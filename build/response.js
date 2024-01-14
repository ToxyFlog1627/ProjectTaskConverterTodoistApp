"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorResponse = exports.successResponse = void 0;
const successResponse = () => ({
    bridges: [{ bridgeActionType: 'request.sync' }, { bridgeActionType: 'finished' }]
});
exports.successResponse = successResponse;
const errorResponse = (text) => ({
    bridges: [
        {
            bridgeActionType: 'display.notification',
            notification: { type: 'error', text }
        },
        { bridgeActionType: 'finished' }
    ]
});
exports.errorResponse = errorResponse;
//# sourceMappingURL=response.js.map