// src/stores/auth.js
import { defineStore } from "pinia"
import api from "@/services/api"

const LS = {
  ACCESS: "itas_access",
  REFRESH: "itas_refresh",
  USER: "itas_user",
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: JSON.parse(localStorage.getItem(LS.USER) || "null"),
    token: localStorage.getItem(LS.ACCESS) || null,
    refreshToken: localStorage.getItem(LS.REFRESH) || null,
    loading: false,
    error: null,
  }),
  getters: {
    isAuthenticated: (s) => !!s.token,
  },
  actions: {
    setTokens(access, refresh) {
      this.token = access || null
      this.refreshToken = refresh || null
      if (access) localStorage.setItem(LS.ACCESS, access); else localStorage.removeItem(LS.ACCESS)
      if (refresh) localStorage.setItem(LS.REFRESH, refresh); else localStorage.removeItem(LS.REFRESH)
    },
    setUser(u) {
      this.user = u
      if (u) localStorage.setItem(LS.USER, JSON.stringify(u))
      else localStorage.removeItem(LS.USER)
    },

    async register({ name, email, password, role }) {
      this.loading = true; this.error = null
      try {
        const { data } = await api.post("/auth/register", { name, email, password, role })
        // approval flow → backend returns only { ok, info }
        return { ok: !!data?.ok, info: data?.info }
      } catch (e) {
        this.error = e?.response?.data?.message || "Kayıt başarısız"
        return { ok: false }
      } finally { this.loading = false }
    },

    async login({ email, password, role }) {
      this.loading = true; this.error = null
      try {
        const { data } = await api.post("/auth/login", { email, password, role })
        if (data.requires2FA && data.tempToken) {
          // stage-2 login (enter code)
          return { requires2FA: true, tempToken: data.tempToken }
        }
        if (data.accessToken) this.setTokens(data.accessToken, data.refreshToken)
        if (data.user) this.setUser(data.user)
        return {
          ok: true,
          requires2FASetup: !!data.requires2FASetup,
        }
      } catch (e) {
        this.error = e?.response?.data?.message || "Giriş başarısız"
        return { ok: false }
      } finally { this.loading = false }
    },

    async login2FA({ code, tempToken }) {
      this.loading = true; this.error = null
      try {
        const { data } = await api.post("/auth/2fa/login", { code, tempToken })
        if (data.accessToken) this.setTokens(data.accessToken, data.refreshToken)
        if (data.user) this.setUser(data.user)
        return { ok: true }
      } catch (e) {
        this.error = e?.response?.data?.message || "2FA doğrulama başarısız"
        return { ok: false }
      } finally { this.loading = false }
    },

    // -------- 2FA Setup flow (protected with access token) --------
    async twoFASetup() {
      const { data } = await api.post("/auth/2fa/setup")
      return data // { qr, secret }
    },

    async twoFAVerify(code) {
      this.error = null
      try {
        const { data } = await api.post("/auth/2fa/verify", { code })
        return { ok: !!data?.ok }
      } catch (e) {
        const status = e?.response?.status
        const already = e?.response?.data?.alreadyEnabled
        if (status === 409 && already) {
          // idempotent success
          return { ok: true, alreadyEnabled: true }
        }
        this.error = e?.response?.data?.message || "2FA doğrulama başarısız"
        throw e
      }
    },

    async fetchMe() {
      try {
        const { data } = await api.get("/auth/me")
        this.setUser(data)
        return data
      } catch (e) {
        // token invalid → logout
        this.logout()
        throw e
      }
    },

    async forgot(email) {
      this.loading = true; this.error = null
      try {
        const { data } = await api.post("/auth/forgot", { email })
        return !!data?.ok
      } catch (e) {
        this.error = e?.response?.data?.message || "İşlem başarısız"
        return false
      } finally { this.loading = false }
    },

    async reset({ token, password }) {
      this.loading = true; this.error = null
      try {
        const { data } = await api.post("/auth/reset", { token, password })
        return !!data?.ok
      } catch (e) {
        this.error = e?.response?.data?.message || "İşlem başarısız"
        return false
      } finally { this.loading = false }
    },

    async logout() {
      try { await api.post("/auth/logout", { refreshToken: this.refreshToken }).catch(() => {}) }
      finally { this.setTokens(null, null); this.setUser(null) }
    },
  },
})