from datetime import datetime, timedelta
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models import VaultMeta, VaultSnapshot
from app.repositories.timeseries import ensure_timeseries

_COLLECTION = "vault_snapshots"

Pipeline = list[dict[str, Any]]


class VaultsRepository:
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
        # Single-series lookups key off pool_id alone — it is globally unique.
        await self._col.create_index([("meta.pool_id", 1), ("ts", -1)])

    async def insert_snapshots(self, snapshots: list[VaultSnapshot]) -> None:
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
    ) -> list[VaultSnapshot]:
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
        results: list[VaultSnapshot] = []
        async for doc in self._col.aggregate(pipeline):
            doc.pop("_id", None)
            results.append(VaultSnapshot(**doc))
        return results

    async def get_snapshots(
        self,
        pool_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[VaultSnapshot], int]:
        """Raw (unbucketed) snapshots for a single vault series, newest first."""
        match: dict[str, object] = {"meta.pool_id": pool_id}
        total = await self._col.count_documents(match)
        cursor = self._col.find(match).sort("ts", -1).skip(offset).limit(limit)
        items: list[VaultSnapshot] = []
        async for doc in cursor:
            doc.pop("_id", None)
            items.append(VaultSnapshot(**doc))
        return items, total

    async def get_history_all(
        self,
        since: datetime,
        until: datetime,
        bucket_minutes: int = 60,
        chains: list[str] | None = None,
        protocols: list[str] | None = None,
        assets: list[str] | None = None,
    ) -> list[VaultSnapshot]:
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
                    "apy_base": {"$avg": "$apy_base"},
                    "apy_reward": {"$avg": "$apy_reward"},
                    "apy_mean_30d": {"$avg": "$apy_mean_30d"},
                    "tvl_usd": {"$avg": "$tvl_usd"},
                }
            },
            {"$sort": {"_id.bucket": 1}},
        ]
        results: list[VaultSnapshot] = []
        async for doc in self._col.aggregate(pipeline):
            results.append(
                VaultSnapshot(
                    ts=doc["_id"]["bucket"],
                    meta=VaultMeta(**doc["_id"]["meta"]),
                    supply_apy=doc.get("supply_apy"),
                    apy_base=doc.get("apy_base"),
                    apy_reward=doc.get("apy_reward"),
                    apy_mean_30d=doc.get("apy_mean_30d"),
                    tvl_usd=doc.get("tvl_usd"),
                )
            )
        return results

    async def get_history(
        self,
        pool_id: str,
        since: datetime,
        until: datetime,
        bucket_minutes: int = 60,
    ) -> list[VaultSnapshot]:
        """Bucketed history for one vault series."""
        pipeline: Pipeline = [
            {
                "$match": {
                    "meta.pool_id": pool_id,
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
                    "meta": {"$first": "$meta"},
                    "supply_apy": {"$avg": "$supply_apy"},
                    "apy_base": {"$avg": "$apy_base"},
                    "apy_reward": {"$avg": "$apy_reward"},
                    "apy_mean_30d": {"$avg": "$apy_mean_30d"},
                    "tvl_usd": {"$avg": "$tvl_usd"},
                }
            },
            {"$sort": {"_id": 1}},
        ]
        results: list[VaultSnapshot] = []
        async for doc in self._col.aggregate(pipeline):
            results.append(
                VaultSnapshot(
                    ts=doc["_id"],
                    meta=VaultMeta(**doc["meta"]),
                    supply_apy=doc.get("supply_apy"),
                    apy_base=doc.get("apy_base"),
                    apy_reward=doc.get("apy_reward"),
                    apy_mean_30d=doc.get("apy_mean_30d"),
                    tvl_usd=doc.get("tvl_usd"),
                )
            )
        return results
