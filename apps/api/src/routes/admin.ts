import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { createAdminService } from "../services/admin.service.js";
import {
  ListUsersQuerySchema,
  CreateUserSchema,
  UpdateUserSchema,
  GroupSchema,
  AddGroupMemberSchema,
} from "./schemas.js";

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const service = createAdminService(db);
  const guards = [requireAuth, requireRole("admin")];

  app.get("/api/admin/users", { preHandler: guards }, async (request) => {
    const { role } = ListUsersQuerySchema.parse(request.query);
    return { users: await service.listUsers(role) };
  });

  app.post("/api/admin/users", { preHandler: guards }, async (request, reply) => {
    const input = CreateUserSchema.parse(request.body);
    return reply.status(201).send(await service.createUser(input));
  });

  app.patch("/api/admin/users/:id", { preHandler: guards }, async (request) => {
    const { id } = request.params as { id: string };
    const patch = UpdateUserSchema.parse(request.body);
    return service.updateUser(id, patch);
  });

  app.post("/api/admin/users/:id/suspend", { preHandler: guards }, async (request) => {
    const { id } = request.params as { id: string };
    return service.setSuspended(id, true);
  });

  app.post("/api/admin/users/:id/unsuspend", { preHandler: guards }, async (request) => {
    const { id } = request.params as { id: string };
    return service.setSuspended(id, false);
  });

  app.delete("/api/admin/users/:id", { preHandler: guards }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.deleteUser(id);
    return reply.status(204).send();
  });

  app.get("/api/admin/groups", { preHandler: guards }, async () => {
    return { groups: await service.listGroups() };
  });

  app.post("/api/admin/groups", { preHandler: guards }, async (request, reply) => {
    const { name } = GroupSchema.parse(request.body);
    return reply.status(201).send(await service.createGroup(name));
  });

  app.get("/api/admin/groups/:id", { preHandler: guards }, async (request) => {
    const { id } = request.params as { id: string };
    return service.getGroup(id);
  });

  app.patch("/api/admin/groups/:id", { preHandler: guards }, async (request) => {
    const { id } = request.params as { id: string };
    const { name } = GroupSchema.parse(request.body);
    return service.renameGroup(id, name);
  });

  app.delete("/api/admin/groups/:id", { preHandler: guards }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.deleteGroup(id);
    return reply.status(204).send();
  });

  app.post("/api/admin/groups/:id/members", { preHandler: guards }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { teacherId } = AddGroupMemberSchema.parse(request.body);
    return reply.status(201).send(await service.addGroupMember(id, teacherId));
  });

  app.delete("/api/admin/groups/:id/members/:teacherId", { preHandler: guards }, async (request, reply) => {
    const { id, teacherId } = request.params as { id: string; teacherId: string };
    await service.removeGroupMember(id, teacherId);
    return reply.status(204).send();
  });
}
