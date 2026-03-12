"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistentLog = exports.paginatedRequest = exports.sync = exports.COMMAND_BATCH_SIZE = void 0;
const redis_1 = require("@upstash/redis");
const axios_1 = __importDefault(require("axios"));
exports.COMMAND_BATCH_SIZE = Number(process.env.COMMAND_BATCH_SIZE) || 50;
console.log(`Using COMMAND_BATCH_SIZE=${exports.COMMAND_BATCH_SIZE}`);
const sync = async (commands, token) => {
    try {
        return await axios_1.default.post("https://api.todoist.com/api/v1/sync", { commands }, { timeout: 60 * 1000, headers: { Authorization: `Bearer ${token}` } });
    }
    catch (error) {
        console.error("Error while syncing: ", error);
        return null;
    }
};
exports.sync = sync;
const paginatedRequest = async (api, apiFunction, arg) => {
    apiFunction = apiFunction.bind(api);
    const result = [];
    while (true) {
        const response = await apiFunction(arg);
        result.push(...response.results);
        if (response.nextCursor === null)
            break;
        arg.cursor = response.nextCursor;
    }
    return result;
};
exports.paginatedRequest = paginatedRequest;
const redis = redis_1.Redis.fromEnv();
const persistentLog = async (message) => {
    console.log(message);
    await redis.set(`${Date.now()}${Math.floor(Math.random() * 100000)}`, message, { ex: 60 * 60 * 24 });
};
exports.persistentLog = persistentLog;
//# sourceMappingURL=api.js.map