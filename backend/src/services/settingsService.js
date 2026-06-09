import { db } from '../config/database.js';

const VALID_KEYS = ['language', 'theme'];

export function getSetting(key) {
	if (!VALID_KEYS.includes(key)) {
		throw new Error(`Invalid setting key: ${key}`);
	}

	const row = db.prepare('SELECT value FROM user_settings WHERE key = ?').get(key);
	return row ? row.value : null;
}

export function getSettings() {
	const rows = db.prepare('SELECT key, value FROM user_settings').all();
	const settings = {};

	for (const row of rows) {
		settings[row.key] = row.value;
	}

	return settings;
}

export function setSetting(key, value) {
	if (!VALID_KEYS.includes(key)) {
		throw new Error(`Invalid setting key: ${key}`);
	}

	const stmt = db.prepare(`
		INSERT INTO user_settings (key, value, updated_at)
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(key) DO UPDATE SET
			value = excluded.value,
			updated_at = CURRENT_TIMESTAMP
	`);

	stmt.run(key, value);
	return { key, value };
}

export function updateSettings(settings) {
	const results = {};

	for (const [key, value] of Object.entries(settings)) {
		if (VALID_KEYS.includes(key)) {
			setSetting(key, value);
			results[key] = value;
		}
	}

	return results;
}
