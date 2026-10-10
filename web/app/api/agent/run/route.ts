import { allowRequest, enqueue } from "@/lib/guard";
import { publicError } from "@/lib/agentAccount";
import { runScenario, type Scenario } from "@/lib/runAgent";

const SCENARIOS = new Set<Scenario>(["movies", "flights", "scam"]);

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(ip)) {
    return Response.json({ error: "Too many agent runs from this address. Wait a minute." }, { status: 429 });
  }

  let body: { scenario?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const scenario = body.scenario;
  if (typeof scenario !== "string" || !SCENARIOS.has(scenario as Scenario)) {
    return Response.json({ error: 'scenario must be "movies", "flights", or "scam".' }, { status: 400 });
  }

  try {
    const result = await enqueue(() => runScenario(scenario as Scenario));
    return Response.json(result);
  } catch (error) {
    return Response.json({ ok: false, steps: [], error: publicError(error) }, { status: 500 });
  }
}
