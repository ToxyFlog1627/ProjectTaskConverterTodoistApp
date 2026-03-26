import { Response } from "express";
import { randomUUID } from "crypto";
import { Choice, ChoiceSetInput, DoistCard, SubmitAction, TextInput, ToggleInput } from "@doist/ui-extensions-core";
import { PersonalProject, TodoistApi } from "@doist/todoist-api-typescript";
import { Command, paginatedRequest, sync } from "./../api";
import { RequestWithToken } from "./../middleware/token";
import { successResponse, errorResponse } from "../response";
import { createInfoCard } from "../card";
import { waitUntil } from "@vercel/functions";
import { storeLog } from "../redis";

const CREATE_NEW_PROJECT = "new_project";
const NO_PARENT_PROJECT = "none";

const PROJECT_ID_INPUT_ID = "Input.ProjectId";
const PROJECT_NAME_INPUT_ID = "Input.ProjectName";
const CREATE_REDIRECT_INPUT_ID = "Input.CreateRedirect";
const MOVE_DESCRIPTION_INPUT_ID = "Input.MoveDescription";
const PARENT_ID_INPUT_ID = "Input.ParentId";

const SELECT_PROJECT_ACTION_ID = "Submit.SelectProject";
const CREATE_PROJECT_ACTION_ID = "Submit.CreateProject";
const CLOSE_ACTION_ID = "Submit.Close";

type Options = {
    createRedirect: boolean;
    moveDescription: boolean;
};

const createRetryInfoCard = (): DoistCard =>
    createInfoCard(CLOSE_ACTION_ID, `Please make sure that the task is synced and try again.`);

const createSyncInfoCard = (): DoistCard =>
    createInfoCard(
        CLOSE_ACTION_ID,
        `
The task will now be converted in the background.
It might take a few minutes, please don't modify it in the meantime.
To see progress either perform a sync, or wait until it will be done automatically.
        `
    );

const createProjectSelectionCard = (projects: PersonalProject[]): DoistCard => {
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
            id: MOVE_DESCRIPTION_INPUT_ID,
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

const createProjectCreationCard = (
    defaultProjectName: string,
    projects: PersonalProject[],
    options: Options
): DoistCard => {
    const card = new DoistCard();

    card.addItem(
        TextInput.from({
            id: PROJECT_NAME_INPUT_ID,
            label: "New project name",
            isRequired: true,
            errorMessage: "Invalid project name.",
            defaultValue: defaultProjectName,
        })
    );

    const choices = [
        Choice.from({ title: "None", value: NO_PARENT_PROJECT }),
        ...projects
            .filter(({ inboxProject }) => !inboxProject)
            .map(({ id, name }) => Choice.from({ title: name, value: id })),
    ];
    card.addItem(
        ChoiceSetInput.from({
            id: PARENT_ID_INPUT_ID,
            label: "Parent project",
            isRequired: true,
            errorMessage: "Invalid project.",
            defaultValue: NO_PARENT_PROJECT,
            choices,
            isSearchable: false,
            isMultiSelect: false,
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

const convertTaskToProject = async (
    api: TodoistApi,
    token: string,
    taskId: string,
    projectId: string,
    options: Options
) => {
    const task = await api.getTask(taskId);
    const subtasks = await paginatedRequest(api, api.getTasks, { parentId: task.id, limit: 200 });
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
                content: "* [Description]",
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

    waitUntil(sync(commands, token));
};

const toProject = async (request: RequestWithToken, response: Response) => {
    try {
        const token = request.token!;
        const api = new TodoistApi(token);

        const { actionType, actionId, params, inputs, data } = request.body.action;
        const { contentPlain: taskTitle, sourceId: taskId } = params;

        if (actionType === "initial") {
            // Make sure that task has been synced and has a proper ID.
            if (taskId.startsWith("tmp-")) {
                response.status(200).json({ card: createRetryInfoCard() });
                return;
            }

            const projects = (await paginatedRequest(api, api.getProjects, { limit: 200 })) as PersonalProject[];
            response.status(200).json({ card: createProjectSelectionCard(projects) });
        } else if (actionId === SELECT_PROJECT_ACTION_ID) {
            const options = {
                createRedirect: inputs[CREATE_REDIRECT_INPUT_ID] === "true",
                moveDescription: inputs[MOVE_DESCRIPTION_INPUT_ID] === "true",
            };
            const projectId = inputs[PROJECT_ID_INPUT_ID];

            if (projectId === CREATE_NEW_PROJECT) {
                const projects = (await paginatedRequest(api, api.getProjects, { limit: 200 })) as PersonalProject[];
                response.status(200).json({ card: createProjectCreationCard(taskTitle, projects, options) });
            } else {
                await convertTaskToProject(api, token, taskId, projectId, options);
                response.status(200).json({ card: createSyncInfoCard() });
            }
        } else if (actionId === CREATE_PROJECT_ACTION_ID) {
            const project = await api.addProject({
                name: inputs[PROJECT_NAME_INPUT_ID],
                parentId: inputs[PARENT_ID_INPUT_ID] === NO_PARENT_PROJECT ? null : inputs[PARENT_ID_INPUT_ID],
            });

            await convertTaskToProject(api, token, taskId, project.id, data.options);
            response.status(200).json({ card: createSyncInfoCard() });
        } else if (actionId === CLOSE_ACTION_ID) {
            response.status(200).json(successResponse());
        } else {
            response.sendStatus(404);
        }
    } catch (error) {
        await storeLog("Unexpected error while converting task to project: " + JSON.stringify(error));
        response.status(200).json(errorResponse("Unexpected error during conversion."));
    }
};

export default toProject;
