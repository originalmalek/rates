"""Background worker: fetches DeFi rates every 5 minutes via APScheduler."""

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis

from app.config.settings import settings
from app.repositories.pools_repository import PoolsRepository
from app.repositories.rates_repository import RatesRepository
from app.services.collector import collect_and_store, collect_pools_and_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _job(
    rates_repo: RatesRepository,
    pools_repo: PoolsRepository,
    redis: Redis,
) -> None:
    try:
        rates_count = await collect_and_store(rates_repo, redis)
        pools_count = await collect_pools_and_store(pools_repo)
        logger.info(
            "Inserted %d rate snapshots, %d pool snapshots; cache warmed",
            rates_count,
            pools_count,
        )
    except Exception:
        logger.exception("collection failed")


async def main() -> None:
    client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongodb_url)  # type: ignore[type-arg]
    db = client[settings.mongodb_db]
    rates_repo = RatesRepository(db)
    pools_repo = PoolsRepository(db)
    await rates_repo.ensure_indexes()
    await pools_repo.ensure_indexes()
    redis: Redis = Redis.from_url(settings.redis_url, decode_responses=True)

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _job,
        "interval",
        minutes=5,
        args=[rates_repo, pools_repo, redis],
        id="collect_rates",
        max_instances=1,
    )
    scheduler.start()
    logger.info("Worker started — collecting every 5 minutes")

    # Run an initial collection immediately
    await _job(rates_repo, pools_repo, redis)

    try:
        await asyncio.Event().wait()
    finally:
        scheduler.shutdown()
        await redis.aclose()
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
