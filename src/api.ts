import axios from "axios";

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
