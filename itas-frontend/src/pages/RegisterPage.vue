<template>
  <section class="min-h-[70vh] flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <div class="bg-white border rounded-2xl shadow-sm p-6 md:p-8">
        <div class="mb-6 text-center">
          <h1 class="text-xl font-semibold">Kayıt Ol</h1>
          <p class="text-sm text-gray-500">Hızlıca hesabını oluştur.</p>
        </div>

        <form @submit.prevent="onSubmit" class="space-y-4" novalidate>
          <!-- Ad Soyad -->
          <div>
            <label class="block text-sm font-medium mb-1" for="name">Ad Soyad</label>
            <input
              id="name"
              v-model.trim="name"
              :class="inputClass(nameError)"
              placeholder="Ad Soyad"
              @blur="touched.name = true"
            />
            <p v-if="showNameError" class="mt-1 text-xs text-red-600">{{ nameError }}</p>
          </div>

          <!-- E-posta -->
          <div>
            <label class="block text-sm font-medium mb-1" for="reg-email">E-posta</label>
            <input
              id="reg-email"
              v-model.trim="email"
              type="email"
              autocomplete="email"
              :class="inputClass(emailError)"
              placeholder="ornek@itas.com"
              @blur="touched.email = true"
            />
            <p v-if="showEmailError" class="mt-1 text-xs text-red-600">{{ emailError }}</p>
          </div>

          <!-- Şifre -->
          <div>
            <label class="block text-sm font-medium mb-1" for="reg-password">Şifre</label>
            <input
              id="reg-password"
              v-model="password"
              type="password"
              :class="inputClass(passwordError)"
              placeholder="••••••"
              @blur="touched.password = true"
            />
            <p v-if="showPasswordError" class="mt-1 text-xs text-red-600">{{ passwordError }}</p>
          </div>

          <!-- Rol seçimi -->
          <div>
            <label class="block text-sm font-medium mb-2">Rol Seçimi</label>
            <div class="grid grid-cols-3 gap-2">
              <button type="button" :class="roleBtn('client')" @click="role='client'">Client</button>
              <button type="button" :class="roleBtn('developer')" @click="role='developer'">Developer</button>
              <button type="button" :class="roleBtn('employer')" @click="role='employer'">Employer</button>
            </div>
            <p class="mt-1 text-xs text-gray-500">
              Seçtiğiniz rol incelemeye gönderilir. Onay sonrası giriş yapabilirsiniz.
            </p>
          </div>

          <button
            class="w-full rounded-lg bg-gray-900 text-white py-2.5 disabled:opacity-60"
            :disabled="disabled || loading"
          >
            {{ loading ? 'Kayıt yapılıyor…' : 'Kayıt Ol' }}
          </button>

          <p v-if="auth.error" class="text-red-600 text-sm text-center">{{ auth.error }}</p>
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
const role = ref("client") // default

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

const baseInput = "w-full border rounded-lg p-2.5 outline-none"
const inputClass = (err) => [
  baseInput,
  err ? "border-red-500 focus:ring-2 focus:ring-red-200"
      : "border-gray-300 focus:ring-2 focus:ring-gray-200"
].join(" ")

const roleBtn = (r) =>
  [
    "w-full text-sm border rounded-lg py-2 transition",
    role.value === r ? "border-gray-900 bg-gray-900 text-white"
                     : "border-gray-300 bg-white hover:bg-gray-50",
  ].join(" ")

const onSubmit = async () => {
  touched.value = { name:true, email:true, password:true }
  if (disabled.value || loading.value) return

  loading.value = true
  // NOTE: backend now returns only { ok, info } on success (no tokens)
  const res = await auth.register({
    name: name.value,
    email: email.value,
    password: password.value,
    role: role.value,
  })
  loading.value = false

  if (res?.ok) {
    router.push({
      name: "pending-approval",
      query: { info: res.info || "Hesabınız inceleniyor. Onay sonrası giriş yapabilirsiniz." }
    })
  }
}
</script>