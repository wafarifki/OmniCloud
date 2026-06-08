<script setup>
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
	IconFileDescription,
	IconFolder,
	IconInfoCircle,
	IconLayoutList,
} from '@tabler/icons-vue';
import DriveShell from '../components/DriveShell.vue';
import { useFileTreeStore } from '../stores/fileTree';
import { useAccountManagementStore } from '../stores/accountManagement';
import { api } from '../services/api';

const fileTreeStore = useFileTreeStore();
const accountStore = useAccountManagementStore();

const { files, isLoading } = storeToRefs(fileTreeStore);
const { accounts } = storeToRefs(accountStore);

const connectingProvider = ref('');
const connectError = ref('');

const quickFiles = computed(() => files.value.filter((file) => !file.is_folder).slice(0, 6));
const spotlightFolders = computed(() => files.value.filter((file) => file.is_folder).slice(0, 4));

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
	if (!value) return 'Baru saja';
	return new Intl.DateTimeFormat('id-ID', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	}).format(new Date(value));
}

async function connectGoogleDrive() {
	connectingProvider.value = 'google_drive';
	connectError.value = '';
	try {
		const { data } = await api.getGoogleConnectUrl();
		window.location.href = data.authorizationUrl;
	} catch (error) {
		connectError.value = error.message;
	} finally {
		connectingProvider.value = '';
	}
}

async function connectOneDrive() {
	connectingProvider.value = 'onedrive';
	connectError.value = '';
	try {
		const { data } = await api.getOneDriveConnectUrl();
		window.location.href = data.authorizationUrl;
	} catch (error) {
		connectError.value = error.message;
	} finally {
		connectingProvider.value = '';
	}
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
				<h1 class="m-0 text-2xl font-normal text-[#202124] dark:text-slate-100">Beranda</h1>

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
					<p class="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#1a73e8]">Cloud accounts</p>
					<h2 class="mb-2 text-[28px] font-medium text-[#202124] dark:text-slate-100">Hubungkan akun dan lihat seluruh file seperti tampilan Drive.</h2>
					<p class="text-[#5f6368] dark:text-slate-400">
						Sinkronisasi metadata akun cloud asli dan tampilkan daftar file dalam antarmuka yang menyerupai Google Drive.
					</p>

					<div class="mt-[18px] flex flex-wrap gap-3">
						<button type="button" class="h-10 rounded-full border border-[#1a73e8] bg-[#1a73e8] px-[18px] text-white disabled:opacity-60" :disabled="Boolean(connectingProvider)" @click="connectGoogleDrive">
							{{ connectingProvider === 'google_drive' ? 'Menghubungkan Google...' : 'Hubungkan Google Drive' }}
						</button>
						<button type="button" class="h-10 rounded-full border border-[#dadce0] bg-white px-[18px] text-[#2563eb] disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400" :disabled="Boolean(connectingProvider)" @click="connectOneDrive">
							{{ connectingProvider === 'onedrive' ? 'Menghubungkan OneDrive...' : 'Hubungkan OneDrive' }}
						</button>
						<RouterLink to="/my-drive" class="inline-flex h-10 items-center rounded-full border border-[#dadce0] bg-white px-[18px] text-[#1a73e8] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400">
							Buka Drive Saya
						</RouterLink>
						<RouterLink to="/quota" class="inline-flex h-10 items-center rounded-full border border-[#dadce0] bg-white px-[18px] text-[#1a73e8] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400">
							Buka Penyimpanan
						</RouterLink>
					</div>

					<p v-if="connectError" class="mt-2.5 text-[#d93025]">{{ connectError }}</p>
				</div>

				<div class="flex flex-col items-center justify-center gap-3.5 rounded-[20px] border border-[#e0e3e7] bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-800/80">
					<div class="grid size-[116px] place-items-center rounded-full" :style="{ background: `conic-gradient(#1a73e8 0 ${storagePercent}%, #eaf1fb ${storagePercent}% 100%)` }">
						<div class="grid size-[82px] place-items-center rounded-full bg-white font-bold text-[#1a73e8] dark:bg-slate-900">{{ storagePercent }}%</div>
					</div>
					<div>
						<strong>{{ formatBytes(totalUsed) }}</strong>
						<p class="text-[#5f6368] dark:text-slate-400">dari {{ formatBytes(totalSpace) }} digunakan</p>
					</div>
				</div>
			</section>

			<section class="mt-[26px]">
				<div class="mb-3 flex items-center justify-between gap-3">
					<h2 class="m-0 text-base font-medium text-[#202124] dark:text-slate-100">Saran folder</h2>
					<button type="button" class="rounded-full border border-[#dadce0] bg-white px-3.5 py-2 text-[#1a73e8] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400">Lihat semua</button>
				</div>

				<div class="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
					<article v-for="folder in spotlightFolders" :key="folder.id" class="rounded-2xl border border-[#e0e3e7] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
						<div class="mb-3 text-[#1a73e8]">
							<IconFolder :size="28" :stroke="1.8" />
						</div>
						<strong>{{ folder.display_name || folder.file_name }}</strong>
						<p class="text-[#5f6368] dark:text-slate-400">{{ folder.provider }}</p>
					</article>
					<div v-if="!spotlightFolders.length && !isLoading" class="rounded-2xl border border-[#e0e3e7] p-[18px] text-[#5f6368] dark:border-slate-700 dark:text-slate-400">
						Belum ada folder tersinkron.
					</div>
				</div>
			</section>

			<section class="mt-[26px]">
				<div class="mb-3 flex items-center justify-between gap-3">
					<h2 class="m-0 text-base font-medium text-[#202124] dark:text-slate-100">File terbaru</h2>
					<button type="button" class="rounded-full border border-[#dadce0] bg-white px-3.5 py-2 text-[#1a73e8] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400">Disarankan</button>
				</div>

				<div class="overflow-hidden rounded-2xl border border-[#e0e3e7] dark:border-slate-700">
					<div class="grid min-h-11 grid-cols-[minmax(220px,2fr)_1.1fr_1fr_140px] items-center gap-3 bg-[#f8fafd] px-[18px] text-[13px] text-[#5f6368] dark:bg-slate-900/70 dark:text-slate-400 max-md:grid-cols-[minmax(180px,1.8fr)_1fr_1fr]">
						<span>Nama</span>
						<span>Pemilik</span>
						<span>Terakhir diubah</span>
						<span class="max-md:hidden">Ukuran file</span>
					</div>

					<div v-for="file in quickFiles" :key="file.id" class="grid min-h-[52px] grid-cols-[minmax(220px,2fr)_1.1fr_1fr_140px] items-center gap-3 border-t border-[#eceff1] px-[18px] dark:border-slate-700 max-md:grid-cols-[minmax(180px,1.8fr)_1fr_1fr]">
						<span class="flex items-center gap-2.5 text-[#202124] dark:text-slate-100">
							<IconFileDescription :size="18" :stroke="1.8" class="text-[#5f6368] dark:text-slate-400" />
							{{ file.display_name || file.file_name }}
						</span>
						<span class="text-[#5f6368] dark:text-slate-400">{{ file.email }}</span>
						<span class="text-[#5f6368] dark:text-slate-400">{{ formatDate(file.updated_at) }}</span>
						<span class="text-[#5f6368] dark:text-slate-400 max-md:hidden">{{ formatBytes(file.size) }}</span>
					</div>

					<div v-if="!quickFiles.length && !isLoading" class="p-[18px] text-[#5f6368] dark:text-slate-400">Belum ada file terbaru.</div>
				</div>
			</section>

			<section class="mt-[26px]">
				<div class="mb-3 flex items-center justify-between gap-3">
					<h2 class="m-0 text-base font-medium text-[#202124] dark:text-slate-100">Akun terhubung</h2>
					<button type="button" class="rounded-full border border-[#dadce0] bg-white px-3.5 py-2 text-[#1a73e8] dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400">Kelola</button>
				</div>

				<div class="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
					<article v-for="account in accounts" :key="account.id" class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-[#e0e3e7] bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
						<div class="grid size-9 place-items-center rounded-full bg-[#e8f0fe] font-bold text-[#1a73e8]">
							{{ account.email?.slice(0, 1).toUpperCase() || 'G' }}
						</div>
						<div>
							<strong>{{ account.email }}</strong>
							<p class="text-[#5f6368] dark:text-slate-400">{{ account.provider }}</p>
						</div>
						<span class="text-xs font-semibold capitalize text-[#188038]">{{ account.status }}</span>
					</article>

					<div v-if="!accounts.length" class="rounded-2xl border border-[#e0e3e7] p-[18px] text-[#5f6368] dark:border-slate-700 dark:text-slate-400">
						Belum ada akun terhubung.
					</div>
				</div>
			</section>
		</div>
	</DriveShell>
</template>