import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { createStudentService } from "../services/student.service.js";
import { SubmitAssignmentSchema } from "./schemas.js";

export async function studentRoutes(app: FastifyInstance): Promise<void> {
  const service = createStudentService(db);
  const guards = [requireAuth, requireRole("student")];

  app.get("/api/student/classes", { preHandler: guards }, async (request) => {
    return { classes: await service.listMyClasses(request.user.id) };
  });

  app.get("/api/student/assignments", { preHandler: guards }, async (request) => {
    return { assignments: await service.listAllAssignments(request.user.id) };
  });

  app.get("/api/student/classes/:classId/assignments", { preHandler: guards }, async (request) => {
    const { classId } = request.params as { classId: string };
    return { assignments: await service.listAssignmentsForClass(request.user.id, classId) };
  });

  app.get("/api/student/assignments/:assignmentId", { preHandler: guards }, async (request) => {
    const { assignmentId } = request.params as { assignmentId: string };
    return service.getAssignmentForStudent(request.user.id, assignmentId);
  });

  app.post("/api/student/assignments/:assignmentId/submission", { preHandler: guards }, async (request, reply) => {
    const { assignmentId } = request.params as { assignmentId: string };
    const { content } = SubmitAssignmentSchema.parse(request.body);
    const submission = await service.submitAssignment(request.user.id, assignmentId, content);
    return reply.status(201).send(submission);
  });

  app.patch("/api/student/assignments/:assignmentId/submission", { preHandler: guards }, async (request) => {
    const { assignmentId } = request.params as { assignmentId: string };
    const { content } = SubmitAssignmentSchema.parse(request.body);
    return service.updateSubmission(request.user.id, assignmentId, content);
  });

  app.get("/api/student/submissions", { preHandler: guards }, async (request) => {
    return { submissions: await service.listMySubmissions(request.user.id) };
  });
}
