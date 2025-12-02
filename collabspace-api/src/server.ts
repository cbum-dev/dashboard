import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import jwt from '@fastify/jwt';
import { registerAuthRoutes } from './routes.auth';
import { registerWorkspaceRoutes } from './routes.workspaces';
import { registerDocumentRoutes } from './routes.documents';

const app = Fastify({
  logger: true,
});

async function buildServer() {
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(sensible);

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    app.log.warn('JWT_SECRET is not set. Using insecure default for development only.');
  }

  await app.register(jwt, {
    secret: jwtSecret || 'dev-insecure-jwt-secret',
  });

  await registerAuthRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerDocumentRoutes(app);

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}

async function start() {
  try {
    await buildServer();
    const port = Number(process.env.PORT) || 4000;
    const host = '0.0.0.0';
    await app.listen({ port, host });
    app.log.info(`API server running on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
