import { buildApp } from "./app.js";
import { env } from "./env.js";

const app = await buildApp();

app
  .listen({ port: env.API_PORT, host: "0.0.0.0" })
  .then(() => console.log(`api listening on :${env.API_PORT}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
