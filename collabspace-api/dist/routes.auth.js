"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthRoutes = registerAuthRoutes;
const prisma_1 = require("./prisma");
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    name: zod_1.z.string().min(1),
    avatarUrl: zod_1.z.string().url().optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
async function registerAuthRoutes(app) {
    app.post("/auth/register", async (request, reply) => {
        const parseResult = registerSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: "Invalid data" });
        }
        const { email, password, name, avatarUrl } = parseResult.data;
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            return reply.status(409).send({ error: "Email already in use" });
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
                avatarUrl,
            },
        });
        const accessToken = app.jwt.sign({ sub: user.id, type: "access" }, { expiresIn: "15m" });
        const refreshToken = app.jwt.sign({ sub: user.id, type: "refresh" }, { expiresIn: "7d" });
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
            },
            accessToken,
            refreshToken,
        };
    });
    app.post("/auth/login", async (request, reply) => {
        const parseResult = loginSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: "Invalid data" });
        }
        const { email, password } = parseResult.data;
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return reply.status(401).send({ error: "Invalid credentials" });
        }
        const valid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!valid) {
            return reply.status(401).send({ error: "Invalid credentials" });
        }
        const accessToken = app.jwt.sign({ sub: user.id, type: "access" }, { expiresIn: "15m" });
        const refreshToken = app.jwt.sign({ sub: user.id, type: "refresh" }, { expiresIn: "7d" });
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
            },
            accessToken,
            refreshToken,
        };
    });
    app.post("/auth/refresh", async (request, reply) => {
        const authHeader = request.headers["authorization"];
        if (!authHeader) {
            return reply.status(401).send({ error: "Missing Authorization header" });
        }
        const [, token] = authHeader.split(" ");
        if (!token) {
            return reply.status(401).send({ error: "Missing token" });
        }
        try {
            const payload = app.jwt.verify(token);
            if (payload.type !== "refresh") {
                return reply.status(401).send({ error: "Invalid token type" });
            }
            const accessToken = app.jwt.sign({ sub: payload.sub, type: "access" }, { expiresIn: "15m" });
            const refreshToken = app.jwt.sign({ sub: payload.sub, type: "refresh" }, { expiresIn: "7d" });
            return { accessToken, refreshToken };
        }
        catch (err) {
            return reply.status(401).send({ error: "Invalid token" });
        }
    });
    app.get("/auth/me", {
        preHandler: [
            async (request, reply) => {
                try {
                    await request.jwtVerify();
                }
                catch (err) {
                    return reply.status(401).send({ error: "Unauthorized" });
                }
            },
        ],
    }, async (request) => {
        const userId = request.user.sub;
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return null;
        }
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
        };
    });
}
