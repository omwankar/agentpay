import { getAddress, isAddress } from "viem";
import { connection } from "next/server";

export async function GET() {
  await connection();
  const configured = process.env.NEXT_PUBLIC_AGENT_ADDRESS?.trim() ?? "";
  const agentAddress = isAddress(configured) ? getAddress(configured) : null;
  const agentError = agentAddress ? null : "The agent address is not set.";

  const demoshow = process.env.DEMOSHOW_ADDRESS?.trim() ?? "";
  const scamtickets = process.env.SCAMTICKETS_ADDRESS?.trim() ?? "";

  return Response.json({
    agentAddress,
    agentError,
    demoshow: isAddress(demoshow) ? demoshow : null,
    scamtickets: isAddress(scamtickets) ? scamtickets : null,
  });
}
