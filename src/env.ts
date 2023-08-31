import dotenv from 'dotenv';

dotenv.config();

export const PORT: number = Number(process.env.PORT);
export const VERIFICATION_TOKEN: string = process.env.VERIFICATION_TOKEN!;

if (!PORT || !VERIFICATION_TOKEN) throw new Error("Can' start: environment variables are missing.");
