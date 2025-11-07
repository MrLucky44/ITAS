// src/db.dev.js
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const devPath = path.resolve(__dirname, "../data/dev.json")

function readDev() {
  if (!fs.existsSync(devPath)) return { tasks: [], daily: [] }
  try {
    return JSON.parse(fs.readFileSync(devPath, "utf-8"))
  } catch {
    return { tasks: [], daily: [] }
  }
}

function writeDev(data) {
  fs.mkdirSync(path.dirname(devPath), { recursive: true })
  fs.writeFileSync(devPath, JSON.stringify(data, null, 2))
}

/** Seed once per user so they always have demo data */
export function ensureDevSeed(userId) {
  const db = readDev()
  const has = db.tasks.some(t => t.assigneeId === userId)
  if (!has) {
    const now = Date.now()
    const mk = (idx, title, status) => ({
      id: `t${idx}-${userId.slice(-6)}`,
      title,
      status, // "beklemede" | "incelemede" | "tamamlandi"
      deadline: new Date(now + idx * 86400000).toISOString(),
      assigneeId: userId,
      updatedAt: new Date(now).toISOString(),
      logs: [
        { id: `l${idx}a`, text: "Görev oluşturuldu", at: new Date(now).toISOString(), by: "system" }
      ]
    })
    db.tasks.push(
      mk(1, "Login akışını iyileştir", "beklemede"),
      mk(2, "2FA QR stil düzeni", "incelemede"),
      mk(3, "Parola reset e-postası şablonu", "beklemede"),
    )
    writeDev(db)
  }
  if (!Array.isArray(db.daily)) {
    db.daily = []
    writeDev(db)
  }
}

/** Tasks */
export function getTasks(userId) {
  ensureDevSeed(userId)
  const db = readDev()
  return db.tasks.filter(t => t.assigneeId === userId)
}

export function getTask(userId, taskId) {
  ensureDevSeed(userId)
  const db = readDev()
  const t = db.tasks.find(x => x.id === taskId && x.assigneeId === userId)
  return t ? JSON.parse(JSON.stringify(t)) : null
}

export function saveTask(userId, task) {
  ensureDevSeed(userId)
  const db = readDev()
  const i = db.tasks.findIndex(x => x.id === task.id && x.assigneeId === userId)
  if (i === -1) db.tasks.push(task)
  else db.tasks[i] = task
  writeDev(db)
}

/** Daily logs */
export function getDaily(userId) {
  ensureDevSeed(userId)
  const db = readDev()
  return (db.daily || []).filter(d => d.userId === userId)
}

export function addDaily(userId, text) {
  ensureDevSeed(userId)
  const db = readDev()
  const item = {
    id: "d" + Math.random().toString(36).slice(2, 9),
    userId,
    text: String(text || "").trim(),
    time: new Date().toISOString(),
  }
  if (!Array.isArray(db.daily)) db.daily = []
  db.daily.unshift(item)
  writeDev(db)
  return item
}

export function removeDaily(userId, id) {
  ensureDevSeed(userId)
  const db = readDev()
  db.daily = (db.daily || []).filter(d => !(d.userId === userId && d.id === id))
  writeDev(db)
  return true
}