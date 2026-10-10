export const REJECTION_REASONS: Record<string, string> = {
  AGENT_REVOKED: "This agent is revoked or was never activated.",
  REF_ALREADY_USED: "This payment reference was already approved.",
  MERCHANT_NOT_ALLOWED: "This merchant is not on the allowlist.",
  OVER_PER_TX_CAP: "The amount is above the per-payment cap.",
  OVER_DAILY_CAP: "The amount would exceed today's budget.",
};

export function explainReason(reason: string) {
  return REJECTION_REASONS[reason] ?? reason;
}
