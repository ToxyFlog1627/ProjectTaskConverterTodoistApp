import { Response } from "express";
import { randomUUID } from "crypto";
import { Choice, ChoiceSetInput, DoistCard, SubmitAction, TextBlock, TextInput, ToggleInput } from "@doist/ui-extensions-core";
import { Project, TodoistApi } from "@doist/todoist-api-typescript";
import { Command, sync } from "./../api";
import { RequestWithToken } from "./../middleware/token";
import { successResponse, errorResponse } from "../response";

const BATCH_SIZE = 20;

const CREATE_NEW_PROJECT = "new_project";

const PROJECT_ID_INPUT_ID = "Input.ProjectId";
const PROJECT_NAME_INPUT_ID = "Input.ProjectName";
const CREATE_REDIRECT_INPUT_ID = "Input.CreateRedirect";

const SELECT_PROJECT_ACTION_ID = "Submit.SelectProject";
const CREATE_PROJECT_ACTION_ID = "Submit.CreateProject";
const CLOSE_ACTION_ID = "Submit.Close";

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

    card.addAction(
        SubmitAction.from({
            id: SELECT_PROJECT_ACTION_ID,
            title: "Next",
            style: "positive",
        })
    );

    return card;
};

const createProjectCreationCard = (defaultProjectName: string, createRedirect: boolean): DoistCard => {
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
            data: { createRedirect: String(createRedirect) },
        })
    );

    return card;
};

const createInfoCard = (): DoistCard => {
    const card = new DoistCard();

    card.addItem(
        TextBlock.from({
            text: `
The task will now be converted in the background.
It might take a few minutes, please don't modify it in the meantime.
To see progress either perform a sync, or wait until it will be done automatically.`,
            wrap: true,
            size: "large",
        })
    );

    card.addAction(
        SubmitAction.from({
            id: CLOSE_ACTION_ID,
            title: "Close",
            style: "positive",
        })
    );

    return card;
};

const incrementalSync = async (commands: Command[], token: string) => {
    for (let i = 0; i < commands.length; i += BATCH_SIZE) {
        const commandBatch = commands.slice(i, i + BATCH_SIZE);
        const response = await sync(commandBatch, token);
        if (!response) return;
    }
};

const convertTaskToProject = async (api: TodoistApi, token: string, taskId: string, projectId: string, createRedirect: boolean) => {
    // taskID seems to be kind of "internal", so we have to get "external" id from the task  ¯\_(ツ)_/¯
    const task = await api.getTask(taskId);
    const tasks = await api.getTasks({ projectId: task.projectId });
    const subtasks = tasks.filter((current) => current.parentId === task.id);

    const commands: Command[] = [];

    if (createRedirect) {
        commands.push({
            type: "item_update",
            uuid: randomUUID(),
            args: {
                id: task.id,
                content: `[[Converted to Project](https://app.todoist.com/app/project/${projectId})] ${task.content}`,
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

    incrementalSync(commands, token);
};

const toProject = async (request: RequestWithToken, response: Response) => {
    try {
        const token = request.token!;
        const api = new TodoistApi(token);

        const { actionType, actionId, params, inputs, data } = request.body.action;
        const { contentPlain: taskTitle, sourceId: taskId } = params;

        if (actionType === "initial") {
            const projects = await api.getProjects();
            const card = createProjectSelectionCard(projects);

            response.status(200).json({ card });
        } else if (actionId === SELECT_PROJECT_ACTION_ID) {
            const createRedirect = inputs[CREATE_REDIRECT_INPUT_ID] === "true";
            const projectId = inputs[PROJECT_ID_INPUT_ID];

            if (projectId === CREATE_NEW_PROJECT) {
                const card = createProjectCreationCard(taskTitle, createRedirect);
                response.status(200).json({ card });
                return;
            }

            await convertTaskToProject(api, token, taskId, projectId, createRedirect);

            const card = createInfoCard();
            response.status(200).json({ card });
        } else if (actionId === CREATE_PROJECT_ACTION_ID) {
            const createRedirect = data["createRedirect"] === "true";
            const projectName = inputs[PROJECT_NAME_INPUT_ID];
            const project = await api.addProject({ name: projectName });

            await convertTaskToProject(api, token, taskId, project.id, createRedirect);

            const card = createInfoCard();
            response.status(200).json({ card });
        } else if (actionId === CLOSE_ACTION_ID) {
            response.status(200).json(successResponse());
        } else {
            response.sendStatus(404);
        }
    } catch (error) {
        console.error(error);
        response.status(200).json(errorResponse("Unexpected error during conversion."));
    }
};

export default toProject;
