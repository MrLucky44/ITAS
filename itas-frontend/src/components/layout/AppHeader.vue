<template>
  <header class="border-b bg-white/80 backdrop-blur">
    <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
      <RouterLink to="/" class="font-semibold">ITAS</RouterLink>
      <nav class="flex items-center gap-3">
        <RouterLink to="/dashboard">Dashboard</RouterLink>
        <RouterLink to="/profile">Profile</RouterLink>
        <template v-if="auth.isAuthenticated">
          <RouterLink to="/2fa-setup">2FA</RouterLink>
          <span class="text-sm text-gray-500">Hi, {{ auth.user?.name || auth.user?.email }}</span>
          <button @click="onLogout" class="px-3 py-1 border rounded">Logout</button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="px-3 py-1 border rounded">Login</RouterLink>
          <RouterLink to="/register" class="px-3 py-1 border rounded">Register</RouterLink>
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
