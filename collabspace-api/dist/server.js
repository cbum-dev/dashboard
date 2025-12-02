"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const sensible_1 = __importDefault(require("@fastify/sensible"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const routes_auth_1 = require("./routes.auth");
const app = (0, fastify_1.default)({
    logger: true,
});
async function buildServer() {
    await app.register(cors_1.default, {
        origin: true,
        credentials: true,
    });
    await app.register(sensible_1.default);
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        app.log.warn('JWT_SECRET is not set. Using insecure default for development only.');
    }
    await app.register(jwt_1.default, {
        secret: jwtSecret || 'dev-insecure-jwt-secret',
    });
    await (0, routes_auth_1.registerAuthRoutes)(app);
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
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
start();
