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
const NEW_TASK_PROJECT_ID_INPUT_ID = 'Input.ProjectId';
const GROUP_BY_SECTIONS_INPUT_ID = 'Input.GroupBySections';
const SELECT_PROJECT_EVENT_ID = 'Submit.SelectProject';
const createCard = (projects) => {
    const card = new ui_extensions_core_1.DoistCard();
    const inboxProject = projects.filter(project => project.isInboxProject)[0].id;
    card.addItem(ui_extensions_core_1.ChoiceSetInput.from({
        id: NEW_TASK_PROJECT_ID_INPUT_ID,
        label: 'Where to create task',
        isRequired: true,
        errorMessage: 'Invalid project.',
        defaultValue: inboxProject,
        choices: [...projects.map(({ id, name }) => ui_extensions_core_1.Choice.from({ title: name, value: id }))],
        isSearchable: false,
        isMultiSelect: false
    }));
    card.addItem(ui_extensions_core_1.ToggleInput.from({
        id: GROUP_BY_SECTIONS_INPUT_ID,
        title: 'Group by sections',
        defaultValue: 'true'
    }));
    card.addAction(ui_extensions_core_1.SubmitAction.from({
        id: 'Action.Submit',
        title: 'Convert',
        style: 'positive'
    }));
    return card;
};
const convertProjectToTask = (api, token, groupBySections, projectId, newTaskProjectId) => __awaiter(void 0, void 0, void 0, function* () {
    const commands = [];
    const project = yield api.getProject(projectId);
    commands.push({
        type: 'item_add',
        temp_id: 'root',
        uuid: (0, crypto_1.randomUUID)(),
        args: {
            content: project.name,
            project_id: newTaskProjectId
        }
    });
    const tasks = yield api.getTasks({ projectId });
    if (groupBySections) {
        const tasksWithoutSection = tasks.filter(task => !task.sectionId);
        commands.push(...tasksWithoutSection.map(task => ({
            type: 'item_move',
            uuid: (0, crypto_1.randomUUID)(),
            args: { id: task.id, parent_id: 'root' }
        })));
        const sections = yield api.getSections(projectId);
        yield Promise.all(sections.map((section) => __awaiter(void 0, void 0, void 0, function* () {
            const sectionTasks = yield api.getTasks({ sectionId: section.id });
            const sectionTaskId = (0, crypto_1.randomUUID)();
            commands.push({
                type: 'item_add',
                temp_id: sectionTaskId,
                uuid: (0, crypto_1.randomUUID)(),
                args: {
                    content: section.name,
                    parent_id: 'root'
                }
            });
            commands.push(...sectionTasks.map(task => ({
                type: 'item_move',
                uuid: (0, crypto_1.randomUUID)(),
                args: { id: task.id, parent_id: sectionTaskId }
            })));
        })));
    }
    else {
        commands.push(...tasks.map(task => ({
            type: 'item_move',
            uuid: (0, crypto_1.randomUUID)(),
            args: { id: task.id, parent_id: 'root' }
        })));
    }
    yield (0, api_1.sync)(commands, token);
});
const toTask = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = request.token;
        const { actionType, params, inputs } = request.body.action;
        const { sourceId: projectId } = params;
        const api = new todoist_api_typescript_1.TodoistApi(token);
        if (actionType === 'initial') {
            const projects = yield api.getProjects();
            const card = createCard(projects);
            response.status(200).json({ card });
        }
        else if (actionType === 'submit') {
            const newTaskProjectId = inputs[NEW_TASK_PROJECT_ID_INPUT_ID];
            const groupBySections = inputs[GROUP_BY_SECTIONS_INPUT_ID] === 'true';
            yield convertProjectToTask(api, token, groupBySections, projectId, newTaskProjectId);
            response.status(200).json((0, response_1.successResponse)('Projects is being converted to task.', '', ''));
        }
        else
            response.sendStatus(404);
    }
    catch (error) {
        console.error(error);
        response.status(200).json((0, response_1.errorResponse)('Error converting project to task.'));
    }
});
exports.default = toTask;
//# sourceMappingURL=to_task.js.map