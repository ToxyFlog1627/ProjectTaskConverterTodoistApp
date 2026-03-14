"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginatedRequest = exports.sync = exports.COMMAND_BATCH_SIZE = void 0;
const axios_1 = __importDefault(require("axios"));
const redis_1 = require("./redis");
exports.COMMAND_BATCH_SIZE = Number(process.env.COMMAND_BATCH_SIZE) || 50;
console.log(`Using COMMAND_BATCH_SIZE=${exports.COMMAND_BATCH_SIZE}`);
const sync = async (commands, token) => {
    try {
        let tempIdMap = {};
        for (let i = 0; i < commands.length; i += exports.COMMAND_BATCH_SIZE) {
            const commandBatch = commands.slice(i, i + exports.COMMAND_BATCH_SIZE);
            commandBatch.forEach((command) => {
                const parentId = command.args.parent_id;
                if (!parentId)
                    return;
                const mappedId = tempIdMap[command.args.parent_id];
                if (!mappedId)
                    return;
                command.args.parent_id = mappedId;
            });
            const response = await axios_1.default.post("https://api.todoist.com/api/v1/sync", { commands: commandBatch }, { timeout: 60 * 1000, headers: { Authorization: `Bearer ${token}` } });
            if (!response || response.status != 200)
                throw new Error("Failed to sync: " + response);
            tempIdMap = { ...tempIdMap, ...response.data.temp_id_mapping };
            Object.entries(response.data.sync_status)
                .filter(([_, status]) => status !== "ok")
                .forEach(([id, status]) => {
                const command = commandBatch.find((command) => command.uuid === id);
                (0, redis_1.storeLog)(`
Unexpected error while syncing command!
Command: ${JSON.stringify(command)}
Response: ${JSON.stringify(status)}`);
            });
        }
    }
    catch (error) {
        (0, redis_1.storeLog)("Error while syncing: " + error);
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
//# sourceMappingURL=api.js.map