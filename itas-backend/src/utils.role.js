import { verifyAccess } from "./utils.js"

export function requireRole(...allowed) {
  return (req, res, next) => {
    try {
      const auth = req.headers.authorization || ""
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
      if (!token) return res.status(401).json({ message: "Unauthorized" })
      const payload = verifyAccess(token) // { sub, email, role }
      req.user = payload
      if (allowed.length && !allowed.includes(payload.role)) {
        return res.status(403).json({ message: "Forbidden" })
      }
      next()
    } catch {
      return res.status(401).json({ message: "Unauthorized" })
    }
  }
}