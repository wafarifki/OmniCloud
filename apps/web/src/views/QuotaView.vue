<script setup>
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
	IconBrandGoogleDrive,
	IconChevronDown,
	IconCloud,
	IconLinkPlus,
	IconPlugConnectedX,
	IconRefresh,
} from '@tabler/icons-vue';
import DriveShell from '../components/DriveShell.vue';
import { useAccountManagementStore } from '../stores/accountManagement';
import { api } from '../services/api';

const accountStore = useAccountManagementStore();
const { accounts, isLoading, error, isDisconnectingId } = storeToRefs(accountStore);

const connectingProvider = ref('');
const actionError = ref('');
const isSyncing = ref(false);
const isConnectMenuOpen = ref(false);

const totalUsed = computed(() => accounts.value.reduce((sum, account) => sum + Number(account.used_space || 0), 0));
const totalSpace = computed(() => accounts.value.reduce((sum, account) => sum + Number(account.total_space || 0), 0));
const totalFree = computed(() => Math.max(0, totalSpace.value - totalUsed.value));

const accountPalette = [
	{
		used: 'bg-[#1a73e8]',
		free: 'bg-[#d2e3fc]',
		surface: 'bg-[#e8f0fe]',
		text: 'text-[#1a73e8]',
	},
	{
		used: 'bg-[#188038]',
		free: 'bg-[#ceead6]',
		surface: 'bg-[#e6f4ea]',
		text: 'text-[#188038]',
	},
	{
		used: 'bg-[#c26401]',
		free: 'bg-[#fce8b2]',
		surface: 'bg-[#fef7e0]',
		text: 'text-[#c26401]',
	},
	{
		used: 'bg-[#9334e6]',
		free: 'bg-[#e9d7fe]',
		surface: 'bg-[#f3e8ff]',
		text: 'text-[#9334e6]',
	},
];

const storageSegments = computed(() => {
	const total = totalSpace.value || 1;

	const accountSegments = accounts.value.flatMap((account, index) => {
		const used = Math.max(0, Number(account.used_space || 0));
		const capacity = Math.max(0, Number(account.total_space || 0));
		const free = Math.max(0, capacity - used);
		const palette = accountPalette[index % accountPalette.length];

		return [
			{
				key: `${account.id}-used`,
				width: `${(used / total) * 100}%`,
				className: palette.used,
			},
			{
				key: `${account.id}-free`,
				width: `${(free / total) * 100}%`,
				className: palette.free,
			},
		].filter((segment) => Number.parseFloat(segment.width) > 0);
	});

	if (!accounts.value.length && totalFree.value > 0) {
		return [
			{
				key: 'empty-free',
				width: '100%',
				className: 'bg-[#eef2f7] dark:bg-slate-700',
			},
		];
	}

	return accountSegments;
});

const accountLegends = computed(() =>
	accounts.value.map((account, index) => {
		const used = Math.max(0, Number(account.used_space || 0));
		const total = Math.max(0, Number(account.total_space || 0));
		const free = Math.max(0, total - used);
		return {
			...account,
			used,
			free,
			palette: accountPalette[index % accountPalette.length],
		};
	}),
);

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

function providerLabel(provider) {
	if (provider === 'google_drive') return 'Google Drive';
	if (provider === 'onedrive') return 'OneDrive';
	return provider;
}

function providerBadgeClass(status) {
	return status === 'active'
		? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
		: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
}

async function loadPage() {
	await accountStore.loadAccounts();
}

async function connectGoogleDrive() {
	connectingProvider.value = 'google_drive';
	isConnectMenuOpen.value = false;
	actionError.value = '';
	try {
		const { data } = await api.getGoogleConnectUrl();
		window.location.href = data.authorizationUrl;
	} catch (error) {
		actionError.value = error.message;
	} finally {
		connectingProvider.value = '';
	}
}

async function connectOneDrive() {
	connectingProvider.value = 'onedrive';
	isConnectMenuOpen.value = false;
	actionError.value = '';
	try {
		const { data } = await api.getOneDriveConnectUrl();
		window.location.href = data.authorizationUrl;
	} catch (error) {
		actionError.value = error.message;
	} finally {
		connectingProvider.value = '';
	}
}

async function disconnectAccount(account) {
	const confirmed = window.confirm(`Disconnect akun ${account.email}?`);
	if (!confirmed) return;

	actionError.value = '';
	try {
		await accountStore.disconnectAccount(account.id);
	} catch (error) {
		actionError.value = error.message;
	}
}

async function syncNow() {
	isSyncing.value = true;
	actionError.value = '';
	try {
		await api.runSync();
		await accountStore.loadAccounts();
	} catch (error) {
		actionError.value = error.message;
	} finally {
		isSyncing.value = false;
	}
}

function toggleConnectMenu() {
	isConnectMenuOpen.value = !isConnectMenuOpen.value;
}

onMounted(loadPage);
</script>

<template>
	<DriveShell current-section="storage">
		<div class="min-h-[calc(100vh-84px)] rounded-[24px] bg-white px-4 py-[18px] pb-6 text-[#202124] dark:bg-slate-800 dark:text-slate-100 sm:px-6">
			<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 class="text-2xl font-normal">Penyimpanan</h1>
					<p class="mt-1 text-sm text-[#5f6368] dark:text-slate-400">Lihat semua akun cloud, kuota masing-masing, lalu hubungkan atau putuskan akun.</p>
				</div>

				<div class="flex flex-wrap items-center gap-3">
					<button type="button" class="inline-flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 py-2 text-[#1a73e8] disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-sky-400" :disabled="isSyncing" @click="syncNow">
						<IconRefresh :size="18" :stroke="2" :class="isSyncing ? 'animate-spin' : ''" />
						<span>{{ isSyncing ? 'Sinkronisasi...' : 'Sinkronkan sekarang' }}</span>
					</button>

					<div class="relative">
						<button type="button" class="inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-4 py-2 text-white disabled:opacity-60" :disabled="Boolean(connectingProvider)" @click="toggleConnectMenu">
							<IconLinkPlus :size="18" :stroke="2" />
							<span>{{ connectingProvider ? 'Menghubungkan...' : 'Hubungkan' }}</span>
							<IconChevronDown :size="16" :stroke="2" class="transition" :class="isConnectMenuOpen ? 'rotate-180' : ''" />
						</button>

						<div v-if="isConnectMenuOpen" class="absolute right-0 top-[calc(100%+10px)] z-20 min-w-[240px] overflow-hidden rounded-[20px] border border-[#e0e3e7] bg-white py-2 shadow-[0_18px_44px_rgba(32,33,36,0.18)] dark:border-slate-700 dark:bg-slate-900">
							<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] disabled:opacity-60 dark:text-slate-100 dark:hover:bg-slate-800" :disabled="Boolean(connectingProvider)" @click="connectGoogleDrive">
								<IconBrandGoogleDrive :size="18" :stroke="2" />
								<span>{{ connectingProvider === 'google_drive' ? 'Menghubungkan Google...' : 'Google Drive' }}</span>
							</button>
							<button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#202124] hover:bg-[#f8fafd] disabled:opacity-60 dark:text-slate-100 dark:hover:bg-slate-800" :disabled="Boolean(connectingProvider)" @click="connectOneDrive">
								<IconLinkPlus :size="18" :stroke="2" />
								<span>{{ connectingProvider === 'onedrive' ? 'Menghubungkan OneDrive...' : 'OneDrive' }}</span>
							</button>
						</div>
					</div>
				</div>
			</div>

			<section class="mb-6 rounded-[28px] border border-[#e0e3e7] bg-white p-5 dark:border-slate-700 dark:bg-slate-900/70">
				<div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
					<div class="flex items-center gap-3">
						<div class="grid size-12 place-items-center rounded-2xl bg-[#e8f0fe] text-[#1a73e8] dark:bg-slate-800">
							<IconCloud :size="24" :stroke="1.8" />
						</div>
						<div>
							<p class="text-sm text-[#5f6368] dark:text-slate-400">Total penyimpanan</p>
							<strong class="text-xl">{{ formatBytes(totalUsed) }} / {{ formatBytes(totalSpace) }}</strong>
						</div>
					</div>

					<div class="min-w-[220px] rounded-[22px] bg-[#f8fafd] px-4 py-3 text-sm dark:bg-slate-800/80">
						<div class="flex items-center justify-between gap-3">
							<span class="text-[#5f6368] dark:text-slate-400">Ruang terpakai</span>
							<strong>{{ formatBytes(totalUsed) }}</strong>
						</div>
						<div class="mt-2 flex items-center justify-between gap-3">
							<span class="text-[#5f6368] dark:text-slate-400">Ruang kosong</span>
							<strong>{{ formatBytes(totalFree) }}</strong>
						</div>
					</div>
				</div>

				<div class="mt-5 overflow-hidden rounded-full bg-[#eef2f7] dark:bg-slate-800">
					<div class="flex h-5 w-full overflow-hidden rounded-full">
						<div v-for="segment in storageSegments" :key="segment.key" class="h-full" :class="segment.className" :style="{ width: segment.width }" />
					</div>
				</div>

				<div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					<div v-for="account in accountLegends" :key="account.id" class="rounded-[22px] border border-[#e3e8ee] bg-[#f8fafd] p-4 dark:border-slate-700 dark:bg-slate-800/85">
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="text-sm font-semibold">{{ account.email }}</p>
								<p class="text-xs text-[#5f6368] dark:text-slate-400">{{ providerLabel(account.provider) }}</p>
							</div>
							<div class="grid gap-1 text-xs">
								<span class="inline-flex items-center gap-2">
									<span class="size-2.5 rounded-full" :class="account.palette.used" />
									Terpakai
								</span>
								<span class="inline-flex items-center gap-2 text-[#5f6368] dark:text-slate-400">
									<span class="size-2.5 rounded-full" :class="account.palette.free" />
									Kosong
								</span>
							</div>
						</div>

						<div class="mt-4 h-3 overflow-hidden rounded-full bg-[#eef2f7] dark:bg-slate-700">
							<div class="flex h-full w-full overflow-hidden rounded-full">
								<div class="h-full" :class="account.palette.used" :style="{ width: `${account.total_space ? Math.min(100, (account.used / account.total_space) * 100) : 0}%` }" />
								<div class="h-full" :class="account.palette.free" :style="{ width: `${account.total_space ? Math.min(100, (account.free / account.total_space) * 100) : 0}%` }" />
							</div>
						</div>

						<div class="mt-3 flex items-center justify-between gap-3 text-sm">
							<span class="text-[#5f6368] dark:text-slate-400">{{ formatBytes(account.used) }} / {{ formatBytes(account.total_space) }}</span>
							<span class="font-medium" :class="account.palette.text">{{ formatBytes(account.free) }} kosong</span>
						</div>

						<div class="mt-4 flex items-center justify-between gap-3">
							<button type="button" class="inline-flex h-10 items-center gap-2 rounded-full border border-[#f3c7c4] bg-white px-4 text-[#c5221f] disabled:opacity-60 dark:border-red-900/50 dark:bg-slate-800 dark:text-red-300" :disabled="isDisconnectingId === account.id" @click="disconnectAccount(account)">
								<IconPlugConnectedX :size="18" :stroke="2" />
								<span>{{ isDisconnectingId === account.id ? 'Memutuskan...' : 'Disconnect' }}</span>
							</button>

							<span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize" :class="providerBadgeClass(account.status)">{{ account.status }}</span>
						</div>
					</div>
				</div>
			</section>

			<p v-if="actionError || error" class="mb-4 rounded-2xl bg-[#fce8e6] px-4 py-3 text-sm text-[#c5221f] dark:bg-red-950/40 dark:text-red-300">{{ actionError || error }}</p>

			<div v-if="!accounts.length && !isLoading" class="rounded-[24px] border border-dashed border-[#dadce0] bg-white p-6 text-center text-[#5f6368] dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
					Belum ada akun terhubung.
			</div>
		</div>
	</DriveShell>
</template>