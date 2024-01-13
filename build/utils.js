"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finishConversion = void 0;
const finishConversion = (success, text) => {
    return {
        bridges: [
            {
                bridgeActionType: 'display.notification',
                notification: {
                    type: success ? 'success' : 'failure',
                    text
                }
            },
            { bridgeActionType: 'request.sync' },
            { bridgeActionType: 'finished' }
        ]
    };
};
exports.finishConversion = finishConversion;
//# sourceMappingURL=utils.js.map