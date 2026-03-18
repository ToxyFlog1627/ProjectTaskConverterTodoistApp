import { TodoistApi } from "@doist/todoist-api-typescript";
import axios from "axios";
import { storeLog } from "./redis";

export const COMMAND_BATCH_SIZE = Number(process.env.COMMAND_BATCH_SIZE) || 50;
console.log(`Using COMMAND_BATCH_SIZE=${COMMAND_BATCH_SIZE}`);

export type Command = {
    type: string;
    uuid: string;
    temp_id?: string;
    args: any;
};

export const sync = async (commands: Command[], token: string): Promise<void> => {
    try {
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

            const response = await axios.post(
                "https://api.todoist.com/api/v1/sync",
                { commands: commandBatch },
                { timeout: 60 * 1000, headers: { Authorization: `Bearer ${token}` } }
            );
            if (!response || response.status != 200) throw new Error("Failed to sync: " + response);

            tempIdMap = { ...tempIdMap, ...response.data.temp_id_mapping };

            await Promise.all(
                Object.entries(response.data.sync_status)
                    .filter(([_, status]) => status !== "ok")
                    .map(([id, status]) => {
                        const command = commandBatch.find((command) => command.uuid === id);
                        return storeLog(`
Unexpected error while syncing command!
Command: ${JSON.stringify(command)}
Response: ${JSON.stringify(status)}`);
                    })
            );
        }
    } catch (error) {
        await storeLog("Error while syncing: " + JSON.stringify(error));
    }
};

interface PaginatedParameter {
    cursor?: string | null;
}

type PaginatedFunction<P, R> = (arg: P) => Promise<{
    results: R[];
    nextCursor: string | null;
}>;

export const paginatedRequest = async <P, R>(
    api: TodoistApi,
    apiFunction: PaginatedFunction<P, R>,
    arg: NoInfer<P & PaginatedParameter>
): Promise<R[]> => {
    apiFunction = apiFunction.bind(api);

    const result: R[] = [];
    while (true) {
        const response = await apiFunction(arg);
        result.push(...response.results);

        if (response.nextCursor === null) break;
        arg.cursor = response.nextCursor;
    }
    return result;
};
