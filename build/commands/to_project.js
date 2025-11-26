"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const ui_extensions_core_1 = require("@doist/ui-extensions-core");
const todoist_api_typescript_1 = require("@doist/todoist-api-typescript");
const api_1 = require("./../api");
const response_1 = require("../response");
const card_1 = require("../card");
const functions_1 = require("@vercel/functions");
const INFO_CARD_TEXT = `
The task will now be converted in the background.
It might take a few minutes, please don't modify it in the meantime.
To see progress either perform a sync, or wait until it will be done automatically.`;
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
const incrementalSync = (commands, token) => __awaiter(void 0, void 0, void 0, function* () {
    for (let i = 0; i < commands.length; i += api_1.COMMAND_BATCH_SIZE) {
        const commandBatch = commands.slice(i, i + api_1.COMMAND_BATCH_SIZE);
        const response = yield (0, api_1.sync)(commandBatch, token);
        if (!response || response.status != 200)
            return;
        Object.entries(response.data.sync_status).forEach(([id, status]) => {
            if (status === "ok")
                return;
            const command = commandBatch.filter((command) => command.uuid === id)[0];
            console.error(`
Unexpected error while syncing command!
Command: ${JSON.stringify(command)}
Response: ${JSON.stringify(status)}`);
        });
    }
});
const convertTaskToProject = (api, token, taskId, projectId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const task = yield api.getTask(taskId);
    const subtasks = yield (0, api_1.paginatedRequest)(api, api.getTasks, { parentId: task.id });
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
});
const toProject = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = request.token;
        const api = new todoist_api_typescript_1.TodoistApi(token);
        const { actionType, actionId, params, inputs, data } = request.body.action;
        const { contentPlain: taskTitle, sourceId: taskId } = params;
        if (actionType === "initial") {
            const projects = (yield (0, api_1.paginatedRequest)(api, api.getProjects, {}));
            response.status(200).json({ card: createProjectSelectionCard(projects) });
        }
        else if (actionId === SELECT_PROJECT_ACTION_ID) {
            const options = {
                createRedirect: inputs[CREATE_REDIRECT_INPUT_ID] === "true",
                moveDescription: inputs[MOVE_DESCRIPTION_INPUT_ID] === "true",
            };
            const projectId = inputs[PROJECT_ID_INPUT_ID];
            if (projectId === CREATE_NEW_PROJECT) {
                const projects = (yield (0, api_1.paginatedRequest)(api, api.getProjects, {}));
                response.status(200).json({ card: createProjectCreationCard(taskTitle, projects, options) });
            }
            else {
                yield convertTaskToProject(api, token, taskId, projectId, options);
                response.status(200).json({ card: (0, card_1.createInfoCard)(CLOSE_ACTION_ID, INFO_CARD_TEXT) });
            }
        }
        else if (actionId === CREATE_PROJECT_ACTION_ID) {
            const project = yield api.addProject({
                name: inputs[PROJECT_NAME_INPUT_ID],
                parentId: inputs[PARENT_ID_INPUT_ID] === NO_PARENT_PROJECT ? null : inputs[PARENT_ID_INPUT_ID],
            });
            yield convertTaskToProject(api, token, taskId, project.id, data.options);
            response.status(200).json({ card: (0, card_1.createInfoCard)(CLOSE_ACTION_ID, INFO_CARD_TEXT) });
        }
        else if (actionId === CLOSE_ACTION_ID) {
            response.status(200).json((0, response_1.successResponse)());
        }
        else {
            response.sendStatus(404);
        }
    }
    catch (error) {
        console.error("Unexpected error while converting task to project: ", error);
        response.status(200).json((0, response_1.errorResponse)("Unexpected error during conversion."));
    }
});
exports.default = toProject;
//# sourceMappingURL=to_project.js.map