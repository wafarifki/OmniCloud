import { Router } from 'express';
import { redactEnv } from '../config/env.js';
import { getLastSyncReport, runDeltaSync } from '../services/syncService.js';

const router = Router();

router.get('/health', (_req, res) => {
	res.json({
		status: 'ok',
		service: 'omnicloud-api',
		config: redactEnv(),
		sync: getLastSyncReport(),
		timestamp: new Date().toISOString(),
	});
});

router.post('/sync/run', async (_req, res, next) => {
	try {
		const report = await runDeltaSync();
		res.json({ data: report });
	} catch (error) {
		next(error);
	}
});

export default router;
