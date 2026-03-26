"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const ui_extensions_core_1 = require("@doist/ui-extensions-core");
const todoist_api_typescript_1 = require("@doist/todoist-api-typescript");
const api_1 = require("./../api");
const response_1 = require("../response");
const card_1 = require("../card");
const functions_1 = require("@vercel/functions");
const redis_1 = require("../redis");
const NEW_TASK_PROJECT_ID_INPUT_ID = "Input.ProjectId";
const GROUP_BY_SECTIONS_INPUT_ID = "Input.GroupBySections";
const CONVERT_ACTION_ID = "Submit.Convert";
const CLOSE_ACTION_ID = "Submit.Close";
const createRetryInfoCard = () => (0, card_1.createInfoCard)(CLOSE_ACTION_ID, `Please make sure that the project is synced and try again.`);
const createSyncInfoCard = () => (0, card_1.createInfoCard)(CLOSE_ACTION_ID, `
The project will now be converted in the background.
It might take a few minutes, please don't modify it in the meantime.
To see progress either perform a sync, or wait until it will be done automatically.
        `);
const createInputCard = (projects) => {
    const card = new ui_extensions_core_1.DoistCard();
    const inboxProject = projects.find((project) => project.inboxProject)?.id;
    if (!inboxProject)
        throw new Error("Failed to find inbox project");
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
const convertProjectToTask = async (api, token, groupBySections, projectId, newTaskProjectId) => {
    const commands = [];
    const project = await api.getProject(projectId);
    commands.push({
        type: "item_add",
        temp_id: "root",
        uuid: (0, crypto_1.randomUUID)(),
        args: {
            content: project.name,
            project_id: newTaskProjectId,
        },
    });
    const tasks = await (0, api_1.paginatedRequest)(api, api.getTasks, { projectId, limit: 200 });
    const topLevelTasks = tasks.filter((task) => task.parentId === null);
    if (groupBySections) {
        const tasksWithoutSection = topLevelTasks.filter((task) => !task.sectionId);
        commands.push(...tasksWithoutSection.map((task) => ({
            type: "item_move",
            uuid: (0, crypto_1.randomUUID)(),
            args: { id: task.id, parent_id: "root" },
        })));
        const sections = await (0, api_1.paginatedRequest)(api, api.getSections, { projectId: projectId, limit: 200 });
        await Promise.all(sections.map(async (section) => {
            const sectionTasks = await (0, api_1.paginatedRequest)(api, api.getTasks, { sectionId: section.id, limit: 200 });
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
        }));
    }
    else {
        commands.push(...topLevelTasks.map((task) => ({
            type: "item_move",
            uuid: (0, crypto_1.randomUUID)(),
            args: { id: task.id, parent_id: "root" },
        })));
    }
    (0, functions_1.waitUntil)((0, api_1.sync)(commands, token));
};
const toTask = async (request, response) => {
    try {
        const token = request.token;
        const api = new todoist_api_typescript_1.TodoistApi(token);
        const { actionType, actionId, params, inputs } = request.body.action;
        const { sourceId: projectId } = params;
        if (actionType === "initial") {
            // Make sure that task has been synced and has a proper ID.
            if (projectId.startsWith("tmp-")) {
                response.status(200).json({ card: createRetryInfoCard() });
                return;
            }
            const projects = (await (0, api_1.paginatedRequest)(api, api.getProjects, { limit: 200 }));
            response.status(200).json({ card: createInputCard(projects) });
        }
        else if (actionId === CONVERT_ACTION_ID) {
            const newTaskProjectId = inputs[NEW_TASK_PROJECT_ID_INPUT_ID];
            const groupBySections = inputs[GROUP_BY_SECTIONS_INPUT_ID] === "true";
            await convertProjectToTask(api, token, groupBySections, projectId, newTaskProjectId);
            response.status(200).json({ card: createSyncInfoCard() });
        }
        else if (actionId === CLOSE_ACTION_ID) {
            response.status(200).json((0, response_1.successResponse)());
        }
        else {
            response.sendStatus(404);
        }
    }
    catch (error) {
        await (0, redis_1.storeLog)("Unexpected error while converting project to task: " + JSON.stringify(error));
        response.status(200).json((0, response_1.errorResponse)("Unexpected error during conversion."));
    }
};
exports.default = toTask;
//# sourceMappingURL=to_task.js.map