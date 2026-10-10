"use client";

import { useEffect, useRef, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  parseEther,
  type Address,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { ArrowRight, Ban, CircleCheck, ExternalLink, Store, Trash, TriangleAlert, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { monadTestnet, MONAD_RPC_URL } from "@/lib/chain";
import { explainReason } from "@/lib/reasons";
import {
  getDeployBlock,
  getVaultAddress,
  merchantSetEvent,
  paymentApprovedEvent,
  paymentRejectedEvent,
  vaultAbi,
} from "@/lib/vault";
import { AddressPill } from "@/components/ui/AddressPill";
import { BrandMark } from "@/components/ui/BrandMark";
import { Badge } from "@/components/ui/Badge";
import { Button, IconLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { formatAgo, formatMon, scanAddressUrl, scanTxUrl, shortAddress, spentRatio } from "@/components/ui/format";
import { Input } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";

type AgentRules = {
  active: boolean;
  perTxCap: bigint;
  dailyCap: bigint;
  spentToday: bigint;
  windowStart: bigint;
  remaining: bigint;
};

type FeedItem = {
  kind: "approved" | "rejected";
  agent: Address;
  merchant: Address;
  amount: bigint;
  ref: Hex;
  reason?: string;
  txHash: Hex;
  blockNumber: bigint;
  logIndex: number;
  timestamp: number;
};

type MerchantRow = { address: Address; allowed: boolean };

type TxState = { label: string; status: "pending" | "confirmed"; hash: Hex | null };

const MONAD_BLOCK_MS = 400;

function timestampFromAnchor(anchorMs: number, anchorBlock: bigint, blockNumber: bigint) {
  const delta = anchorBlock >= blockNumber ? anchorBlock - blockNumber : 0n;
  const deltaMs = delta > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(delta) * MONAD_BLOCK_MS;
  return anchorMs - deltaMs;
}

function barClass(ratio: number) {
  if (ratio > 90) return "bg-red-500";
  if (ratio > 70) return "bg-amber-400";
  return "bg-[#2DD4BF]";
}

function errorText(error: unknown) {
  if (typeof error === "object" && error && "code" in error && (error as { code?: number }).code === 4001) {
    return "Request cancelled in the wallet.";
  }
  if (typeof error === "object" && error && "shortMessage" in error) {
    return String((error as { shortMessage?: string }).shortMessage);
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

function getProvider(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  return eth ?? null;
}

function publicClient() {
  return createPublicClient({ chain: monadTestnet, transport: http(MONAD_RPC_URL) });
}

function asAgent(value: unknown): Omit<AgentRules, "remaining"> | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown> & unknown[];
  const active = "active" in row ? row.active : row[0];
  const perTxCap = "perTxCap" in row ? row.perTxCap : row[1];
  const dailyCap = "dailyCap" in row ? row.dailyCap : row[2];
  const spentToday = "spentToday" in row ? row.spentToday : row[3];
  const windowStart = "windowStart" in row ? row.windowStart : row[4];
  if (
    typeof active !== "boolean" ||
    typeof perTxCap !== "bigint" ||
    typeof dailyCap !== "bigint" ||
    typeof spentToday !== "bigint" ||
    typeof windowStart !== "bigint"
  ) {
    return null;
  }
  return { active, perTxCap, dailyCap, spentToday, windowStart };
}

async function ensureMonad() {
  const provider = getProvider();
  if (!provider) throw new Error("No wallet found. Install a browser wallet and try again.");
  const chainId = "0x279F";
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? (error as { code?: number }).code : undefined;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: "Monad Testnet",
          nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
          rpcUrls: [MONAD_RPC_URL],
          blockExplorerUrls: ["https://testnet.monadvision.com"],
        },
      ],
    });
  }
}

export function Dashboard() {
  const vault = getVaultAddress();
  const deployBlock = getDeployBlock();
  const configured = Boolean(vault && deployBlock !== null);
  const [account, setAccount] = useState<Address | null>(null);
  const [owner, setOwner] = useState<Address | null>(null);
  const [agentAddress, setAgentAddress] = useState("");
  const [perTx, setPerTx] = useState("0.5");
  const [daily, setDaily] = useState("2");
  const [merchant, setMerchant] = useState("");
  const [rules, setRules] = useState<AgentRules | null>(null);
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState | null>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [vaultBalance, setVaultBalance] = useState<bigint | null>(null);
  const [chainReady, setChainReady] = useState(!configured);
  const [configReady, setConfigReady] = useState(false);
  const [syncedAgent, setSyncedAgent] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [now, setNow] = useState(0);
  const [freshKeys, setFreshKeys] = useState<Set<string>>(() => new Set());
  const agentRef = useRef(agentAddress);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const requestId = useRef(0);
  const seenKeys = useRef<Set<string> | null>(null);
  const toastState = useRef<{ id: string; status: "pending" | "confirmed" } | null>(null);
  agentRef.current = agentAddress;

  async function refresh() {
    if (!vault || deployBlock === null) return;
    const id = ++requestId.current;
    try {
      const client = publicClient();
      const nextOwner = await client.readContract({ address: vault, abi: vaultAbi, functionName: "owner" });
      if (id !== requestId.current) return;
      setOwner(nextOwner);

      try {
        const nextBalance = await client.getBalance({ address: nextOwner });
        if (id !== requestId.current) return;
        setVaultBalance(nextBalance);
      } catch {
        if (id !== requestId.current) return;
      }

      const agent = agentRef.current.trim();
      if (isAddress(agent)) {
        const [record, remaining] = await Promise.all([
          client.readContract({ address: vault, abi: vaultAbi, functionName: "agents", args: [getAddress(agent)] }),
          client.readContract({
            address: vault,
            abi: vaultAbi,
            functionName: "remainingToday",
            args: [getAddress(agent)],
          }),
        ]);
        const parsed = asAgent(record);
        if (id !== requestId.current) return;
        setRules(parsed ? { ...parsed, remaining } : null);
      } else {
        if (id !== requestId.current) return;
        setRules(null);
      }

      const [approved, rejected, merchantLogs] = await Promise.all([
        client.getLogs({ address: vault, event: paymentApprovedEvent, fromBlock: deployBlock, toBlock: "latest" }),
        client.getLogs({ address: vault, event: paymentRejectedEvent, fromBlock: deployBlock, toBlock: "latest" }),
        client.getLogs({ address: vault, event: merchantSetEvent, fromBlock: deployBlock, toBlock: "latest" }),
      ]);

      const items: Omit<FeedItem, "timestamp">[] = [
        ...approved.flatMap((log) => {
          const { agent, merchant: payee, amount, ref } = log.args;
          if (!agent || !payee || amount === undefined || !ref || !log.transactionHash) return [];
          return [
            {
              kind: "approved" as const,
              agent,
              merchant: payee,
              amount,
              ref,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber ?? 0n,
              logIndex: log.logIndex ?? 0,
            },
          ];
        }),
        ...rejected.flatMap((log) => {
          const { agent, merchant: payee, amount, ref, reason } = log.args;
          if (!agent || !payee || amount === undefined || !ref || !log.transactionHash) return [];
          return [
            {
              kind: "rejected" as const,
              agent,
              merchant: payee,
              amount,
              ref,
              reason,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber ?? 0n,
              logIndex: log.logIndex ?? 0,
            },
          ];
        }),
      ];
      items.sort((a, b) => {
        if (a.blockNumber === b.blockNumber) return b.logIndex - a.logIndex;
        return a.blockNumber > b.blockNumber ? -1 : 1;
      });
      if (id !== requestId.current) return;

      let anchorMs = Date.now();
      const anchorBlock = items[0]?.blockNumber ?? 0n;
      if (items.length > 0 && anchorBlock > 0n) {
        try {
          const block = await client.getBlock({ blockNumber: anchorBlock });
          if (id !== requestId.current) return;
          anchorMs = Number(block.timestamp) * 1000;
        } catch {
          anchorMs = Date.now();
        }
      }
      setFeed(
        items.map((item) => ({
          ...item,
          timestamp: timestampFromAnchor(anchorMs, anchorBlock, item.blockNumber),
        })),
      );

      const latest = new Map<string, MerchantRow & { block: bigint; index: number }>();
      for (const log of merchantLogs) {
        if (!log.args.merchant || log.args.allowed === undefined) continue;
        const address = getAddress(log.args.merchant);
        const block = log.blockNumber ?? 0n;
        const index = log.logIndex ?? 0;
        const prev = latest.get(address);
        if (!prev || block > prev.block || (block === prev.block && index >= prev.index)) {
          latest.set(address, { address, allowed: log.args.allowed, block, index });
        }
      }
      setMerchants(
        [...latest.values()]
          .filter((row) => row.allowed)
          .map((row) => ({ address: row.address, allowed: true })),
      );
      if (id !== requestId.current) return;
      setFeedError(null);
      setChainReady(true);
      setSyncedAgent(agentRef.current.trim());
    } catch (err) {
      if (id !== requestId.current) return;
      setFeedError(errorText(err));
      setChainReady(true);
      setSyncedAgent(agentRef.current.trim());
    }
  }
  refreshRef.current = refresh;

  useEffect(() => {
    let stop = false;
    void (async () => {
      try {
        const response = await fetch("/api/config");
        const body = (await response.json()) as { agentAddress?: string | null };
        if (!stop && body.agentAddress) setAgentAddress(body.agentAddress);
      } catch {
        if (!stop) setError("Could not load the demo agent address.");
      } finally {
        if (!stop) setConfigReady(true);
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (!vault || deployBlock === null) return;
    void refreshRef.current();
    const id = setInterval(() => void refreshRef.current(), 4000);
    return () => clearInterval(id);
  }, [vault, deployBlock]);

  useEffect(() => {
    if (!vault || deployBlock === null || !isAddress(agentAddress)) return;
    void refreshRef.current();
  }, [agentAddress, vault, deployBlock]);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const keys = feed.map((item) => `${item.txHash}-${item.logIndex}`);
    if (seenKeys.current === null) {
      seenKeys.current = new Set(keys);
      return;
    }
    const arrived = keys.filter((key) => !seenKeys.current?.has(key));
    for (const key of keys) seenKeys.current.add(key);
    if (arrived.length > 0) setFreshKeys(new Set(arrived));
  }, [feed]);

  useEffect(() => {
    if (!tx) return;
    toastState.current = { id: tx.label, status: tx.status };
    if (tx.status === "pending") {
      toast.loading(tx.hash ? `${tx.label} pending` : `${tx.label}…`, { id: tx.label });
      return;
    }
    toast.success(`${tx.label} confirmed`, {
      id: tx.label,
      description: tx.hash ? (
        <a className="font-medium text-[#99f6e4] underline" href={scanTxUrl(tx.hash)} target="_blank" rel="noreferrer">
          View on explorer
        </a>
      ) : undefined,
    });
  }, [tx]);

  useEffect(() => {
    if (!error) return;
    if (toastState.current?.status === "pending") {
      toast.dismiss(toastState.current.id);
      toastState.current = null;
    }
    toast.error(error);
  }, [error]);

  useEffect(() => {
    if (!confirmRevoke) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirmRevoke(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmRevoke]);

  const isOwner = Boolean(account && owner && account.toLowerCase() === owner.toLowerCase());
  const lockReason = !isOwner ? "Connect owner wallet" : busy ? "Transaction in progress" : undefined;
  const rulesLoading =
    configured && (!configReady || (isAddress(agentAddress) && syncedAgent.toLowerCase() !== agentAddress.trim().toLowerCase()));
  const feedLoading = configured && !chainReady;
  const agentInvalid = agentAddress.trim().length > 0 && !isAddress(agentAddress.trim());
  const merchantInvalid = merchant.trim().length > 0 && !isAddress(merchant.trim());
  const ratio = rules ? spentRatio(rules.spentToday, rules.dailyCap) : 0;
  const agentStatus = !rules ? "Not set" : rules.active ? "Active" : "Revoked";
  const agentTone = !rules ? "neutral" : rules.active ? "success" : "danger";

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      await ensureMonad();
      const provider = getProvider();
      if (!provider) throw new Error("No wallet found. Install a browser wallet and try again.");
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts[0] || !isAddress(accounts[0])) throw new Error("The wallet did not return an account.");
      setAccount(getAddress(accounts[0]));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setConnecting(false);
    }
  }

  async function send(
    label: string,
    data: Hex,
    write: (gas: bigint) => Promise<Hex>,
  ) {
    if (!vault) {
      setError("Set NEXT_PUBLIC_VAULT_ADDRESS before sending a transaction.");
      return;
    }
    setBusy(true);
    setError(null);
    setTx({ label, status: "pending", hash: null });
    try {
      await ensureMonad();
      if (!account) throw new Error("Connect the owner wallet first.");
      const client = publicClient();
      const gas = await client.estimateGas({ account, to: vault, data });
      const hash = await write((gas * 12n) / 10n);
      setTx({ label, status: "pending", hash });
      await client.waitForTransactionReceipt({ hash });
      setTx({ label, status: "confirmed", hash });
      await refresh();
    } catch (err) {
      setTx(null);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function walletClient() {
    const provider = getProvider();
    if (!provider || !account) throw new Error("Connect the owner wallet first.");
    return createWalletClient({ account, chain: monadTestnet, transport: custom(provider) });
  }

  async function onSetAgent() {
    if (!vault || !isAddress(agentAddress)) {
      setError("Enter a valid agent address.");
      return;
    }
    let perTxCap: bigint;
    let dailyCap: bigint;
    try {
      perTxCap = parseEther(perTx);
      dailyCap = parseEther(daily);
    } catch {
      setError("Enter caps in MON, for example 0.5 and 2.");
      return;
    }
    const args = [getAddress(agentAddress), perTxCap, dailyCap] as const;
    const data = encodeFunctionData({ abi: vaultAbi, functionName: "setAgent", args });
    await send("Set agent", data, (gas) =>
      walletClient().writeContract({ address: vault, abi: vaultAbi, functionName: "setAgent", args, gas }),
    );
  }

  async function onRevoke() {
    if (!vault || !isAddress(agentAddress)) {
      setError("Enter a valid agent address.");
      return;
    }
    const args = [getAddress(agentAddress)] as const;
    const data = encodeFunctionData({ abi: vaultAbi, functionName: "revokeAgent", args });
    await send("Revoke agent", data, (gas) =>
      walletClient().writeContract({ address: vault, abi: vaultAbi, functionName: "revokeAgent", args, gas }),
    );
  }

  async function onMerchant(allowed: boolean, target?: string) {
    const value = (target ?? merchant).trim();
    if (!vault || !isAddress(value)) {
      setError("Enter a valid merchant address.");
      return;
    }
    const args = [getAddress(value), allowed] as const;
    const data = encodeFunctionData({ abi: vaultAbi, functionName: "setMerchant", args });
    await send(allowed ? "Approve merchant" : "Remove merchant", data, (gas) =>
      walletClient().writeContract({ address: vault, abi: vaultAbi, functionName: "setMerchant", args, gas }),
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2DD4BF]/15 text-[#2DD4BF] ring-1 ring-[#2DD4BF]/35">
            <BrandMark className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">AgentPay</h1>
            <p className="text-sm text-white/60">Spending rules for AI agents</p>
            <p className="text-xs text-white/40">Testnet only. Test funds.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Monad Testnet
          </span>
          {account ? (
            <AddressPill address={account} />
          ) : (
            <Button onClick={() => void connect()} disabled={connecting}>
              <Wallet className="h-4 w-4" />
              {connecting ? "Connecting…" : "Connect wallet"}
            </Button>
          )}
        </div>
      </header>

      {!configured && !bannerDismissed ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-100">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="flex-1">
            Set NEXT_PUBLIC_VAULT_ADDRESS and NEXT_PUBLIC_DEPLOY_BLOCK in web/.env.local after the contract is deployed,
            then restart the app.
          </p>
          <button
            type="button"
            aria-label="Dismiss warning"
            onClick={() => setBannerDismissed(true)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-amber-100/80 transition duration-200 hover:bg-amber-300/10 hover:text-amber-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="teal"
          label="Owner balance"
          loading={feedLoading}
          value={vaultBalance === null ? "—" : formatMon(vaultBalance)}
          unit="MON"
        />
        <StatCard
          tone="sky"
          label="Per-payment cap"
          loading={rulesLoading}
          value={rules ? formatMon(rules.perTxCap) : "—"}
          unit="MON"
        />
        <StatCard
          tone="amber"
          label="Daily budget"
          loading={rulesLoading}
          value={rules ? formatMon(rules.dailyCap) : "—"}
          unit="MON"
        />
        <StatCard
          tone="emerald"
          label="Spent today"
          loading={rulesLoading}
          value={rules ? formatMon(rules.spentToday) : "—"}
          unit="MON"
        >
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn("h-full rounded-full transition-all duration-200", barClass(ratio))}
              style={{ width: `${Math.min(100, ratio)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-white/45">
            Remaining today{" "}
            <span className="font-mono text-white/70">{rules ? `${formatMon(rules.remaining)} MON` : "—"}</span>
          </p>
        </StatCard>
      </section>

      <Card
        title="Agent"
        description={
          owner
            ? `Vault owner ${shortAddress(owner)}${account && !isOwner ? ". Read-only until the owner wallet connects." : ""}`
            : "Owner not loaded"
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {rulesLoading ? <div className="skeleton h-6 w-20 rounded-full" /> : <Badge tone={agentTone}>{agentStatus}</Badge>}
          {isAddress(agentAddress) ? <AddressPill address={agentAddress} /> : null}
        </div>
        <div className="flex flex-col gap-3">
          <Input
            label="Agent address"
            mono
            value={agentAddress}
            onChange={(event) => setAgentAddress(event.target.value)}
            disabled={!isOwner}
            placeholder="0x…"
            invalid={agentInvalid}
            hint={agentInvalid ? "Enter a valid address." : undefined}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Per-payment cap (MON)"
              mono
              value={perTx}
              onChange={(event) => setPerTx(event.target.value)}
              disabled={!isOwner}
            />
            <Input
              label="Daily budget (MON)"
              mono
              value={daily}
              onChange={(event) => setDaily(event.target.value)}
              disabled={!isOwner}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button disabled={!isOwner || busy} tooltip={lockReason} onClick={() => void onSetAgent()}>
              Set caps
            </Button>
            <Button variant="danger" disabled={!isOwner || busy} tooltip={lockReason} onClick={() => setConfirmRevoke(true)}>
              Revoke agent
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Approved merchants">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <Input
              label="Merchant address"
              mono
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              disabled={!isOwner}
              placeholder="0x…"
              invalid={merchantInvalid}
              hint={merchantInvalid ? "Enter a valid address." : undefined}
            />
          </div>
          <div className="flex gap-2 sm:pt-[1.85rem]">
            <Button disabled={!isOwner || busy} tooltip={lockReason} onClick={() => void onMerchant(true)}>
              Approve
            </Button>
            <Button variant="ghost" disabled={!isOwner || busy} tooltip={lockReason} onClick={() => void onMerchant(false)}>
              Remove
            </Button>
          </div>
        </div>

        {feedLoading ? (
          <div className="mt-5 space-y-3">
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-12 rounded-xl" />
          </div>
        ) : merchants.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
            <Store className="h-8 w-8 text-white/25" />
            <p className="text-sm text-white/50">No approved merchants yet</p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {merchants.map((row) => (
              <li key={row.address} className="flex items-center justify-between gap-3 py-3">
                <AddressPill address={row.address} />
                <div className="flex items-center gap-1">
                  <IconLink href={scanAddressUrl(row.address)} label="View merchant on explorer">
                    <ExternalLink className="h-4 w-4" />
                  </IconLink>
                  <Button
                    variant="dangerGhost"
                    icon
                    disabled={!isOwner || busy}
                    tooltip={lockReason}
                    aria-label={`Remove ${shortAddress(row.address)}`}
                    onClick={() => void onMerchant(false, row.address)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Live feed"
        description="Newest first. Refreshes every 4 seconds."
        action={feedLoading ? <div className="skeleton h-6 w-16 rounded-full" /> : <Badge tone="live">Live</Badge>}
      >
        {feedError ? <p className="mb-3 text-sm text-red-300">{feedError}</p> : null}
        {feedLoading ? (
          <div className="space-y-3">
            <div className="skeleton h-16 rounded-xl" />
            <div className="skeleton h-16 rounded-xl" />
            <div className="skeleton h-16 rounded-xl" />
          </div>
        ) : feed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2DD4BF] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2DD4BF]" />
            </span>
            <p className="text-sm text-white/50">No payments yet. Waiting for the agent...</p>
          </div>
        ) : (
          <ul className="relative space-y-3 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-white/10">
            {feed.map((item) => {
              const key = `${item.txHash}-${item.logIndex}`;
              const blocked = item.kind === "rejected";
              return (
                <li
                  key={key}
                  className={cn(
                    "relative ml-0 rounded-xl border py-3 pr-3 pl-14",
                    blocked ? "border-red-500/30 bg-red-500/[0.08]" : "border-white/[0.06] bg-white/[0.02]",
                    freshKeys.has(key) && "feed-in",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-3 left-0 z-10 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-[#0c0e14]",
                      blocked ? "bg-[#2a1518] text-red-300" : "bg-[#102018] text-emerald-300",
                    )}
                  >
                    {blocked ? <Ban className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium text-white">{formatMon(item.amount)} MON</span>
                    <Badge tone={blocked ? "danger" : "success"}>{blocked ? "BLOCKED" : "PAID"}</Badge>
                    <span className="ml-auto">
                      <IconLink href={scanTxUrl(item.txHash)} label="View transaction on explorer">
                        <ExternalLink className="h-4 w-4" />
                      </IconLink>
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-xs text-white/55">
                    <span>{shortAddress(item.agent)}</span>
                    <ArrowRight className="h-3 w-3 text-white/30" />
                    <span>{shortAddress(item.merchant)}</span>
                    <span className="font-sans text-white/35">· {now > 0 ? formatAgo(item.timestamp, now) : "just now"}</span>
                  </p>
                  {blocked && item.reason ? <p className="mt-1.5 text-sm text-red-200/90">{explainReason(item.reason)}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {confirmRevoke ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setConfirmRevoke(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101218] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="revoke-title" className="text-lg font-medium text-white">
              Revoke this agent?
            </h3>
            <p className="mt-2 text-sm text-white/60">
              The agent will no longer be able to spend from the vault. You can set caps again later.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" autoFocus onClick={() => setConfirmRevoke(false)}>
                Cancel
              </Button>
              <Button
                variant="dangerSolid"
                onClick={() => {
                  setConfirmRevoke(false);
                  void onRevoke();
                }}
              >
                Revoke agent
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
