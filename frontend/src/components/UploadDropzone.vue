<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const emit = defineEmits(['files-selected']);

function onInputChange(event) {
	const files = Array.from(event.target.files || []);
	if (files.length) {
		emit('files-selected', files);
	}
}

function onDrop(event) {
	event.preventDefault();
	const files = Array.from(event.dataTransfer?.files || []);
	if (files.length) {
		emit('files-selected', files);
	}
}

function onDragOver(event) {
	event.preventDefault();
}
</script>

<template>
	<label class="flex cursor-pointer flex-col gap-5 rounded-[28px] border border-dashed border-[#c7d2e2] bg-gradient-to-br from-[#f7faff] to-white p-6 transition hover:border-[#1a73e8] hover:bg-[#f4f8ff]" @drop="onDrop" @dragover="onDragOver">
		<input class="hidden" type="file" multiple @change="onInputChange" />
		<div class="space-y-3">
			<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#1a73e8]">{{ t('drive.uploadPipeline') }}</p>
			<h2 class="text-2xl font-semibold text-[#202124]">{{ t('drive.dragDropTitle') }}</h2>
			<p class="max-w-3xl text-sm leading-6 text-[#5f6368]">
				{{ t('drive.dragDropDesc') }}
			</p>
		</div>
		<span class="inline-flex w-fit items-center rounded-full bg-[#1a73e8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
			{{ t('drive.chooseFiles') }}
		</span>
	</label>
</template>
