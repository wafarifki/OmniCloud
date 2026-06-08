import { Router } from 'express';
import { listAccounts } from '../services/accountService.js';
import { env } from '../config/env.js';
import {
	createGoogleAuthorizationRequest,
	completeGoogleAccountLink,
	getGoogleIntegrationStatus,
} from '../services/googleOAuthService.js';
import {
	createOneDriveAuthorizationRequest,
	completeOneDriveAccountLink,
	getOneDriveIntegrationStatus,
} from '../services/oneDriveOAuthService.js';

const router = Router();

router.get('/accounts', (_req, res) => {
	const accounts = listAccounts().map((account) => ({
		...account,
		free_space: Number(account.total_space) - Number(account.used_space),
	}));

	res.json({ data: accounts });
});

router.get('/accounts/google/status', (_req, res) => {
	res.json({ data: getGoogleIntegrationStatus() });
});

router.get('/accounts/onedrive/status', (_req, res) => {
	res.json({ data: getOneDriveIntegrationStatus() });
});

router.get('/accounts/google/connect', (_req, res, next) => {
	try {
		const data = createGoogleAuthorizationRequest();
		res.json({ data });
	} catch (error) {
		next(error);
	}
});

router.get('/accounts/onedrive/connect', (_req, res, next) => {
	try {
		const data = createOneDriveAuthorizationRequest();
		res.json({ data });
	} catch (error) {
		next(error);
	}
});

router.get('/accounts/google/callback', async (req, res) => {
	const frontendUrl = new URL(env.frontendUrl);

	try {
		const { code, state, error } = req.query;

		if (error) {
			frontendUrl.searchParams.set('google', 'error');
			frontendUrl.searchParams.set('message', String(error));
			return res.redirect(frontendUrl.toString());
		}

		await completeGoogleAccountLink({ code: String(code || ''), state: String(state || '') });
		frontendUrl.searchParams.set('google', 'connected');
		return res.redirect(frontendUrl.toString());
	} catch (error) {
		frontendUrl.searchParams.set('google', 'error');
		frontendUrl.searchParams.set('message', error.message);
		return res.redirect(frontendUrl.toString());
	}
});

router.get('/accounts/onedrive/callback', async (req, res) => {
	const frontendUrl = new URL(env.frontendUrl);

	try {
		const { code, state, error } = req.query;

		if (error) {
			frontendUrl.searchParams.set('onedrive', 'error');
			frontendUrl.searchParams.set('message', String(error));
			return res.redirect(frontendUrl.toString());
		}

		await completeOneDriveAccountLink({ code: String(code || ''), state: String(state || '') });
		frontendUrl.searchParams.set('onedrive', 'connected');
		return res.redirect(frontendUrl.toString());
	} catch (error) {
		frontendUrl.searchParams.set('onedrive', 'error');
		frontendUrl.searchParams.set('message', error.message);
		return res.redirect(frontendUrl.toString());
	}
});

export default router;
