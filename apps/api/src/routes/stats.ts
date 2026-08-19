import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { redis } from "../db/redis.js";
import { requireAuth } from "../auth/middleware.js";
import { createStatsService } from "../services/stats.service.js";

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  const service = createStatsService(db, redis);
  const guard = [requireAuth];

  app.get("/api/v0/stats/average-grades", { preHandler: guard }, () => service.averageGrades());

  app.get("/api/v0/stats/average-grades/:id", { preHandler: guard }, (request) => {
    const { id } = request.params as { id: string };
    return service.averageGradesForClass(id);
  });

  app.get("/api/v0/stats/teacher-names", { preHandler: guard }, () => service.teacherNames());

  app.get("/api/v0/stats/student-names", { preHandler: guard }, () => service.studentNames());

  app.get("/api/v0/stats/classes", { preHandler: guard }, () => service.classes());

  app.get("/api/v0/stats/classes/:id", { preHandler: guard }, (request) => {
    const { id } = request.params as { id: string };
    return service.studentsForClass(id);
  });
}
