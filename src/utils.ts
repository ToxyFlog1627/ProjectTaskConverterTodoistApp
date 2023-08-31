export const finishConversion = (success: boolean, text: string) => {
	return {
		bridges: [
			{ bridgeActionType: 'finished' },
			{ bridgeActionType: 'request.sync' },
			{
				bridgeActionType: 'display.notification',
				notification: {
					type: success ? 'success' : 'failure',
					text
				}
			}
		]
	};
};
