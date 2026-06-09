<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconBrandGoogleDrive } from '@tabler/icons-vue';
import { api } from '../services/api';

const { t } = useI18n();

const props = defineProps({
	accounts: { type: Array, required: true },
});

const isConnecting = ref(false);
const connectError = ref('');

function formatBytes(value) {
	if (!value) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let amount = Number(value);
	let unitIndex = 0;
	while (amount >= 1024 && unitIndex < units.length - 1) {
		amount /= 1024;
		unitIndex += 1;
	}
	return `${amount.toFixed(amount >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function usagePercent(account) {
	if (!Number(account.total_space)) return 0;
	return Math.min(100, Math.round((Number(account.used_space) / Number(account.total_space)) * 100));
}

async function connectGoogleDrive() {
	isConnecting.value = true;
	connectError.value = '';

	try {
		const { data } = await api.getGoogleConnectUrl();
		window.location.href = data.authorizationUrl;
	} catch (error) {
		connectError.value = error.message;
	} finally {
		isConnecting.value = false;
	}
}
</script>

<template>
	<section class="rounded-[28px] border border-[#e6ebf2] bg-white p-6 shadow-sm">
		<div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#1a73e8]">{{ t('storagePanel.integratedAccounts') }}</p>
				<h2 class="mt-2 text-2xl font-semibold text-[#202124]">{{ t('storagePanel.quotaOverview') }}</h2>
			</div>
			<button type="button" class="inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" :disabled="isConnecting" @click="connectGoogleDrive">
				<IconBrandGoogleDrive :size="18" :stroke="2" />
				{{ isConnecting ? t('storagePanel.connecting') : t('storagePanel.connectGoogle') }}
			</button>
		</div>

		<p v-if="connectError" class="mb-4 rounded-2xl bg-[#fce8e6] px-4 py-3 text-sm text-[#c5221f]">{{ connectError }}</p>

		<div class="grid gap-4">
			<article v-for="account in props.accounts" :key="account.id" class="rounded-3xl border border-[#e6ebf2] bg-[#fbfcff] p-5">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<strong class="block text-base font-semibold text-[#202124]">{{ account.email }}</strong>
						<p class="mt-1 text-sm text-[#5f6368]">{{ account.provider }}</p>
					</div>
					<span class="rounded-full bg-[#e6f4ea] px-3 py-1 text-xs font-semibold capitalize text-[#188038]">{{ account.status }}</span>
				</div>

				<div class="mt-4 h-2 overflow-hidden rounded-full bg-[#dfe6ef]">
					<span class="block h-full rounded-full bg-[#1a73e8]" :style="{ width: `${usagePercent(account)}%` }"></span>
				</div>

				<div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[#5f6368]">
					<span>{{ formatBytes(account.used_space) }} {{ t('storagePanel.used') }}</span>
					<span>{{ formatBytes(account.free_space) }} {{ t('storagePanel.free') }}</span>
				</div>
			</article>

			<div v-if="!props.accounts.length" class="rounded-3xl border border-[#e6ebf2] bg-[#fbfcff] p-5 text-sm text-[#5f6368]">
				{{ t('storagePanel.noAccounts') }}
			</div>
		</div>
	</section>
</template>
