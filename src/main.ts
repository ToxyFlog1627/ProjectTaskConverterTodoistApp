import express, { Request, Response } from 'express';
import { json } from 'body-parser';
import { saveRawBody, verificationMiddleware } from './middleware/verification';
import { tokenExtractor } from './middleware/token';
import toTask from './commands/to_task';
import toProject from './commands/to_project';
import { PORT } from './env';

const app = express();
app.use(json({ verify: saveRawBody }), verificationMiddleware, tokenExtractor);
app.post('/to_task', toTask);
app.post('/to_project', toProject);
app.post('*', (request: Request, response: Response) => response.sendStatus(404));
app.listen(PORT, () => console.log(`Extension server is running on port ${PORT}.`));
