# Deploy and verify AgentVault on Monad testnet

Do this from `contracts/`. Use a throwaway testnet key. Never print `PRIVATE_KEY`, and never commit `contracts/.env`.

Network, from [docs.monad.xyz](https://docs.monad.xyz): chain id `10143`, currency MON, RPC `https://testnet-rpc.monad.xyz`. Fund the deployer at [https://faucet.monad.xyz](https://faucet.monad.xyz) before the real broadcast. `foundry.toml` already sets `network = "monad"`, that RPC, and chain id `10143`.

Copy the example env file and fill it in. `PRIVATE_KEY` is the `0x` hex key. `AGENT_ADDRESS` is the agent the vault will authorize. `MERCHANT_ADDRESS` is the merchant that will be allowed.

```powershell
Copy-Item .env.example .env
```

## Load contracts/.env

This sets the three variables for the current PowerShell window. It does not print their values.

```powershell
Get-Content .env | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  $pair = $line.Split("=", 2)
  if ($pair.Length -ne 2) { return }
  $name = $pair[0].Trim()
  $value = $pair[1].Trim().Trim('"').Trim("'")
  Set-Item -Path "Env:$name" -Value $value
}
```

If `forge` is not recognized, open a new terminal after Foundry was installed, or run this once in the same window:

```powershell
$env:Path = "$env:USERPROFILE\.foundry\bin;" + $env:Path
```

## Dry run

Simulates the deploy, `setAgent(AGENT_ADDRESS, 0.5 ether, 2 ether)`, and `setMerchant(MERCHANT_ADDRESS, true)`. No transaction is sent.

```powershell
forge script script/Deploy.s.sol:Deploy --rpc-url https://testnet-rpc.monad.xyz
```

## Broadcast

Sends the transactions. The script logs `AgentVault deployed at 0x...`.

```powershell
forge script script/Deploy.s.sol:Deploy --rpc-url https://testnet-rpc.monad.xyz --broadcast
```

## Deploy block

Foundry writes the receipts to `broadcast/Deploy.s.sol/10143/run-latest.json`. If that folder is missing, use the directory that the broadcast just created under `broadcast/Deploy.s.sol/`.

```powershell
$run = Get-Content .\broadcast\Deploy.s.sol\10143\run-latest.json -Raw | ConvertFrom-Json
$run.transactions[0].contractAddress
$run.receipts[0].transactionHash
$run.receipts[0].blockNumber
```

`blockNumber` is the value for `NEXT_PUBLIC_DEPLOY_BLOCK`. The contract address is the vault address.

The same block number from the deploy transaction hash:

```powershell
cast receipt <TX_HASH> blockNumber --rpc-url https://testnet-rpc.monad.xyz
```

`<TX_HASH>` is `$run.receipts[0].transactionHash` from the broadcast file. `cast receipt` takes that field name; this is from `cast receipt --help`, not an extra flag.

## Verify

Flags below are from [Verify a smart contract on Monad using Foundry](https://docs.monad.xyz/guides/verify-smart-contract/foundry), testnet section. Chain id is `10143`. Run these from `contracts/` after the broadcast. Replace `<VAULT_ADDRESS>` with the deployed address. There are no constructor arguments.

### MonadVision

```powershell
forge verify-contract <VAULT_ADDRESS> src/AgentVault.sol:AgentVault --chain 10143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/
```

Success looks like `Contract successfully verified`. Then open:

`https://testnet.monadvision.com/address/<VAULT_ADDRESS>`

The contract page should show the AgentVault source and a verified mark.

### Monadscan

The docs also give an Etherscan-style verifier. `YourApiKeyToken` is the placeholder written in the docs.

```powershell
forge verify-contract <VAULT_ADDRESS> src/AgentVault.sol:AgentVault --chain 10143 --verifier etherscan --etherscan-api-key YourApiKeyToken --watch
```

Success ends with `Pass - Verified`. Then open:

`https://testnet.monadscan.com/address/<VAULT_ADDRESS>`

The contract page should show the source as verified.

The docs example uses the short contract name `Counter`. This repo uses `src/AgentVault.sol:AgentVault`, which is the same file-and-contract form the docs print in the successful Monadscan log (`src/Counter.sol:Counter`).

## Manual fallback

Use this only if `forge verify-contract` fails. The docs point at MonadVision's verify page and do not list a separate UI URL, so open the deployed contract on `https://testnet.monadvision.com` and use that explorer's verify control.

Flatten the source:

```powershell
forge flatten src/AgentVault.sol --output AgentVault.flat.sol
```

Paste `AgentVault.flat.sol` into the explorer form. Settings below are from `forge config` and from `out/AgentVault.sol/AgentVault.json` after the current build. `foundry.toml` does not pin a solc version (`auto_detect_solc` is on), so re-check the compiler line in that JSON after you compile for the broadcast. The bytecode must be verified with the compiler that produced it.

| Setting | Value |
| --- | --- |
| Contract | `src/AgentVault.sol:AgentVault` |
| Compiler | `0.8.37+commit.f401782d` |
| Optimizer | off |
| Optimizer runs | 200 (stored, unused while the optimizer is off) |
| EVM version | `osaka` |
| via IR | off |
| Constructor arguments | none |

After the explorer accepts the source, reload `https://testnet.monadvision.com/address/<VAULT_ADDRESS>` and confirm the contract tab shows the AgentVault source as verified.
