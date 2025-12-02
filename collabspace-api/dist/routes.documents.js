import { z } from "zod";
import { prisma } from "./prisma";
async function requireAuth(request, reply) {
    try {
        await request.jwtVerify();
    }
    catch {
        return reply.status(401).send({ error: "Unauthorized" });
    }
}
export async function registerDocumentRoutes(app) {
    const createDocSchema = z.object({
        title: z.string().min(1),
    });
    const renameSchema = z.object({
        title: z.string().min(1),
    });
    const snapshotSchema = z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        changesSummary: z.string().optional(),
        changeCount: z.number().int().optional(),
        type: z.enum(["AUTO", "MANUAL"]).default("MANUAL"),
    });
    app.get("/workspaces/:workspaceId/documents", { preHandler: [requireAuth] }, async (request, reply) => {
        const userId = request.user.sub;
        const { workspaceId } = request.params;
        const membership = await prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId,
                    workspaceId,
                },
            },
        });
        if (!membership) {
            return reply.status(403).send({ error: "Not a member of this workspace" });
        }
        const documents = await prisma.document.findMany({
            where: { workspaceId },
            orderBy: { createdAt: "asc" },
        });
        return documents;
    });
    app.post("/workspaces/:workspaceId/documents", { preHandler: [requireAuth] }, async (request, reply) => {
        const userId = request.user.sub;
        const { workspaceId } = request.params;
        const parsed = createDocSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: "Invalid data" });
        }
        const membership = await prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId,
                    workspaceId,
                },
            },
        });
        if (!membership) {
            return reply.status(403).send({ error: "Not a member of this workspace" });
        }
        const document = await prisma.document.create({
            data: {
                title: parsed.data.title,
                workspaceId,
                ownerId: userId,
            },
        });
        return document;
    });
    app.patch("/documents/:documentId", { preHandler: [requireAuth] }, async (request, reply) => {
        const userId = request.user.sub;
        const { documentId } = request.params;
        const parsed = renameSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: "Invalid data" });
        }
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: { workspace: { include: { members: true } } },
        });
        if (!document) {
            return reply.status(404).send({ error: "Document not found" });
        }
        const isMember = document.workspace.members.some((m) => m.userId === userId);
        if (!isMember) {
            return reply.status(403).send({ error: "Forbidden" });
        }
        const updated = await prisma.document.update({
            where: { id: documentId },
            data: { title: parsed.data.title },
        });
        return updated;
    });
    app.delete("/documents/:documentId", { preHandler: [requireAuth] }, async (request, reply) => {
        const userId = request.user.sub;
        const { documentId } = request.params;
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: { workspace: { include: { members: true } } },
        });
        if (!document) {
            return reply.status(404).send({ error: "Document not found" });
        }
        const isMember = document.workspace.members.some((m) => m.userId === userId);
        if (!isMember) {
            return reply.status(403).send({ error: "Forbidden" });
        }
        await prisma.document.delete({ where: { id: documentId } });
        return { ok: true };
    });
    app.get("/documents/:documentId", { preHandler: [requireAuth] }, async (request, reply) => {
        const userId = request.user.sub;
        const { documentId } = request.params;
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: { workspace: { include: { members: true } } },
        });
        if (!document) {
            return reply.status(404).send({ error: "Document not found" });
        }
        const isMember = document.workspace.members.some((m) => m.userId === userId);
        if (!isMember) {
            return reply.status(403).send({ error: "Forbidden" });
        }
        return document;
    });
    app.get("/documents/:documentId/versions", { preHandler: [requireAuth] }, async (request, reply) => {
        const userId = request.user.sub;
        const { documentId } = request.params;
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: { workspace: { include: { members: true } } },
        });
        if (!document) {
            return reply.status(404).send({ error: "Document not found" });
        }
        const isMember = document.workspace.members.some((m) => m.userId === userId);
        if (!isMember) {
            return reply.status(403).send({ error: "Forbidden" });
        }
        const versions = await prisma.documentVersion.findMany({
            where: { documentId },
            orderBy: { createdAt: "desc" },
            include: {
                author: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });
        return versions;
    });
    app.post("/documents/:documentId/versions", { preHandler: [requireAuth] }, async (request, reply) => {
        const userId = request.user.sub;
        const { documentId } = request.params;
        const parsed = snapshotSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: "Invalid data" });
        }
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: { workspace: { include: { members: true } } },
        });
        if (!document) {
            return reply.status(404).send({ error: "Document not found" });
        }
        const isMember = document.workspace.members.some((m) => m.userId === userId);
        if (!isMember) {
            return reply.status(403).send({ error: "Forbidden" });
        }
        const { title, content, changesSummary, changeCount, type } = parsed.data;
        const version = await prisma.documentVersion.create({
            data: {
                documentId,
                authorId: userId,
                title,
                snapshotType: type,
                content,
                changesSummary,
                changeCount,
            },
        });
        await prisma.document.update({
            where: { id: documentId },
            data: { currentVersionId: version.id },
        });
        return version;
    });
    app.post("/documents/:documentId/restore/:versionId", { preHandler: [requireAuth] }, async (request, reply) => {
        const userId = request.user.sub;
        const { documentId, versionId } = request.params;
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: { workspace: { include: { members: true } } },
        });
        if (!document) {
            return reply.status(404).send({ error: "Document not found" });
        }
        const isMember = document.workspace.members.some((m) => m.userId === userId);
        if (!isMember) {
            return reply.status(403).send({ error: "Forbidden" });
        }
        const version = await prisma.documentVersion.findUnique({
            where: { id: versionId },
        });
        if (!version || version.documentId !== documentId) {
            return reply.status(404).send({ error: "Version not found" });
        }
        await prisma.document.update({
            where: { id: documentId },
            data: { currentVersionId: versionId },
        });
        return { ok: true };
    });
}
