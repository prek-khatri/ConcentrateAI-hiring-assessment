import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { createTeacherService } from "../services/teacher.service.js";
import {
  CreateClassSchema,
  UpdateClassSchema,
  AddStudentSchema,
  CreateAssignmentSchema,
  UpdateAssignmentSchema,
  GradeSubmissionSchema,
} from "./schemas.js";

export async function teacherRoutes(app: FastifyInstance): Promise<void> {
  const service = createTeacherService(db);
  const guards = [requireAuth, requireRole("teacher")];

  app.get("/api/teacher/classes", { preHandler: guards }, async (request) => {
    return { classes: await service.listMyClasses(request.user.id) };
  });

  app.post("/api/teacher/classes", { preHandler: guards }, async (request, reply) => {
    const { name, description } = CreateClassSchema.parse(request.body);
    const cls = await service.createClass(request.user.id, name, description);
    return reply.status(201).send(cls);
  });

  app.get("/api/teacher/classes/:classId", { preHandler: guards }, async (request) => {
    const { classId } = request.params as { classId: string };
    return service.getClass(request.user.id, classId);
  });

  app.patch("/api/teacher/classes/:classId", { preHandler: guards }, async (request) => {
    const { classId } = request.params as { classId: string };
    const { name, description } = UpdateClassSchema.parse(request.body);
    return service.updateClass(request.user.id, classId, name, description);
  });

  app.delete("/api/teacher/classes/:classId", { preHandler: guards }, async (request, reply) => {
    const { classId } = request.params as { classId: string };
    await service.deleteClass(request.user.id, classId);
    return reply.status(204).send();
  });

  app.get("/api/teacher/students", { preHandler: guards }, async () => {
    return { students: await service.listAvailableStudents() };
  });

  app.post("/api/teacher/classes/:classId/students", { preHandler: guards }, async (request, reply) => {
    const { classId } = request.params as { classId: string };
    const { studentId } = AddStudentSchema.parse(request.body);
    await service.addStudent(request.user.id, classId, studentId);
    return reply.status(204).send();
  });

  app.delete("/api/teacher/classes/:classId/students/:studentId", { preHandler: guards }, async (request, reply) => {
    const { classId, studentId } = request.params as { classId: string; studentId: string };
    await service.removeStudent(request.user.id, classId, studentId);
    return reply.status(204).send();
  });

  app.post("/api/teacher/classes/:classId/assignments", { preHandler: guards }, async (request, reply) => {
    const { classId } = request.params as { classId: string };
    const body = CreateAssignmentSchema.parse(request.body);
    const assignment = await service.createAssignment(request.user.id, classId, {
      title: body.title,
      description: body.description,
      due_at: body.dueAt ? new Date(body.dueAt) : null,
      published: body.published,
    });
    return reply.status(201).send(assignment);
  });

  app.get("/api/teacher/assignments/:assignmentId", { preHandler: guards }, async (request) => {
    const { assignmentId } = request.params as { assignmentId: string };
    return service.getAssignment(request.user.id, assignmentId);
  });

  app.patch("/api/teacher/assignments/:assignmentId", { preHandler: guards }, async (request) => {
    const { assignmentId } = request.params as { assignmentId: string };
    const body = UpdateAssignmentSchema.parse(request.body);
    return service.updateAssignment(request.user.id, assignmentId, {
      title: body.title,
      description: body.description,
      due_at: body.dueAt ? new Date(body.dueAt) : null,
      published: body.published,
    });
  });

  app.delete("/api/teacher/assignments/:assignmentId", { preHandler: guards }, async (request, reply) => {
    const { assignmentId } = request.params as { assignmentId: string };
    await service.deleteAssignment(request.user.id, assignmentId);
    return reply.status(204).send();
  });

  app.post("/api/teacher/submissions/:submissionId/grade", { preHandler: guards }, async (request) => {
    const { submissionId } = request.params as { submissionId: string };
    const { score, feedback } = GradeSubmissionSchema.parse(request.body);
    return service.gradeSubmission(request.user.id, submissionId, score, feedback);
  });
}
