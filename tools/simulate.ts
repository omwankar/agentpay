import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  isAddress,
  parseAbi,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const abi = parseAbi([
  "function authorize(address merchant, uint256 amount, bytes32 ref) returns (bool)",
  "event PaymentApproved(address indexed agent, address indexed merchant, uint256 amount, bytes32 indexed ref)",
  "event PaymentRejected(address indexed agent, address indexed merchant, uint256 amount, bytes32 indexed ref, string reason)",
]);

type Scenario = "approve" | "over-cap" | "bad-merchant";

function loadEnv(path: string) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trim = line.trim();
    if (!trim || trim.startsWith("#")) continue;
    const idx = trim.indexOf("=");
    if (idx < 1) continue;
    const name = trim.slice(0, idx).trim();
    const value = trim.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function required(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`${name} is missing from tools/.env`);
  return value;
}

function addressEnv(name: string): Address {
  const value = required(name);
  if (!isAddress(value)) throw new Error(`${name} is not an address`);
  return value;
}

function redact(message: string) {
  const secret = process.env.AGENT_PRIVATE_KEY ?? "";
  if (!secret) return message;
  const bare = secret.replace(/^0x/i, "");
  return message.split(secret).join("[REDACTED]").split(bare).join("[REDACTED]");
}

const scenario = process.argv[2] as Scenario | undefined;
if (scenario !== "approve" && scenario !== "over-cap" && scenario !== "bad-merchant") {
  console.error("Usage: npx tsx simulate.ts approve|over-cap|bad-merchant");
  process.exit(1);
}

const root = dirname(fileURLToPath(import.meta.url));
loadEnv(join(root, ".env"));

const rpcUrl = required("RPC_URL");
const vault = addressEnv("VAULT_ADDRESS");
const merchant = addressEnv("MERCHANT_ADDRESS");
const blocked = addressEnv("BLOCKED_MERCHANT_ADDRESS");
const explorer = (process.env.EXPLORER_URL ?? "").replace(/\/$/, "");
const key = required("AGENT_PRIVATE_KEY");
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.error("AGENT_PRIVATE_KEY must be a 32-byte hex key.");
  process.exit(1);
}

const account = privateKeyToAccount(key as Hex);
const chain = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
} as const;

const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });

const payee = scenario === "bad-merchant" ? blocked : merchant;
const amount = scenario === "over-cap" ? parseEther("0.6") : parseEther("0.05");
const ref = `0x${randomBytes(32).toString("hex")}` as Hex;

try {
  const data = encodeFunctionData({ abi, functionName: "authorize", args: [payee, amount, ref] });
  const gas = await publicClient.estimateGas({ account: account.address, to: vault, data });
  const hash = await wallet.writeContract({
    address: vault,
    abi,
    functionName: "authorize",
    args: [payee, amount, ref],
    gas: (gas * 12n) / 10n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  let outcome: { eventName: string; reason?: string } | null = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
      if (decoded.eventName === "PaymentApproved") {
        outcome = { eventName: decoded.eventName };
        break;
      }
      if (decoded.eventName === "PaymentRejected") {
        outcome = { eventName: decoded.eventName, reason: String(decoded.args.reason) };
        break;
      }
    } catch {
      continue;
    }
  }
  const link = explorer ? `${explorer}/tx/${hash}` : hash;
  if (scenario === "approve" && outcome?.eventName === "PaymentApproved") {
    console.log("PASS PaymentApproved");
    console.log(link);
    process.exit(0);
  }
  if (scenario === "over-cap" && outcome?.reason === "OVER_PER_TX_CAP") {
    console.log("BLOCKED OVER_PER_TX_CAP");
    console.log(link);
    process.exit(0);
  }
  if (scenario === "bad-merchant" && outcome?.reason === "MERCHANT_NOT_ALLOWED") {
    console.log("BLOCKED MERCHANT_NOT_ALLOWED");
    console.log(link);
    process.exit(0);
  }
  console.error(`FAIL ${scenario} got ${outcome?.eventName ?? "no event"}${outcome?.reason ? ` ${outcome.reason}` : ""}`);
  console.error(link);
  process.exit(1);
} catch (error) {
  const message = error instanceof Error ? error.message : "Simulation failed.";
  console.error(redact(message));
  process.exit(1);
}
