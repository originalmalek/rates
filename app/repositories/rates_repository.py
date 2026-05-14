from datetime import datetime, timedelta
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models import RateSnapshot, SnapshotMeta
from app.repositories.timeseries import ensure_timeseries

_COLLECTION = "rate_snapshots"

Pipeline = list[dict[str, Any]]


class RatesRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:  # type: ignore[type-arg]
        self._db = db
        self._col = db[_COLLECTION]

    async def ensure_indexes(self) -> None:
        await ensure_timeseries(self._db, _COLLECTION)
        await self._col.create_index([("meta.protocol", 1), ("ts", -1)])
        await self._col.create_index([("meta.asset", 1), ("ts", -1)])
        await self._col.create_index(
            [("meta.protocol", 1), ("meta.chain", 1), ("meta.asset", 1), ("ts", -1)]
        )

    async def insert_snapshots(self, snapshots: list[RateSnapshot]) -> None:
        if not snapshots:
            return
        docs = [s.model_dump() for s in snapshots]
        await self._col.insert_many(docs)

    async def get_latest_all(
        self,
        chains: list[str] | None = None,
        protocols: list[str] | None = None,
        assets: list[str] | None = None,
        max_age_minutes: int | None = None,
    ) -> list[RateSnapshot]:
        match: dict[str, object] = {}
        if chains:
            match["meta.chain"] = {"$in": chains}
        if protocols:
            match["meta.protocol"] = {"$in": protocols}
        if assets:
            match["meta.asset"] = {"$in": assets}
        if max_age_minutes is not None:
            cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
            match["ts"] = {"$gte": cutoff}

        pipeline: Pipeline = []
        if match:
            pipeline.append({"$match": match})
        pipeline += [
            {"$sort": {"ts": -1}},
            {"$group": {"_id": "$meta", "doc": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$doc"}},
        ]
        results: list[RateSnapshot] = []
        async for doc in self._col.aggregate(pipeline):
            doc.pop("_id", None)
            results.append(RateSnapshot(**doc))
        return results

    async def get_latest(
        self, protocol: str, chain: str, asset: str
    ) -> RateSnapshot | None:
        pipeline: Pipeline = [
            {
                "$match": {
                    "meta.protocol": protocol,
                    "meta.chain": chain,
                    "meta.asset": asset,
                }
            },
            {"$sort": {"ts": -1}},
            {"$limit": 1},
        ]
        async for doc in self._col.aggregate(pipeline):
            doc.pop("_id", None)
            return RateSnapshot(**doc)
        return None

    async def get_history_all(
        self,
        since: datetime,
        until: datetime,
        bucket_minutes: int = 60,
        chains: list[str] | None = None,
        protocols: list[str] | None = None,
        assets: list[str] | None = None,
    ) -> list[RateSnapshot]:
        match: dict[str, object] = {"ts": {"$gte": since, "$lt": until}}
        if chains:
            match["meta.chain"] = {"$in": chains}
        if protocols:
            match["meta.protocol"] = {"$in": protocols}
        if assets:
            match["meta.asset"] = {"$in": assets}
        pipeline: Pipeline = [
            {"$match": match},
            {
                "$group": {
                    "_id": {
                        "meta": "$meta",
                        "bucket": {
                            "$dateTrunc": {
                                "date": "$ts",
                                "unit": "minute",
                                "binSize": bucket_minutes,
                            }
                        },
                    },
                    "supply_apy": {"$avg": "$supply_apy"},
                    "borrow_apy": {"$avg": "$borrow_apy"},
                    "tvl_usd": {"$avg": "$tvl_usd"},
                }
            },
            {"$sort": {"_id.bucket": 1}},
        ]
        results: list[RateSnapshot] = []
        async for doc in self._col.aggregate(pipeline):
            meta = SnapshotMeta(**doc["_id"]["meta"])
            results.append(
                RateSnapshot(
                    ts=doc["_id"]["bucket"],
                    meta=meta,
                    supply_apy=doc.get("supply_apy"),
                    borrow_apy=doc.get("borrow_apy"),
                    utilization=None,
                    tvl_usd=doc.get("tvl_usd"),
                )
            )
        return results

    async def get_history(
        self,
        protocol: str,
        chain: str,
        asset: str,
        since: datetime,
        until: datetime,
        bucket_minutes: int = 60,
    ) -> list[RateSnapshot]:
        pipeline: Pipeline = [
            {
                "$match": {
                    "meta.protocol": protocol,
                    "meta.chain": chain,
                    "meta.asset": asset,
                    "ts": {"$gte": since, "$lt": until},
                }
            },
            {
                "$group": {
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
                }
            },
            {"$sort": {"_id": 1}},
        ]
        meta = SnapshotMeta(protocol=protocol, chain=chain, asset=asset)
        results: list[RateSnapshot] = []
        async for doc in self._col.aggregate(pipeline):
            results.append(
                RateSnapshot(
                    ts=doc["_id"],
                    meta=meta,
                    supply_apy=doc.get("supply_apy"),
                    borrow_apy=doc.get("borrow_apy"),
                    utilization=None,
                    tvl_usd=doc.get("tvl_usd"),
                )
            )
        return results
