import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import MyDriveView from '../views/MyDriveView.vue';
import QuotaView from '../views/QuotaView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/my-drive',
      name: 'my-drive',
      component: MyDriveView,
    },
		{
			path: '/quota',
			name: 'quota',
			component: QuotaView,
		},
  ],
});

export default router;
