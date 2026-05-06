import httpx

from app.parsers.defillama import fetch_snapshots
from app.repositories.rates_repository import RatesRepository


async def collect_and_store(repo: RatesRepository) -> int:
    """Fetch rate snapshots from DeFi Llama and persist them.

    Returns the number of snapshots inserted.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        snapshots = await fetch_snapshots(client)

    await repo.insert_snapshots(snapshots)
    return len(snapshots)
