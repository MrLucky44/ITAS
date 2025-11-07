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

// REGISTER → immediately require 2FA setup
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {}
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Ad, e-posta ve şifre zorunludur.' })
    }
    const hash = await bcrypt.hash(password, 10)
    const user = createUser({ name, email, passwordHash: hash })

    // issue tokens so client can call /auth/2fa/setup (requires auth)
    const { accessToken, refreshToken } = signTokens({ sub: user.id, email: user.email, role: user.role })
    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        twoFAEnabled: !!user.twoFAEnabled, twoFASetupRequired: !!user.twoFASetupRequired
      },
      requires2FASetup: true
    })
  } catch (e) {
    if (e.message === 'exists') return res.status(409).json({ message: 'Bu e-posta zaten kayıtlı.' })
    console.error(e)
    res.status(500).json({ message: 'Kayıt başarısız' })
  }
})

// LOGIN → if 2FA enabled: 2FA login, if setup required: force setup
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  const user = email ? findUserByEmail(email) : null
  if (!user) return res.status(401).json({ message: 'Geçersiz kimlik bilgileri' })
  const ok = await bcrypt.compare(password || '', user.passwordHash)
  if (!ok) return res.status(401).json({ message: 'Geçersiz kimlik bilgileri' })

  // 2FA already enabled → go through 2FA login flow
  if (user.twoFAEnabled && user.twoFASecret) {
    const tempToken = jwt.sign({ sub: user.id, twoFAStage: true }, process.env.JWT_ACCESS_SECRET || 'access_secret', { expiresIn: '3m' })
    return res.json({ requires2FA: true, tempToken })
  }

  // 2FA setup still required → send tokens but force client to setup page
  if (user.twoFASetupRequired) {
    const { accessToken, refreshToken } = signTokens({ sub: user.id, email: user.email, role: user.role })
    return res.json({
      accessToken, refreshToken,
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        twoFAEnabled: !!user.twoFAEnabled, twoFASetupRequired: !!user.twoFASetupRequired
      },
      requires2FASetup: true
    })
  }

  // plain login
  const { accessToken, refreshToken } = signTokens({ sub: user.id, email: user.email, role: user.role })
  res.json({
    accessToken, refreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role,
      twoFAEnabled: !!user.twoFAEnabled, twoFASetupRequired: !!user.twoFASetupRequired }
  })
})

// 2FA LOGIN VERIFY
router.post('/2fa/login', (req, res) => {
  const { code, tempToken } = req.body || {}
  if (!code || !tempToken) return res.status(400).json({ message: 'Eksik veri' })

  try {
    const payload = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET || 'access_secret')
    if (!payload?.twoFAStage) return res.status(401).json({ message: 'Unauthorized' })
    const user = findUserById(payload.sub)
    if (!user || !user.twoFASecret) return res.status(401).json({ message: 'Unauthorized' })

    const ok = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: 'base32',
      token: code,
      window: 1,
    })
    if (!ok) return res.status(400).json({ message: 'Kod geçersiz' })

    const tokens = signTokens({ sub: user.id, email: user.email, role: user.role })
    return res.json({ ...tokens, user: {
      id: user.id, email: user.email, name: user.name, role: user.role,
      twoFAEnabled: !!user.twoFAEnabled, twoFASetupRequired: !!user.twoFASetupRequired
    } })
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
})

// 2FA SETUP (protected)
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

// 2FA VERIFY (protected) → mark setup complete
router.post('/2fa/verify', (req, res) => {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  let payload
  try { payload = verifyAccess(token) } catch { return res.status(401).json({ message: 'Unauthorized' }) }

  const user = findUserById(payload.sub)
  if (!user || !user.twoFASetupTemp) return res.status(400).json({ message: 'Önce setup çağrılmalı' })

  const { code } = req.body || {}
  const ok = speakeasy.totp.verify({
    secret: user.twoFASetupTemp,
    encoding: 'base32',
    token: code,
    window: 1,
  })
  if (!ok) return res.status(400).json({ message: 'Kod geçersiz' })

  updateUserById(user.id, {
    twoFAEnabled: true,
    twoFASecret: user.twoFASetupTemp,
    twoFASetupTemp: null,
    twoFASetupRequired: false
  })
  res.json({ ok: true })
})

/**
 * FORGOT → Always respond immediately to avoid ERR_EMPTY_RESPONSE,
 * then send the email asynchronously. If the email is not registered,
 * we still return { ok: true } (no user enumeration).
 */
router.post('/forgot', async (req, res) => {
  const { email } = req.body || {}
  const user = email ? findUserByEmail(email) : null

  // Prepare token (store only if user exists)
  const token = crypto.randomBytes(32).toString('hex')
  const exp = new Date(Date.now() + 15 * 60 * 1000)
  if (user) setResetToken(email, token, exp.toISOString())

  const appUrl = process.env.APP_WEB_URL || 'http://localhost:5173'
  const resetUrl = `${appUrl}/reset?token=${token}`
  console.log('[RESET LINK]', resetUrl)

  // 1) Respond immediately so the client never sees ERR_EMPTY_RESPONSE
  if (!res.headersSent) res.json({ ok: true })

  // 2) Send email after responding (fire-and-forget)
  setImmediate(async () => {
    try {
      // Only try to send if the user exists
      if (!user) return

      const transporter = req.app.locals.transporter
      if (!transporter) {
        console.error('[SMTP] transporter not available')
        return
      }

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
      console.log('[SMTP ACCEPTED]', info.accepted)
      console.log('[SMTP RESPONSE]', info.response)
    } catch (err) {
      console.error('[SMTP SEND ERROR]', err?.response || err?.message || err)
    }
  })
})

// RESET PASSWORD
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

// ME includes flags
router.get('/me', (req, res) => {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const payload = verifyAccess(token)
    const user = findUserById(payload.sub)
    if (!user) return res.status(401).json({ message: 'Unauthorized' })
    res.json({
      id: user.id, email: user.email, name: user.name, role: user.role,
      twoFAEnabled: !!user.twoFAEnabled, twoFASetupRequired: !!user.twoFASetupRequired
    })
  } catch (e) { return res.status(401).json({ message: 'Unauthorized' }) }
})

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body || {}
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken zorunlu' })
  try {
    const payload = verifyRefresh(refreshToken)
    const user = findUserById(payload.sub)
    if (!user) return res.status(401).json({ message: 'Unauthorized' })
    const tokens = signTokens({ sub: user.id, email: user.email, role: user.role })
    res.json(tokens)
  } catch (e) { res.status(401).json({ message: 'Unauthorized' }) }
})

router.post('/logout', (req, res) => { res.json({ ok: true }) })

export default router