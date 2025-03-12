"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInfoCard = void 0;
const ui_extensions_core_1 = require("@doist/ui-extensions-core");
const createInfoCard = (actionId, text) => {
    const card = new ui_extensions_core_1.DoistCard();
    card.addItem(ui_extensions_core_1.TextBlock.from({
        text,
        wrap: true,
        size: "large",
    }));
    card.addAction(ui_extensions_core_1.SubmitAction.from({
        id: actionId,
        title: "Close",
        style: "positive",
    }));
    return card;
};
exports.createInfoCard = createInfoCard;
//# sourceMappingURL=card.js.map