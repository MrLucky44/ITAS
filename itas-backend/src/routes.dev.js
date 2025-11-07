// src/routes.dev.js
import { Router } from "express"
import { verifyAccess } from "./utils.js"
import {
  ensureDevSeed, getTasks, getTask, saveTask,
  getDaily, addDaily, removeDaily
} from "./db.dev.js"

const r = Router()

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return res.status(401).json({ message: "Unauthorized" })
  try {
    req.user = verifyAccess(token) // { sub, email, role }
    // 👉 Seed once per user so they always have demo tasks/logs
    ensureDevSeed(req.user.sub)
    return next()
  } catch {
    return res.status(401).json({ message: "Unauthorized" })
  }
}

/** SUMMARY */
r.get("/summary", requireAuth, (req, res) => {
  const uid = req.user.sub
  const tasks = getTasks(uid)
  const assigned = tasks.length
  const completed = tasks.filter(t => t.status === "tamamlandi").length
  const review = tasks.filter(t => t.status === "incelemede").length
  const score = completed * 10 + review * 5
  res.json({ assigned, completed, review, score })
})

/** TASKS LIST */
r.get("/tasks", requireAuth, (req, res) => {
  res.json(getTasks(req.user.sub))
})

/** TASK DETAIL */
r.get("/tasks/:id", requireAuth, (req, res) => {
  const t = getTask(req.user.sub, req.params.id)
  if (!t) return res.status(404).json({ message: "Görev bulunamadı" })
  res.json(t)
})

/** UPDATE STATUS */
r.put("/tasks/:id/status", requireAuth, (req, res) => {
  const uid = req.user.sub
  const t = getTask(uid, req.params.id)
  if (!t) return res.status(404).json({ message: "Görev bulunamadı" })
  const allowed = ["beklemede", "incelemede", "tamamlandi"]
  const next = req.body?.status
  if (!allowed.includes(next)) return res.status(400).json({ message: "Geçersiz durum" })
  t.status = next
  t.updatedAt = new Date().toISOString()
  saveTask(uid, t)
  res.json({ ok: true })
})

/** ADD TASK LOG */
r.post("/tasks/:id/logs", requireAuth, (req, res) => {
  const uid = req.user.sub
  const t = getTask(uid, req.params.id)
  if (!t) return res.status(404).json({ message: "Görev bulunamadı" })
  const text = String(req.body?.text || "").trim()
  if (!text) return res.status(400).json({ message: "Log metni boş" })

  if (!Array.isArray(t.logs)) t.logs = []
  const item = {
    id: "l" + Math.random().toString(36).slice(2, 8),
    text,
    at: new Date().toISOString(),
    by: req.user?.email || "you",
  }
  t.logs.push(item)
  t.updatedAt = new Date().toISOString()
  saveTask(uid, t)             // 👉 persists to disk
  res.json(item)
})

/** DELETE TASK LOG */
r.delete("/tasks/:id/logs/:logId", requireAuth, (req, res) => {
  const uid = req.user.sub
  const t = getTask(uid, req.params.id)
  if (!t) return res.status(404).json({ message: "Görev bulunamadı" })
  t.logs = (t.logs || []).filter(l => l.id !== req.params.logId)
  t.updatedAt = new Date().toISOString()
  saveTask(uid, t)
  res.json({ ok: true })
})

/** DAILY LOGS */
r.get("/daily-logs", requireAuth, (req, res) => {
  res.json(getDaily(req.user.sub))
})

r.post("/daily-logs", requireAuth, (req, res) => {
  const text = String(req.body?.text || "").trim()
  if (!text) return res.status(400).json({ message: "Metin boş" })
  const item = addDaily(req.user.sub, text)
  res.json(item)
})

r.delete("/daily-logs/:id", requireAuth, (req, res) => {
  removeDaily(req.user.sub, req.params.id)
  res.json({ ok: true })
})

export default r