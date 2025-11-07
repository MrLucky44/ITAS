// src/server.js
import nodemailer from "nodemailer"
import dotenv from "dotenv"
dotenv.config()

async function createTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT || 587)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // SSL only on 465
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      logger: true,
      debug: true,
    })
    await transporter.verify()
    console.log("[SMTP] Transporter verified ✅")
    return transporter
  } else {
    // fallback: Ethereal (test only, not delivered to real inbox)
    const testAcc = await nodemailer.createTestAccount()
    const transporter = nodemailer.createTransport({
      host: testAcc.smtp.host,
      port: testAcc.smtp.port,
      secure: testAcc.smtp.secure,
      auth: { user: testAcc.user, pass: testAcc.pass },
    })
    console.warn("[SMTP] Using Ethereal test account")
    return transporter
  }
}

// create Express app
import express from "express"
import morgan from "morgan"
import helmet from "helmet"
import cors from "cors"
import cookieParser from "cookie-parser"
import authRoutes from "./routes.auth.js"

// NEW: admin helpers
import fs from "fs"
import path from "path"
import jwt from "jsonwebtoken"
import { fileURLToPath } from "url"
import { requireRole } from "./utils.role.js"
import { findUserById, updateUserById } from "./db.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const usersJsonPath = path.resolve(__dirname, "../data/users.json")

// one-click link verify (approve/deny)
const ACTION_LINK_SECRET = process.env.ACTION_LINK_SECRET || "dev_action_secret"

function verifyRoleActionToken(token) {
  return jwt.verify(token, ACTION_LINK_SECRET)
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, '&quot;')
}

function renderHtml(title, body) {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; padding: 28px; color: #111; }
  .card { max-width: 680px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; background: #fff; }
  .t { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
  .b { color: #374151; }
  .hint { margin-top: 12px; font-size: 12px; color: #6b7280; }
</style>
</head>
<body>
  <div class="card">
    <h1 class="t">${escapeHtml(title)}</h1>
    <div class="b">${body}</div>
    <div class="hint">Bu sayfayı kapatabilirsiniz.</div>
  </div>
</body></html>`
}

const app = express()
app.use(helmet())
app.use(morgan("dev"))
app.use(express.json())
app.use(cookieParser())
app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN?.split(",") ||
      ["http://127.0.0.1:5173", "http://localhost:5173"],
    credentials: true,
  })
)

// attach transporter to app.locals
createTransporter().then((t) => {
  app.locals.transporter = t
})

// routes
app.use("/api/auth", authRoutes)

app.get("/api/health", (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
)

// expose current backend port for frontend auto-detection
app.get("/api/dev/port", (req, res) => {
  const port = Number(process.env.PORT || 3000)
  // use 127.0.0.1 to avoid odd localhost/CORS issues
  res.json({ ok: true, port, apiUrl: `http://127.0.0.1:${port}/api` })
})

/* ---------------- One-click Approve/Deny from Gmail ---------------- */
/**
 * GET /api/admin/role-action?token=...
 * Token is signed & time-limited; no auth header required.
 */
app.get("/api/admin/role-action", async (req, res) => {
  // prevent 304 caching
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store",
  })

  const token = req.query.token
  if (!token) {
    return res.status(400).send(renderHtml("Hatalı istek", "Token bulunamadı."))
  }

  try {
    const payload = verifyRoleActionToken(token) // { sub, act, req, iat, exp }
    const user = findUserById(payload.sub)
    if (!user) {
      return res.status(404).send(renderHtml("Bulunamadı", "Kullanıcı bulunamadı."))
    }

    const t = req.app.locals.transporter
    if (!t) console.error("[SMTP] transporter not available at role-action")

    console.log("[ROLE-ACTION] act=%s req=%s user=%s", payload.act, payload.req, user.email)

    if (payload.act === "approve") {
      const newRole = payload.req
      updateUserById(user.id, { role: newRole, requestedRole: null, approved: true })

      if (t) {
        try {
          const info = await t.sendMail({
            from: process.env.SMTP_FROM || `ITAS Support <${process.env.SMTP_USER}>`,
            to: user.email, // <<< send to the USER
            subject: "ITAS Rolünüz Onaylandı",
            text: `Merhaba ${user.name || ""}, talep ettiğiniz '${payload.req}' rolünüz onaylandı.`,
            headers: { "X-ITAS": "role-approved" },
          })
          console.log("[APPROVAL MAIL SENT] to=%s id=%s accepted=%j resp=%s",
            user.email, info.messageId, info.accepted, info.response)
        } catch (e) {
          console.error("[APPROVAL MAIL ERROR]", e?.response || e?.message || e)
        }
      }

      return res.status(200).send(
        renderHtml(
          "Onaylandı ✅",
          `Kullanıcı <b>${escapeHtml(user.email)}</b> artık <b>${escapeHtml(newRole)}</b> olarak onaylandı.`
        )
      )
    }

    if (payload.act === "deny") {
      updateUserById(user.id, { requestedRole: null, approved: false })

      if (t) {
        try {
          const info = await t.sendMail({
            from: process.env.SMTP_FROM || `ITAS Support <${process.env.SMTP_USER}>`,
            to: user.email, // <<< send to the USER
            subject: "ITAS Rol Talebiniz Reddedildi",
            text: `Merhaba ${user.name || ""}, talep ettiğiniz '${payload.req}' rolünüz reddedildi.`,
            headers: { "X-ITAS": "role-denied" },
          })
          console.log("[DENY MAIL SENT] to=%s id=%s accepted=%j resp=%s",
            user.email, info.messageId, info.accepted, info.response)
        } catch (e) {
          console.error("[DENY MAIL ERROR]", e?.response || e?.message || e)
        }
      }

      return res.status(200).send(
        renderHtml(
          "Reddedildi ❌",
          `Kullanıcı <b>${escapeHtml(user.email)}</b> rol talebi reddedildi.`
        )
      )
    }

    return res.status(400).send(renderHtml("Hatalı istek", "Geçersiz işlem."))
  } catch (e) {
    return res.status(400).send(renderHtml("Token Geçersiz", "Bağlantı süresi dolmuş veya geçersiz."))
  }
})
/* ---------------- Admin: role approval list & actions (UI) ---------------- */

// List pending role requests (users with requestedRole and not approved)
/* ---------------- One-click Approve/Deny from Gmail ---------------- */
/**
 * GET /api/admin/role-action?token=...
 * Token is signed & time-limited; no auth header required.
 */
app.get("/api/admin/role-action", async (req, res) => {
  // 🔒 never cache this action
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store",
  })

  const token = req.query.token
  if (!token) {
    return res.status(400).send(renderHtml("Hatalı istek", "Token bulunamadı."))
  }

  try {
    const payload = verifyRoleActionToken(token) // { sub, act, req, iat, exp }
    const user = findUserById(payload.sub)
    if (!user) {
      return res.status(404).send(renderHtml("Bulunamadı", "Kullanıcı bulunamadı."))
    }

    const t = req.app.locals.transporter
    if (!t) console.error("[SMTP] transporter not available at role-action")

    if (payload.act === "approve") {
      const newRole = payload.req
      updateUserById(user.id, { role: newRole, requestedRole: null, approved: true })

      if (t) {
        try {
          const info = await t.sendMail({
            from: process.env.SMTP_FROM || `ITAS Support <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: "ITAS Rolünüz Onaylandı",
            text: `Merhaba ${user.name || ""}, talep ettiğiniz '${payload.req}' rolünüz onaylandı.`,
            headers: { "X-ITAS": "role-approved" },
          })
          console.log("[APPROVAL MAIL SENT]", info.messageId, info.accepted, info.response)
        } catch (e) {
          console.error("[APPROVAL MAIL ERROR]", e?.response || e?.message || e)
        }
      }

      return res.status(200).send(
        renderHtml("Onaylandı ✅",
          `Kullanıcı <b>${escapeHtml(user.email)}</b> artık <b>${escapeHtml(newRole)}</b> olarak onaylandı.`)
      )
    }

    if (payload.act === "deny") {
      updateUserById(user.id, { requestedRole: null, approved: false })

      if (t) {
        try {
          const info = await t.sendMail({
            from: process.env.SMTP_FROM || `ITAS Support <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: "ITAS Rol Talebiniz Reddedildi",
            text: `Merhaba ${user.name || ""}, talep ettiğiniz '${payload.req}' rolünüz reddedildi.`,
            headers: { "X-ITAS": "role-denied" },
          })
          console.log("[DENY MAIL SENT]", info.messageId, info.accepted, info.response)
        } catch (e) {
          console.error("[DENY MAIL ERROR]", e?.response || e?.message || e)
        }
      }

      return res.status(200).send(
        renderHtml("Reddedildi ❌",
          `Kullanıcı <b>${escapeHtml(user.email)}</b> rol talebi reddedildi.`)
      )
    }

    return res.status(400).send(renderHtml("Hatalı istek", "Geçersiz işlem."))
  } catch (e) {
    return res.status(400).send(renderHtml("Token Geçersiz", "Bağlantı süresi dolmuş veya geçersiz."))
  }
})

// Approve: set role, clear requestedRole, approved=true
app.put(
  "/api/admin/users/:id/role",
  requireRole("admin", "employer"),
  (req, res) => {
    const { id } = req.params
    const { role } = req.body || {}
    const allowed = ["client", "developer", "employer"]
    if (!allowed.includes(role))
      return res.status(400).json({ message: "Geçersiz rol" })

    // Policy example: only admin can grant 'employer'
    if (role === "employer" && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Employer onayı sadece admin tarafından verilir" })
    }

    const user = findUserById(id)
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" })
    updateUserById(id, { role, requestedRole: null, approved: true })
    res.json({ ok: true })
  }
)

// Deny: clear requestedRole, keep approved=false
app.post(
  "/api/admin/users/:id/role/deny",
  requireRole("admin", "employer"),
  (req, res) => {
    const { id } = req.params
    const user = findUserById(id)
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı" })
    if (!user.requestedRole)
      return res.status(400).json({ message: "Bekleyen talep yok" })
    updateUserById(id, { requestedRole: null, approved: false })
    res.json({ ok: true })
  }
)

/* ---------------- Optional: contact ITAS Support ---------------- */

app.post("/api/support/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {}
    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ message: "Ad, e-posta ve mesaj zorunludur." })
    }
    const t = req.app.locals.transporter
    if (!t) return res.status(500).json({ message: "Mail servisi hazır değil" })

    const to = process.env.SUPPORT_TO || process.env.SMTP_USER
    const from =
      process.env.SUPPORT_FROM || `ITAS Support <${process.env.SMTP_USER}>`

    await t.sendMail({
      from,
      to,
      subject: subject ? `[ITAS Support] ${subject}` : "ITAS Destek İletişim",
      text: `Gönderen: ${name} <${email}>\n\n${message}`,
    })
    res.json({ ok: true })
  } catch (e) {
    console.error("[SUPPORT SEND ERROR]", e?.message || e)
    res.status(500).json({ message: "Gönderilemedi" })
  }
})

/* ---------------- Auto-port boot ---------------- */
const BASE_PORT = Number(process.env.PORT || 3000)
const MAX_TRIES = 20

function startServer(port, tries = 0) {
  const server = app.listen(port, () => {
    console.log(`ITAS backend running on http://localhost:${port}`)
  })

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && tries < MAX_TRIES) {
      const next = port + 1
      console.warn(`[PORT] ${port} in use, trying ${next}...`)
      startServer(next, tries + 1)
    } else {
      console.error(`[PORT] Failed to bind:`, err)
      process.exit(1)
    }
  })
}

startServer(BASE_PORT)