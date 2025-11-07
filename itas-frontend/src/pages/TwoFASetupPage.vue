<template>
  <section class="max-w-lg mx-auto bg-white border rounded-2xl p-6">
    <h1 class="text-xl font-semibold mb-1">İki Aşamalı Doğrulama (2FA)</h1>
    <p class="text-sm text-gray-500 mb-4">
      Google Authenticator, Authy veya benzeri bir uygulama ile QR kodu tarayın ve 6 haneli kodu girin.
    </p>

    <!-- Already enabled -->
    <div v-if="alreadyEnabled" class="rounded bg-green-50 border border-green-200 p-3 text-green-700">
      2FA zaten etkin. Ana sayfaya yönlendiriliyorsunuz…
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="text-sm text-gray-500">Yükleniyor…</div>

    <!-- Start button -->
    <div v-else-if="!qr" class="flex items-center gap-3">
      <button
        class="border rounded px-4 py-2 bg-gray-900 text-white disabled:opacity-60"
        :disabled="busy"
        @click="getQR"
      >
        Kurulumu Başlat
      </button>
      <p class="text-xs text-gray-500">Butona tıkladıktan sonra QR kod üretilecektir.</p>
    </div>

    <!-- QR + verify -->
    <div v-else class="space-y-4">
      <img :src="qr" alt="QR" class="w-56 h-56 border rounded" />

      <div class="bg-gray-50 border rounded p-3 text-xs text-gray-600 break-all">
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium">Yedek Secret:</span>
          <button class="text-blue-600 hover:underline" @click="copySecret">Kopyala</button>
        </div>
        <div class="mt-1">{{ secret }}</div>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">6 haneli kod</label>
        <div class="flex items-center gap-2">
          <input
            v-model.trim="code"
            maxlength="6"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="123456"
            class="border p-2 rounded w-32 text-center tracking-widest"
            @input="onlyDigits"
          />
          <button
            class="border rounded px-4 py-2 bg-gray-900 text-white disabled:opacity-60"
            :disabled="busy || code.length !== 6"
            @click="verify"
          >
            Doğrula
          </button>
        </div>
        <p v-if="hint" class="mt-1 text-xs text-gray-500">{{ hint }}</p>
      </div>

      <p v-if="msg" class="text-sm" :class="ok ? 'text-green-600' : 'text-red-600'">
        {{ msg }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const router = useRouter()

const loading = ref(true)
const busy = ref(false)
const alreadyEnabled = ref(false)

const qr = ref(null)
const secret = ref(null)
const code = ref("")
const hint = ref("Kod uygulamada 30 sn'de bir yenilenir.")
const msg = ref("")
const ok = ref(false)

function onlyDigits() {
  code.value = code.value.replace(/\D/g, "").slice(0, 6)
}

async function getQR() {
  try {
    busy.value = true
    const data = await auth.twoFASetup()
    qr.value = data.qr
    secret.value = data.secret
    msg.value = ""
  } catch (e) {
    msg.value = "QR üretilemedi. Lütfen tekrar deneyin."
    ok.value = false
  } finally {
    busy.value = false
  }
}

async function verify() {
  if (code.value.length !== 6) {
    msg.value = "Lütfen 6 haneli kodu girin."
    ok.value = false
    return
  }
  try {
    busy.value = true
    await auth.twoFAVerify(code.value)
    await auth.fetchMe() // bayrakları güncelle
    ok.value = true
    msg.value = "2FA etkinleştirildi. Yönlendiriliyorsunuz…"
    setTimeout(() => router.push("/"), 600)
  } catch {
    ok.value = false
    msg.value = "Kod doğrulanamadı. Doğru kodu girip tekrar deneyin."
  } finally {
    busy.value = false
  }
}

async function copySecret() {
  try {
    await navigator.clipboard.writeText(secret.value || "")
    msg.value = "Secret panoya kopyalandı."
    ok.value = true
  } catch {
    msg.value = "Kopyalanamadı."
    ok.value = false
  }
}

onMounted(async () => {
  // Oturum yoksa login'e gönder
  if (!auth.isAuthenticated) {
    router.replace({ name: "login", query: { redirect: "/twofa-setup" } })
    return
  }
  // Kullanıcı bilgilerini tazele
  try { await auth.fetchMe() } catch {}
  // Zaten 2FA etkinse gönder
  if (auth.user?.twoFAEnabled === true && auth.user?.twoFASetupRequired === false) {
    alreadyEnabled.value = true
    loading.value = false
    setTimeout(() => router.replace("/"), 500)
    return
  }
  // Zorunlu kurulum varsa otomatik QR oluştur
  if (auth.user?.twoFASetupRequired && !qr.value) {
    await getQR()
  }
  loading.value = false
})
</script>