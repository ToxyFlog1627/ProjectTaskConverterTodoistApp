import { TodoistApi } from "@doist/todoist-api-typescript";
import axios from "axios";

export const COMMAND_BATCH_SIZE = Number(process.env.COMMAND_BATCH_SIZE) || 50;
console.log(`Using COMMAND_BATCH_SIZE=${COMMAND_BATCH_SIZE}`);

export type Command = {
    type: string;
    uuid: string;
    temp_id?: string;
    args: any;
};

export const sync = async (commands: Command[], token: string) => {
    try {
        return await axios.post(
            "https://api.todoist.com/api/v1/sync",
            { commands },
            { timeout: 60 * 1000, headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (error) {
        console.error("Error while syncing: ", error);
        return null;
    }
};

interface PaginatedParameter {
    cursor?: string | null;
}

type PaginatedFunction<P extends PaginatedParameter, R> = (arg: P) => Promise<{
    results: R[];
    nextCursor: string | null;
}>;

export const paginatedRequest = async <P extends PaginatedParameter, R>(
    api: TodoistApi,
    apiFunction: PaginatedFunction<P, R>,
    arg: P
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
