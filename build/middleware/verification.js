"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificationMiddleware = exports.saveRawBody = void 0;
const crypto_js_1 = __importDefault(require("crypto-js"));
require("dotenv/config");
const VERIFICATION_TOKEN = process.env.VERIFICATION_TOKEN;
const saveRawBody = (request, _response, buffer, _encoding) => {
    if (!Buffer.isBuffer(buffer))
        return;
    const bufferCopy = Buffer.alloc(buffer.length);
    buffer.copy(bufferCopy);
    request.rawBody = bufferCopy;
};
exports.saveRawBody = saveRawBody;
const verificationMiddleware = (request, response, next) => {
    if (!Buffer.isBuffer(request.rawBody)) {
        response.sendStatus(403);
        return;
    }
    const requestHash = request.headers["x-todoist-hmac-sha256"];
    if (!requestHash) {
        response.sendStatus(403);
        return;
    }
    const localRequestHash = crypto_js_1.default.HmacSHA256(request.rawBody.toString("utf-8"), VERIFICATION_TOKEN).toString(crypto_js_1.default.enc.Base64);
    if (localRequestHash !== requestHash) {
        response.sendStatus(403);
        return;
    }
    next();
};
exports.verificationMiddleware = verificationMiddleware;
//# sourceMappingURL=verification.js.map