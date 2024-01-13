import axios from 'axios';

export type Command = {
	type: string;
	uuid: string;
	temp_id?: string;
	args: any;
};

const MAX_SYNC_TIMEOUT = 15000;

export const sync = async (commands: Command[], token: string) =>
	axios.post('https://api.todoist.com/sync/v9/sync', { commands }, { timeout: MAX_SYNC_TIMEOUT, headers: { Authorization: `Bearer ${token}` } });
