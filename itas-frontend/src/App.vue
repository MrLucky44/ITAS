<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <AppHeader />
    <main class="mx-auto max-w-5xl p-4">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import AppHeader from "@/components/layout/AppHeader.vue"
</script>
<style>
*{margin:0;padding:0}
</style>