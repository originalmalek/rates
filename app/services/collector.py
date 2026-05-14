from datetime import datetime, timedelta

import httpx
from redis.asyncio import Redis

from app.cache import get_or_set, make_key
from app.parsers.defillama import fetch_pool_snapshots, fetch_snapshots
from app.repositories.pools_repository import PoolsRepository
from app.repositories.rates_repository import RatesRepository

_TTL_LATEST = 55
_TTL_HISTORY = 300


async def collect_and_store(repo: RatesRepository, redis: Redis | None = None) -> int:
    """Fetch rate snapshots from DeFi Llama, persist them, and warm the cache.

    Returns the number of snapshots inserted.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        snapshots = await fetch_snapshots(client)

    await repo.insert_snapshots(snapshots)

    if redis is not None:
        await _warm_cache(repo, redis)

    return len(snapshots)


async def collect_pools_and_store(repo: PoolsRepository) -> int:
    """Fetch stablecoin LP snapshots from DeFi Llama and persist them.

    No cache warming yet — pools API/cache lands in Phase 2.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        snapshots = await fetch_pool_snapshots(client)
    await repo.insert_snapshots(snapshots)
    return len(snapshots)


async def _warm_cache(repo: RatesRepository, redis: Redis) -> None:
    key_latest = make_key("rates:latest", "", "", "")
    await redis.delete(key_latest)
    await get_or_set(redis, key_latest, _TTL_LATEST, repo.get_latest_all)

    until = datetime.utcnow()
    since = until - timedelta(hours=24)
    key_history = make_key("rates:history_all", "24", "60", "", "", "")
    await redis.delete(key_history)
    await get_or_set(
        redis,
        key_history,
        _TTL_HISTORY,
        lambda: repo.get_history_all(since=since, until=until, bucket_minutes=60),
    )
