import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataPath = path.resolve(__dirname, '../data/users.json')

function readDB() {
  if (!fs.existsSync(dataPath)) return { users: [] }
  const raw = fs.readFileSync(dataPath, 'utf-8')
  try { return JSON.parse(raw) } catch { return { users: [] } }
}

function writeDB(db) {
  fs.writeFileSync(dataPath, JSON.stringify(db, null, 2))
}

export function findUserByEmail(email) {
  const db = readDB()
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null
}

export function createUser({ name, email, passwordHash, role = 'customer' }) {
  const db = readDB()
  if (db.users.some(u => u.email.toLowerCase() == email.toLowerCase())) {
    throw new Error('exists')
  }
  const id = 'u' + Math.random().toString(36).slice(2, 9)
  const user = {
    id, name, email, passwordHash, role,
    createdAt: new Date().toISOString(),

    // 2FA defaults for mandatory setup
    twoFAEnabled: false,
    twoFASecret: null,
    twoFASetupTemp: null,
    twoFASetupRequired: true
  }
  db.users.push(user)
  writeDB(db)
  return user
}

export function findUserById(id) {
  const db = readDB()
  return db.users.find(u => u.id === id) || null
}

export function updateUserById(id, patch) {
  const db = readDB()
  const idx = db.users.findIndex(u => u.id === id)
  if (idx === -1) return null
  db.users[idx] = { ...db.users[idx], ...patch }
  writeDB(db)
  return db.users[idx]
}

export function setResetToken(email, token, expISO) {
  const db = readDB()
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase())
  if (!user) return null
  user.resetToken = token
  user.resetTokenExp = expISO
  writeDB(db)
  return user
}

export function findUserByResetToken(token) {
  const db = readDB()
  return db.users.find(u => u.resetToken === token) || null
}