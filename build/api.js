"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sync = void 0;
const axios_1 = __importDefault(require("axios"));
const BATCH_SIZE = 20;
const MAX_SYNC_TIMEOUT = 15000;
const sync = (commands, token) => {
    for (let i = 0; i < commands.length; i += BATCH_SIZE) {
        const commandBatch = commands.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        axios_1.default.post('https://api.todoist.com/sync/v9/sync', { commands: commandBatch }, { timeout: MAX_SYNC_TIMEOUT, headers: { Authorization: `Bearer ${token}` } });
    }
};
exports.sync = sync;
//# sourceMappingURL=api.js.map