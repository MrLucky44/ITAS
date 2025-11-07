// src/services/dev.js
import api from "./api"

// Summary cards
export async function getDevSummary() {
  const { data } = await api.get("/dev/summary")
  return data
}

// Active tasks list
export async function getDevTasks() {
  const { data } = await api.get("/dev/tasks")
  return data // Task[]
}

// Task detail (for drawer)
export async function getTaskDetail(taskId) {
  const { data } = await api.get(`/dev/tasks/${encodeURIComponent(taskId)}`)
  return data // Task with logs
}

// Update task status
export async function setTaskStatus(taskId, status) {
  const { data } = await api.put(`/dev/tasks/${encodeURIComponent(taskId)}/status`, { status })
  return data // { ok: true }
}

// Add a log line to task
export async function addTaskLog(taskId, text) {
  const { data } = await api.post(`/dev/tasks/${encodeURIComponent(taskId)}/logs`, { text })
  return data // created log
}

// Delete a log line from task
export async function deleteTaskLog(taskId, logId) {
  const { data } = await api.delete(
    `/dev/tasks/${encodeURIComponent(taskId)}/logs/${encodeURIComponent(logId)}`
  )
  return !!data?.ok
}

// Daily logs: list
export async function getDailyLogs() {
  const { data } = await api.get("/dev/daily-logs")
  return data // DailyLog[]
}

// Daily logs: create
export async function createDailyLog(text) {
  const { data } = await api.post("/dev/daily-logs", { text })
  return data // created DailyLog
}

// Daily logs: delete
export async function deleteDailyLog(id) {
  const { data } = await api.delete(`/dev/daily-logs/${encodeURIComponent(id)}`)
  return !!data?.ok
}