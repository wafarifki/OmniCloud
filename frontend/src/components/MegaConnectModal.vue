<script setup>
import { ref } from 'vue';

const props = defineProps({
	isConnecting: {
		type: Boolean,
		default: false,
	},
	error: {
		type: String,
		default: '',
	},
});

const emit = defineEmits(['close', 'connect']);

const form = ref({
	email: '',
	password: '',
	secondFactorCode: '',
});

function closeModal() {
	if (props.isConnecting) return;
	emit('close');
}

function submitForm() {
	emit('connect', {
		email: form.value.email,
		password: form.value.password,
		secondFactorCode: form.value.secondFactorCode || undefined,
	});
}
</script>

<template>
	<div class="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 backdrop-blur-sm">
		<form class="w-full max-w-md rounded-[28px] border border-[#e0e3e7] bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900" @submit.prevent="submitForm">
			<div class="mb-5">
				<h2 class="text-xl font-medium">Hubungkan MEGA</h2>
			</div>

			<p v-if="error" class="mb-4 rounded-2xl bg-[#fce8e6] px-4 py-3 text-sm text-[#c5221f] dark:bg-red-950/40 dark:text-red-300">
				{{ error }}
			</p>

			<label class="mb-3 block text-sm">
				<span class="mb-1 block text-[#5f6368] dark:text-slate-400">Email</span>
				<input v-model="form.email" type="email" required autocomplete="username" placeholder="nama@email.com" class="h-11 w-full rounded-2xl border border-[#dadce0] bg-white px-4 outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8] dark:border-slate-700 dark:bg-slate-800 dark:placeholder:text-slate-500" />
			</label>

			<label class="mb-3 block text-sm">
				<span class="mb-1 block text-[#5f6368] dark:text-slate-400">Password</span>
				<input v-model="form.password" type="password" required autocomplete="current-password" placeholder="Password akun MEGA" class="h-11 w-full rounded-2xl border border-[#dadce0] bg-white px-4 outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8] dark:border-slate-700 dark:bg-slate-800 dark:placeholder:text-slate-500" />
			</label>

			<label class="block text-sm">
				<span class="mb-1 block text-[#5f6368] dark:text-slate-400">Kode 2FA <span class="text-xs">(opsional)</span></span>
				<input v-model="form.secondFactorCode" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" class="h-11 w-full rounded-2xl border border-[#dadce0] bg-white px-4 outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8] dark:border-slate-700 dark:bg-slate-800 dark:placeholder:text-slate-500" />
			</label>

			<div class="mt-6 flex items-center justify-end gap-3">
				<button type="button" class="h-10 rounded-full px-4 text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800" :disabled="isConnecting" @click="closeModal">Batal</button>
				<button type="submit" class="h-10 rounded-full bg-[#1a73e8] px-5 text-white disabled:opacity-60" :disabled="isConnecting">{{ isConnecting ? 'Menghubungkan...' : 'Hubungkan MEGA' }}</button>
			</div>
		</form>
	</div>
</template>
