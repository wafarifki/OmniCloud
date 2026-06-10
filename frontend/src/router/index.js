import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import MyDriveView from '../views/MyDriveView.vue';
import RecentView from '../views/RecentView.vue';
import StarredView from '../views/StarredView.vue';
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
			path: '/recent',
			name: 'recent',
			component: RecentView,
		},
		{
			path: '/starred',
			name: 'starred',
			component: StarredView,
		},
		{
			path: '/quota',
			name: 'quota',
			component: QuotaView,
		},
	],
});

export default router;
