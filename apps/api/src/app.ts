import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { ApiError } from "./errors.js";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { studentRoutes } from "./routes/student.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cookie);
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send(err.toJSON());
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: err.issues.map((i) => i.message).join("; ") },
      });
    }
    app.log.error(err);
    return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Unexpected error" } });
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes);
  await app.register(studentRoutes);

  return app;
}
