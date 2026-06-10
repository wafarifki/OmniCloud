import { db } from '../config/database.js';
import { encryptJson } from '../utils/crypto.js';

export function listAccounts() {
	return db
		.prepare(`
      SELECT id, email, provider, total_space, used_space, status, created_at, updated_at
      FROM cloud_accounts
      ORDER BY provider, email
    `)
		.all();
}

export function getAccountById(id) {
	return db.prepare('SELECT * FROM cloud_accounts WHERE id = ?').get(id);
}

export function getActiveAccounts() {
	return db.prepare("SELECT * FROM cloud_accounts WHERE status = 'active'").all();
}

export function updateAccountUsage(id, usedSpace) {
	db.prepare(
		'UPDATE cloud_accounts SET used_space = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
	).run(usedSpace, id);
}

export function updateAccountStorage(id, totalSpace, usedSpace) {
	db.prepare(
		`UPDATE cloud_accounts
     SET total_space = ?, used_space = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
	).run(totalSpace, usedSpace, id);
}

export function markAccountStatus(id, status) {
	db.prepare('UPDATE cloud_accounts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
		status,
		id,
	);
}

export function updateAccountCredentials(id, credentials) {
	const encrypted_credentials =
		typeof credentials === 'string' ? credentials : encryptJson(credentials);

	db.prepare(
		'UPDATE cloud_accounts SET encrypted_credentials = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
	).run(encrypted_credentials, id);
}

export function deleteAccount(id) {
	db.prepare('DELETE FROM cloud_accounts WHERE id = ?').run(id);
}

export function upsertCloudAccount({
	id,
	email,
	provider,
	credentials,
	total_space,
	used_space,
	status = 'active',
}) {
	const encrypted_credentials = typeof credentials === 'string' ? credentials : encryptJson(credentials);

	db.prepare(`
    INSERT INTO cloud_accounts (
      id, email, provider, encrypted_credentials, total_space, used_space, status
    ) VALUES (
      @id, @email, @provider, @encrypted_credentials, @total_space, @used_space, @status
    )
		ON CONFLICT(provider, email) DO UPDATE SET
      encrypted_credentials = excluded.encrypted_credentials,
      total_space = excluded.total_space,
      used_space = excluded.used_space,
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `).run({
		id,
		email,
		provider,
		encrypted_credentials,
		total_space,
		used_space,
		status,
	});

	return db.prepare('SELECT * FROM cloud_accounts WHERE provider = ? AND email = ?').get(provider, email);
}
