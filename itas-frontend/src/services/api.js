import axios from "axios"

async function detectBackend() {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && !envUrl.includes("<picked-port>")) return envUrl

  const guessPorts = [3000, 3001, 3002, 3003]
  for (const port of guessPorts) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`)
      if (res.ok) return `http://localhost:${port}/api`
    } catch (_) {}
  }
  console.warn("[API] No backend detected, using 3000")
  return "http://localhost:3000/api"
}

const baseURL = await detectBackend()
const api = axios.create({ baseURL, withCredentials: true })

api.interceptors.request.use((config) => {
  const access = localStorage.getItem("itas_access")
  if (access) config.headers.Authorization = `Bearer ${access}`
  return config
})

export default api