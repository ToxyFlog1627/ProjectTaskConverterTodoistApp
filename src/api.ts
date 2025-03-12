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
            "https://api.todoist.com/sync/v9/sync",
            { commands },
            { timeout: 60 * 1000, headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (error) {
        console.error("Error while syncing: ", error);
        return null;
    }
};
