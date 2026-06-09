import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/healthRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { env } from './config/env.js';

export function createApp() {
	const app = express();

	app.use(
		cors({
			origin: env.corsOrigin,
		}),
	);
	app.use(express.json());

	app.use('/api', healthRoutes);
	app.use('/api', accountRoutes);
	app.use('/api', fileRoutes);
	app.use('/api', uploadRoutes);
	app.use('/api', settingsRoutes);

	app.use((error, _req, res, _next) => {
		console.error(error);
		res.status(500).json({
			error: error.message || 'Internal server error',
		});
	});

	return app;
}
