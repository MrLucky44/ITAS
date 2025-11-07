<template>
    <section class="space-y-8">
      <!-- 🧭 Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold tracking-tight">Geliştirici Paneli</h1>
        <button
  @click="refresh"
  class="flex items-center gap-2 text-sm border px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
  :disabled="loading"
>
  <ArrowPathIcon
    class="w-4 h-4 transition-transform duration-500"
    :class="[
      rotated ? 'rotate-180' : 'rotate-0',
      loading ? 'animate-spin text-gray-500' : ''
    ]"
  />
  <span>Yenile</span>
</button>
    </div>
  
      <!-- ⚙️ Summary cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="border rounded-xl p-4 bg-white">
          <div class="text-sm text-gray-500">Atanan Görev</div>
          <div class="text-2xl font-semibold text-gray-800">{{ stats.assigned }}</div>
        </div>
  
        <div class="border rounded-xl p-4 bg-white">
          <div class="text-sm text-gray-500">Tamamlanan</div>
          <div class="text-2xl font-semibold text-green-600">{{ stats.completed }}</div>
        </div>
  
        <div class="border rounded-xl p-4 bg-white">
          <div class="text-sm text-gray-500">Bekleyen İnceleme</div>
          <div class="text-2xl font-semibold text-yellow-500">{{ stats.review }}</div>
        </div>
  
        <div class="border rounded-xl p-4 bg-white">
          <div class="text-sm text-gray-500">Toplam Puan</div>
          <div class="text-2xl font-semibold text-blue-600">{{ stats.score }}</div>
        </div>
      </div>

<!-- 📝 Puanlama Açıklaması (detaylı) -->
<details class="bg-white border rounded-xl p-4 text-sm text-gray-700">
  <summary class="cursor-pointer select-none font-medium">
    Puanlama Nasıl Hesaplanır?
    <span class="ml-2 text-xs text-gray-500"></span>
  </summary>
  <div class="mt-3">
    <ul class="list-disc pl-5 space-y-1">
      <li><b>Tamamlandı</b> durumundaki her görev: <b>+10 puan</b></li>
      <li><b>İncelemede</b> durumundaki her görev: <b>+5 puan</b></li>
      <li><b>Beklemede</b> durumundaki görevler: <b>+0 puan</b></li>
    </ul>
  </div>
</details>
  
      <!-- 📋 Active Tasks -->
      <div class="bg-white border rounded-xl">
        <div class="px-4 py-3 border-b font-medium text-gray-800">Aktif Görevler</div>
  
        <div v-if="tasks.length" class="divide-y text-sm">
          <button
            v-for="t in tasks"
            :key="t.id"
            type="button"
            class="w-full text-left flex items-center justify-between p-4 hover:bg-gray-50 transition"
            @click="openTask(t.id)"
          >
            <div>
              <div class="font-medium">{{ t.title }}</div>
              <div class="text-gray-500 text-xs">Son tarih: {{ formatDate(t.deadline) }}</div>
            </div>
  
            <span
              class="text-xs px-2 py-1 rounded-full"
              :class="{
                'bg-green-100 text-green-700': t.status === 'tamamlandi',
                'bg-yellow-100 text-yellow-700': t.status === 'incelemede',
                'bg-gray-100 text-gray-700': t.status === 'beklemede',
              }"
            >
              {{ statusText(t.status) }}
            </span>
          </button>
        </div>
  
        <div v-else class="p-4 text-sm text-gray-500">
          Şu anda size atanmış aktif görev bulunmuyor.
        </div>
      </div>
  
      <!-- 🕒 Daily Log -->
      <div class="bg-white border rounded-xl">
        <div class="px-4 py-3 border-b font-medium text-gray-800">Günlük Durum</div>
  
        <form @submit.prevent="addDaily" class="p-4 space-y-2">
          <textarea
            v-model="logText"
            rows="3"
            class="border rounded w-full p-2 text-sm"
            placeholder="Bugün neler üzerinde çalıştınız?"
          ></textarea>
          <div class="flex justify-end">
            <button
  type="submit"
  class="bg-gray-900 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-800 disabled:opacity-60"
  :disabled="!(logText && logText.trim())"
>
  Kaydet
</button>
          </div>
        </form>
  
        <div v-if="daily.length" class="divide-y text-sm">
          <div
            v-for="l in daily"
            :key="l.id"
            class="p-4 text-gray-700 flex justify-between items-start"
          >
            <div>
              <p>{{ l.text }}</p>
              <p class="text-xs text-gray-400 mt-1">{{ formatDateTime(l.time) }}</p>
            </div>
            <button @click="removeDaily(l.id)" class="text-red-500 text-xs hover:underline">
              Sil
            </button>
          </div>
        </div>
      </div>
  <!-- 🔎 Task Drawer -->
<Transition name="slide-right">
  <div v-if="drawerOpen" class="absolute inset-0 z-[9999] flex justify-end" style="margin-top: 0; margin-bottom: 0;">
    <!-- overlay -->
    <div
      class="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
      @click="closeDrawer"
    ></div>

    <!-- right panel -->
    <aside
      class="relative z-[99910] h-full  w-[480px] bg-white shadow-2xl border-l"
    >
      <div class="p-4 border-b flex items-center justify-between">
        <div class="font-semibold">Görev Detayı</div>
        <button
          class="text-sm text-gray-500 hover:text-gray-700 hover:underline inline-flex items-center gap-1"
          @click="closeDrawer"
        >
          <XMarkIcon class="w-4 h-4" />
          Kapat
        </button>
      </div>

      <div class="p-4 overflow-y-auto space-y-4 flex-1" v-if="task">
        <div>
          <div class="text-lg font-semibold">{{ task.title }}</div>
          <div class="text-xs text-gray-500">
            Son güncelleme: {{ formatDateTime(task.updatedAt) }}
          </div>
        </div>

        <!-- Status -->
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600">Durum:</label>
          <select v-model="status" @change="saveStatus" class="border rounded px-2 py-1 text-sm">
            <option value="beklemede">Beklemede</option>
            <option value="incelemede">İncelemede</option>
            <option value="tamamlandi">Tamamlandı</option>
          </select>
          <span class="text-xs px-2 py-0.5 rounded border" :class="badgeClass(status)">
            {{ statusText(status) }}
          </span>
        </div>

        <!-- Add task log -->
        <div class="flex items-center gap-2">
          <input
            v-model="taskLog"
            @keyup.enter="pushTaskLog"
            class="border rounded px-3 py-2 flex-1 text-sm"
            placeholder="Bu görev için not ekle (Enter)"
          />
          <button
            type="button"
            class="border rounded px-3 py-2 bg-gray-900 text-white text-sm flex items-center gap-2 hover:bg-gray-800 disabled:opacity-60"
            @click="pushTaskLog"
            :disabled="!taskLog || !taskLog.trim()"
          >
            <PlusIcon class="w-4 h-4" />
            Ekle
          </button>
        </div>

        <!-- Task logs -->
        <div>
          <div class="text-sm font-medium mb-2">Loglar</div>
          <ul class="space-y-2 max-h-72 overflow-y-auto pr-1">
            <li v-for="l in logsSafe" :key="l.id" class="p-2 border rounded">
              <div class="text-xs text-gray-500 flex items-center justify-between">
                <span>{{ formatDateTime(l.at) }} • {{ l.by || 'system' }}</span>
                <button
                  @click="removeTaskLog(l.id)"
                  class="text-red-500 hover:underline flex items-center gap-1 text-xs"
                  title="Sil"
                >
                  <TrashIcon class="w-4 h-4" />
                  Sil
                </button>
              </div>
              <div class="text-sm break-words">{{ l.text }}</div>
            </li>
          </ul>
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      </div>

      <div v-else class="p-4 text-sm text-gray-500">Yükleniyor…</div>
    </aside>
  </div>
</Transition>
      
    </section>
  </template>
  <style scoped>
  .slide-right-enter-from,
  .slide-right-leave-to { transform: translateX(100%); }
  .slide-right-enter-active,
  .slide-right-leave-active { transition: transform .25s ease; }
  .slide-right-enter-to,
  .slide-right-leave-from { transform: translateX(0); }
  </style>
<script setup>
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/solid'
import { ArrowPathIcon } from "@heroicons/vue/24/outline"
import { onMounted, computed, ref } from "vue"
import { useDevStore } from "@/stores/dev.store.js"

const dev = useDevStore()
const logText = ref("")
const taskLog = ref("")

// state/computed …
const loading  = computed(() => dev.loading)
const stats    = computed(() => dev.stats)
const tasks    = computed(() => dev.activeTasks)
const daily    = computed(() => dev.daily)
const task     = computed(() => dev.task)
const logsSafe = computed(() => dev.logsSafe)
const error    = computed(() => dev.error)
const drawerOpen = computed(() => !!task.value)
const rotated = ref(false)

// ✅ add these helpers so the template can call them
const formatDate = (d) => {
  try {
    return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })
  } catch { return d ?? "" }
}
const formatDateTime = (d) => {
  try {
    return new Date(d).toLocaleString("tr-TR")
  } catch { return d ?? "" }
}

const statusText = (s) => s === "tamamlandi" ? "Tamamlandı" : s === "incelemede" ? "İncelemede" : "Beklemede"
const badgeClass = (s) =>
  s === "tamamlandi" ? "border-green-300 text-green-700 bg-green-50"
: s === "incelemede" ? "border-amber-300 text-amber-700 bg-amber-50"
: "border-gray-300 text-gray-700 bg-gray-50"

// actions …
function openTask(id){ dev.openTask(id) }
function closeDrawer(){ dev.resetTask(); taskLog.value = "" }
function saveStatus(e){ dev.updateStatus(e?.target?.value || dev.task?.status) }
async function pushTaskLog(){
  if (!task.value) return
  const txt = (taskLog.value || "").trim()
  if (!txt) return
  await dev.addTaskLog(txt)
  taskLog.value = ""
}
async function refresh() {
  rotated.value = !rotated.value
  await dev.refreshAll()
  setTimeout(() => (rotated.value = false), 500)
}

function removeTaskLog(id){ dev.deleteTaskLog(id) }
async function addDaily(){
  const txt = (logText.value || "").trim()
  if (!txt) return
  await dev.addDaily(txt)
  logText.value = ""
}
function removeDaily(id){ dev.deleteDaily(id) }

onMounted(() => dev.refreshAll())

</script>