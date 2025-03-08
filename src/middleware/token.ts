import { Request, Response, NextFunction } from "express";

export type RequestWithToken = Request & { token?: string };

export const tokenExtractor = (request: RequestWithToken, response: Response, next: NextFunction): void => {
    const appToken = request.headers["x-todoist-apptoken"];
    if (!appToken) {
        response.sendStatus(403);
        return;
    }

    request.token = appToken as string;
    next();
};
