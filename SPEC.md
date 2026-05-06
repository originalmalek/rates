# DeFi Stablecoin Rates Monitor — Specification

## Data Model (rate_snapshots)

MongoDB time-series collection.

### Collection settings
- timeField: `ts`
- metaField: `meta`
- granularity: `minutes`
- expireAfterSeconds: 63072000 (2 years)

### Document shape

```json
{
  "ts": "<UTC naive datetime>",
  "meta": {
    "protocol": "aave-v3",
    "chain": "ethereum",
    "asset": "USDC"
  },
  "supply_apy": 5.23,
  "borrow_apy": 6.41,
  "utilization": null,
  "tvl_usd": 234567890.0
}
```

### Field semantics
- `ts` — UTC naive datetime, set at fetch time
- `meta.protocol` — DeFi Llama project slug (see whitelist in app/config/protocols.py)
- `meta.chain` — lowercase chain name (e.g. "ethereum")
- `meta.asset` — token symbol (e.g. "USDC", "USDT", "DAI", "USDS", "sDAI")
- `supply_apy` — percent (5.2 = 5.2%), can be None
- `borrow_apy` — percent (5.2 = 5.2%), can be None (Spark, Sky may omit)
- `utilization` — 0..1, can be None (DeFi Llama does not provide it)
- `tvl_usd` — USD float, can be None

### Pydantic models (app/models.py)

```python
class SnapshotMeta(BaseModel):
    protocol: str
    chain: str
    asset: str

class RateSnapshot(BaseModel):
    ts: datetime          # UTC naive
    meta: SnapshotMeta
    supply_apy: float | None
    borrow_apy: float | None
    utilization: float | None  # 0..1
    tvl_usd: float | None
```

## Phase 1 Whitelist

- Chain: ethereum
- Protocols: aave-v3, fluid-lending, compound-v3, morpho-blue, spark, sky-lending
- Assets: USDC, USDT, DAI, USDS, sDAI
