<template>
  <header class="border-b bg-white/80 backdrop-blur">
    <div class="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
      <!-- ✅ Larger Logo -->
      <RouterLink to="/" class="flex items-center gap-3">
        <img
          src="/logo.png"
          alt="ITAS Logo"
          class="h-20 w-auto sm:h-14 md:h-16 transition-transform hover:scale-105 duration-200"
        />
        <span class="sr-only">ITAS</span>
      </RouterLink>

      <nav class="flex items-center gap-4 text-sm md:text-base">
        <RouterLink to="/dashboard" class="hover:text-blue-600 transition-colors">Dashboard</RouterLink>
        <RouterLink to="/profile" class="hover:text-blue-600 transition-colors">Profile</RouterLink>

        <template v-if="auth.isAuthenticated">
          <span class="text-gray-600 text-sm">Hi, {{ auth.user?.name || auth.user?.email }}</span>
          <button
            @click="onLogout"
            class="px-3 py-1.5 border rounded hover:bg-red-500 transition-colors"
          >
            Logout
          </button>
        </template>

        <template v-else>
          <RouterLink
            to="/login"
            class="px-3 py-1.5 border rounded hover:bg-gray-100 transition-colors"
          >
            Login
          </RouterLink>
          <RouterLink
            to="/register"
            class="px-3 py-1.5 border rounded hover:bg-gray-100 transition-colors"
          >
            Register
          </RouterLink>
        </template>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { useAuthStore } from "@/stores/auth"
import { useRouter } from "vue-router"
const auth = useAuthStore()
const router = useRouter()

const onLogout = async () => {
  await auth.logout()
  router.push({ name: "login" })
}
</script>