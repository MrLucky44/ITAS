// src/db.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataPath = path.resolve(__dirname, '../data/users.json')

function ensureFile() {
  if (!fs.existsSync(dataPath)) {
    const initial = { users: [] }
    fs.mkdirSync(path.dirname(dataPath), { recursive: true })
    fs.writeFileSync(dataPath, JSON.stringify(initial, null, 2))
  }
}

function readDB() {
  ensureFile()
  const raw = fs.readFileSync(dataPath, 'utf-8')
  try { return JSON.parse(raw) } catch { return { users: [] } }
}

function writeDB(db) {
  fs.writeFileSync(dataPath, JSON.stringify(db, null, 2))
}

/** Queries **/
export function findUserByEmail(email) {
  const db = readDB()
  return db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase()) || null
}

export function findUserById(id) {
  const db = readDB()
  return db.users.find(u => u.id === id) || null
}

export function findUserByResetToken(token) {
  const db = readDB()
  return db.users.find(u => u.resetToken === token) || null
}

/** Mutations **/
export function createUser({
  name,
  email,
  passwordHash,
  // actual granted role at creation time — always 'client' for inspection flow
  role = 'client',
  // what user asked for on signup: 'client' | 'developer' | 'employer'
  requestedRole = 'client',
  twoFASetupRequired = false
}) {
  const db = readDB()
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    const e = new Error('exists'); throw e
  }

  const id = 'u' + Math.random().toString(36).slice(2, 9)
  const now = new Date().toISOString()

  const user = {
    id,
    name,
    email,
    passwordHash,
    role,                   // actual, minimal perms at start ('client')
    requestedRole,          // desired role to be inspected
    approved: false,        // unified inspection: starts false

    createdAt: now,
    updatedAt: now,

    // 2FA fields
    twoFAEnabled: false,
    twoFASecret: null,
    twoFASetupTemp: null,
    twoFASetupRequired,     // force setup after register

    // password reset fields
    resetToken: null,
    resetTokenExp: null
  }

  db.users.push(user)
  writeDB(db)
  return user
}

export function updateUserById(id, patch) {
  const db = readDB()
  const idx = db.users.findIndex(u => u.id === id)
  if (idx === -1) return null
  db.users[idx] = {
    ...db.users[idx],
    ...patch,
    updatedAt: new Date().toISOString()
  }
  writeDB(db)
  return db.users[idx]
}

export function setResetToken(email, token, expISO) {
  const db = readDB()
  const idx = db.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase())
  if (idx === -1) return null
  db.users[idx].resetToken = token
  db.users[idx].resetTokenExp = expISO
  db.users[idx].updatedAt = new Date().toISOString()
  writeDB(db)
  return db.users[idx]
}

/** (Optional) helpers for admin listing pending requests */
export function listPendingRoleRequests() {
  const db = readDB()
  return db.users.filter(u => !!u.requestedRole && u.approved === false)
}