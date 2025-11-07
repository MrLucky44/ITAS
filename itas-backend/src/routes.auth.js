import { Router } from 'express'
import bcrypt from 'bcryptjs'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import {
  findUserByEmail, createUser, findUserById,
  updateUserById, setResetToken, findUserByResetToken
} from './db.js'
import { signTokens, verifyAccess, verifyRefresh } from './utils.js'

const router = Router()
const ROLES = ['client', 'developer', 'employer']

/* ---------- one-click approve/deny link helpers (local to this file) ---------- */
const ACTION_LINK_SECRET = process.env.ACTION_LINK_SECRET || 'dev_action_secret'
const ACTION_LINK_TTL = Number(process.env.ACTION_LINK_TTL || 172800) // 48h

function signRoleActionToken({ userId, requestedRole, action }) {
  // action: "approve" | "deny"
  const payload = { sub: userId, act: action, req: requestedRole }
  return jwt.sign(payload, ACTION_LINK_SECRET, { expiresIn: ACTION_LINK_TTL })
}

/* -------------------------------- REGISTER ---------------------------------- */
/**
 * REGISTER
 * - Everyone picks a desired role -> stored as requestedRole
 * - Account is created with role='client', approved=false
 * - ITAS Support is emailed about the request (async) WITH Approve/Deny buttons
 * - No tokens returned (user is NOT logged in)
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {}
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Ad, e-posta ve şifre zorunludur.' })
    }
    const requestedRole = ROLES.includes(role) ? role : 'client'

    const hash = await bcrypt.hash(password, 10)
    const user = createUser({
      name, email, passwordHash: hash,
      role: 'client',
      requestedRole,
      approved: false,
      twoFASetupRequired: false, // 2FA ilk girişte zorunlu kılınacak
    })

    // Notify Support WITH approve/deny links
    setImmediate(async () => {
      try {
        const t = req.app.locals.transporter
        if (!t) return console.error('[SMTP] transporter not available')

        const approveToken = signRoleActionToken({ userId: user.id, requestedRole, action: 'approve' })
        const denyToken = signRoleActionToken({ userId: user.id, requestedRole, action: 'deny' })
        const apiBase = process.env.APP_API_URL || 'http://127.0.0.1:3000/api'
        const approveUrl = `${apiBase}/admin/role-action?token=${approveToken}`
        const denyUrl = `${apiBase}/admin/role-action?token=${denyToken}`

        const to = process.env.SUPPORT_TO || process.env.SMTP_USER
        const from = process.env.SUPPORT_FROM || `ITAS Support <${process.env.SMTP_USER}>`
        await t.sendMail({
          from, to,
          subject: `[ITAS] Yeni rol talebi: ${requestedRole} (${email})`,
          html: `
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
              <h2>Yeni Rol Talebi</h2>
              <p><b>Kullanıcı:</b> ${name} &lt;${email}&gt;</p>
              <p><b>Talep Edilen Rol:</b> ${requestedRole}</p>
              <p><b>Kullanıcı ID:</b> ${user.id}</p>
              <p style="margin:16px 0">Bu talebi doğrudan onaylamak ya da reddetmek için:</p>
              <p>
                <a href="${approveUrl}"
                   style="display:inline-block;margin-right:8px;padding:10px 14px;background:#111;color:#fff;border-radius:8px;text-decoration:none">
                  Onayla
                </a>
                <a href="${denyUrl}"
                   style="display:inline-block;padding:10px 14px;border:1px solid #ddd;border-radius:8px;text-decoration:none;color:#111">
                  Reddet
                </a>
              </p>
              <p style="color:#777;font-size:12px;margin-top:12px">
                Linkler ${Math.floor(ACTION_LINK_TTL/3600)} saat içinde geçerlidir.
              </p>
            </div>
          `,
          text:
`Yeni Rol Talebi

Kullanıcı: ${name} <${email}>
Talep Edilen Rol: ${requestedRole}
Kullanıcı ID: ${user.id}

Onayla: ${approveUrl}
Reddet: ${denyUrl}
(Geçerlilik: ${Math.floor(ACTION_LINK_TTL/3600)} saat)`,
        })
        console.log('[SUPPORT MAIL] role request sent to', to)
      } catch (e) {
        console.error('[SUPPORT MAIL ERROR]', e?.message || e)
      }
    })

    // Return info; NO tokens
    return res.json({
      ok: true,
      info: 'Hesabınız inceleniyor. Onay sonrası giriş yapabilirsiniz.',
    })
  } catch (e) {
    if (e.message === 'exists') return res.status(409).json({ message: 'Bu e-posta zaten kayıtlı.' })
    console.error(e)
    res.status(500).json({ message: 'Kayıt başarısız' })
  }
})

/* --------------------------------- LOGIN ------------------------------------ */
/**
 * LOGIN
 * - Optional UI role must match granted role
 * - If 2FA already enabled -> issue tempToken for stage-2
 * - If 2FA not enabled yet -> on FIRST login flip twoFASetupRequired=true and force setup
 */
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body || {}
  const user = email ? findUserByEmail(email) : null
  if (!user) return res.status(401).json({ message: 'Geçersiz kimlik bilgileri' })

  const ok = await bcrypt.compare(password || '', user.passwordHash)
  if (!ok) return res.status(401).json({ message: 'Geçersiz kimlik bilgileri' })

  // Optional: if UI sends desired role at login, enforce it matches granted role
  if (role && role !== user.role) {
    return res.status(403).json({ message: `Bu hesap rolü '${user.role}'.` })
  }

  // If 2FA already enabled -> go to code step (NOT setup)
  if (user.twoFAEnabled && user.twoFASecret) {
    const tempToken = jwt.sign(
      { sub: user.id, twoFAStage: true },
      process.env.JWT_ACCESS_SECRET || 'access_secret',
      { expiresIn: '3m' }
    )
    return res.json({ requires2FA: true, tempToken })
  }

  // FIRST SUCCESSFUL LOGIN: user has no secret yet -> force setup NOW
  if (!user.twoFAEnabled && !user.twoFASecret && !user.twoFASetupRequired) {
    updateUserById(user.id, { twoFASetupRequired: true })
    user.twoFASetupRequired = true           // <<< important: mutate local copy
  }

  // Because we mutated local `user`, this triggers on the same request
  if (user.twoFASetupRequired) {
    const tokens = signTokens({ sub: user.id, email: user.email, role: user.role })
    return res.json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        approved: !!user.approved,
        requestedRole: user.requestedRole || null,
        twoFAEnabled: !!user.twoFAEnabled,
        twoFASetupRequired: true
      },
      requires2FASetup: true
    })
  }

  // (fallback) plain login
  const tokens = signTokens({ sub: user.id, email: user.email, role: user.role })
  return res.json({ ...tokens, user: {
    id: user.id, email: user.email, name: user.name, role: user.role,
    approved: !!user.approved, requestedRole: user.requestedRole || null,
    twoFAEnabled: !!user.twoFAEnabled, twoFASetupRequired: !!user.twoFASetupRequired
  }})
})
/* ------------------------------ 2FA LOGIN VERIFY ---------------------------- */
router.post('/2fa/login', (req, res) => {
  const { code, tempToken } = req.body || {}
  if (!code || !tempToken) {
    return res.status(400).json({ message: 'Eksik veri' })
  }

  try {
    const payload = jwt.verify(
      tempToken,
      process.env.JWT_ACCESS_SECRET || 'access_secret'
    )
    if (!payload?.twoFAStage) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const user = findUserById(payload.sub)
    if (!user || !user.twoFASecret) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    // normalize and validate the code
    const raw = String(code).trim().replace(/\s+/g, '')
    if (!/^\d{6}$/.test(raw)) {
      return res.status(400).json({ message: 'Kod geçersiz' })
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: 'base32',
      token: raw,
      step: 30,
      window: 2, // small clock drift tolerance
    })

    if (!valid) {
      return res.status(400).json({ message: 'Kod geçersiz' })
    }

    // ensure flags are consistent after successful 2FA
    if (!user.twoFAEnabled || user.twoFASetupRequired) {
      updateUserById(user.id, {
        twoFAEnabled: true,
        twoFASetupRequired: false,
        last2FAVerifiedAt: new Date().toISOString(),
      })
      // also reflect on the in-memory copy for this response
      user.twoFAEnabled = true
      user.twoFASetupRequired = false
    } else {
      // still store the timestamp for auditing if you like
      updateUserById(user.id, { last2FAVerifiedAt: new Date().toISOString() })
    }

    const tokens = signTokens({ sub: user.id, email: user.email, role: user.role })
    return res.json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        approved: !!user.approved,
        requestedRole: user.requestedRole || null,
        twoFAEnabled: !!user.twoFAEnabled,
        twoFASetupRequired: !!user.twoFASetupRequired,
      },
    })
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
})

/* -------------------------------- 2FA SETUP --------------------------------- */
router.post('/2fa/setup', (req, res) => {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })

  let payload
  try { payload = verifyAccess(token) } catch { return res.status(401).json({ message: 'Unauthorized' }) }

  const user = findUserById(payload.sub)
  if (!user) return res.status(401).json({ message: 'Unauthorized' })

  const secret = speakeasy.generateSecret({ name: `ITAS (${user.email})`, length: 20 })
  QRCode.toDataURL(secret.otpauth_url, (err, dataURL) => {
    if (err) return res.status(500).json({ message: 'QR üretilemedi' })
    updateUserById(user.id, { twoFASetupTemp: secret.base32 })
    res.json({ qr: dataURL, secret: secret.base32 })
  })
})

/* ------------------------------- 2FA VERIFY -------------------------------- */
// 2FA VERIFY (protected) → idempotent and clears temp secret
router.post('/2fa/verify', (req, res) => {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })

  let payload
  try { payload = verifyAccess(token) } catch { return res.status(401).json({ message: 'Unauthorized' }) }

  const user = findUserById(payload.sub)
  if (!user) return res.status(401).json({ message: 'Unauthorized' })

  // Already completed setup → idempotent success
  if (user.twoFAEnabled && user.twoFASecret && !user.twoFASetupTemp) {
    return res.status(409).json({ alreadyEnabled: true, message: '2FA zaten etkin.' })
  }

  if (!user.twoFASetupTemp) {
    return res.status(400).json({ message: 'Önce setup çağrılmalı' })
  }

  const raw = (req.body?.code ?? '').toString().trim().replace(/\s+/g, '')
  const ok = speakeasy.totp.verify({
    secret: user.twoFASetupTemp,
    encoding: 'base32',
    token: raw,
    step: 30,
    window: 2,
  })
  if (!ok) return res.status(400).json({ message: 'Kod geçersiz' })

  // ✅ finalize setup: persist secret, clear temp, flip flags
  updateUserById(user.id, {
    twoFAEnabled: true,
    twoFASecret: user.twoFASetupTemp,
    twoFASetupTemp: null,
    twoFASetupRequired: false,
  })

  return res.json({ ok: true })
})

/* --------------------------------- FORGOT ----------------------------------- */
/**
 * Respond immediately (prevents ERR_EMPTY_RESPONSE)
 * Email is sent async (only if user exists)
 */
router.post('/forgot', async (req, res) => {
  const { email } = req.body || {}
  const user = email ? findUserByEmail(email) : null

  const token = crypto.randomBytes(32).toString('hex')
  const exp = new Date(Date.now() + 15 * 60 * 1000)
  if (user) setResetToken(email, token, exp.toISOString())

  const appUrl = process.env.APP_WEB_URL || 'http://localhost:5173'
  const resetUrl = `${appUrl}/reset?token=${token}`
  console.log('[RESET LINK]', resetUrl)

  if (!res.headersSent) res.json({ ok: true })

  setImmediate(async () => {
    try {
      if (!user) return
      const transporter = req.app.locals.transporter
      if (!transporter) return console.error('[SMTP] transporter not available')

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `ITAS <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'ITAS Parola Sıfırlama',
        html: `
          <p>Parolanızı sıfırlamak için <a href="${resetUrl}">buraya tıklayın</a>.</p>
          <p>Bu bağlantı <strong>15 dakika</strong> geçerlidir.</p>
        `,
        headers: { 'X-ITAS': 'forgot' },
      })
      console.log('[SMTP SENT]', info.messageId)
    } catch (err) {
      console.error('[SMTP SEND ERROR]', err?.response || err?.message || err)
    }
  })
})

/* ---------------------------------- RESET ----------------------------------- */
router.post('/reset', async (req, res) => {
  const { token, password } = req.body || {}
  if (!token || !password) return res.status(400).json({ message: 'Geçersiz istek' })

  const user = findUserByResetToken(token)
  if (!user) return res.status(400).json({ message: 'Token geçersiz' })
  if (!user.resetTokenExp || new Date(user.resetTokenExp) < new Date()) {
    return res.status(400).json({ message: 'Token süresi dolmuş' })
  }

  const hash = await bcrypt.hash(password, 10)
  updateUserById(user.id, { passwordHash: hash, resetToken: null, resetTokenExp: null })
  return res.json({ ok: true })
})

/* ------------------------------------ ME ------------------------------------ */
router.get('/me', (req, res) => {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const payload = verifyAccess(token)
    const user = findUserById(payload.sub)
    if (!user) return res.status(401).json({ message: 'Unauthorized' })
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      approved: !!user.approved,
      requestedRole: user.requestedRole || null,
      twoFAEnabled: !!user.twoFAEnabled,
      twoFASetupRequired: !!user.twoFASetupRequired
    })
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
})

/* --------------------------------- REFRESH ---------------------------------- */
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body || {}
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken zorunlu' })
  try {
    const payload = verifyRefresh(refreshToken)
    const user = findUserById(payload.sub)
    if (!user) return res.status(401).json({ message: 'Unauthorized' })
    const tokens = signTokens({ sub: user.id, email: user.email, role: user.role })
    res.json(tokens)
  } catch {
    res.status(401).json({ message: 'Unauthorized' })
  }
})

router.post('/logout', (req, res) => { res.json({ ok: true }) })

export default router