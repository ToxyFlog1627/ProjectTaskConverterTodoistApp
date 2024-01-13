import axios from 'axios';

export type Command = {
	type: string;
	uuid: string;
	temp_id?: string;
	args: any;
};

const MAX_SYNC_SIZE = 100;
const MAX_SYNC_TIMEOUT = 15000;

export const sync = async (commands: Command[], token: string): Promise<boolean> => {
	if (commands.length >= MAX_SYNC_SIZE) return false;

	await axios.post('https://api.todoist.com/sync/v9/sync', { commands }, { timeout: MAX_SYNC_TIMEOUT, headers: { Authorization: `Bearer ${token}` } });
	return true;
};
