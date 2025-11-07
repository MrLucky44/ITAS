<script setup>
import { useRoute } from "vue-router"
import { useAuthStore } from "@/stores/auth"
const route = useRoute()
const auth = useAuthStore()
const info = route.query.info || "Hesabınız inceleniyor. Onay sonrası giriş yapabilirsiniz."
</script>

<template>
  <section class="min-h-[60vh] flex items-center justify-center px-4">
    <div class="w-full max-w-lg bg-white border rounded-2xl p-6">
      <h1 class="text-xl font-semibold mb-2">İnceleme Aşamasında</h1>
      <p class="text-gray-600">{{ info }}</p>

      <div class="mt-5 flex gap-2">
        <RouterLink to="/login" class="px-3 py-2 border rounded hover:bg-gray-50">Giriş Yap</RouterLink>
        <RouterLink to="/" class="px-3 py-2 border rounded hover:bg-gray-50">Ana sayfa</RouterLink>
      </div>

      <div v-if="auth.user?.requestedRole" class="mt-3 text-xs text-gray-500">
        Talep edilen rol: <b>{{ auth.user.requestedRole }}</b>
      </div>
    </div>
  </section>
</template>