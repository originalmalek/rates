# Milestones

## Milestone 4 — Multi-chain support for AAVE v3

Goal: extend the system to fetch lending/borrowing rates from AAVE v3
on **all 15 chains** where it is deployed, using DeFi Llama's
built-in `stablecoin: true` flag to automatically include all
stablecoin pools (basic, bridged, synthetic, yield-bearing, EUR-pegged).

Other protocols (compound-v3, fluid-lending, morpho-blue, spark,
sky-lending) remain Ethereum-only.

---

### Completed

- **Config refactor** — `app/config/protocols.py` switched to
  per-protocol `{chains: frozenset}` map. AAVE v3 whitelists 15
  chains; other protocols stay Ethereum-only. Helpers
  `canonical_chain()` and `is_supported()` exported.
- **Parser refactor** — drops `_CHAIN_FILTER` and `_clean_symbol`,
  filters by `stablecoin: true`, canonicalises chain names
  (`OP Mainnet` → `optimism`, `BSC` → `bnb`). Symbols kept verbatim
  so bridged tokens (`USDC.E`, `DAI.E`, `USD₮0`) stay distinct.
- **Frontend — Chain column + filter** —
  - `RatesTable` shows a coloured chain badge per row, rows sorted
    `chain → tvl desc` within asset groups.
  - `ChainFilter` chips with All / None controls; selection synced
    with URL (`?chains=ethereum,arbitrum`); shareable links.
  - `ApyChart` series keyed by `(protocol, chain, asset)`; capped to
    top-20 by avg TVL with a "showing top N" hint.
  - Filtering is **client-side** for now — server-side support is in
    the remaining work below.
- **Parser tests** — 10/10 pass; covers multichain AAVE, chain
  alias canonicalisation, stablecoin flag, bridged distinct.

---

### Remaining

#### 1. Frontend — sortable rate columns

Click on **Supply APY**, **Borrow APY**, or **TVL** header sorts the
table by that column. Direction toggle:

- 1st click → **desc**
- 2nd click → **asc**
- 3rd click → **off**, back to default grouped-by-asset view

When a sort is active, **asset grouping disappears** — rows render as a
flat list across all assets so the user sees a true ranking. Section
headers (`USDC (12)`, `USDT (8)`...) only render when no sort is active.

Header indicators: `▾` for desc, `▴` for asc, blank when off.

Sort state lives in component state (no URL sync — different from
chain filter, which is shareable). `null`-valued cells (missing
borrow APY etc.) sink to the bottom regardless of direction.

#### 2. Database — compound index

```python
await db.rate_snapshots.create_index(
    [("meta.protocol", 1), ("meta.chain", 1), ("meta.asset", 1), ("ts", -1)]
)
```

Wired into `RatesRepository.ensure_indexes()`.

#### 3. API — server-side `?chains=` filter

Three endpoints learn the optional CSV `chains` query parameter:

- `GET /rates/latest?chains=ethereum,arbitrum`
- `GET /rates/history/all?chains=ethereum,arbitrum`
- `GET /rates/history?protocol=&chain=&asset=...` already accepts
  single `chain`.

Repository methods get an optional `chains: list[str] | None` kwarg
wired into the `$match` stage.

#### 4. API — freshness cutoff (bonus)

Optional `max_age_minutes` query parameter on `/rates/latest`
(default e.g. 60). Snapshots older than the cutoff are omitted so the
dashboard never displays stale chains.

#### 5. Frontend hooks — pass chains to API

Once step 3 ships, switch `useRates` and `useHistory` to forward the
selected chains in the request URL instead of post-filtering on the
client.

#### 6. Tests

- **Repository**: `chains` filter narrows results correctly.
- **Router**: `?chains=arbitrum,base` returns only those chains;
  empty / missing param returns everything.

---

### Out of scope (deferred)

- On-chain fetching (we still use DeFi Llama for everything).
- Multi-chain support for other protocols (compound-v3 has multi-chain
  deployments — left for Milestone 5).
- Asset-level filtering in the UI (only chain filter for now).
- Per-chain TVL aggregation card.
- Morpho Blue vault-name spam handling — see `NOTES.md`.
