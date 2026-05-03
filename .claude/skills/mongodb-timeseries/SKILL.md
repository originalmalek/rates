---
name: mongodb-timeseries
description: How to model, write, and query time-series data in MongoDB for this project. Use whenever working on the rates_repository, schema, queries, or aggregations.
---

# MongoDB Time-Series for Rate Snapshots

## Collection setup

Always create as time-series collection, NOT a regular collection:

```python
await db.create_collection(
    "rate_snapshots",
    timeseries={
        "timeField": "ts",
        "metaField": "meta",
        "granularity": "minutes",
    },
    expireAfterSeconds=60 * 60 * 24 * 365 * 2,  # 2 years retention
)
```

## Document shape

```python
{
  "ts": datetime,                    # UTC, naive datetime
  "meta": {
    "protocol": "aave-v3",
    "chain": "ethereum",
    "asset": "USDC",
  },
  "supply_apy": 5.23,                # percent, can be None
  "borrow_apy": 6.41,                # percent, can be None
  "utilization": 0.78,               # 0..1, can be None
  "tvl_usd": 234567890.0,            # USD, can be None
}
```

The `meta` subdocument is immutable per series. Never write fields
outside `meta` that identify the series.

## Indexes

Time-series collections auto-create an index on (meta, ts). Add:

```python
await db.rate_snapshots.create_index([("meta.protocol", 1), ("ts", -1)])
await db.rate_snapshots.create_index([("meta.asset", 1), ("ts", -1)])
```

## Repository interface (app/repositories/rates_repository.py)

All DB access goes through these methods. No exceptions.

```python
class RatesRepository:
    async def insert_snapshots(self, snapshots: list[RateSnapshot]) -> None: ...
    async def get_latest(
        self, protocol: str, chain: str, asset: str
    ) -> RateSnapshot | None: ...
    async def get_latest_all(self) -> list[RateSnapshot]: ...
    async def get_history(
        self,
        protocol: str, chain: str, asset: str,
        since: datetime, until: datetime,
        bucket_minutes: int = 60,
    ) -> list[RateSnapshot]: ...
```

## Query patterns

### Latest per series — use $group on meta:

```python
pipeline = [
    {"$sort": {"ts": -1}},
    {"$group": {
        "_id": "$meta",
        "doc": {"$first": "$$ROOT"},
    }},
    {"$replaceRoot": {"newRoot": "$doc"}},
]
```

### History with downsampling — use $bucket or $dateTrunc:

```python
pipeline = [
    {"$match": {
        "meta.protocol": protocol,
        "meta.asset": asset,
        "ts": {"$gte": since, "$lt": until},
    }},
    {"$group": {
        "_id": {
            "$dateTrunc": {
                "date": "$ts",
                "unit": "minute",
                "binSize": bucket_minutes,
            }
        },
        "supply_apy": {"$avg": "$supply_apy"},
        "borrow_apy": {"$avg": "$borrow_apy"},
        "tvl_usd": {"$avg": "$tvl_usd"},
    }},
    {"$sort": {"_id": 1}},
]
```

## What NOT to do

- Do NOT update existing documents. Time-series collections are append-only.
- Do NOT add fields outside the schema without updating SPEC.md.
- Do NOT use `find_one_and_update` — it's not supported on time-series.
- Do NOT bypass the repository — even in tests, mock at the repo level.
