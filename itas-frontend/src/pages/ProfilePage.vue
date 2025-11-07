<template>
  <section>
    <h2 class="text-xl font-semibold mb-4">Profile</h2>
    <pre class="bg-white border p-3 rounded whitespace-pre-wrap">{{ auth.user }}</pre>
    <button class="mt-3 border px-3 py-1 rounded" @click="reload">Reload (/auth/me)</button>
  </section>
</template>

<script setup>
import { useAuthStore } from "@/stores/auth"
const auth = useAuthStore()
const reload = () => auth.fetchMe()
</script>
