import nodemailer from "nodemailer"
import dotenv from "dotenv"
dotenv.config()

async function createTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT || 587)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // true if SSL
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    await transporter.verify()
    console.log("[SMTP] Transporter verified ✅")
    return transporter
  } else {
    // fallback: Ethereal (test only)
    const testAcc = await nodemailer.createTestAccount()
    const transporter = nodemailer.createTransport({
      host: testAcc.smtp.host,
      port: testAcc.smtp.port,
      secure: testAcc.smtp.secure,
      auth: {
        user: testAcc.user,
        pass: testAcc.pass,
      },
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

const app = express()
app.use(helmet())
app.use(morgan("dev"))
app.use(express.json())
app.use(cookieParser())
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:5173"],
  credentials: true,
}))

// attach transporter to app.locals
createTransporter().then(t => { app.locals.transporter = t })

// routes
app.use("/api/auth", authRoutes)
app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }))
// expose current backend port for frontend auto-detection
app.get("/api/dev/port", (req, res) => {
  // Express doesn't know its own port until after listen(),
  // so we use the environment base + optional proxy info
  const port = Number(process.env.PORT || 3000)
  res.json({
    ok: true,
    port,
    apiUrl: `http://localhost:${port}/api`,
  })
})
// --- auto-port start ---
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
// --- auto-port end ---