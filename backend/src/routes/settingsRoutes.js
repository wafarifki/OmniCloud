import { Router } from 'express';
import { getSettings, updateSettings } from '../services/settingsService.js';

const router = Router();

router.get('/settings', (_req, res) => {
	try {
		const settings = getSettings();
		res.json({ data: settings });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.patch('/settings', (req, res) => {
	try {
		const settings = req.body;
		const updated = updateSettings(settings);
		res.json({ data: updated });
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
});

export default router;
