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
const BATCH_SIZE = 50;
const CREATE_NEW_PROJECT = 'new_project';
const PROJECT_ID_INPUT_ID = 'Input.ProjectId';
const PROJECT_NAME_INPUT_ID = 'Input.ProjectName';
const SELECT_PROJECT_ACTION_ID = 'Submit.SelectProject';
const CREATE_PROJECT_ACTION_ID = 'Submit.CreateProject';
const CLOSE_ACTION_ID = 'Submit.Close';
const createProjectSelectionCard = (projects) => {
    const card = new ui_extensions_core_1.DoistCard();
    const choices = [ui_extensions_core_1.Choice.from({ title: 'New project', value: CREATE_NEW_PROJECT }), ...projects.map(({ id, name }) => ui_extensions_core_1.Choice.from({ title: name, value: id }))];
    card.addItem(ui_extensions_core_1.ChoiceSetInput.from({
        id: PROJECT_ID_INPUT_ID,
        label: 'Project',
        isRequired: true,
        errorMessage: 'Invalid project.',
        defaultValue: CREATE_NEW_PROJECT,
        choices,
        isSearchable: false,
        isMultiSelect: false
    }));
    card.addAction(ui_extensions_core_1.SubmitAction.from({
        id: SELECT_PROJECT_ACTION_ID,
        title: 'Next',
        style: 'positive'
    }));
    return card;
};
const createProjectCreationCard = (defaultProjectName) => {
    const card = new ui_extensions_core_1.DoistCard();
    card.addItem(ui_extensions_core_1.TextInput.from({
        id: PROJECT_NAME_INPUT_ID,
        label: 'New project name',
        isRequired: false,
        errorMessage: 'Invalid project name.',
        defaultValue: defaultProjectName
    }));
    card.addAction(ui_extensions_core_1.SubmitAction.from({
        id: CREATE_PROJECT_ACTION_ID,
        title: 'Next',
        style: 'positive'
    }));
    return card;
};
const createInfoCard = () => {
    const card = new ui_extensions_core_1.DoistCard();
    card.addItem(ui_extensions_core_1.TextBlock.from({
        text: `
The task will now be converted in the background.
It might take a few minutes, please don't modify it in the meantime.
To see progress either perform a sync, or wait until it will be done automatically.`,
        wrap: true,
        size: 'large'
    }));
    card.addAction(ui_extensions_core_1.SubmitAction.from({
        id: CLOSE_ACTION_ID,
        title: 'Close',
        style: 'positive'
    }));
    return card;
};
const incrementalSync = (commands, token) => __awaiter(void 0, void 0, void 0, function* () {
    for (let i = 0; i < commands.length; i += BATCH_SIZE) {
        const commandBatch = commands.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const response = yield (0, api_1.sync)(commandBatch, token);
        if (!response)
            return;
    }
});
const convertTaskToProject = (api, token, taskId, projectId) => __awaiter(void 0, void 0, void 0, function* () {
    const task = yield api.getTask(taskId);
    const tasks = yield api.getTasks({ projectId: task.projectId });
    const subtasks = tasks.filter(task => task.parentId === taskId);
    const commands = [];
    commands.push(...subtasks.map(({ id }) => ({
        type: 'item_move',
        uuid: (0, crypto_1.randomUUID)(),
        args: { id, project_id: projectId }
    })));
    if (!task.description && task.commentCount === 0) {
        commands.push({
            type: 'item_delete',
            uuid: (0, crypto_1.randomUUID)(),
            args: { id: taskId }
        });
    }
    incrementalSync(commands, token);
});
const toProject = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = request.token;
        const api = new todoist_api_typescript_1.TodoistApi(token);
        const { actionType, actionId, params, inputs } = request.body.action;
        const { contentPlain: taskTitle, sourceId: taskId } = params;
        if (actionType === 'initial') {
            const projects = yield api.getProjects();
            const card = createProjectSelectionCard(projects);
            response.status(200).json({ card });
        }
        else if (actionId === SELECT_PROJECT_ACTION_ID) {
            const projectId = inputs[PROJECT_ID_INPUT_ID];
            if (projectId === CREATE_NEW_PROJECT) {
                const card = createProjectCreationCard(taskTitle);
                response.status(200).json({ card });
                return;
            }
            yield convertTaskToProject(api, token, taskId, projectId);
            const card = createInfoCard();
            response.status(200).json({ card });
        }
        else if (actionId === CREATE_PROJECT_ACTION_ID) {
            const projectName = inputs[PROJECT_NAME_INPUT_ID];
            const project = yield api.addProject({ name: projectName });
            yield convertTaskToProject(api, token, taskId, project.id);
            const card = createInfoCard();
            response.status(200).json({ card });
        }
        else if (actionId === CLOSE_ACTION_ID)
            response.status(200).json((0, response_1.successResponse)());
        else
            response.sendStatus(404);
    }
    catch (error) {
        console.error(error);
        response.status(200).json((0, response_1.errorResponse)('Unexpected error during conversion.'));
    }
});
exports.default = toProject;
//# sourceMappingURL=to_project.js.map