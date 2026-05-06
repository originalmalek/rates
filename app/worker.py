"""Background worker: fetches DeFi rates every 5 minutes via APScheduler."""

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from motor.motor_asyncio import AsyncIOMotorClient

from app.config.settings import settings
from app.repositories.rates_repository import RatesRepository
from app.services.collector import collect_and_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _job(repo: RatesRepository) -> None:
    try:
        count = await collect_and_store(repo)
        logger.info("Inserted %d snapshots", count)
    except Exception:
        logger.exception("collect_and_store failed")


async def main() -> None:
    client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongodb_url)  # type: ignore[type-arg]
    db = client[settings.mongodb_db]
    repo = RatesRepository(db)
    await repo.ensure_indexes()

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _job,
        "interval",
        minutes=5,
        args=[repo],
        id="collect_rates",
        max_instances=1,
    )
    scheduler.start()
    logger.info("Worker started — collecting every 5 minutes")

    # Run an initial collection immediately
    await _job(repo)

    try:
        await asyncio.Event().wait()
    finally:
        scheduler.shutdown()
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
