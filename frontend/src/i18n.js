import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import id from './locales/id.json';

const SUPPORTED_LOCALES = ['id', 'en'];
const DEFAULT_LOCALE = 'id';

function detectLocale() {
	const stored = window.localStorage.getItem('omnicloud-language');
	if (stored && SUPPORTED_LOCALES.includes(stored)) {
		return stored;
	}

	const browserLang = navigator.language.split('-')[0];
	if (SUPPORTED_LOCALES.includes(browserLang)) {
		return browserLang;
	}

	return DEFAULT_LOCALE;
}

export const i18n = createI18n({
	legacy: false,
	locale: detectLocale(),
	fallbackLocale: 'en',
	messages: {
		en,
		id,
	},
});

export function setLocale(locale) {
	if (SUPPORTED_LOCALES.includes(locale)) {
		i18n.global.locale.value = locale;
		window.localStorage.setItem('omnicloud-language', locale);
		document.documentElement.setAttribute('lang', locale);
	}
}

export function getLocale() {
	return i18n.global.locale.value;
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
