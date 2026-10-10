import { getAddress, isAddress, parseAbi, parseAbiItem, type Address } from "viem";

export const vaultAbi = parseAbi([
  "function owner() view returns (address)",
  "function agents(address) view returns (bool active, uint256 perTxCap, uint256 dailyCap, uint256 spentToday, uint256 windowStart)",
  "function allowedMerchant(address) view returns (bool)",
  "function usedRef(bytes32) view returns (bool)",
  "function remainingToday(address) view returns (uint256)",
  "function setAgent(address agent, uint256 perTxCap, uint256 dailyCap)",
  "function revokeAgent(address agent)",
  "function setMerchant(address merchant, bool allowed)",
  "function authorize(address merchant, uint256 amount, bytes32 ref) returns (bool)",
  "event AgentSet(address indexed agent, uint256 perTxCap, uint256 dailyCap)",
  "event AgentRevoked(address indexed agent)",
  "event MerchantSet(address indexed merchant, bool allowed)",
  "event PaymentApproved(address indexed agent, address indexed merchant, uint256 amount, bytes32 indexed ref)",
  "event PaymentRejected(address indexed agent, address indexed merchant, uint256 amount, bytes32 indexed ref, string reason)",
]);

export const paymentApprovedEvent = parseAbiItem(
  "event PaymentApproved(address indexed agent, address indexed merchant, uint256 amount, bytes32 indexed ref)",
);
export const paymentRejectedEvent = parseAbiItem(
  "event PaymentRejected(address indexed agent, address indexed merchant, uint256 amount, bytes32 indexed ref, string reason)",
);
export const merchantSetEvent = parseAbiItem(
  "event MerchantSet(address indexed merchant, bool allowed)",
);

export function getVaultAddress(): Address | null {
  const value = process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? "";
  return isAddress(value) ? getAddress(value) : null;
}

export function getDeployBlock(): bigint | null {
  const value = process.env.NEXT_PUBLIC_DEPLOY_BLOCK?.trim() ?? "";
  if (!/^\d+$/.test(value)) return null;
  return BigInt(value);
}
