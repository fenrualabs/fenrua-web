import { outputDirectory, stagePublicOutput } from "./public-output-lib.mjs";

const entries = stagePublicOutput();
console.log(JSON.stringify({ status: "ok", scope: "static-public-output", outputDirectory: "public", entries }));
