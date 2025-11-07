// src/utils.action.js
import jwt from "jsonwebtoken"

const ACTION_LINK_SECRET = process.env.ACTION_LINK_SECRET || "dev_action_secret"
const ACTION_LINK_TTL = Number(process.env.ACTION_LINK_TTL || 172800) // 48h

export function signRoleActionToken({ userId, requestedRole, action }) {
  // action: "approve" | "deny", requestedRole: "client" | "developer" | "employer"
  const payload = { sub: userId, act: action, req: requestedRole }
  const token = jwt.sign(payload, ACTION_LINK_SECRET, { expiresIn: ACTION_LINK_TTL })
  return token
}

export function verifyRoleActionToken(token) {
  return jwt.verify(token, ACTION_LINK_SECRET)
}