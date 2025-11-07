// src/stores/dev.store.js
import { defineStore } from "pinia"
import {
  getDevSummary,
  getDevTasks,
  getDailyLogs,
  createDailyLog,
  deleteDailyLog,
  getTaskDetail,
  setTaskStatus,
  addTaskLog,
  deleteTaskLog,
} from "@/services/dev"

export const useDevStore = defineStore("dev", {
  state: () => ({
    loading: false,
    stats: { assigned: 0, completed: 0, review: 0, score: 0 },
    activeTasks: [],
    daily: [],
    task: null,
    status: "beklemede",
    taskLog: "",
    logText: "",
    error: "",
  }),

  getters: {
    logsSafe: (s) => (s.task?.logs ? s.task.logs : []),
  },

  actions: {
    async refreshAll() {
      this.loading = true
      try {
        const [s, t, l] = await Promise.all([
          getDevSummary(),
          getDevTasks(),
          getDailyLogs(),
        ])
        this.stats = s
        this.activeTasks = t
        this.daily = l
      } catch (e) {
        console.error("refreshAll error:", e)
        this.error = e?.response?.data?.message || "Veri alınamadı"
      } finally {
        this.loading = false
      }
    },

    /* ---- Daily Logs ---- */
    async addDaily(text) {
      const txt = (text || "").trim()
      if (!txt) return
      try {
        const item = await createDailyLog(txt)
        this.daily.unshift(item)
        this.logText = ""
      } catch (e) {
        console.error("addDaily error:", e)
        this.error = e?.response?.data?.message || "Günlük kaydedilemedi"
      }
    },

    async deleteDaily(id) {
      try {
        const ok = await deleteDailyLog(id)
        if (ok) this.daily = this.daily.filter((l) => l.id !== id)
      } catch (e) {
        console.error("deleteDaily error:", e)
        this.error = e?.response?.data?.message || "Silinemedi"
      }
    },

    /* ---- Task Drawer ---- */
    async openTask(id) {
      this.error = ""
      this.task = null
      try {
        this.task = await getTaskDetail(id)
        this.status = this.task.status
      } catch (e) {
        this.error = e?.response?.data?.message || "Görev detayı alınamadı"
      }
    },

    resetTask() {
      this.task = null
      this.taskLog = ""
    },

    async updateStatus(status) {
      if (!this.task) return
      try {
        await setTaskStatus(this.task.id, status)
        this.task = await getTaskDetail(this.task.id)
        await this.refreshAll()
      } catch (e) {
        this.error = e?.response?.data?.message || "Durum güncellenemedi"
      }
    },

    async addTaskLog(text) {
      if (!this.task) return
      const txt = (text || "").trim()
      if (!txt) return
      try {
        const added = await addTaskLog(this.task.id, txt)
        this.task.logs.push(added)
        this.task.updatedAt = new Date().toISOString()
        this.taskLog = ""
      } catch (e) {
        console.error("addTaskLog error:", e)
        this.error = e?.response?.data?.message || "Log eklenemedi"
      }
    },

    async deleteTaskLog(logId) {
      if (!this.task) return
      try {
        const ok = await deleteTaskLog(this.task.id, logId)
        if (ok) this.task.logs = this.task.logs.filter((l) => l.id !== logId)
      } catch (e) {
        console.error("deleteTaskLog error:", e)
        this.error = e?.response?.data?.message || "Log silinemedi"
      }
    },
  },
})