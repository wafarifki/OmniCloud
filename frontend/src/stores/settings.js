import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../services/api';
import { setLocale, getLocale, SUPPORTED_LOCALES } from '../i18n';

export const useSettingsStore = defineStore('settings', () => {
	const language = ref(getLocale());
	const isLoading = ref(false);
	const error = ref('');
	const isInitialized = ref(false);

	async function loadSettings() {
		if (isInitialized.value) return;

		isLoading.value = true;
		error.value = '';

		try {
			const { data } = await api.getSettings();
			if (data?.language && SUPPORTED_LOCALES.includes(data.language)) {
				language.value = data.language;
				setLocale(data.language);
			}
			isInitialized.value = true;
		} catch (err) {
			console.warn('Could not load settings from backend, using local storage:', err.message);
			isInitialized.value = true;
		} finally {
			isLoading.value = false;
		}
	}

	async function updateLanguage(newLanguage) {
		if (!SUPPORTED_LOCALES.includes(newLanguage)) return;

		const previousLanguage = language.value;
		language.value = newLanguage;
		setLocale(newLanguage);

		try {
			await api.updateSettings({ language: newLanguage });
		} catch (err) {
			console.warn('Could not save language to backend, saved to local storage only:', err.message);
		}
	}

	return {
		language,
		isLoading,
		error,
		isInitialized,
		loadSettings,
		updateLanguage,
	};
});
