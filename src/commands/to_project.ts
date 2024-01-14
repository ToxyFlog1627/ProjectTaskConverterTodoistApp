import { Response } from 'express';
import { randomUUID } from 'crypto';
import { Choice, ChoiceSetInput, DoistCard, SubmitAction, TextInput } from '@doist/ui-extensions-core';
import { Project, TodoistApi } from '@doist/todoist-api-typescript';
import { Command, sync } from './../api';
import { RequestWithToken } from './../middleware/token';
import { successResponse, errorResponse } from '../response';

const BATCH_SIZE = 50;

const CREATE_NEW_PROJECT = 'new_project';

const PROJECT_ID_INPUT_ID = 'Input.ProjectId';
const PROJECT_NAME_INPUT_ID = 'Input.ProjectName';

const SELECT_PROJECT_ACTION_ID = 'Submit.SelectProject';
const CREATE_PROJECT_ACTION_ID = 'Submit.CreateProject';

const createProjectSelectionCard = (projects: Project[]): DoistCard => {
	const card = new DoistCard();

	const choices = [Choice.from({ title: 'New project', value: CREATE_NEW_PROJECT }), ...projects.map(({ id, name }) => Choice.from({ title: name, value: id }))];
	card.addItem(
		ChoiceSetInput.from({
			id: PROJECT_ID_INPUT_ID,
			label: 'Project',
			isRequired: true,
			errorMessage: 'Invalid project.',
			defaultValue: CREATE_NEW_PROJECT,
			choices,
			isSearchable: false,
			isMultiSelect: false
		})
	);

	card.addAction(
		SubmitAction.from({
			id: SELECT_PROJECT_ACTION_ID,
			title: 'Next',
			style: 'positive'
		})
	);

	return card;
};

const createProjectCreationCard = (defaultProjectName: string): DoistCard => {
	const card = new DoistCard();

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
			id: CREATE_PROJECT_ACTION_ID,
			title: 'Next',
			style: 'positive'
		})
	);

	return card;
};

const convertTaskToProject = async (api: TodoistApi, token: string, taskId: string, projectId: string) => {
	const task = await api.getTask(taskId);
	const tasks = await api.getTasks({ projectId: task.projectId });
	const subtasks = tasks.filter(task => task.parentId === taskId);

	const commands: Command[] = [];

	commands.push(
		...subtasks.map(({ id }) => ({
			type: 'item_move',
			uuid: randomUUID(),
			args: { id, project_id: projectId }
		}))
	);

	if (!task.description && task.commentCount === 0) {
		commands.push({
			type: 'item_delete',
			uuid: randomUUID(),
			args: { id: taskId }
		});
	}

	for (let i = 0; i < commands.length; i += BATCH_SIZE) {
		const commandBatch = commands.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
		await sync(commandBatch, token);
	}

	return successResponse('The task is being converted to a project.', `https://todoist.com/app/project/${projectId}`, 'Open project');
};

const toProject = async (request: RequestWithToken, response: Response) => {
	try {
		const token = request.token!;
		const api = new TodoistApi(token);

		const { actionType, actionId, params, inputs } = request.body.action;
		const { contentPlain: taskTitle, sourceId: taskId } = params;

		if (actionType === 'initial') {
			const projects = await api.getProjects();
			const card = createProjectSelectionCard(projects);

			response.status(200).json({ card });
		} else if (actionId === SELECT_PROJECT_ACTION_ID) {
			const projectId = inputs[PROJECT_ID_INPUT_ID];

			if (projectId === CREATE_NEW_PROJECT) {
				const card = createProjectCreationCard(taskTitle);
				response.status(200).json({ card });
				return;
			}

			const finalResponse = await convertTaskToProject(api, token, taskId, projectId);
			response.status(200).json(finalResponse);
		} else if (actionId === CREATE_PROJECT_ACTION_ID) {
			const projectName = inputs[PROJECT_NAME_INPUT_ID];

			const project = await api.addProject({ name: projectName });

			const finalResponse = await convertTaskToProject(api, token, taskId, project.id);
			response.status(200).json(finalResponse);
		} else response.sendStatus(404);
	} catch (error) {
		console.error(error);
		response.status(200).json(errorResponse('Unexpected error during conversion.'));
	}
};

export default toProject;
