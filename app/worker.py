"""Background worker: fetches DeFi rates on an interval via APScheduler.

Interval is configurable via ``COLLECT_INTERVAL_MINUTES`` (default 1440 = daily).
"""

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis

from app.config.settings import settings
from app.repositories.pools_repository import PoolsRepository
from app.repositories.rates_repository import RatesRepository
from app.repositories.vaults_repository import VaultsRepository
from app.services.collector import (
    collect_and_store,
    collect_pools_and_store,
    collect_vaults_and_store,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _job(
    rates_repo: RatesRepository,
    pools_repo: PoolsRepository,
    vaults_repo: VaultsRepository,
    redis: Redis,
) -> None:
    try:
        rates_count = await collect_and_store(rates_repo, redis)
        pools_count = await collect_pools_and_store(pools_repo, redis)
        vaults_count = await collect_vaults_and_store(vaults_repo, redis)
        logger.info(
            "Inserted %d rate, %d pool, %d vault snapshots; cache warmed",
            rates_count,
            pools_count,
            vaults_count,
        )
    except Exception:
        logger.exception("collection failed")


async def main() -> None:
    client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongodb_url)  # type: ignore[type-arg]
    db = client[settings.mongodb_db]
    rates_repo = RatesRepository(db)
    pools_repo = PoolsRepository(db)
    vaults_repo = VaultsRepository(db)
    await rates_repo.ensure_indexes()
    await pools_repo.ensure_indexes()
    await vaults_repo.ensure_indexes()
    redis: Redis = Redis.from_url(settings.redis_url, decode_responses=True)

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _job,
        "interval",
        minutes=settings.collect_interval_minutes,
        args=[rates_repo, pools_repo, vaults_repo, redis],
        id="collect_rates",
        max_instances=1,
    )
    scheduler.start()
    logger.info(
        "Worker started — collecting every %d minutes",
        settings.collect_interval_minutes,
    )

    # Run an initial collection immediately
    await _job(rates_repo, pools_repo, vaults_repo, redis)

    try:
        await asyncio.Event().wait()
    finally:
        scheduler.shutdown()
        await redis.aclose()
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
