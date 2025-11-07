import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

const ACCESS_EXPIRES_IN = process.env.ACCESS_EXPIRES_IN || '15m'
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '30d'

export function signTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'access_secret', { expiresIn: ACCESS_EXPIRES_IN })
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refresh_secret', { expiresIn: REFRESH_EXPIRES_IN })
  return { accessToken, refreshToken }
}

export function verifyAccess(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'access_secret')
}

export function verifyRefresh(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'refresh_secret')
}
