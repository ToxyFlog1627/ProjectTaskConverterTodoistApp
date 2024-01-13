"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorResponse = exports.successResponse = void 0;
const successResponse = (text, url, actionText) => {
    return {
        bridges: [
            {
                bridgeActionType: 'display.notification',
                notification: {
                    text,
                    type: exports.successResponse ? 'success' : 'error',
                    action: url,
                    actionText
                }
            },
            { bridgeActionType: 'request.sync' },
            { bridgeActionType: 'finished' }
        ]
    };
};
exports.successResponse = successResponse;
const errorResponse = (text) => {
    return {
        bridges: [
            {
                bridgeActionType: 'display.notification',
                notification: { type: 'error', text }
            },
            { bridgeActionType: 'finished' }
        ]
    };
};
exports.errorResponse = errorResponse;
//# sourceMappingURL=response.js.map