---
name: defi-data-sources
description: How to fetch DeFi lending rates from DeFi Llama and on-chain sources. Use whenever working on data ingestion, parsers, or adding a new protocol.
---

# DeFi Data Sources

## Primary source: DeFi Llama Yields API

- Endpoint: `https://yields.llama.fi/pools`
- No auth needed. Rate limit ~30 req/min (we use 1 req per cycle).
- Returns: `{ "data": [ { pool, chain, project, symbol, tvlUsd, apy,
  apyBase, apyReward, apyMean30d, ... } ] }`

### Filtering whitelist (Phase 1: Ethereum only)

Projects (DefiLlama `project` slugs):
- `aave-v3`
- `fluid-lending`
- `compound-v3`
- `morpho-blue`
- `spark`
- `sky-lending` (or `sky-savings-rate`)

Chains: `Ethereum` (Phase 1). Add `Arbitrum`, `Base`, `Optimism` in Phase 2.

Symbols: `USDC`, `USDT`, `DAI`, `USDS`, `sDAI`. Reject anything
containing `-`, `LP`, `wstETH`, etc. — only pure stablecoins.

### Field mapping

| Snapshot field | DeFi Llama source         |
|----------------|---------------------------|
| supply_apy     | `apy` or `apyBase`        |
| borrow_apy     | not in /pools — see below |
| utilization    | not in /pools — see below |
| tvl_usd        | `tvlUsd`                  |

## Borrow APY and utilization

DeFi Llama /pools doesn't expose borrow rates. Two options:

1. **DeFi Llama Yields Borrow** (`https://yields.llama.fi/lendBorrow`)
   — borrow APY, totalSupplyUsd, totalBorrowUsd. Join by `pool` ID
   from /pools. Preferred for MVP.
2. **Protocol subgraphs / RPC** for protocols not covered. Skip in MVP.

## Adding a new protocol — checklist

1. Find its `project` slug on https://defillama.com/yields
2. Add to whitelist in `app/config/protocols.py`
3. Verify with manual `curl` that pools appear in /pools and /lendBorrow
4. Add a fixture file `tests/fixtures/<protocol>.json` with sample response
5. Add snapshot test in `tests/parsers/test_<protocol>.py`

## What NOT to do

- Do NOT scrape protocol UIs.
- Do NOT call RPC nodes from the parser layer (do it from a separate
  enricher module if needed).
- Do NOT hardcode pool IDs — always discover by (project, chain, symbol).
