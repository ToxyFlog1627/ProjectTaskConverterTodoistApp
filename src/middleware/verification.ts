import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto-js';
import { VERIFICATION_TOKEN } from '../env';

export type UnverifiedRequest = Request & { rawBody?: Buffer };

export const saveRawBody = (request: UnverifiedRequest, _response: Response, buffer: Buffer, _encoding: string): void => {
	if (!Buffer.isBuffer(buffer)) return;

	const bufferCopy = Buffer.alloc(buffer.length);
	buffer.copy(bufferCopy);
	(request as any).rawBody = bufferCopy;
};

export const verificationMiddleware = (request: UnverifiedRequest, response: Response, next: NextFunction): void => {
	if (!Buffer.isBuffer(request.rawBody)) {
		response.sendStatus(403);
		return;
	}

	const requestHash = request.headers['x-todoist-hmac-sha256'];
	if (!requestHash) {
		response.sendStatus(403);
		return;
	}

	const localRequestHash = crypto.HmacSHA256(request.rawBody.toString('utf-8'), VERIFICATION_TOKEN).toString(crypto.enc.Base64);
	if (localRequestHash !== requestHash) {
		response.sendStatus(403);
		return;
	}

	next();
};
