import dotenv from 'dotenv';
import os from 'os';
import crypto from 'crypto';
import path from 'path';

dotenv.config();

const machineFingerprint = crypto
	.createHash('sha256')
	.update(`${os.hostname()}|${os.platform()}|${os.arch()}`)
	.digest('hex');

const envHalf = process.env.OMNICLOUD_SECRET_HALF || 'omnicloud-dev-secret-half';
const derivedKeyMaterial = `${envHalf}:${machineFingerprint}`;
const encryptionKey = crypto.createHash('sha256').update(derivedKeyMaterial).digest();

export const env = {
	port: Number(process.env.PORT || 8787),
	corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
	syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES || 5),
	encryptionKey,
	frontendUrl: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
	googleCredentialsPath: path.resolve(
		process.cwd(),
		process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json',
	),
	googleRedirectUri:
		process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8787/api/accounts/google/callback',
	onedriveClientId: process.env.ONEDRIVE_CLIENT_ID || '',
	onedriveClientSecret: process.env.ONEDRIVE_CLIENT_SECRET || '',
	onedriveTenantId: process.env.ONEDRIVE_TENANT_ID || 'common',
	onedriveRedirectUri:
		process.env.ONEDRIVE_REDIRECT_URI || 'http://localhost:8787/api/accounts/onedrive/callback',
};

export function redactEnv() {
	return {
		port: env.port,
		corsOrigin: env.corsOrigin,
		syncIntervalMinutes: env.syncIntervalMinutes,
		frontendUrl: env.frontendUrl,
		googleCredentialsPath: env.googleCredentialsPath,
		googleRedirectUri: env.googleRedirectUri,
		onedriveClientId: env.onedriveClientId ? '[configured]' : '[missing]',
		onedriveTenantId: env.onedriveTenantId,
		onedriveRedirectUri: env.onedriveRedirectUri,
	};
}
