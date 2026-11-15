<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { useDocStore } from '@/stores/doc_store'

const route = useRoute()
const docStore = useDocStore()

const navs = [
  { to: '/library', icon: 'library', label: '印件库' },
  { to: '/separation', icon: 'layers', label: '分色' },
  { to: '/overprint', icon: 'overlap', label: '套印' },
  { to: '/delivery', icon: 'delivery', label: '交付' },
]

const currentTitle = computed(() => (route.meta.title as string) || '')
</script>

<template>
  <div class="h-screen flex flex-col">
    <header
      class="h-14 shrink-0 flex items-center gap-6 px-6 border-b bg-white"
      style="border-color: var(--color-line)"
    >
      <div class="flex items-center gap-3">
        <span
          class="w-8 h-8 rounded-md flex items-center justify-center text-white"
          style="background: var(--color-primary)"
        >
          <AppIcon name="droplet" :size="18" />
        </span>
        <div>
          <div class="font-semibold" style="font-size: var(--text-base)">
            专色审版台
          </div>
        </div>
      </div>

      <nav class="flex items-center gap-1">
        <RouterLink
          v-for="n in navs"
          :key="n.to"
          :to="n.to"
          class="btn btn-ghost"
          :class="{ active: route.path.startsWith(n.to) }"
        >
          <AppIcon :name="n.icon" :size="17" />
          <span>{{ n.label }}</span>
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-4">
        <span
          v-if="docStore.doc"
          class="text-sm"
          style="color: var(--color-muted); font-size: var(--text-xs)"
        >
          {{ docStore.doc.name }} · {{ currentTitle }}
        </span>
        <span
          v-else
          style="color: var(--color-faint); font-size: var(--text-xs)"
        >
          未打开印件
        </span>
      </div>
    </header>

    <main class="flex-1 min-h-0">
      <RouterView />
    </main>
  </div>
</template>
