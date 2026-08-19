import { Redis } from "ioredis";
import { env } from "../env.js";

export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: 2 });
}

export const redis = createRedis(env.REDIS_URL);
