import express, { json } from "express";
import { saveRawBody, verificationMiddleware } from "./middleware/verification";
import { tokenExtractor } from "./middleware/token";
import toTask from "./commands/to_task";
import toProject from "./commands/to_project";
import "dotenv/config";

const PORT = process.env.PORT || 3000;

const app = express();

app.use(json({ verify: saveRawBody }), verificationMiddleware, tokenExtractor);

app.post("/to_task", toTask);
app.post("/to_project", toProject);

app.listen(PORT, () => console.log(`Extension server is running on port ${PORT}.`));

export default app;
