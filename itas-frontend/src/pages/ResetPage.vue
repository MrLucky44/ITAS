<template>
  <section class="min-h-[60vh] flex items-center justify-center px-4">
    <div class="w-full max-w-md bg-white border rounded-2xl p-6">
      <h1 class="text-xl font-semibold mb-3">Parola Sıfırla</h1>

      <input
        v-model="password"
        type="password"
        class="w-full border rounded-lg p-2.5 mb-3"
        placeholder="Yeni şifre"
        @keyup.enter="onReset"
      />

      <button
        class="w-full rounded-lg bg-gray-900 text-white py-2.5 disabled:opacity-60"
        :disabled="!canSubmit"
        @click="onReset"
      >
        Sıfırla
      </button>

      <p v-if="done" class="text-sm text-green-600 mt-3">Şifre sıfırlandı. Giriş yapabilirsiniz.</p>
      <p v-if="auth.error" class="text-sm text-red-600 mt-2">{{ auth.error }}</p>
      <p v-if="tokenError" class="text-sm text-red-600 mt-2">{{ tokenError }}</p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const password = ref("")
const done = ref(false)
const tokenError = ref("")

const token = computed(() => route.query.token)
const canSubmit = computed(() => (password.value?.length || 0) >= 6 && !!token.value)

async function onReset() {
  tokenError.value = ""
  if (!token.value) {
    tokenError.value = "Geçersiz bağlantı: token bulunamadı."
    return
  }
  const ok = await auth.reset({ token: token.value, password: password.value })
  done.value = ok
  if (ok) setTimeout(() => router.push("/login"), 800)
}
</script>