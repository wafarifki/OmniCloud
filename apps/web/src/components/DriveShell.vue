<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import {
	IconBrandGoogleDrive,
	IconChevronRight,
	IconHelp,
	IconHome,
	IconLayoutGrid,
	IconMoon,
	IconPlus,
	IconSearch,
	IconSettings,
	IconSun,
	IconStar,
	IconTrash,
	IconUsers,
	IconClockHour4,
	IconAdjustmentsHorizontal,
	IconCloud,
	IconFolder,
} from '@tabler/icons-vue';

const props = defineProps({
	currentSection: { type: String, required: true },
});

const emit = defineEmits(['new-folder', 'upload-files', 'upload-folder']);

const isCreateMenuOpen = ref(false);
const createMenuRef = ref(null);
const theme = ref('light');

function toggleCreateMenu() {
	isCreateMenuOpen.value = !isCreateMenuOpen.value;
}

function runCreateAction(action) {
	isCreateMenuOpen.value = false;
	emit(action);
}

function handleDocumentClick(event) {
	if (!createMenuRef.value?.contains(event.target)) {
		isCreateMenuOpen.value = false;
	}
}

function applyTheme(nextTheme) {
	theme.value = nextTheme;
	document.documentElement.classList.toggle('dark', nextTheme === 'dark');
	window.localStorage.setItem('omnicloud-theme', nextTheme);
}

function toggleTheme() {
	applyTheme(theme.value === 'dark' ? 'light' : 'dark');
}

onMounted(() => {
	theme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
	document.addEventListener('click', handleDocumentClick);
});

onBeforeUnmount(() => {
	document.removeEventListener('click', handleDocumentClick);
});

const navItems = [
	{ id: 'home', label: 'Beranda', icon: IconHome, to: '/' },
	{ id: 'drive', label: 'Drive Saya', icon: IconFolder, to: '/my-drive' },
	{ id: 'shared', label: 'Dibagikan', icon: IconUsers, to: '/my-drive' },
	{ id: 'recent', label: 'Terbaru', icon: IconClockHour4, to: '/my-drive' },
	{ id: 'starred', label: 'Berbintang', icon: IconStar, to: '/my-drive' },
	{ id: 'storage', label: 'Penyimpanan', icon: IconCloud, to: '/quota' },
];
</script>

<template>
	<div class="min-h-screen bg-[#f8fafd] text-[#202124] dark:bg-slate-900 dark:text-slate-100">
		<header class="grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 pr-3 sm:gap-5 sm:px-3 sm:pr-4 lg:grid-cols-[240px_minmax(320px,720px)_1fr]">
			<div class="flex items-center gap-3.5">
				<div class="flex items-center gap-2">
					<IconBrandGoogleDrive :size="28" :stroke="1.8" class="text-[#1a73e8]" />
					<div class="hidden text-[22px] font-medium text-[#5f6368] dark:text-slate-300 lg:block">OmniCloud</div>
				</div>
			</div>

			<div class="grid h-12 min-w-0 grid-cols-[52px_minmax(0,1fr)_48px] items-center rounded-full bg-[#eaf1fb] pr-2.5 dark:bg-slate-800/90">
				<span class="grid place-items-center text-[#5f6368] dark:text-slate-400">
					<IconSearch :size="18" :stroke="2" />
				</span>
				<input type="search" placeholder="Telusuri di OmniCloud" class="min-w-0 border-0 bg-transparent text-base text-[#202124] outline-none placeholder:text-[#5f6368] dark:text-slate-100 dark:placeholder:text-slate-400" />
				<span class="grid place-items-center text-[#5f6368] dark:text-slate-400">
					<IconAdjustmentsHorizontal :size="18" :stroke="2" />
				</span>
			</div>

			<div class="flex items-center justify-end gap-2">
				<button type="button" class="hidden size-10 place-items-center rounded-full text-[#5f6368] hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10 sm:grid" @click="toggleTheme">
					<IconMoon v-if="theme !== 'dark'" :size="18" :stroke="2" />
					<IconSun v-else :size="18" :stroke="2" />
				</button>
				<button type="button" class="hidden size-10 place-items-center rounded-full text-[#5f6368] hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10 sm:grid">
					<IconHelp :size="18" :stroke="2" />
				</button>
				<button type="button" class="hidden size-10 place-items-center rounded-full text-[#5f6368] hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10 sm:grid">
					<IconSettings :size="18" :stroke="2" />
				</button>
			</div>
		</header>

		<div class="grid grid-cols-1 gap-3 lg:grid-cols-[256px_minmax(0,1fr)]">
			<aside class="hidden px-0 py-2 lg:block">
				<div ref="createMenuRef" class="relative ml-4 inline-block">
					<button type="button" class="inline-flex h-14 items-center gap-3.5 rounded-2xl bg-white px-[18px] pr-[22px] font-medium text-[#3c4043] shadow-[0_1px_3px_rgba(60,64,67,0.3),0_4px_8px_rgba(60,64,67,0.15)] dark:bg-slate-800 dark:text-slate-100 dark:shadow-[0_10px_30px_rgba(15,23,42,0.45)]" @click.stop="toggleCreateMenu">
						<IconPlus :size="22" :stroke="2" />
						<span>Baru</span>
					</button>

					<div v-if="isCreateMenuOpen" class="absolute left-0 top-[calc(100%+10px)] z-30 w-56 overflow-hidden rounded-2xl border border-[#e0e3e7] bg-white py-2 shadow-[0_12px_36px_rgba(60,64,67,0.2)] dark:border-slate-700 dark:bg-slate-800 dark:shadow-[0_12px_36px_rgba(15,23,42,0.45)]">
						<button type="button" class="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] dark:text-slate-100 dark:hover:bg-slate-700/70" @click="runCreateAction('new-folder')">
							<span>Folder Baru</span>
							<IconChevronRight :size="16" :stroke="2" class="text-[#5f6368] dark:text-slate-400" />
						</button>
						<button type="button" class="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] dark:text-slate-100 dark:hover:bg-slate-700/70" @click="runCreateAction('upload-files')">
							<span>Upload File</span>
							<IconChevronRight :size="16" :stroke="2" class="text-[#5f6368] dark:text-slate-400" />
						</button>
						<button type="button" class="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] dark:text-slate-100 dark:hover:bg-slate-700/70" @click="runCreateAction('upload-folder')">
							<span>Upload Folder</span>
							<IconChevronRight :size="16" :stroke="2" class="text-[#5f6368] dark:text-slate-400" />
						</button>
					</div>
				</div>

				<nav class="mt-[18px] flex flex-col gap-0.5">
					<RouterLink v-for="item in navItems" :key="item.label" :to="item.to" class="mr-3 flex h-10 items-center gap-3.5 rounded-r-[20px] px-6 text-[#202124] dark:text-slate-100" :class="props.currentSection === item.id ? 'bg-[#d3e3fd] font-semibold dark:bg-slate-700' : 'hover:bg-black/[0.03] dark:hover:bg-white/6'">
						<component :is="item.icon" :size="18" :stroke="2" class="shrink-0 text-[#5f6368] dark:text-slate-400" />
						<span>{{ item.label }}</span>
					</RouterLink>
				</nav>

			</aside>

			<main class="px-2 pb-4 lg:px-0 lg:pr-4 lg:pb-6">
				<slot />
			</main>
		</div>
	</div>
</template>