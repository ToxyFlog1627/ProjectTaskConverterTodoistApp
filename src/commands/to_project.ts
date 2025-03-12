import { Response } from "express";
import { randomUUID } from "crypto";
import { Choice, ChoiceSetInput, DoistCard, SubmitAction, TextInput, ToggleInput } from "@doist/ui-extensions-core";
import { Project, TodoistApi } from "@doist/todoist-api-typescript";
import { Command, COMMAND_BATCH_SIZE, sync } from "./../api";
import { RequestWithToken } from "./../middleware/token";
import { successResponse, errorResponse } from "../response";
import { createInfoCard } from "../card";
import { waitUntil } from "@vercel/functions";

const INFO_CARD_TEXT = `
The task will now be converted in the background.
It might take a few minutes, please don't modify it in the meantime.
To see progress either perform a sync, or wait until it will be done automatically.`;

const CREATE_NEW_PROJECT = "new_project";

const PROJECT_ID_INPUT_ID = "Input.ProjectId";
const PROJECT_NAME_INPUT_ID = "Input.ProjectName";
const CREATE_REDIRECT_INPUT_ID = "Input.CreateRedirect";
const MOVE_TASK_DESCRIPTION_ID = "Input.MoveDescription";

const SELECT_PROJECT_ACTION_ID = "Submit.SelectProject";
const CREATE_PROJECT_ACTION_ID = "Submit.CreateProject";
const CLOSE_ACTION_ID = "Submit.Close";

type Options = {
    createRedirect: boolean;
    moveDescription: boolean;
};

const createProjectSelectionCard = (projects: Project[]): DoistCard => {
    const card = new DoistCard();

    const choices = [
        Choice.from({ title: "New project", value: CREATE_NEW_PROJECT }),
        ...projects.map(({ id, name }) => Choice.from({ title: name, value: id })),
    ];
    card.addItem(
        ChoiceSetInput.from({
            id: PROJECT_ID_INPUT_ID,
            label: "Project",
            isRequired: true,
            errorMessage: "Invalid project.",
            defaultValue: CREATE_NEW_PROJECT,
            choices,
            isSearchable: false,
            isMultiSelect: false,
        })
    );

    card.addItem(
        ToggleInput.from({
            id: CREATE_REDIRECT_INPUT_ID,
            title: "Replace with link to the project",
            defaultValue: "true",
        })
    );
    card.addItem(
        ToggleInput.from({
            id: MOVE_TASK_DESCRIPTION_ID,
            title: "Move description by creating a new task",
            defaultValue: "true",
        })
    );

    card.addAction(
        SubmitAction.from({
            id: SELECT_PROJECT_ACTION_ID,
            title: "Next",
            style: "positive",
        })
    );

    return card;
};

const createProjectCreationCard = (defaultProjectName: string, options: Options): DoistCard => {
    const card = new DoistCard();

    card.addItem(
        TextInput.from({
            id: PROJECT_NAME_INPUT_ID,
            label: "New project name",
            isRequired: false,
            errorMessage: "Invalid project name.",
            defaultValue: defaultProjectName,
        })
    );

    card.addAction(
        SubmitAction.from({
            id: CREATE_PROJECT_ACTION_ID,
            title: "Next",
            style: "positive",
            data: { options },
        })
    );

    return card;
};

const incrementalSync = async (commands: Command[], token: string) => {
    for (let i = 0; i < commands.length; i += COMMAND_BATCH_SIZE) {
        const commandBatch = commands.slice(i, i + COMMAND_BATCH_SIZE);
        const response = await sync(commandBatch, token);
        if (!response || response.status != 200) return;

        Object.entries(response.data.sync_status).forEach(([id, status]) => {
            if (status === "ok") return;

            const command = commandBatch.filter((command) => command.uuid === id)[0];
            console.error(`
Unexpected error while syncing command!
Command: ${JSON.stringify(command)}
Response: ${JSON.stringify(status)}`);
        });
    }
};

const convertTaskToProject = async (api: TodoistApi, token: string, taskId: string, projectId: string, options: Options) => {
    // taskID seems to be kind of "internal", so we have to get "external" id from the task  ¯\_(ツ)_/¯
    const task = await api.getTask(taskId);
    const tasks = await api.getTasks({ projectId: task.projectId });
    const subtasks = tasks.filter((current) => current.parentId === task.id);

    const commands: Command[] = [];

    if (options.createRedirect) {
        commands.push({
            type: "item_update",
            uuid: randomUUID(),
            args: {
                id: task.id,
                content: `[[Converted to Project](https://app.todoist.com/app/project/${projectId})] ${task.content}`,
            },
        });
    }

    if (options.moveDescription && task.description) {
        commands.push({
            type: "item_add",
            temp_id: randomUUID(),
            uuid: randomUUID(),
            args: {
                content: "[Original description]",
                description: task.description,
                project_id: projectId,
            },
        });
        commands.push({
            type: "item_update",
            uuid: randomUUID(),
            args: {
                id: task.id,
                description: "",
            },
        });
    }

    commands.push(
        ...subtasks.map(({ id }) => ({
            type: "item_move",
            uuid: randomUUID(),
            args: { id, project_id: projectId },
        }))
    );

    waitUntil(incrementalSync(commands, token));
};

const toProject = async (request: RequestWithToken, response: Response) => {
    try {
        const token = request.token!;
        const api = new TodoistApi(token);

        const { actionType, actionId, params, inputs, data } = request.body.action;
        const { contentPlain: taskTitle, sourceId: taskId } = params;

        if (actionType === "initial") {
            const projects = await api.getProjects();

            response.status(200).json({ card: createProjectSelectionCard(projects) });
        } else if (actionId === SELECT_PROJECT_ACTION_ID) {
            const options = {
                createRedirect: inputs[CREATE_REDIRECT_INPUT_ID] === "true",
                moveDescription: inputs[MOVE_TASK_DESCRIPTION_ID] === "true",
            };
            const projectId = inputs[PROJECT_ID_INPUT_ID];

            if (projectId === CREATE_NEW_PROJECT) {
                response.status(200).json({ card: createProjectCreationCard(taskTitle, options) });
            } else {
                await convertTaskToProject(api, token, taskId, projectId, options);
                response.status(200).json({ card: createInfoCard(CLOSE_ACTION_ID, INFO_CARD_TEXT) });
            }
        } else if (actionId === CREATE_PROJECT_ACTION_ID) {
            const project = await api.addProject({ name: inputs[PROJECT_NAME_INPUT_ID] });

            await convertTaskToProject(api, token, taskId, project.id, data.options);
            response.status(200).json({ card: createInfoCard(CLOSE_ACTION_ID, INFO_CARD_TEXT) });
        } else if (actionId === CLOSE_ACTION_ID) {
            response.status(200).json(successResponse());
        } else {
            response.sendStatus(404);
        }
    } catch (error) {
        console.error("Unexpected error while converting task to project: ", error);
        response.status(200).json(errorResponse("Unexpected error during conversion."));
    }
};

export default toProject;
