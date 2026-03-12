"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const ui_extensions_core_1 = require("@doist/ui-extensions-core");
const todoist_api_typescript_1 = require("@doist/todoist-api-typescript");
const api_1 = require("./../api");
const response_1 = require("../response");
const card_1 = require("../card");
const functions_1 = require("@vercel/functions");
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
const createRetryInfoCard = () => (0, card_1.createInfoCard)(CLOSE_ACTION_ID, `Please make sure that the task is synced and try again.`);
const createSyncInfoCard = () => (0, card_1.createInfoCard)(CLOSE_ACTION_ID, `
The task will now be converted in the background.
It might take a few minutes, please don't modify it in the meantime.
To see progress either perform a sync, or wait until it will be done automatically.
        `);
const createProjectSelectionCard = (projects) => {
    const card = new ui_extensions_core_1.DoistCard();
    const choices = [
        ui_extensions_core_1.Choice.from({ title: "New project", value: CREATE_NEW_PROJECT }),
        ...projects.map(({ id, name }) => ui_extensions_core_1.Choice.from({ title: name, value: id })),
    ];
    card.addItem(ui_extensions_core_1.ChoiceSetInput.from({
        id: PROJECT_ID_INPUT_ID,
        label: "Project",
        isRequired: true,
        errorMessage: "Invalid project.",
        defaultValue: CREATE_NEW_PROJECT,
        choices,
        isSearchable: false,
        isMultiSelect: false,
    }));
    card.addItem(ui_extensions_core_1.ToggleInput.from({
        id: CREATE_REDIRECT_INPUT_ID,
        title: "Replace with link to the project",
        defaultValue: "true",
    }));
    card.addItem(ui_extensions_core_1.ToggleInput.from({
        id: MOVE_DESCRIPTION_INPUT_ID,
        title: "Move description by creating a new task",
        defaultValue: "true",
    }));
    card.addAction(ui_extensions_core_1.SubmitAction.from({
        id: SELECT_PROJECT_ACTION_ID,
        title: "Next",
        style: "positive",
    }));
    return card;
};
const createProjectCreationCard = (defaultProjectName, projects, options) => {
    const card = new ui_extensions_core_1.DoistCard();
    card.addItem(ui_extensions_core_1.TextInput.from({
        id: PROJECT_NAME_INPUT_ID,
        label: "New project name",
        isRequired: true,
        errorMessage: "Invalid project name.",
        defaultValue: defaultProjectName,
    }));
    const choices = [
        ui_extensions_core_1.Choice.from({ title: "None", value: NO_PARENT_PROJECT }),
        ...projects
            .filter(({ inboxProject }) => !inboxProject)
            .map(({ id, name }) => ui_extensions_core_1.Choice.from({ title: name, value: id })),
    ];
    card.addItem(ui_extensions_core_1.ChoiceSetInput.from({
        id: PARENT_ID_INPUT_ID,
        label: "Parent project",
        isRequired: true,
        errorMessage: "Invalid project.",
        defaultValue: NO_PARENT_PROJECT,
        choices,
        isSearchable: false,
        isMultiSelect: false,
    }));
    card.addAction(ui_extensions_core_1.SubmitAction.from({
        id: CREATE_PROJECT_ACTION_ID,
        title: "Next",
        style: "positive",
        data: { options },
    }));
    return card;
};
const incrementalSync = async (commands, token) => {
    (0, api_1.persistentLog)("Starting to sync commands: " + JSON.stringify(commands));
    for (let i = 0; i < commands.length; i += api_1.COMMAND_BATCH_SIZE) {
        const commandBatch = commands.slice(i, i + api_1.COMMAND_BATCH_SIZE);
        const response = await (0, api_1.sync)(commandBatch, token);
        if (!response || response.status != 200)
            return;
        Object.entries(response.data.sync_status).forEach(([id, status]) => {
            if (status === "ok")
                return;
            const command = commandBatch.filter((command) => command.uuid === id)[0];
            const error = `
Unexpected error while syncing command!
Command: ${JSON.stringify(command)}
Response: ${JSON.stringify(status)}`;
            console.error(error);
            (0, api_1.persistentLog)(error);
        });
    }
};
const convertTaskToProject = async (api, token, taskId, projectId, options) => {
    const task = await api.getTask(taskId);
    const subtasks = await (0, api_1.paginatedRequest)(api, api.getTasks, { parentId: task.id });
    const commands = [];
    if (options.createRedirect) {
        commands.push({
            type: "item_update",
            uuid: (0, crypto_1.randomUUID)(),
            args: {
                id: task.id,
                content: `[[Converted to Project](https://app.todoist.com/app/project/${projectId})] ${task.content}`,
            },
        });
    }
    if (options.moveDescription && task.description) {
        commands.push({
            type: "item_add",
            temp_id: (0, crypto_1.randomUUID)(),
            uuid: (0, crypto_1.randomUUID)(),
            args: {
                content: "* [Description]",
                description: task.description,
                project_id: projectId,
            },
        });
        commands.push({
            type: "item_update",
            uuid: (0, crypto_1.randomUUID)(),
            args: {
                id: task.id,
                description: "",
            },
        });
    }
    commands.push(...subtasks.map(({ id }) => ({
        type: "item_move",
        uuid: (0, crypto_1.randomUUID)(),
        args: { id, project_id: projectId },
    })));
    (0, functions_1.waitUntil)(incrementalSync(commands, token));
};
const toProject = async (request, response) => {
    (0, api_1.persistentLog)(`toProject entry`);
    try {
        const token = request.token;
        const api = new todoist_api_typescript_1.TodoistApi(token);
        const { actionType, actionId, params, inputs, data } = request.body.action;
        const { contentPlain: taskTitle, sourceId: taskId } = params;
        (0, api_1.persistentLog)(`toProject action BEGIN: ${JSON.stringify(request.body.action)}`);
        if (actionType === "initial") {
            // Make sure that task has been synced and has a proper ID.
            if (taskId.startsWith("tmp-")) {
                response.status(200).json({ card: createRetryInfoCard() });
                return;
            }
            const projects = (await (0, api_1.paginatedRequest)(api, api.getProjects, {}));
            (0, api_1.persistentLog)(`Initial, projects: ${JSON.stringify(projects)}`);
            response.status(200).json({ card: createProjectSelectionCard(projects) });
        }
        else if (actionId === SELECT_PROJECT_ACTION_ID) {
            const options = {
                createRedirect: inputs[CREATE_REDIRECT_INPUT_ID] === "true",
                moveDescription: inputs[MOVE_DESCRIPTION_INPUT_ID] === "true",
            };
            const projectId = inputs[PROJECT_ID_INPUT_ID];
            (0, api_1.persistentLog)(`Select project: ${projectId}`);
            if (projectId === CREATE_NEW_PROJECT) {
                const projects = (await (0, api_1.paginatedRequest)(api, api.getProjects, {}));
                (0, api_1.persistentLog)(`Select project, answering with: ${JSON.stringify(createProjectCreationCard(taskTitle, projects, options))}`);
                response.status(200).json({ card: createProjectCreationCard(taskTitle, projects, options) });
            }
            else {
                await convertTaskToProject(api, token, taskId, projectId, options);
                (0, api_1.persistentLog)(`Select project, answering with: ${JSON.stringify(createSyncInfoCard())}`);
                response.status(200).json({ card: createSyncInfoCard() });
            }
        }
        else if (actionId === CREATE_PROJECT_ACTION_ID) {
            const project = await api.addProject({
                name: inputs[PROJECT_NAME_INPUT_ID],
                parentId: inputs[PARENT_ID_INPUT_ID] === NO_PARENT_PROJECT ? null : inputs[PARENT_ID_INPUT_ID],
            });
            (0, api_1.persistentLog)(`Create project: ${JSON.stringify(project)}`);
            await convertTaskToProject(api, token, taskId, project.id, data.options);
            (0, api_1.persistentLog)(`Create project, answering with: ${JSON.stringify(createSyncInfoCard())}`);
            response.status(200).json({ card: createSyncInfoCard() });
        }
        else if (actionId === CLOSE_ACTION_ID) {
            response.status(200).json((0, response_1.successResponse)());
        }
        else {
            (0, api_1.persistentLog)(`404, action ID: ${actionId}`);
            response.sendStatus(404);
        }
        (0, api_1.persistentLog)(`toProject action END: ${JSON.stringify(request.body.action)}`);
    }
    catch (error) {
        (0, api_1.persistentLog)("Unexpected error while converting task to project: " + error);
        console.error("Unexpected error while converting task to project: ", error);
        response.status(200).json((0, response_1.errorResponse)("Unexpected error during conversion."));
    }
};
exports.default = toProject;
//# sourceMappingURL=to_project.js.map