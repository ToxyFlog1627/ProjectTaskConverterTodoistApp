import { Response } from "express";
import { randomUUID } from "crypto";
import { Choice, ChoiceSetInput, DoistCard, SubmitAction, TextBlock, ToggleInput } from "@doist/ui-extensions-core";
import { Project, TodoistApi } from "@doist/todoist-api-typescript";
import { Command, COMMAND_BATCH_SIZE, paginatedRequest, sync } from "./../api";
import { RequestWithToken } from "./../middleware/token";
import { successResponse, errorResponse } from "../response";
import { createInfoCard } from "../card";
import { waitUntil } from "@vercel/functions";

const INFO_CARD_TEXT = `
The project will now be converted in the background.
It might take a few minutes, please don't modify it in the meantime.
To see progress either perform a sync, or wait until it will be done automatically.`;

const NEW_TASK_PROJECT_ID_INPUT_ID = "Input.ProjectId";
const GROUP_BY_SECTIONS_INPUT_ID = "Input.GroupBySections";

const CONVERT_ACTION_ID = "Submit.Convert";
const CLOSE_ACTION_ID = "Submit.Close";

const createInputCard = (projects: Project[]): DoistCard => {
    const card = new DoistCard();

    const inboxProject = projects.filter((project) => project.isInboxProject)[0].id;
    const choices = [...projects.map(({ id, name }) => Choice.from({ title: name, value: id }))];
    card.addItem(
        ChoiceSetInput.from({
            id: NEW_TASK_PROJECT_ID_INPUT_ID,
            label: "Where to create task",
            isRequired: true,
            errorMessage: "Invalid project.",
            defaultValue: inboxProject,
            choices,
            isSearchable: false,
            isMultiSelect: false,
        })
    );

    card.addItem(
        ToggleInput.from({
            id: GROUP_BY_SECTIONS_INPUT_ID,
            title: "Group by sections",
            defaultValue: "true",
        })
    );

    card.addAction(
        SubmitAction.from({
            id: CONVERT_ACTION_ID,
            title: "Next",
            style: "positive",
        })
    );

    return card;
};

const incrementalSync = async (commands: Command[], token: string) => {
    let tempIdMap: { [key: string]: string } = {};
    for (let i = 0; i < commands.length; i += COMMAND_BATCH_SIZE) {
        const commandBatch = commands.slice(i, i + COMMAND_BATCH_SIZE);
        commandBatch.forEach((command) => {
            const parentId = command.args.parent_id;
            if (!parentId) return;

            const mappedId = tempIdMap[command.args.parent_id];
            if (!mappedId) return;

            command.args.parent_id = mappedId;
        });

        const response = await sync(commandBatch, token);
        if (!response) return;
        tempIdMap = { ...tempIdMap, ...response.data.temp_id_mapping };
    }
};

const convertProjectToTask = async (
    api: TodoistApi,
    token: string,
    groupBySections: boolean,
    projectId: string,
    newTaskProjectId: string
) => {
    const commands: Command[] = [];
    const project = await api.getProject(projectId);

    commands.push({
        type: "item_add",
        temp_id: "root",
        uuid: randomUUID(),
        args: {
            content: project.name,
            project_id: newTaskProjectId,
        },
    });

    const tasks = await paginatedRequest(api, api.getTasks, { projectId });
    const topLevelTasks = tasks.filter((task) => task.parentId === null);
    if (groupBySections) {
        const tasksWithoutSection = topLevelTasks.filter((task) => !task.sectionId);
        commands.push(
            ...tasksWithoutSection.map((task) => ({
                type: "item_move",
                uuid: randomUUID(),
                args: { id: task.id, parent_id: "root" },
            }))
        );

        const sections = await paginatedRequest(api, api.getSections, { projectId: projectId });
        await Promise.all(
            sections.map(async (section) => {
                const sectionTasks = await paginatedRequest(api, api.getTasks, { sectionId: section.id });
                const sectionTaskId = randomUUID();

                commands.push({
                    type: "item_add",
                    temp_id: sectionTaskId,
                    uuid: randomUUID(),
                    args: {
                        content: section.name,
                        parent_id: "root",
                    },
                });

                commands.push(
                    ...sectionTasks.map((task) => ({
                        type: "item_move",
                        uuid: randomUUID(),
                        args: { id: task.id, parent_id: sectionTaskId },
                    }))
                );
            })
        );
    } else {
        commands.push(
            ...topLevelTasks.map((task) => ({
                type: "item_move",
                uuid: randomUUID(),
                args: { id: task.id, parent_id: "root" },
            }))
        );
    }

    waitUntil(incrementalSync(commands, token));
};

const toTask = async (request: RequestWithToken, response: Response) => {
    try {
        const token = request.token!;
        const api = new TodoistApi(token);

        const { actionType, actionId, params, inputs } = request.body.action;
        const { sourceId: projectId } = params;

        if (actionType === "initial") {
            const projects = await paginatedRequest(api, api.getProjects, {});

            response.status(200).json({ card: createInputCard(projects) });
        } else if (actionId === CONVERT_ACTION_ID) {
            const newTaskProjectId = inputs[NEW_TASK_PROJECT_ID_INPUT_ID];
            const groupBySections = inputs[GROUP_BY_SECTIONS_INPUT_ID] === "true";

            await convertProjectToTask(api, token, groupBySections, projectId, newTaskProjectId);
            response.status(200).json({ card: createInfoCard(CLOSE_ACTION_ID, INFO_CARD_TEXT) });
        } else if (actionId === CLOSE_ACTION_ID) {
            response.status(200).json(successResponse());
        } else {
            response.sendStatus(404);
        }
    } catch (error) {
        console.error("Unexpected error while converting project to task: ", error);
        response.status(200).json(errorResponse("Unexpected error during conversion."));
    }
};

export default toTask;
