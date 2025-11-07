<template>
  <section class="min-h-[60vh] flex items-center justify-center px-4">
    <div class="w-full max-w-md bg-white border rounded-2xl p-6">
      <h1 class="text-xl font-semibold mb-3">Şifremi Unuttum</h1>
      <p class="text-sm text-gray-500 mb-4">E-posta adresini gir; sıfırlama bağlantısı gönderiyoruz.</p>
      <input v-model="email" type="email" class="w-full border rounded-lg p-2.5 mb-3" placeholder="ornek@itas.com" />
      <button class="w-full rounded-lg bg-gray-900 text-white py-2.5" @click="send">Gönder</button>
      <p v-if="done" class="text-sm text-green-600 mt-3">Eğer kayıtlıysa e-postana link gönderdik (geliştirmede konsola yazdırıyoruz).</p>
      <p v-if="auth.error" class="text-sm text-red-600 mt-2">{{ auth.error }}</p>
    </div>
  </section>
</template>
<script setup>
import { ref } from "vue"
import { useAuthStore } from "@/stores/auth"
const auth = useAuthStore()
const email = ref("")
const done = ref(false)
const send = async () => { done.value = await auth.forgot(email.value) }
</script>
