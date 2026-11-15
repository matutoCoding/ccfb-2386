<script setup lang="ts">
// 统一 1.7 线宽线性图标，中性色，禁 emoji
const props = defineProps<{ name: string; size?: number }>()
const size = props.size ?? 18

const paths: Record<string, string> = {
  library:
    'M4 4h6v16H4zM14 4h6v16h-6zM7 7h.01M7 10h.01M17 7h.01M17 10h.01',
  layers:
    'M12 3l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
  overlap: 'M8 8h10v10H8zM6 6h10v10H6z',
  delivery: 'M3 7h13v10H3zM16 10h3l2 3v4h-5M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v5M14 11v5',
  lock: 'M6 10h12v10H6zM8 10V7a4 4 0 018 0v3M12 14v3',
  unlock: 'M6 10h12v10H6zM8 10V7a4 4 0 017.5-2M12 14v3',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.5 10.7a3 3 0 004 4M9 5.2A9.7 9.7 0 0112 5c6.5 0 10 6 10 6a17 17 0 01-3 3.6M6.2 7.3A16.6 16.6 0 002 11s3.5 6 10 6a9.6 9.6 0 003.4-.6',
  undo: 'M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-3',
  redo: 'M15 7l5 5-5 5M20 12H9a5 5 0 000 10h3',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  refresh: 'M4 12a8 8 0 0114-5.3L20 8M20 4v4h-4M20 12a8 8 0 01-14 5.3L4 16M4 20v-4h4',
  download: 'M12 4v10m0 0l-4-4m4 4l4-4M5 19h14',
  check: 'M5 12l5 5L20 7',
  alert: 'M12 4l9 16H3l9-16zM12 10v4M12 17h.01',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  droplet: 'M12 4s6 6.5 6 11a6 6 0 11-12 0c0-4.5 6-11 6-11z',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 13a1 1 0 100-2 1 1 0 000 2z',
  text: 'M5 6h14M12 6v13M9 19h6',
  square: 'M4 4h16v16H4z',
  circle: 'M12 20a8 8 0 100-16 8 8 0 000 16z',
  pen: 'M4 20l4-1L19 8l-3-3L5 16l-1 4zM14 7l3 3',
  image: 'M4 5h16v14H4zM8 13l3 3 4-5 4 5M9 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-7h8v7',
  zoomIn: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4M11 8v6M8 11h6',
}
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || ''" />
  </svg>
</template>
