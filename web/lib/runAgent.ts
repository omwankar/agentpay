import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  getAddress,
  http,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { getAgentAccount, publicError } from "./agentAccount";
import { buy } from "./buy";
import { findItem } from "./catalog";
import { monadTestnet, MONAD_RPC_URL } from "./chain";
import { explainReason } from "./reasons";
import { getVaultAddress, vaultAbi } from "./vault";

export type Scenario = "movies" | "flights" | "scam";

export type AgentStep = { step: string; detail: string };

export type AgentRun = {
  ok: boolean;
  steps: AgentStep[];
  reason?: string;
  ticket?: {
    ticketId: string;
    item: string;
    quantity: number;
    txHash: string;
    explorerUrl: string;
  };
};

const SCENARIOS: Record<Scenario, { itemId: string; quantity: number; scam: boolean }> = {
  movies: { itemId: "movie-midnight", quantity: 2, scam: false },
  flights: { itemId: "flight-bom", quantity: 20, scam: false },
  scam: { itemId: "movie-midnight", quantity: 2, scam: true },
};

function readPayee(body: Record<string, unknown>): Address {
  const merchant = body.merchant;
  if (typeof merchant !== "string") throw new Error("DemoShow did not return a merchant.");
  return getAddress(merchant);
}

export async function runScenario(scenario: Scenario): Promise<AgentRun> {
  const choice = SCENARIOS[scenario];
  const item = findItem(choice.itemId);
  if (!item) throw new Error("Demo catalog is missing an item.");

  const steps: AgentStep[] = [];
  steps.push({
    step: "requested",
    detail: `Requested ${choice.quantity} × ${item.name} from DemoShow.`,
  });

  const scamAddress = process.env.SCAMTICKETS_ADDRESS?.trim();
  if (choice.scam && !scamAddress) throw new Error("SCAMTICKETS_ADDRESS is not set.");

  const quote = await buy({
    itemId: choice.itemId,
    quantity: choice.quantity,
    merchantAddress: choice.scam ? scamAddress : undefined,
  });
  if (quote.status !== 402) {
    const message = typeof quote.body.error === "string" ? quote.body.error : "DemoShow did not return HTTP 402.";
    steps.push({ step: "got 402", detail: message });
    return { ok: false, steps, reason: message };
  }

  const amount = BigInt(String(quote.body.amount));
  const ref = quote.body.ref as Hex;
  const payee = readPayee(quote.body);
  steps.push({
    step: "got 402",
    detail: `Got HTTP 402. Amount ${formatEther(amount)} MON. Merchant ${payee}. Ref ${ref}.`,
  });
  steps.push({ step: "asked AgentPay", detail: "Asked AgentPay to authorize this payment." });

  const vault = getVaultAddress();
  if (!vault) throw new Error("NEXT_PUBLIC_VAULT_ADDRESS is not set.");

  const account = getAgentAccount();
  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(MONAD_RPC_URL) });
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http(MONAD_RPC_URL) });

  try {
    const gas = await publicClient.estimateGas({
      account,
      to: vault,
      data: encodeFunctionData({
        abi: vaultAbi,
        functionName: "authorize",
        args: [payee, amount, ref],
      }),
    });
    const hash = await walletClient.writeContract({
      address: vault,
      abi: vaultAbi,
      functionName: "authorize",
      args: [payee, amount, ref],
      gas: (gas * 12n) / 10n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const approved = parseEventLogs({ abi: vaultAbi, logs: receipt.logs, eventName: "PaymentApproved" });
    const rejected = parseEventLogs({ abi: vaultAbi, logs: receipt.logs, eventName: "PaymentRejected" });

    if (rejected.length > 0) {
      const reason = rejected[0].args.reason ?? "REJECTED";
      steps.push({ step: "result", detail: `Blocked: ${reason}. ${explainReason(reason)}` });
      return { ok: false, steps, reason };
    }
    if (approved.length === 0) {
      const detail = "The transaction confirmed, but AgentPay did not emit an approval.";
      steps.push({ step: "result", detail });
      return { ok: false, steps, reason: detail };
    }
  } catch (error) {
    const detail = publicError(error);
    steps.push({ step: "result", detail });
    return { ok: false, steps, reason: detail };
  }

  steps.push({ step: "result", detail: "Payment processed." });
  const ticket = await buy({ itemId: choice.itemId, quantity: choice.quantity, ref });
  if (ticket.status !== 200) {
    const message = typeof ticket.body.message === "string" ? ticket.body.message : "DemoShow did not issue a ticket.";
    steps.push({ step: "ticket", detail: message });
    return { ok: false, steps, reason: message };
  }

  const issued = {
    ticketId: String(ticket.body.ticketId),
    item: String(ticket.body.item),
    quantity: Number(ticket.body.quantity),
    txHash: String(ticket.body.txHash),
    explorerUrl: String(ticket.body.explorerUrl),
  };
  steps.push({ step: "ticket", detail: `Ticket ${issued.ticketId} issued for ${issued.item}.` });
  return { ok: true, steps, ticket: issued };
}
