import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/library' },
    {
      path: '/library',
      name: 'library',
      component: () => import('@/pages/LibraryPage.vue'),
      meta: { title: '印件库' },
    },
    {
      path: '/separation',
      name: 'separation',
      component: () => import('@/pages/SeparationPage.vue'),
      meta: { title: '分色' },
    },
    {
      path: '/overprint',
      name: 'overprint',
      component: () => import('@/pages/OverprintPage.vue'),
      meta: { title: '套印' },
    },
    {
      path: '/delivery',
      name: 'delivery',
      component: () => import('@/pages/DeliveryPage.vue'),
      meta: { title: '交付' },
    },
  ],
})
