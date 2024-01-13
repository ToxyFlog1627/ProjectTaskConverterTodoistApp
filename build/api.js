"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sync = void 0;
const axios_1 = __importDefault(require("axios"));
const MAX_SYNC_TIMEOUT = 15000;
const sync = (commands, token) => __awaiter(void 0, void 0, void 0, function* () { return axios_1.default.post('https://api.todoist.com/sync/v9/sync', { commands }, { timeout: MAX_SYNC_TIMEOUT, headers: { Authorization: `Bearer ${token}` } }); });
exports.sync = sync;
//# sourceMappingURL=api.js.map