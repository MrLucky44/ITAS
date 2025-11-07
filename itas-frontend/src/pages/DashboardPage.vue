<template>
  <div>
    <component :is="current" />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent } from "vue"
import { useAuthStore } from "@/stores/auth"

// ✅ Lazy-load components correctly
const Client = defineAsyncComponent(() => import("@/pages/dashboards/DashboardClient.vue"))
const Dev = defineAsyncComponent(() => import("@/pages/dashboards/DashboardDeveloper.vue"))
const Employer = defineAsyncComponent(() => import("@/pages/dashboards/DashboardEmployer.vue"))
const Fallback = defineAsyncComponent(() => import("@/pages/dashboards/DashboardUnknown.vue"))

const auth = useAuthStore()

const current = computed(() => {
  const role = auth.user?.role
  if (role === "client") return Client
  if (role === "developer") return Dev
  if (role === "employer") return Employer
  return Fallback
})
</script>