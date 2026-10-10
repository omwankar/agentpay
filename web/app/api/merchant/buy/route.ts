import { buy } from "@/lib/buy";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Send a JSON object." }, { status: 400 });
  }
  try {
    const result = await buy(body as Record<string, unknown>);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DemoShow could not check the approval.";
    return Response.json({ error: message }, { status: 500 });
  }
}
