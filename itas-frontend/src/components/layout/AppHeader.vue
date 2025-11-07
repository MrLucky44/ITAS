<template>
  <header class="border bg-white/80 backdrop-blur">
    <div class="mx-auto max-w-6xl px-6 py-2 flex items-center justify-between">
      <!-- Logo -->
      <RouterLink to="/" class="flex items-center gap-2">
        <img
          src="/logo.png"
          alt="ITAS Logo"
          class="h-10 w-auto sm:h-9 md:h-20 transition-transform hover:scale-105 duration-200"
        />
        <span class="sr-only">ITAS</span>
      </RouterLink>

      <nav class="flex items-center gap-4 text-sm md:text-base">
        <template v-if="auth.isAuthenticated">
          <RouterLink to="/dashboard" class="hover:text-blue-600 transition-colors">Dashboard</RouterLink>
          <RouterLink to="/profile" class="hover:text-blue-600 transition-colors">Profile</RouterLink>

          <span class="text-gray-600 text-sm">
  Hi, {{ auth.user?.name || auth.user?.email }}
  <span v-if="auth.user?.role" class="ml-1 text-gray-400">({{ auth.user.role }})</span>
</span>
          <button
            @click="onLogout"
            class="px-3 py-1 border rounded hover:bg-red-500 hover:text-white transition-colors"
          >
            Logout
          </button>
        </template>

        <!-- 👇 Icons added here -->
        <template v-else>
          <RouterLink
            to="/login"
            class="flex items-center gap-1.5 px-3 py-1 border rounded hover:bg-gray-100 transition-colors"
          >
            <ArrowRightOnRectangleIcon class="h-4 w-4" />
            Login
          </RouterLink>

          <RouterLink
            to="/register"
            class="flex items-center gap-1.5 px-3 py-1 border rounded hover:bg-gray-100 transition-colors"
          >
            <UserPlusIcon class="h-4 w-4" />
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
import { ArrowRightOnRectangleIcon, UserPlusIcon } from "@heroicons/vue/24/outline"

const auth = useAuthStore()
const router = useRouter()

const onLogout = async () => {
  await auth.logout()
  router.push({ name: "login" })
}
</script>