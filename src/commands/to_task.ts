import { Command, sync } from './../api';
import { RequestWithToken } from './../middleware/token';
import { Response } from 'express';
import { Choice, ChoiceSetInput, DoistCard, SubmitAction, ToggleInput } from '@doist/ui-extensions-core';
import { Project, TodoistApi } from '@doist/todoist-api-typescript';
import { randomUUID } from 'crypto';
import { finishConversion } from '../utils';

const NEW_TASK_PROJECT_ID_INPUT_ID = 'Input.ProjectId';
const GROUP_BY_SECTIONS_INPUT_ID = 'Input.GroupBySections';

const createCard = (projects: Project[]): DoistCard => {
	const card = new DoistCard();

	const inboxProject = projects.filter(project => project.isInboxProject)[0].id;
	card.addItem(
		ChoiceSetInput.from({
			id: NEW_TASK_PROJECT_ID_INPUT_ID,
			label: 'Where to create task',
			isRequired: true,
			errorMessage: 'Invalid project.',
			defaultValue: inboxProject,
			choices: [...projects.map(({ id, name }) => Choice.from({ title: name, value: id }))],
			isSearchable: false,
			isMultiSelect: false
		})
	);

	card.addItem(
		ToggleInput.from({
			id: GROUP_BY_SECTIONS_INPUT_ID,
			title: 'Group by sections',
			defaultValue: 'true'
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

const convertProjectToTask = async (api: TodoistApi, token: string, groupBySections: boolean, projectId: string, newTaskProjectId: string) => {
	const commands: Command[] = [];
	const project = await api.getProject(projectId);

	commands.push({
		type: 'item_add',
		temp_id: 'root',
		uuid: randomUUID(),
		args: {
			content: project.name,
			project_id: newTaskProjectId
		}
	});

	const tasks = await api.getTasks({ projectId });
	if (groupBySections) {
		const tasksWithoutSection = tasks.filter(task => !task.sectionId);
		commands.push(
			...tasksWithoutSection.map(task => ({
				type: 'item_move',
				uuid: randomUUID(),
				args: { id: task.id, parent_id: 'root' }
			}))
		);

		const sections = await api.getSections(projectId);
		await Promise.all(
			sections.map(async section => {
				const sectionTasks = await api.getTasks({ sectionId: section.id });
				const sectionTaskId = randomUUID();

				commands.push({
					type: 'item_add',
					temp_id: sectionTaskId,
					uuid: randomUUID(),
					args: {
						content: section.name,
						parent_id: 'root'
					}
				});

				commands.push(
					...sectionTasks.map(task => ({
						type: 'item_move',
						uuid: randomUUID(),
						args: { id: task.id, parent_id: sectionTaskId }
					}))
				);
			})
		);
	} else {
		commands.push(
			...tasks.map(task => ({
				type: 'item_move',
				uuid: randomUUID(),
				args: { id: task.id, parent_id: 'root' }
			}))
		);
	}

	await sync(commands, token);
};

const toTask = async (request: RequestWithToken, response: Response) => {
	try {
		const token = request.token!;
		const { actionType, params, inputs } = request.body.action;
		const { sourceId: projectId } = params;
		const api = new TodoistApi(token);

		if (actionType === 'initial') {
			const projects = await api.getProjects();
			const card = createCard(projects);
			response.status(200).json({ card });
		} else if (actionType === 'submit') {
			const newTaskProjectId = inputs[NEW_TASK_PROJECT_ID_INPUT_ID];
			const groupBySections = inputs[GROUP_BY_SECTIONS_INPUT_ID];
			await convertProjectToTask(api, token, groupBySections, projectId, newTaskProjectId);
			response.status(200).json(finishConversion(true, 'Projects is being converted to task.'));
		} else response.sendStatus(404);
	} catch {
		response.status(200).json(finishConversion(false, 'Error converting project to task.'));
	}
};

export default toTask;
