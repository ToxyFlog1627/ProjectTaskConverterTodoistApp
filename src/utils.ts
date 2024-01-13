export const finishConversion = (success: boolean, text: string) => {
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
