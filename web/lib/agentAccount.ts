import { isHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export function getAgentAccount() {
  const raw = process.env.AGENT_PRIVATE_KEY?.trim();
  if (!raw) throw new Error("AGENT_PRIVATE_KEY is not set.");
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!isHex(key) || key.length !== 66) {
    throw new Error("AGENT_PRIVATE_KEY must be a 32-byte hex key.");
  }
  return privateKeyToAccount(key);
}

export function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const key = process.env.AGENT_PRIVATE_KEY;
  if (key && message.includes(key)) return "The agent wallet could not send the transaction.";
  return message.slice(0, 400);
}
