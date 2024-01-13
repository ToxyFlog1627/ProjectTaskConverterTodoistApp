"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const verification_1 = require("./middleware/verification");
const token_1 = require("./middleware/token");
const to_task_1 = __importDefault(require("./commands/to_task"));
const to_project_1 = __importDefault(require("./commands/to_project"));
const PORT = process.env.PORT || 3000;
const app = (0, express_1.default)();
app.use((0, express_1.json)({ verify: verification_1.saveRawBody }), verification_1.verificationMiddleware, token_1.tokenExtractor);
app.post('/to_task', to_task_1.default);
app.post('/to_project', to_project_1.default);
app.post('*', (request, response) => response.sendStatus(404));
app.listen(PORT, () => console.log(`Extension server is running on port ${PORT}.`));
exports.default = app;
//# sourceMappingURL=index.js.map