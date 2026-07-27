from datetime import datetime, timedelta

import httpx
from redis.asyncio import Redis

from app.cache import CACHE_TTL_HISTORY, CACHE_TTL_LATEST, get_or_set, make_key
from app.config.settings import settings
from app.models import PoolSnapshot, RateSnapshot, VaultSnapshot
from app.parsers.defillama import (
    fetch_pool_snapshots,
    fetch_snapshots,
    fetch_vault_snapshots,
)
from app.repositories.pools_repository import PoolsRepository
from app.repositories.rates_repository import RatesRepository
from app.repositories.vaults_repository import VaultsRepository


async def collect_and_store(repo: RatesRepository, redis: Redis | None = None) -> int:
    """Fetch rate snapshots from DeFi Llama, persist them, and warm the cache.

    Returns the number of snapshots inserted.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        snapshots = await fetch_snapshots(client)

    await repo.insert_snapshots(snapshots)

    if redis is not None:
        await _warm_rates_cache(repo, redis)

    return len(snapshots)


async def collect_pools_and_store(
    repo: PoolsRepository, redis: Redis | None = None
) -> int:
    """Fetch stablecoin LP snapshots from DeFi Llama, persist them, and warm cache."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        snapshots = await fetch_pool_snapshots(client)
    await repo.insert_snapshots(snapshots)

    if redis is not None:
        await _warm_pools_cache(repo, redis)

    return len(snapshots)


async def collect_vaults_and_store(
    repo: VaultsRepository, redis: Redis | None = None
) -> int:
    """Fetch stablecoin yield-vault snapshots from DeFi Llama, persist, warm cache."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        snapshots = await fetch_vault_snapshots(client)
    await repo.insert_snapshots(snapshots)

    if redis is not None:
        await _warm_vaults_cache(repo, redis)

    return len(snapshots)


async def _warm_rates_cache(repo: RatesRepository, redis: Redis) -> None:
    # Warm the same view the no-filter /latest route serves: default
    # staleness cutoff applied, so stale series stay excluded from the cache.
    key_latest = make_key("rates:latest", "", "", "", "")
    await redis.delete(key_latest)
    await get_or_set(
        redis,
        key_latest,
        CACHE_TTL_LATEST,
        lambda: repo.get_latest_all(
            max_age_minutes=settings.effective_max_age_minutes
        ),
        RateSnapshot,
    )

    until = datetime.utcnow()
    since = until - timedelta(hours=24)
    key_history = make_key("rates:history_all", "24", "60", "", "", "")
    await redis.delete(key_history)
    await get_or_set(
        redis,
        key_history,
        CACHE_TTL_HISTORY,
        lambda: repo.get_history_all(since=since, until=until, bucket_minutes=60),
        RateSnapshot,
    )


async def _warm_pools_cache(repo: PoolsRepository, redis: Redis) -> None:
    # Warm the same view the no-filter /latest route serves: default
    # staleness cutoff applied, so stale pools stay excluded from the cache.
    key_latest = make_key("pools:latest", "", "", "", "")
    await redis.delete(key_latest)
    await get_or_set(
        redis,
        key_latest,
        CACHE_TTL_LATEST,
        lambda: repo.get_latest_all(
            max_age_minutes=settings.effective_max_age_minutes
        ),
        PoolSnapshot,
    )

    until = datetime.utcnow()
    since = until - timedelta(hours=24)
    key_history = make_key("pools:history_all", "24", "60", "", "", "")
    await redis.delete(key_history)
    await get_or_set(
        redis,
        key_history,
        CACHE_TTL_HISTORY,
        lambda: repo.get_history_all(since=since, until=until, bucket_minutes=60),
        PoolSnapshot,
    )


async def _warm_vaults_cache(repo: VaultsRepository, redis: Redis) -> None:
    # Warm the same view the no-filter /latest route serves: default
    # staleness cutoff applied, so vaults that stopped reporting drop out.
    key_latest = make_key("vaults:latest", "", "", "", "")
    await redis.delete(key_latest)
    await get_or_set(
        redis,
        key_latest,
        CACHE_TTL_LATEST,
        lambda: repo.get_latest_all(
            max_age_minutes=settings.effective_max_age_minutes
        ),
        VaultSnapshot,
    )

    until = datetime.utcnow()
    since = until - timedelta(hours=24)
    key_history = make_key("vaults:history_all", "24", "60", "", "", "")
    await redis.delete(key_history)
    await get_or_set(
        redis,
        key_history,
        CACHE_TTL_HISTORY,
        lambda: repo.get_history_all(since=since, until=until, bucket_minutes=60),
        VaultSnapshot,
    )
