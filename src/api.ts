import { Task, TodoistApi } from '@doist/todoist-api-typescript';
import axios from 'axios';

export const getSubtasks = async (api: TodoistApi, parentId: string): Promise<Task[]> => {
	const tasks = await api.getTasks();
	return tasks.filter(task => task.parentId === parentId);
};

export type Command = {
	type: string;
	uuid: string;
	temp_id?: string;
	args: any;
};

export const sync = (commands: Command[], token: string) => axios.post('https://api.todoist.com/sync/v9/sync', { commands }, { timeout: 10000, headers: { Authorization: `Bearer ${token}` } });
