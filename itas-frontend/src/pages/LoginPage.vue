<template>
  <section class="min-h-[70vh] flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <div class="bg-white border rounded-2xl shadow-sm p-6 md:p-8">
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm3 8H9V6a3 3 0 116 0v3z"/>
            </svg>
          </div>
          <h1 class="text-xl font-semibold">ITAS’a Giriş</h1>
          <p class="text-sm text-gray-500">Hesabınıza erişmek için bilgilerinizi girin.</p>
        </div>

        <form @submit.prevent="onSubmit" novalidate class="space-y-4">
          <div>
            <label for="email" class="block text-sm font-medium mb-1">E-posta</label>
            <input id="email" v-model.trim="email" type="email" autocomplete="email"
              :class="inputClass(emailError)" placeholder="ornek@itas.com" @blur="touched.email = true" />
            <p v-if="showEmailError" class="mt-1 text-xs text-red-600">{{ emailError }}</p>
          </div>

          <div>
            <div class="flex items-center justify-between">
              <label for="password" class="block text-sm font-medium mb-1">Şifre</label>
              <RouterLink class="text-xs text-blue-600 hover:underline" to="/forgot">Şifremi unuttum</RouterLink>
            </div>
            <div class="relative">
              <input id="password" :type="showPassword ? 'text' : 'password'" v-model="password"
                autocomplete="current-password" :class="inputClass(passwordError)"
                placeholder="••••••" @blur="touched.password = true" />
              <button type="button" class="absolute inset-y-0 right-2 rounded px-2 text-gray-500 hover:text-gray-700"
                @click="showPassword = !showPassword"
                :aria-label="showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'">
                <svg v-if="!showPassword" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 110-10 5 5 0 010 10z"/></svg>
                <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.3 2L2 3.3l4 4C4 8.7 2 12 12 12c2.9 0 5.3-.6 7.1-1.6l2 2C18.5 14.7 15.5 15.5 12 15.5 5 15.5 1.5 12 1.5 12c.8-1.6 2-3.2 3.5-4.6L3.3 2z"/></svg>
              </button>
            </div>
            <p v-if="showPasswordError" class="mt-1 text-xs text-red-600">{{ passwordError }}</p>
          </div>

          <button class="w-full rounded-lg bg-gray-900 text-white py-2.5 disabled:opacity-60" :disabled="disabled">
            {{ auth.loading ? 'Giriş yapılıyor…' : 'Giriş Yap' }}
          </button>

          <p v-if="auth.error" class="text-red-600 text-sm text-center">{{ auth.error }}</p>

          <div v-if="step2.tempToken" class="pt-2">
            <label class="block text-sm font-medium mb-1">2FA Kodu</label>
            <input v-model="twofa" class="w-full border rounded-lg p-2.5" placeholder="123456" />
            <button type="button" class="w-full mt-3 rounded-lg bg-gray-900 text-white py-2.5" @click="on2FA">
              Doğrula
            </button>
          </div>

          <p class="text-xs text-gray-500 text-center">
            Demo: <code>admin@itas.local</code> / <code>123456</code>
          </p>
        </form>

        <div class="mt-6 text-center text-sm">
          Hesabın yok mu?
          <RouterLink class="text-blue-600 hover:underline" to="/register">Kayıt ol</RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import { useAuthStore } from "@/stores/auth"
import { useRoute, useRouter } from "vue-router"

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref("admin@itas.local")
const password = ref("123456")
const showPassword = ref(false)
const touched = ref({ email: false, password: false })

const twofa = ref("")
const step2 = ref({ tempToken: null })

const emailError = computed(() =>
  !email.value && touched.value.email ? "E-posta zorunludur." :
  email.value && !/.+@.+\..+/.test(email.value) ? "Geçerli bir e-posta girin." : ""
)
const passwordError = computed(() =>
  !password.value && touched.value.password ? "Şifre zorunludur." :
  password.value && password.value.length < 6 ? "En az 6 karakter." : ""
)

const showEmailError = computed(() => !!emailError.value)
const showPasswordError = computed(() => !!passwordError.value)
const disabled = computed(() => !!emailError.value || !!passwordError.value || !email.value || !password.value)

const inputClass = (err) => [
  "w-full border rounded-lg p-2.5 outline-none",
  err ? "border-red-500 focus:ring-2 focus:ring-red-200"
      : "border-gray-300 focus:ring-2 focus:ring-gray-200"
].join(" ")

onMounted(() => {
  if (auth.isAuthenticated) router.replace(route.query.redirect || "/")
})

const onSubmit = async () => {
  touched.value = { email: true, password: true }
  if (disabled.value) return

  const res = await auth.login({ email: email.value, password: password.value })

  // 2FA-on-login flow (already exists)
  if (res?.requires2FA) {
    step2.value.tempToken = res.tempToken
    return
  }

  // Normal login
  if (res?.ok) {
    // ⬇️ NEW: force 2FA setup if backend/store says it's required
    if (res.requires2FASetup || auth.user?.twoFASetupRequired) {
      router.push({ name: "twofa-setup" })
    } else {
      router.push(route.query.redirect || "/")
    }
  }
}

const on2FA = async () => {
  if (!twofa.value) return
  const res = await auth.login2FA({ code: twofa.value, tempToken: step2.value.tempToken })
  if (res.ok) {
    // After 2FA-login success you’re fully authenticated
    router.push(route.query.redirect || "/")
  }
}
</script>