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
The project will now be converted in the background.
It might take a few minutes, please don't modify it in the meantime.
To see progress either perform a sync, or wait until it will be done automatically.`;
const NEW_TASK_PROJECT_ID_INPUT_ID = "Input.ProjectId";
const GROUP_BY_SECTIONS_INPUT_ID = "Input.GroupBySections";
const CONVERT_ACTION_ID = "Submit.Convert";
const CLOSE_ACTION_ID = "Submit.Close";
const createInputCard = (projects) => {
    const card = new ui_extensions_core_1.DoistCard();
    const inboxProject = projects.filter((project) => project.isInboxProject)[0].id;
    const choices = [...projects.map(({ id, name }) => ui_extensions_core_1.Choice.from({ title: name, value: id }))];
    card.addItem(ui_extensions_core_1.ChoiceSetInput.from({
        id: NEW_TASK_PROJECT_ID_INPUT_ID,
        label: "Where to create task",
        isRequired: true,
        errorMessage: "Invalid project.",
        defaultValue: inboxProject,
        choices,
        isSearchable: false,
        isMultiSelect: false,
    }));
    card.addItem(ui_extensions_core_1.ToggleInput.from({
        id: GROUP_BY_SECTIONS_INPUT_ID,
        title: "Group by sections",
        defaultValue: "true",
    }));
    card.addAction(ui_extensions_core_1.SubmitAction.from({
        id: CONVERT_ACTION_ID,
        title: "Next",
        style: "positive",
    }));
    return card;
};
const incrementalSync = (commands, token) => __awaiter(void 0, void 0, void 0, function* () {
    let tempIdMap = {};
    for (let i = 0; i < commands.length; i += api_1.COMMAND_BATCH_SIZE) {
        const commandBatch = commands.slice(i, i + api_1.COMMAND_BATCH_SIZE);
        commandBatch.forEach((command) => {
            const parentId = command.args.parent_id;
            if (!parentId)
                return;
            const mappedId = tempIdMap[command.args.parent_id];
            if (!mappedId)
                return;
            command.args.parent_id = mappedId;
        });
        const response = yield (0, api_1.sync)(commandBatch, token);
        if (!response)
            return;
        tempIdMap = Object.assign(Object.assign({}, tempIdMap), response.data.temp_id_mapping);
    }
});
const convertProjectToTask = (api, token, groupBySections, projectId, newTaskProjectId) => __awaiter(void 0, void 0, void 0, function* () {
    const commands = [];
    const project = yield api.getProject(projectId);
    commands.push({
        type: "item_add",
        temp_id: "root",
        uuid: (0, crypto_1.randomUUID)(),
        args: {
            content: project.name,
            project_id: newTaskProjectId,
        },
    });
    const tasks = yield (0, api_1.paginatedRequest)(api, api.getTasks, { projectId });
    const topLevelTasks = tasks.filter((task) => task.parentId === null);
    if (groupBySections) {
        const tasksWithoutSection = topLevelTasks.filter((task) => !task.sectionId);
        commands.push(...tasksWithoutSection.map((task) => ({
            type: "item_move",
            uuid: (0, crypto_1.randomUUID)(),
            args: { id: task.id, parent_id: "root" },
        })));
        const sections = yield (0, api_1.paginatedRequest)(api, api.getSections, { projectId: projectId });
        yield Promise.all(sections.map((section) => __awaiter(void 0, void 0, void 0, function* () {
            const sectionTasks = yield (0, api_1.paginatedRequest)(api, api.getTasks, { sectionId: section.id });
            const sectionTaskId = (0, crypto_1.randomUUID)();
            commands.push({
                type: "item_add",
                temp_id: sectionTaskId,
                uuid: (0, crypto_1.randomUUID)(),
                args: {
                    content: section.name,
                    parent_id: "root",
                },
            });
            commands.push(...sectionTasks.map((task) => ({
                type: "item_move",
                uuid: (0, crypto_1.randomUUID)(),
                args: { id: task.id, parent_id: sectionTaskId },
            })));
        })));
    }
    else {
        commands.push(...topLevelTasks.map((task) => ({
            type: "item_move",
            uuid: (0, crypto_1.randomUUID)(),
            args: { id: task.id, parent_id: "root" },
        })));
    }
    (0, functions_1.waitUntil)(incrementalSync(commands, token));
});
const toTask = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = request.token;
        const api = new todoist_api_typescript_1.TodoistApi(token);
        const { actionType, actionId, params, inputs } = request.body.action;
        const { sourceId: projectId } = params;
        if (actionType === "initial") {
            const projects = yield (0, api_1.paginatedRequest)(api, api.getProjects, {});
            response.status(200).json({ card: createInputCard(projects) });
        }
        else if (actionId === CONVERT_ACTION_ID) {
            const newTaskProjectId = inputs[NEW_TASK_PROJECT_ID_INPUT_ID];
            const groupBySections = inputs[GROUP_BY_SECTIONS_INPUT_ID] === "true";
            yield convertProjectToTask(api, token, groupBySections, projectId, newTaskProjectId);
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
        console.error("Unexpected error while converting project to task: ", error);
        response.status(200).json((0, response_1.errorResponse)("Unexpected error during conversion."));
    }
});
exports.default = toTask;
//# sourceMappingURL=to_task.js.map