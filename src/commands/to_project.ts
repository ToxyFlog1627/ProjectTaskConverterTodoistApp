import { Command, getSubtasks, sync } from './../api';
import { RequestWithToken } from './../middleware/token';
import { Response } from 'express';
import { Choice, ChoiceSetInput, DoistCard, SubmitAction, TextInput } from '@doist/ui-extensions-core';
import { Project, TodoistApi } from '@doist/todoist-api-typescript';
import { randomUUID } from 'crypto';
import { finishConversion } from '../utils';

const CREATE_NEW_PROJECT = 'new_project';
const PROJECT_ID_INPUT_ID = 'Input.ProjectId';
const PROJECT_NAME_INPUT_ID = 'Input.ProjectName';

const createCard = (projects: Project[], defaultProjectName: string): DoistCard => {
	const card = new DoistCard();

	card.addItem(
		ChoiceSetInput.from({
			id: PROJECT_ID_INPUT_ID,
			label: 'Project',
			isRequired: true,
			errorMessage: 'Invalid project.',
			defaultValue: CREATE_NEW_PROJECT,
			choices: [Choice.from({ title: 'New project', value: CREATE_NEW_PROJECT }), ...projects.map(({ id, name }) => Choice.from({ title: name, value: id }))],
			isSearchable: false,
			isMultiSelect: false
		})
	);

	card.addItem(
		TextInput.from({
			id: PROJECT_NAME_INPUT_ID,
			label: 'New project name',
			isRequired: false,
			errorMessage: 'Invalid project name.',
			defaultValue: defaultProjectName
		})
	);

	card.addAction(
		SubmitAction.from({
			id: 'Action.Submit',
			title: 'Convert',
			style: 'positive'
		})
	);

	return card;
};

const convertTaskToProject = async (api: TodoistApi, token: string, taskId: string, projectId: string) => {
	const commands: Command[] = [];
	const subtasks = await getSubtasks(api, taskId);

	commands.push(
		...subtasks.map(({ id }) => ({
			type: 'item_move',
			uuid: randomUUID(),
			args: { id, project_id: projectId }
		}))
	);

	const task = await api.getTask(taskId);
	if (!task.description && task.commentCount === 0) {
		commands.push({
			type: 'item_delete',
			uuid: randomUUID(),
			args: { id: taskId }
		});
	}

	await sync(commands, token);
};

const toProject = async (request: RequestWithToken, response: Response) => {
	try {
		const token = request.token!;
		const { actionType, params, inputs } = request.body.action;
		const { contentPlain: taskTitle, sourceId: taskId } = params;
		const api = new TodoistApi(token);

		if (actionType === 'initial') {
			const projects = await api.getProjects();
			const card = createCard(projects, taskTitle);
			response.status(200).json({ card });
		} else if (actionType === 'submit') {
			let projectId = inputs[PROJECT_ID_INPUT_ID];
			const newProjectName = inputs[PROJECT_NAME_INPUT_ID];
			if (projectId === CREATE_NEW_PROJECT && newProjectName) {
				const project = await api.addProject({ name: newProjectName });
				projectId = project.id;
			}

			response.status(200).json(finishConversion(true, 'Task is being converted to project...'));

			await convertTaskToProject(api, token, taskId, projectId);
		} else response.sendStatus(404);
	} catch {
		response.status(200).json(finishConversion(false, 'Error converting task to project.'));
	}
};

export default toProject;
