import axios from 'axios';

export type Command = {
	type: string;
	uuid: string;
	temp_id?: string;
	args: any;
};

export const sync = (commands: Command[], token: string) =>
	axios.post('https://api.todoist.com/sync/v9/sync', { commands }, { timeout: 15000, headers: { Authorization: `Bearer ${token}` } });
