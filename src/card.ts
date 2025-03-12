import { DoistCard, SubmitAction, TextBlock } from "@doist/ui-extensions-core";

export const createInfoCard = (actionId: string, text: string): DoistCard => {
    const card = new DoistCard();

    card.addItem(
        TextBlock.from({
            text,
            wrap: true,
            size: "large",
        })
    );

    card.addAction(
        SubmitAction.from({
            id: actionId,
            title: "Close",
            style: "positive",
        })
    );

    return card;
};
