"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sync = void 0;
const axios_1 = __importDefault(require("axios"));
const sync = (commands, token) => axios_1.default.post('https://api.todoist.com/sync/v9/sync', { commands }, { timeout: 15000, headers: { Authorization: `Bearer ${token}` } });
exports.sync = sync;
//# sourceMappingURL=api.js.map