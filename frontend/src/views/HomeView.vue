<script setup>
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import {
	IconFileDescription,
	IconInfoCircle,
	IconLayoutList,
} from '@tabler/icons-vue';
import dropboxLogo from '../assets/dropbox.svg';
import googleDriveLogo from '../assets/google-drive.svg';
import megaLogo from '../assets/mega.svg';
import oneDriveLogo from '../assets/microsoft-onedrive.svg';
import DriveShell from '../components/DriveShell.vue';
import TruncateMarquee from '../components/TruncateMarquee.vue';
import { useFileTreeStore } from '../stores/fileTree';
import { useAccountManagementStore } from '../stores/accountManagement';

const { t } = useI18n();

const fileTreeStore = useFileTreeStore();
const accountStore = useAccountManagementStore();

const { files, isLoading } = storeToRefs(fileTreeStore);
const { accounts } = storeToRefs(accountStore);

const quickFiles = computed(() => files.value.filter((file) => !file.is_folder).slice(0, 6));

const totalUsed = computed(() => accounts.value.reduce((sum, account) => sum + Number(account.used_space || 0), 0));
const totalSpace = computed(() => accounts.value.reduce((sum, account) => sum + Number(account.total_space || 0), 0));
const storagePercent = computed(() => {
	if (!totalSpace.value) return 0;
	return Math.min(100, Math.round((totalUsed.value / totalSpace.value) * 100));
});

function formatBytes(value) {
	if (!value) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let amount = Number(value);
	let index = 0;
	while (amount >= 1024 && index < units.length - 1) {
		amount /= 1024;
		index += 1;
	}
	return `${amount.toFixed(amount >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
	if (!value) return t('home.justNow');
	return new Intl.DateTimeFormat('id-ID', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	}).format(new Date(value));
}

function getModifiedTime(file) {
	return file.modifiedTime;
}

function providerLabel(provider) {
	if (provider === 'google_drive') return 'Google Drive';
	if (provider === 'onedrive') return 'OneDrive';
	if (provider === 'dropbox') return 'Dropbox';
	if (provider === 'mega') return 'MEGA';
	return provider || 'Provider';
}

function providerIcon(provider) {
	if (provider === 'google_drive') return googleDriveLogo;
	if (provider === 'onedrive') return oneDriveLogo;
	if (provider === 'dropbox') return dropboxLogo;
	if (provider === 'mega') return megaLogo;
	return null;
}

async function loadPage() {
	await Promise.all([fileTreeStore.loadFiles('/'), accountStore.loadAccounts()]);
}

onMounted(loadPage);
</script>

<template>
	<DriveShell current-section="home">
		<div class="min-h-[calc(100vh-84px)] rounded-[24px] bg-white px-4 py-[18px] pb-7 text-[#202124] dark:bg-slate-800 dark:text-slate-100 sm:px-6">
			<div class="mb-[18px] flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
				<h1 class="m-0 text-2xl font-normal text-[#202124] dark:text-slate-100">{{ t('home.title') }}</h1>

				<div class="flex items-center gap-2">
					<button type="button" class="grid size-9 place-items-center rounded-full text-[#5f6368] hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/8">
						<IconInfoCircle :size="18" :stroke="2" />
					</button>
					<button type="button" class="grid size-9 place-items-center rounded-full text-[#5f6368] hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/8">
						<IconLayoutList :size="18" :stroke="2" />
					</button>
				</div>
			</div>

			<section class="mb-7 grid gap-5 rounded-[20px] bg-gradient-to-b from-[#e8f0fe] to-[#f1f6ff] p-7 dark:from-slate-900 dark:to-slate-800 sm:grid-cols-[minmax(0,1.6fr)_280px]">
				<div>
					<p class="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#1a73e8]">{{ t('home.subtitle') }}</p>
					<h2 class="mb-2 text-[28px] font-medium text-[#202124] dark:text-slate-100">{{ t('home.heroTitle') }}</h2>
					<p class="text-[#5f6368] dark:text-slate-400">
						{{ t('home.heroDesc') }}
					</p>

					<div class="mt-[18px] flex flex-wrap gap-3">
						<RouterLink to="/my-drive" class="inline-flex h-10 items-center rounded-full border border-[#1a73e8] bg-[#1a73e8] px-[18px] text-white disabled:opacity-60">
							{{ t('nav.myDrive') }}
						</RouterLink>
						<RouterLink to="/quota" class="inline-flex h-10 items-center rounded-full border border-[#dadce0] bg-white px-[18px] text-[#1a73e8] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400">
							{{ t('nav.storage') }}
						</RouterLink>
					</div>
				</div>

				<div class="flex flex-col items-center justify-center gap-3.5 rounded-[20px] border border-[#e0e3e7] bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-800/80">
					<div class="grid size-[116px] place-items-center rounded-full" :style="{ background: `conic-gradient(#1a73e8 0 ${storagePercent}%, #eaf1fb ${storagePercent}% 100%)` }">
						<div class="grid size-[82px] place-items-center rounded-full bg-white font-bold text-[#1a73e8] dark:bg-slate-900">{{ storagePercent }}%</div>
					</div>
					<div>
						<strong>{{ formatBytes(totalUsed) }}</strong>
						<p class="text-[#5f6368] dark:text-slate-400">{{ t('sidebar.storageUsed', { used: formatBytes(totalUsed), total: formatBytes(totalSpace) }) }}</p>
					</div>
				</div>
			</section>

			<section class="mt-[26px]">
				<div class="mb-3 flex items-center justify-between gap-3">
					<h2 class="m-0 text-base font-medium text-[#202124] dark:text-slate-100">{{ t('home.recentFiles') }}</h2>
					<RouterLink to="/recent" class="rounded-full border border-[#dadce0] bg-white px-3.5 py-2 text-[#1a73e8] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400">{{ t('home.viewAll') }}</RouterLink>
				</div>

				<div class="overflow-hidden rounded-2xl border border-[#e0e3e7] dark:border-slate-700">
					<div class="grid min-h-11 grid-cols-[minmax(220px,2fr)_1.1fr_1fr_140px] items-center gap-3 bg-[#f8fafd] px-[18px] text-[13px] text-[#5f6368] dark:bg-slate-900/70 dark:text-slate-400 max-md:grid-cols-[minmax(180px,1.8fr)_1fr_1fr]">
						<span>{{ t('home.fileName') }}</span>
						<span>{{ t('home.fileOwner') }}</span>
						<span>{{ t('home.fileModified') }}</span>
						<span class="max-md:hidden">{{ t('home.fileSize') }}</span>
					</div>

					<div v-for="file in quickFiles" :key="file.id" class="grid min-h-[52px] grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)_140px] items-center gap-3 border-t border-[#eceff1] px-[18px] dark:border-slate-700 max-md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
						<span class="flex min-w-0 items-center gap-2.5 text-[#202124] dark:text-slate-100">
							<IconFileDescription :size="18" :stroke="1.8" class="text-[#5f6368] dark:text-slate-400" />
							<TruncateMarquee :text="file.display_name || file.file_name" />
						</span>
						<div class="flex min-w-0 items-center gap-2 text-[#5f6368] dark:text-slate-400">
							<div v-if="providerIcon(file.provider)" class="flex size-6 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900/70">
								<img :src="providerIcon(file.provider)" :alt="providerLabel(file.provider)" class="size-3.5 object-contain" />
							</div>
							<TruncateMarquee class="min-w-0" :text="file.email" />
						</div>
						<span class="text-[#5f6368] dark:text-slate-400">{{ formatDate(getModifiedTime(file)) }}</span>
						<span class="text-[#5f6368] dark:text-slate-400 max-md:hidden">{{ formatBytes(file.size) }}</span>
					</div>

					<div v-if="!quickFiles.length && !isLoading" class="p-[18px] text-[#5f6368] dark:text-slate-400">{{ t('home.noFiles') }}</div>
				</div>
			</section>
		</div>
	</DriveShell>
</template>