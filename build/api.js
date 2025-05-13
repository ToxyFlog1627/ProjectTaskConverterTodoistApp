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
exports.paginatedRequest = exports.sync = exports.COMMAND_BATCH_SIZE = void 0;
const axios_1 = __importDefault(require("axios"));
exports.COMMAND_BATCH_SIZE = Number(process.env.COMMAND_BATCH_SIZE) || 50;
console.log(`Using COMMAND_BATCH_SIZE=${exports.COMMAND_BATCH_SIZE}`);
const sync = (commands, token) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield axios_1.default.post("https://api.todoist.com/api/v1/sync", { commands }, { timeout: 60 * 1000, headers: { Authorization: `Bearer ${token}` } });
    }
    catch (error) {
        console.error("Error while syncing: ", error);
        return null;
    }
});
exports.sync = sync;
const paginatedRequest = (api, apiFunction, arg) => __awaiter(void 0, void 0, void 0, function* () {
    apiFunction = apiFunction.bind(api);
    const result = [];
    while (true) {
        const response = yield apiFunction(arg);
        result.push(...response.results);
        if (response.nextCursor === null)
            break;
        arg.cursor = response.nextCursor;
    }
    return result;
});
exports.paginatedRequest = paginatedRequest;
//# sourceMappingURL=api.js.map