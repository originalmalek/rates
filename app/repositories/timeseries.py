"""Shared helper for creating MongoDB time-series collections.

Both rate_snapshots and pool_snapshots are configured identically:
- timeField=ts, metaField=meta, granularity=minutes
- 2-year TTL on documents

If the collection already exists (as either time-series OR regular,
left over from earlier deployments) we leave it alone — converting
in place isn't supported by MongoDB. Fresh installs get a proper
time-series collection.

mongomock-motor doesn't implement the timeseries kwarg; in tests
we silently fall back to a regular collection (auto-created on
first insert).
"""

from motor.motor_asyncio import AsyncIOMotorDatabase

_TIME_FIELD = "ts"
_META_FIELD = "meta"
_GRANULARITY = "minutes"
_EXPIRE_AFTER_SECONDS = 60 * 60 * 24 * 365 * 2  # 2 years


async def ensure_timeseries(
    db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
    collection_name: str,
) -> None:
    existing = await db.list_collection_names()
    if collection_name in existing:
        return
    try:
        await db.create_collection(
            collection_name,
            timeseries={
                "timeField": _TIME_FIELD,
                "metaField": _META_FIELD,
                "granularity": _GRANULARITY,
            },
            expireAfterSeconds=_EXPIRE_AFTER_SECONDS,
        )
    except NotImplementedError:
        # mongomock-motor: regular collection will be auto-created on insert.
        pass
