# Demo trigger

`simulate.ts` is a test harness for the three AgentVault outcomes. It is not the AI agent. Nothing in `/web` or `/contracts` imports it.

## Setup

```powershell
cd tools
npm install
Copy-Item .env.example .env
```

Put the agent key in `tools/.env` as `AGENT_PRIVATE_KEY`. The other values in the example are the public testnet addresses. Never commit `tools/.env`, and never print the key.

The agent address needs a little test MON for gas.

## Scenarios

From `tools/`:

```powershell
npx tsx simulate.ts approve
npx tsx simulate.ts over-cap
npx tsx simulate.ts bad-merchant
```

| Command | What it sends | Expected line |
| --- | --- | --- |
| `approve` | 0.05 MON to the approved merchant | `PASS PaymentApproved` |
| `over-cap` | 0.6 MON to the approved merchant | `BLOCKED OVER_PER_TX_CAP` |
| `bad-merchant` | 0.05 MON to the blocked merchant | `BLOCKED MERCHANT_NOT_ALLOWED` |

Each run uses a new `bytes32` reference, waits for the receipt, and prints the explorer link for that transaction.
