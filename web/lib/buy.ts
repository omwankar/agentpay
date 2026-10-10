import { randomBytes } from "node:crypto";
import {
  bytesToHex,
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHex,
  type Address,
} from "viem";
import { monadTestnet, MONAD_RPC_URL, txUrl } from "./chain";
import { DEMO_DISCLAIMER, findItem } from "./catalog";
import { getDeployBlock, getVaultAddress, paymentApprovedEvent } from "./vault";

export type BuyInput = {
  itemId?: unknown;
  quantity?: unknown;
  ref?: unknown;
  merchantAddress?: unknown;
};

export type BuyResult = {
  status: number;
  body: Record<string, unknown>;
};

function addressEnv(name: string): Address | null {
  const value = process.env[name]?.trim() ?? "";
  return isAddress(value) ? getAddress(value) : null;
}

function client() {
  return createPublicClient({
    chain: monadTestnet,
    transport: http(MONAD_RPC_URL),
  });
}

export async function buy(input: BuyInput): Promise<BuyResult> {
  const itemId = typeof input.itemId === "string" ? input.itemId : "";
  const item = findItem(itemId);
  if (!item) return { status: 404, body: { error: "Unknown item." } };

  const quantity = input.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return { status: 400, body: { error: "quantity must be a whole number from 1 to 100." } };
  }

  const demoshow = addressEnv("DEMOSHOW_ADDRESS");
  const scam = addressEnv("SCAMTICKETS_ADDRESS");
  if (!demoshow) return { status: 500, body: { error: "DEMOSHOW_ADDRESS is not set." } };

  const total = item.priceWei * BigInt(quantity);
  let payee = demoshow;
  if (input.merchantAddress !== undefined && input.merchantAddress !== null && input.merchantAddress !== "") {
    if (typeof input.merchantAddress !== "string" || !isAddress(input.merchantAddress)) {
      return { status: 400, body: { error: "merchantAddress is not a valid address." } };
    }
    const given = getAddress(input.merchantAddress);
    if (scam && given === scam) payee = scam;
    else if (given === demoshow) payee = demoshow;
    else return { status: 400, body: { error: "merchantAddress must be DemoShow or the scam demo address." } };
  }

  const ref = input.ref;
  if (ref === undefined || ref === null || ref === "") {
    return {
      status: 402,
      body: {
        amount: total.toString(),
        merchant: payee,
        ref: bytesToHex(randomBytes(32)),
        itemId: item.id,
        quantity,
        message: `${DEMO_DISCLAIMER} Approve this payment with AgentPay, then call buy again with the ref.`,
      },
    };
  }

  if (typeof ref !== "string" || !isHex(ref) || ref.length !== 66) {
    return { status: 400, body: { error: "ref must be a bytes32 hex string." } };
  }

  const vault = getVaultAddress();
  const fromBlock = getDeployBlock();
  if (!vault || fromBlock === null) {
    return { status: 500, body: { error: "Vault address or deploy block is not set." } };
  }

  const logs = await client().getLogs({
    address: vault,
    event: paymentApprovedEvent,
    args: { ref },
    fromBlock,
    toBlock: "latest",
  });

  const match = logs.find((log) => {
    const merchant = log.args.merchant;
    const amount = log.args.amount;
    return merchant !== undefined && amount !== undefined && getAddress(merchant) === demoshow && amount >= total;
  });

  if (!match) {
    return {
      status: 402,
      body: {
        amount: total.toString(),
        merchant: payee,
        ref,
        itemId: item.id,
        quantity,
        message: "No AgentPay approval found for this ref, DemoShow, and amount.",
      },
    };
  }

  const txHash = match.transactionHash ?? "0x";
  return {
    status: 200,
    body: {
      ticketId: `DEMO-${ref.slice(2, 10)}`,
      item: item.name,
      quantity,
      txHash,
      explorerUrl: txHash === "0x" ? "" : txUrl(txHash),
    },
  };
}
