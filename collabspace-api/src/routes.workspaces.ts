import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "./prisma";

async function requireAuth(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

export async function registerWorkspaceRoutes(app: FastifyInstance) {
  const createWorkspaceSchema = z.object({
    name: z.string().min(1),
  });

  const inviteSchema = z.object({
    email: z.string().email(),
  });

  app.get("/workspaces", { preHandler: [requireAuth] as any }, async (request: any) => {
    const userId = request.user.sub as string;

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
    }));
  });

  app.post("/workspaces", { preHandler: [requireAuth] as any }, async (request: any, reply) => {
    const userId = request.user.sub as string;
    const parsed = createWorkspaceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid data" });
    }

    const { name } = parsed.data;

    const workspace = await prisma.workspace.create({
      data: {
        name,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "OWNER",
          },
        },
      },
    });

    return workspace;
  });

  app.post("/workspaces/:workspaceId/invite", { preHandler: [requireAuth] as any }, async (request: any, reply) => {
    const userId = request.user.sub as string;
    const { workspaceId } = request.params as { workspaceId: string };
    const parsed = inviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid data" });
    }

    const { email } = parsed.data;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: true },
    });

    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const isMember = workspace.members.some((m) => m.userId === userId);
    if (!isMember) {
      return reply.status(403).send({ error: "Not a member of this workspace" });
    }

    const invitedUser = await prisma.user.findUnique({ where: { email } });
    if (!invitedUser) {
      return reply.status(404).send({ error: "User not found" });
    }

    const existingMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: invitedUser.id,
          workspaceId: workspace.id,
        },
      },
    });
    if (existingMembership) {
      return reply.status(409).send({ error: "User already a member" });
    }

    const membership = await prisma.workspaceMember.create({
      data: {
        userId: invitedUser.id,
        workspaceId: workspace.id,
        role: "MEMBER",
      },
    });

    return membership;
  });
}
