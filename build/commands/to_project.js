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
const api_1 = require("./../api");
const ui_extensions_core_1 = require("@doist/ui-extensions-core");
const todoist_api_typescript_1 = require("@doist/todoist-api-typescript");
const crypto_1 = require("crypto");
const utils_1 = require("../utils");
const CREATE_NEW_PROJECT = 'new_project';
const PROJECT_ID_INPUT_ID = 'Input.ProjectId';
const PROJECT_NAME_INPUT_ID = 'Input.ProjectName';
const createCard = (projects, defaultProjectName) => {
    const card = new ui_extensions_core_1.DoistCard();
    card.addItem(ui_extensions_core_1.ChoiceSetInput.from({
        id: PROJECT_ID_INPUT_ID,
        label: 'Project',
        isRequired: true,
        errorMessage: 'Invalid project.',
        defaultValue: CREATE_NEW_PROJECT,
        choices: [ui_extensions_core_1.Choice.from({ title: 'New project', value: CREATE_NEW_PROJECT }), ...projects.map(({ id, name }) => ui_extensions_core_1.Choice.from({ title: name, value: id }))],
        isSearchable: false,
        isMultiSelect: false
    }));
    card.addItem(ui_extensions_core_1.TextInput.from({
        id: PROJECT_NAME_INPUT_ID,
        label: 'New project name',
        isRequired: false,
        errorMessage: 'Invalid project name.',
        defaultValue: defaultProjectName
    }));
    card.addAction(ui_extensions_core_1.SubmitAction.from({
        id: 'Action.Submit',
        title: 'Convert',
        style: 'positive'
    }));
    return card;
};
const convertTaskToProject = (api, token, taskId, projectId) => __awaiter(void 0, void 0, void 0, function* () {
    const commands = [];
    const subtasks = yield (0, api_1.getSubtasks)(api, taskId);
    commands.push(...subtasks.map(({ id }) => ({
        type: 'item_move',
        uuid: (0, crypto_1.randomUUID)(),
        args: { id, project_id: projectId }
    })));
    const task = yield api.getTask(taskId);
    if (!task.description && task.commentCount === 0) {
        commands.push({
            type: 'item_delete',
            uuid: (0, crypto_1.randomUUID)(),
            args: { id: taskId }
        });
    }
    yield (0, api_1.sync)(commands, token);
});
const toProject = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = request.token;
        const { actionType, params, inputs } = request.body.action;
        const { contentPlain: taskTitle, sourceId: taskId } = params;
        const api = new todoist_api_typescript_1.TodoistApi(token);
        if (actionType === 'initial') {
            const projects = yield api.getProjects();
            const card = createCard(projects, taskTitle);
            response.status(200).json({ card });
        }
        else if (actionType === 'submit') {
            let projectId = inputs[PROJECT_ID_INPUT_ID];
            const newProjectName = inputs[PROJECT_NAME_INPUT_ID];
            if (projectId === CREATE_NEW_PROJECT && newProjectName) {
                const project = yield api.addProject({ name: newProjectName });
                projectId = project.id;
            }
            yield convertTaskToProject(api, token, taskId, projectId);
            response.status(200).json((0, utils_1.finishConversion)(true, 'Task is being converted to project.'));
        }
        else
            response.sendStatus(404);
    }
    catch (_a) {
        response.status(200).json((0, utils_1.finishConversion)(false, 'Error converting task to project.'));
    }
});
exports.default = toProject;
//# sourceMappingURL=to_project.js.map