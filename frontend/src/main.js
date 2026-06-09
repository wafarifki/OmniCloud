import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import router from './router';
import { i18n } from './i18n';

const storedTheme = window.localStorage.getItem('omnicloud-theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme = storedTheme || (prefersDark ? 'dark' : 'light');

document.documentElement.classList.toggle('dark', initialTheme === 'dark');

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);
app.mount('#app');
