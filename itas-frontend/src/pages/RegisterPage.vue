<template>
  <section class="min-h-[70vh] flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <div class="bg-white border rounded-2xl shadow-sm p-6 md:p-8">
        <div class="mb-6 text-center">
          <h1 class="text-xl font-semibold">Kayıt Ol</h1>
          <p class="text-sm text-gray-500">Hızlıca hesabını oluştur.</p>
        </div>

        <form @submit.prevent="onSubmit" class="space-y-4" novalidate>
          <div>
            <label class="block text-sm font-medium mb-1" for="name">Ad Soyad</label>
            <input id="name" v-model.trim="name" :class="inputClass(nameError)" placeholder="Ad Soyad" @blur="touched.name=true" />
            <p v-if="showNameError" class="mt-1 text-xs text-red-600">{{ nameError }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1" for="reg-email">E-posta</label>
            <input id="reg-email" v-model.trim="email" type="email" autocomplete="email"
                   :class="inputClass(emailError)" placeholder="ornek@itas.com" @blur="touched.email=true" />
            <p v-if="showEmailError" class="mt-1 text-xs text-red-600">{{ emailError }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1" for="reg-password">Şifre</label>
            <input id="reg-password" v-model="password" type="password"
                   :class="inputClass(passwordError)" placeholder="••••••" @blur="touched.password=true" />
            <p v-if="showPasswordError" class="mt-1 text-xs text-red-600">{{ passwordError }}</p>
          </div>

          <button class="w-full rounded-lg bg-gray-900 text-white py-2.5 disabled:opacity-60" :disabled="disabled || loading">
            {{ loading ? 'Kayıt yapılıyor…' : 'Kayıt Ol' }}
          </button>

          <p v-if="auth.error" class="text-red-600 text-sm text-center">{{ auth.error }}</p>

          <div class="text-sm text-center mt-4">
            Zaten hesabın var mı?
            <RouterLink class="text-blue-600 hover:underline" to="/login">Giriş yap</RouterLink>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from "vue"
import { useAuthStore } from "@/stores/auth"
import { useRouter } from "vue-router"

const auth = useAuthStore()
const router = useRouter()

const name = ref("")
const email = ref("")
const password = ref("")
const touched = ref({ name:false, email:false, password:false })
const loading = ref(false)

const nameError = computed(() => !name.value && touched.value.name ? "Ad Soyad zorunludur." : "")
const emailError = computed(() =>
  !email.value && touched.value.email ? "E-posta zorunludur." :
  email.value && !/.+@.+\..+/.test(email.value) ? "Geçerli bir e-posta girin." : ""
)
const passwordError = computed(() =>
  !password.value && touched.value.password ? "Şifre zorunludur." :
  password.value && password.value.length < 6 ? "En az 6 karakter." : ""
)

const showNameError = computed(() => !!nameError.value)
const showEmailError = computed(() => !!emailError.value)
const showPasswordError = computed(() => !!passwordError.value)
const disabled = computed(() =>
  !!nameError.value || !!emailError.value || !!passwordError.value ||
  !name.value || !email.value || !password.value
)

const inputClass = (err) => [
  "w-full border rounded-lg p-2.5 outline-none",
  err ? "border-red-500 focus:ring-2 focus:ring-red-200"
      : "border-gray-300 focus:ring-2 focus:ring-gray-200"
].join(" ")

const onSubmit = async () => {
  touched.value = { name:true, email:true, password:true }
  if (disabled.value || loading.value) return
  loading.value = true

  // NOTE: auth.register should return { ok, requires2FASetup } (per store patch)
  const res = await auth.register({ name: name.value, email: email.value, password: password.value })
  loading.value = false

  if (res?.ok) {
    // Force 2FA setup if backend says so OR user flag says so
    if (res.requires2FASetup || auth.user?.twoFASetupRequired) {
      router.push({ name: "twofa-setup" })
    } else {
      router.push("/")
    }
  }
}
</script>