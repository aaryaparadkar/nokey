import { createApp } from "./app";
import { env } from "./env";

const app = createApp();

console.log(`nokey server listening on http://localhost:${env.PORT}`);

export default { port: env.PORT, fetch: app.fetch };
