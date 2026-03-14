"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeLog = void 0;
const redis_1 = require("@upstash/redis");
const LOG_EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 30d
const isVercel = !!process.env.VERCEL;
let redis = null;
const storeLog = async (message) => {
    console.log(message);
    if (!isVercel)
        return;
    if (redis === null)
        redis = redis_1.Redis.fromEnv();
    const key = `logs:${new Date().toISOString().slice(0, 10)}`;
    redis.rpush(key, message);
    redis.expire(key, LOG_EXPIRATION_SECONDS, "NX");
};
exports.storeLog = storeLog;
//# sourceMappingURL=redis.js.map