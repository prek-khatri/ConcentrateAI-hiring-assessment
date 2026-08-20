import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { redis } from "../db/redis.js";
import { requireAuth } from "../auth/middleware.js";
import { ApiError } from "../errors.js";
import { createStatsService } from "../services/stats.service.js";

const ClassIdParams = z.object({ id: z.string().uuid() });

// A malformed (non-UUID) id otherwise reaches the DB as a raw string and Postgres
// rejects it as an invalid uuid literal — an unhandled error that surfaces as a
// generic 500 instead of a clean 400. Callers hitting this API directly (its whole
// point, per the spec) can easily pass a bad id by hand.
function parseClassId(request: { params: unknown }): string {
  const parsed = ClassIdParams.safeParse(request.params);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", "id must be a valid UUID");
  }
  return parsed.data.id;
}

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  const service = createStatsService(db, redis);
  const guard = [requireAuth];

  app.get("/api/v0/stats/average-grades", { preHandler: guard }, () => service.averageGrades());

  app.get("/api/v0/stats/average-grades/:id", { preHandler: guard }, (request) =>
    service.averageGradesForClass(parseClassId(request))
  );

  app.get("/api/v0/stats/teacher-names", { preHandler: guard }, () => service.teacherNames());

  app.get("/api/v0/stats/student-names", { preHandler: guard }, () => service.studentNames());

  app.get("/api/v0/stats/classes", { preHandler: guard }, () => service.classes());

  app.get("/api/v0/stats/classes/:id", { preHandler: guard }, (request) =>
    service.studentsForClass(parseClassId(request))
  );
}
