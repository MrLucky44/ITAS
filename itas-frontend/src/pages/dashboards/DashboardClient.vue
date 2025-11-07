<template>
    <section class="space-y-6">
      <h1 class="text-2xl font-semibold">Müşteri Paneli</h1>
  
      <!-- Quick actions -->
      <div class="grid md:grid-cols-3 gap-4">
        <button class="border rounded-lg p-4 hover:bg-gray-50 text-left">
          🎫 Yeni Bilet Oluştur
          <p class="text-sm text-gray-500">Talebinizi bize iletin.</p>
        </button>
        <button class="border rounded-lg p-4 hover:bg-gray-50 text-left">
          📂 Açık Biletlerim
          <p class="text-sm text-gray-500">Devam eden süreçleri takip edin.</p>
        </button>
        <button class="border rounded-lg p-4 hover:bg-gray-50 text-left">
          🧾 Geçmiş Biletler
          <p class="text-sm text-gray-500">Tamamlanan işlerin kaydı.</p>
        </button>
      </div>
  
      <!-- Example table -->
      <div class="bg-white border rounded-xl">
        <div class="px-4 py-3 border-b font-medium">Son Aktiviteler</div>
        <div class="p-4 text-sm text-gray-600">Henüz aktivite yok.</div>
      </div>
    </section>
  </template>