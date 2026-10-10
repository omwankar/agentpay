import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../lib/loadEnv";
import { runScenario, type Scenario } from "../lib/runAgent";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv(dir);

const scenario = process.argv[2] as Scenario;
if (scenario !== "movies" && scenario !== "flights" && scenario !== "scam") {
  console.error("Usage: npx tsx scripts/agent.ts movies|flights|scam");
  process.exit(1);
}

const result = await runScenario(scenario);
for (const step of result.steps) {
  console.log(`${step.step}: ${step.detail}`);
}
if (result.ticket) console.log(JSON.stringify(result.ticket, null, 2));
if (!result.ok) {
  if (result.reason) console.error(result.reason);
  process.exit(1);
}
