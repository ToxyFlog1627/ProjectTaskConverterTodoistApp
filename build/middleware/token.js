"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenExtractor = void 0;
const tokenExtractor = (request, response, next) => {
    const appToken = request.headers["x-todoist-apptoken"];
    if (!appToken) {
        response.sendStatus(403);
        return;
    }
    request.token = appToken;
    next();
};
exports.tokenExtractor = tokenExtractor;
//# sourceMappingURL=token.js.map