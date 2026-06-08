import { randomUUID } from 'crypto';
import path from 'path';
import { db } from '../config/database.js';

function normalizePath(input = '/') {
	if (!input || input === '/') return '/';
	const cleaned = input.startsWith('/') ? input : `/${input}`;
	return cleaned.endsWith('/') ? cleaned : `${cleaned}/`;
}

function buildDisplayNames(rows) {
	const grouped = rows.reduce((map, row) => {
		const key = `${row.virtual_path}:${row.file_name}`;
		if (!map.has(key)) map.set(key, []);
		map.get(key).push(row);
		return map;
	}, new Map());

	return rows.map((row) => {
		const siblings = grouped.get(`${row.virtual_path}:${row.file_name}`) || [];
		if (siblings.length <= 1) {
			return row;
		}

		const ext = path.extname(row.file_name);
		const baseName = ext ? row.file_name.slice(0, -ext.length) : row.file_name;
		return {
			...row,
			display_name: `${baseName} (${row.provider} - ${row.email})${ext}`,
		};
	});
}

export function listFilesByPath(virtualPath = '/') {
	const normalized = normalizePath(virtualPath);
	const rows = db
		.prepare(`
      SELECT
        fm.*, ca.provider, ca.email
      FROM file_metadata fm
      INNER JOIN cloud_accounts ca ON ca.id = fm.cloud_account_id
			WHERE fm.virtual_path = ?
				AND ca.status = 'active'
      ORDER BY fm.is_folder DESC, fm.file_name COLLATE NOCASE ASC
    `)
		.all(normalized);

	return buildDisplayNames(rows);
}

export function createFileMetadata(record) {
	const payload = {
		id: randomUUID(),
		virtual_path: normalizePath(record.virtual_path),
		file_name: record.file_name,
		is_folder: record.is_folder ? 1 : 0,
		size: record.size,
		mime_type: record.mime_type || null,
		cloud_account_id: record.cloud_account_id,
		remote_file_id: record.remote_file_id,
		remote_parent_id: record.remote_parent_id || null,
	};

	db.prepare(`
    INSERT INTO file_metadata (
      id, virtual_path, file_name, is_folder, size, mime_type,
      cloud_account_id, remote_file_id, remote_parent_id
    ) VALUES (
      @id, @virtual_path, @file_name, @is_folder, @size, @mime_type,
      @cloud_account_id, @remote_file_id, @remote_parent_id
    )
  `).run(payload);

	return getFileById(payload.id);
}

export function getFileById(id) {
	return db
		.prepare(`
      SELECT fm.*, ca.provider, ca.email
      FROM file_metadata fm
      INNER JOIN cloud_accounts ca ON ca.id = fm.cloud_account_id
			WHERE fm.id = ? AND ca.status = 'active'
    `)
		.get(id);
}

export function getFileByRemoteId(cloudAccountId, remoteFileId) {
	return db
		.prepare(`
      SELECT fm.*, ca.provider, ca.email
      FROM file_metadata fm
      INNER JOIN cloud_accounts ca ON ca.id = fm.cloud_account_id
			WHERE fm.cloud_account_id = ? AND fm.remote_file_id = ? AND ca.status = 'active'
    `)
		.get(cloudAccountId, remoteFileId);
}

export function listAllFiles() {
	return db.prepare('SELECT * FROM file_metadata').all();
}

export function replaceFilesForAccount(cloudAccountId, records) {
	const normalizedRecords = records.map((record) => ({
		id: record.id || randomUUID(),
		virtual_path: normalizePath(record.virtual_path),
		file_name: record.file_name,
		is_folder: record.is_folder ? 1 : 0,
		size: Number(record.size || 0),
		mime_type: record.mime_type || null,
		cloud_account_id: cloudAccountId,
		remote_file_id: record.remote_file_id,
		remote_parent_id: record.remote_parent_id || null,
	}));

	const replace = db.transaction(() => {
		db.prepare('DELETE FROM file_metadata WHERE cloud_account_id = ?').run(cloudAccountId);

		if (!normalizedRecords.length) {
			return;
		}

		const insert = db.prepare(`
      INSERT INTO file_metadata (
        id, virtual_path, file_name, is_folder, size, mime_type,
        cloud_account_id, remote_file_id, remote_parent_id
      ) VALUES (
        @id, @virtual_path, @file_name, @is_folder, @size, @mime_type,
        @cloud_account_id, @remote_file_id, @remote_parent_id
      )
    `);

		normalizedRecords.forEach((record) => insert.run(record));
	});

	replace();
}

export function clearFilesForAccount(cloudAccountId) {
	db.prepare('DELETE FROM file_metadata WHERE cloud_account_id = ?').run(cloudAccountId);
}

export function upsertFileMetadata(record) {
	db.prepare(`
    INSERT INTO file_metadata (
      id, virtual_path, file_name, is_folder, size, mime_type,
      cloud_account_id, remote_file_id, remote_parent_id
    ) VALUES (
      @id, @virtual_path, @file_name, @is_folder, @size, @mime_type,
      @cloud_account_id, @remote_file_id, @remote_parent_id
    )
    ON CONFLICT(id) DO UPDATE SET
      virtual_path = excluded.virtual_path,
      file_name = excluded.file_name,
      is_folder = excluded.is_folder,
      size = excluded.size,
      mime_type = excluded.mime_type,
      cloud_account_id = excluded.cloud_account_id,
      remote_file_id = excluded.remote_file_id,
      remote_parent_id = excluded.remote_parent_id,
      updated_at = CURRENT_TIMESTAMP
  `).run({
		...record,
		virtual_path: normalizePath(record.virtual_path),
		is_folder: record.is_folder ? 1 : 0,
	});
}

export function listDirectoryTree() {
	return db
		.prepare(`
      SELECT id, virtual_path, file_name, is_folder, cloud_account_id
      FROM file_metadata
      ORDER BY virtual_path, is_folder DESC, file_name
    `)
		.all();
}
