# Project: DeFi Stablecoin Rates Monitor

Web dashboard with three top-level views, all backed by DeFi Llama:

- **Lending** — supply / borrow APYs. AAVE v3, Compound v3, Fluid,
  SparkLend, Spark Savings, Sky-lending, Jupiter Lend, Kamino Lend, Save.
- **Liquidity Pools** — multi-token stablecoin LP / AMM APY + TVL.
  Curve, Convex, Uniswap v3/v4, Fluid DEX, Kamino Liquidity.
- **Vaults** — curated single-asset yield vaults. Morpho Blue, Euler v2,
  Yearn, Curve LlamaLend, Midas, Centrifuge and others (17 slugs).

The whitelist in `app/config/protocols.py` lists **protocols only** — every
chain DeFi Llama reports for a listed protocol is collected, so new
deployments appear on their own. Slugs must match DeFi Llama's `project`
field exactly; a wrong slug matches nothing and fails silently (`spark`
did, for months — the real markets are `sparklend` / `spark-savings`).

Stablecoin filtering uses DeFi Llama's `stablecoin: true` flag, so bridged
(`USDC.E`), synthetic (`USDE`, `sUSDE`) and yield-bearing variants flow in
automatically. Each view narrows further: LP requires
`exposure: "multi"`; vaults require `exposure: "single"` **and**
`tvlUsd >= VAULT_MIN_TVL_USD` ($1M). Since `exposure: "single"` also
matches every lending market, it is protocol membership that separates the
tabs — keep `PROTOCOLS` / `LIQUIDITY_PROTOCOLS` / `VAULT_PROTOCOLS`
disjoint or a pool shows up twice.

## Stack
- Backend: Python 3.12, FastAPI, Motor (async MongoDB), httpx, APScheduler
- DB: MongoDB 7+ with time-series collections
- Cache: Redis 7 (alpine in compose) for read-through API caching
- Frontend: Next.js 16, TypeScript, Tailwind, Recharts
- Package manager: project venv at `.venv/` (Python), pnpm (Node)

## Commands
Run Python tools through the project venv (uv is not installed for
the `sergey` user — `.venv/bin/python -m <tool>` is the canonical form).

- Worker: `.venv/bin/python -m app.worker`
- API: always on port 8000 — `fuser -k 8000/tcp 2>/dev/null; sleep 1 && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Tests: `.venv/bin/python -m pytest tests/ -v`
- Type check: `.venv/bin/python -m mypy app/`
- Frontend dev: `pnpm dev` (in `web/`)
- Frontend build: `pnpm build` (in `web/`)
- Frontend prod start: `pnpm start` (in `web/`) — serves the latest `.next/` build
- Infra (MongoDB + Redis): `docker compose up -d` (from project root)

## Architecture rules
- All MongoDB access goes through `app/repositories/` —
  `RatesRepository` for `rate_snapshots`, `PoolsRepository` for
  `pool_snapshots`, `VaultsRepository` for `vault_snapshots`. No direct
  Motor calls in services or routers.
- All Redis access goes through `app/cache.py` (`make_key`,
  `get_or_set`). `get_or_set` is generic over a Pydantic model —
  pass `RateSnapshot`, `PoolSnapshot` or `VaultSnapshot` as
  `model_type`. Routes wrap their repo call in `get_or_set(...)`; the
  worker invalidates + re-warms the no-filter cache keys after every
  insert. A pre-warm must build its key and call its loader exactly as
  the route does, or it writes an entry nothing reads.
- Pydantic v2 for all DTOs. No raw dicts crossing layer boundaries.
- DeFi Llama is the only data source. The parser has three entry
  points: `fetch_snapshots()` for lending, `fetch_pool_snapshots()`
  for LP and `fetch_vault_snapshots()` for vaults. Filter rules differ
  per the section above.
- Frontend filter state lives in URL search params. Each tab has
  its own state. Hooks (`useRates`/`useHistory` for lending,
  `usePools`/`usePoolHistory` for LP, `useVaults`/`useVaultHistory`
  for vaults) translate the active filter sets to CSV query params;
  "all selected" sends no param. A `cancelled` flag in each effect's
  closure discards stale in-flight responses when the URL changes.

## Data model (do not change without updating SPEC.md)
- Three collections: `rate_snapshots` (lending), `pool_snapshots` (LP)
  and `vault_snapshots` (vaults). All keyed by
  `meta.{protocol, chain, asset, pool_id}`, all indexed identically. LP
  and vault snapshots have no `borrow_apy` / `utilization`; vaults add
  `apy_base` / `apy_reward` / `apy_mean_30d` and a `meta.vault_name`.
- `meta.pool_id` (DeFi Llama's `pool` UUID) is what makes a series
  unique — the triple repeats upstream (`kamino-lend/solana/USDC` is
  17 separate markets). Single-series lookups take `pool_id` and
  nothing else; protocol/chain/asset are for filtering and display.
- For vaults, `meta.asset` is the *underlying* stablecoin (resolved from
  the symbol by `underlying_stablecoin()`) so the asset filter behaves
  like the other tabs; the curator's brand name lives in
  `meta.vault_name`.
- See @.claude/skills/mongodb-timeseries/SKILL.md for document shape
  and query patterns (applies to all three collections).

## Testing
- Each parser has snapshot tests in tests/parsers/ using fixed
  JSON fixtures (never hit real APIs in tests).
- Mock httpx with respx.
- Repository tests use mongomock-motor.

## Gotchas
- DeFi Llama API: no auth, ~30 req/min, single /pools call gives
  everything we need per cycle.
- APY normalization: DeFi Llama already returns percent (5.2 = 5.2%).
  Some on-chain sources return decimals — always normalize to percent
  in parser layer.
- Some protocols (Spark, Sky) may report only supply, no borrow.
  Treat missing fields as None, not 0.

## FastAPI coding rules
See @FASTAPI_RULES.md

## Workflow
- Always run typecheck and tests before considering a task done.
- Don't add features beyond what's in the current milestone.
- If you find an unrelated bug, note it in NOTES.md, don't fix it.
