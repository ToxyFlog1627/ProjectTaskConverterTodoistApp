import { Redis } from "@upstash/redis";

const LOG_EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 30d

const isVercel = !!process.env.VERCEL;
let redis: Redis | null = null;

export const storeLog = async (message: string) => {
    console.log(message);
    if (!isVercel) return;
    if (redis === null) redis = Redis.fromEnv();

    const key = `logs:${new Date().toISOString().slice(0, 10)}`;
    redis.rpush(key, message);
    redis.expire(key, LOG_EXPIRATION_SECONDS, "NX");
};
