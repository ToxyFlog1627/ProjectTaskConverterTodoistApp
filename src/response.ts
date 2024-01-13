export const successResponse = (text: string, url: string, actionText: string) => {
	return {
		bridges: [
			{
				bridgeActionType: 'display.notification',
				notification: {
					text,
					type: successResponse ? 'success' : 'error',
					action: url,
					actionText
				}
			},
			{ bridgeActionType: 'request.sync' },
			{ bridgeActionType: 'finished' }
		]
	};
};

export const errorResponse = (text: string) => {
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
