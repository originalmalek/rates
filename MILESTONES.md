# Milestones

## Milestone 4 — Multi-chain support for AAVE v3

Goal: extend the system to fetch lending/borrowing rates from AAVE v3
on **all 15 chains** where it is deployed, using DeFi Llama's
built-in `stablecoin: true` flag to automatically include all
stablecoin pools (basic, bridged, synthetic, yield-bearing, EUR-pegged).

Other protocols (compound-v3, fluid-lending, morpho-blue, spark,
sky-lending) remain Ethereum-only.

---

### 1. Config (`app/config/protocols.py`)

Replace flat `PROTOCOLS = {...}` and `ASSETS = {...}` sets with a
per-protocol structure:

```python
PROTOCOLS = {
    "aave-v3": {
        "chains": [
            "ethereum", "arbitrum", "optimism", "base", "polygon",
            "avalanche", "bnb", "gnosis", "linea", "mantle",
            "celo", "sonic", "aptos", "megaeth", "plasma",
        ],
    },
    "compound-v3":   {"chains": ["ethereum"]},
    "fluid-lending": {"chains": ["ethereum"]},
    "morpho-blue":   {"chains": ["ethereum"]},
    "spark":         {"chains": ["ethereum"]},
    "sky-lending":   {"chains": ["ethereum"]},
}
```

No explicit asset whitelist. Filtering happens by:
- `pool["project"] in PROTOCOLS`
- `chain_canonical(pool["chain"]) in PROTOCOLS[project]["chains"]`
- `pool["stablecoin"] is True`

Bridged tokens (`USDC.E`, `DAI.E`, `USD₮`, etc.) are kept as separate
assets — the symbol from DeFi Llama is used verbatim.

### 2. Parser (`app/parsers/defillama.py`)

- Drop `_CHAIN_FILTER = "Ethereum"` constant.
- Drop `_clean_symbol` — DeFi Llama returns clean symbols for these
  pools (no LP composites in stablecoin lending pools).
- Add chain canonicalisation helper:
  ```python
  _CHAIN_ALIASES = {
      "OP Mainnet": "optimism",
      "BSC": "bnb",
  }
  def _canonical_chain(c: str) -> str:
      return _CHAIN_ALIASES.get(c, c.lower())
  ```
- New whitelist check:
  ```python
  def _is_whitelisted(pool: dict) -> bool:
      project = pool.get("project")
      chain = _canonical_chain(pool.get("chain", ""))
      if project not in PROTOCOLS:
          return False
      if chain not in PROTOCOLS[project]["chains"]:
          return False
      return pool.get("stablecoin") is True
  ```
- Snapshot `meta.chain` is the canonical (lowercase) chain name.

### 3. Database

Schema unchanged (`meta.chain` already exists and is part of
`metaField`). Add a new compound index for fast multi-chain queries:

```python
await db.rate_snapshots.create_index(
    [("meta.protocol", 1), ("meta.chain", 1), ("meta.asset", 1), ("ts", -1)]
)
```

### 4. API (`app/routers/rates.py`)

All three endpoints accept an optional `chains` query parameter
(comma-separated CSV):

- `GET /rates/latest?chains=ethereum,arbitrum`
- `GET /rates/history/all?chains=ethereum,arbitrum`
- `GET /rates/history?protocol=&chain=&asset=...` (already accepts
  single `chain`)

Repository methods get a new optional kwarg `chains: list[str] | None`
that is wired into the `$match` stage.

**Freshness filter (bonus):** add `max_age_minutes` query param to
`/rates/latest` (default e.g. 60). Snapshots older than the cutoff are
omitted so the dashboard never shows stale chains.

### 5. Frontend — table

- New column **Chain** with a small chain badge (icon + lowercase
  label). Order: Protocol | Chain | Asset | Supply APY | Borrow APY | TVL.
- Grouping stays by asset; within a group rows sorted by
  `chain → tvl desc`.
- Chart legend gains chain suffix:
  `AAVE v3 USDC · Arbitrum`.
- Add a small palette for chain colours (used for both badge and
  chart line distinguishability).

### 6. Frontend — chain filter (multi-select)

- New component `ChainFilter` rendered above `RatesTable`.
- Multi-select chips listing every chain present in the latest data.
- All chains selected by default.
- State synced with URL (`?chains=ethereum,arbitrum`) so the view is
  shareable and survives reload.
- `useRates(chains)` and `useHistory(chains)` accept the selection
  and pass it as a query param to the API.
- Empty selection = show all (avoid “nothing visible” UX trap).

### 7. Tests

- **Fixture**: extend `tests/fixtures/defillama_pools.json` with
  AAVE v3 pools on at least 3 chains (Ethereum, Arbitrum, Mantle) and
  at least one synthetic stable (e.g. `USDE`) and one bridged
  (`USDC.E`).
- **Parser tests**:
  - Multi-chain pools produce one snapshot per `(chain, asset)`.
  - Non-stablecoin pools (`stablecoin: false`) are skipped.
  - Non-AAVE protocols on non-Ethereum chains are filtered out.
  - Chain canonicalisation: `OP Mainnet` → `optimism`, `BSC` → `bnb`.
- **Repository tests**: `chains` filter narrows results correctly.
- **Router tests**: `?chains=arbitrum,base` returns only those chains;
  empty / missing param returns everything.

---

### Out of scope (deferred)

- On-chain fetching (we still use DeFi Llama for everything).
- Multi-chain support for other protocols (compound-v3 has multi-chain
  deployments — left for Milestone 5).
- Asset-level filtering in the UI (only chain filter for now).
- Per-chain TVL aggregation card.
