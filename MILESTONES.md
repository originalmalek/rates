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
- **Frontend — chain column + filter** —
  - `RatesTable` shows a coloured chain badge per row, rows sorted
    `chain → tvl desc` within asset groups.
  - `ChainFilter` chips with All / None controls; selection synced
    with URL (`?chains=ethereum,arbitrum`); shareable links.
  - `ApyChart` series keyed by `(protocol, chain, asset)`; capped to
    top-20 by avg TVL with a "showing top N" hint.
- **Frontend — sortable rate columns** — click Supply APY / Borrow
  APY / TVL header to sort. Toggle: desc → asc → off (back to
  grouped-by-asset). When a sort is active, asset section headers
  collapse and rows render flat with an extra `Asset` column. Null
  cells sink to the bottom regardless of direction.
- **Frontend — protocol and asset filters** — `ProtocolFilter` and
  `AssetFilter` mirror the chain filter pattern. Asset filter has a
  text search and `+ visible` / `− visible` bulk actions because
  there are ~200 unique stablecoin symbols (Morpho Blue vault names
  included). All three filters compose via set intersection. URL:
  `?protocols=...&chains=...&assets=...`.
- **Parser tests** — 10/10 pass; covers multichain AAVE, chain
  alias canonicalisation, stablecoin flag, bridged distinct.

Filtering is currently **client-side**. The server-side
`?chains=` / `?protocols=` / `?assets=` work is in the remaining list.

---

### Remaining

#### 1. Database — compound index

```python
await db.rate_snapshots.create_index(
    [("meta.protocol", 1), ("meta.chain", 1), ("meta.asset", 1), ("ts", -1)]
)
```

Wired into `RatesRepository.ensure_indexes()`.

#### 2. API — server-side `?chains=` / `?protocols=` / `?assets=` filters

All three endpoints learn optional CSV query parameters:

- `GET /rates/latest?chains=ethereum,arbitrum&protocols=aave-v3`
- `GET /rates/history/all?chains=...&protocols=...&assets=...`
- `GET /rates/history?protocol=&chain=&asset=...` already accepts
  single values.

Repository methods get optional `chains`, `protocols`, `assets`
kwargs wired into the `$match` stage.

#### 3. API — freshness cutoff (bonus)

Optional `max_age_minutes` query parameter on `/rates/latest`
(default e.g. 60). Snapshots older than the cutoff are omitted so the
dashboard never displays stale chains.

#### 4. Frontend hooks — pass filters to API

Once step 2 ships, switch `useRates` and `useHistory` to forward the
selected chains / protocols / assets in the request URL instead of
post-filtering on the client. Reduces payload from ~50–150 KB to a
few KB once the user narrows down.

#### 5. Tests

- **Repository**: `chains` / `protocols` / `assets` filters narrow
  results correctly.
- **Router**: `?chains=arbitrum,base` returns only those chains;
  empty / missing param returns everything.

---

### Out of scope (deferred)

- On-chain fetching (we still use DeFi Llama for everything).
- Multi-chain support for other protocols (compound-v3 has multi-chain
  deployments — left for Milestone 5).
- Per-chain TVL aggregation card.
- Morpho Blue vault-name spam handling — see `NOTES.md`.
