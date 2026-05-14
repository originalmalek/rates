from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis

from app.cache import CACHE_TTL_HISTORY, CACHE_TTL_LATEST, get_or_set, make_key
from app.dependencies import get_pools_repo, get_redis_client
from app.models import PoolSnapshot, PoolSnapshotsPage
from app.repositories.pools_repository import PoolsRepository

router = APIRouter()


def _parse_csv(value: str | None) -> list[str] | None:
    if value is None:
        return None
    parts = [p.strip() for p in value.split(",") if p.strip()]
    return parts or None


@router.get("/latest", response_model=list[PoolSnapshot])
async def get_latest(
    chains: str | None = Query(default=None, description="Comma-separated chain names"),
    protocols: str | None = Query(default=None, description="Comma-separated protocol slugs"),
    assets: str | None = Query(default=None, description="Comma-separated LP symbols"),
    repo: PoolsRepository = Depends(get_pools_repo),
    redis: Redis = Depends(get_redis_client),
) -> list[PoolSnapshot]:
    key = make_key(
        "pools:latest",
        chains or "",
        protocols or "",
        assets or "",
    )
    return await get_or_set(
        redis, key, CACHE_TTL_LATEST,
        lambda: repo.get_latest_all(
            chains=_parse_csv(chains),
            protocols=_parse_csv(protocols),
            assets=_parse_csv(assets),
        ),
        PoolSnapshot,
    )


@router.get("/history/all", response_model=list[PoolSnapshot])
async def get_history_all(
    hours: int = 24,
    bucket_minutes: int = 60,
    chains: str | None = Query(default=None, description="Comma-separated chain names"),
    protocols: str | None = Query(default=None, description="Comma-separated protocol slugs"),
    assets: str | None = Query(default=None, description="Comma-separated LP symbols"),
    repo: PoolsRepository = Depends(get_pools_repo),
    redis: Redis = Depends(get_redis_client),
) -> list[PoolSnapshot]:
    until = datetime.utcnow()
    since = until - timedelta(hours=hours)
    key = make_key(
        "pools:history_all",
        str(hours),
        str(bucket_minutes),
        chains or "",
        protocols or "",
        assets or "",
    )
    return await get_or_set(
        redis, key, CACHE_TTL_HISTORY,
        lambda: repo.get_history_all(
            since=since,
            until=until,
            bucket_minutes=bucket_minutes,
            chains=_parse_csv(chains),
            protocols=_parse_csv(protocols),
            assets=_parse_csv(assets),
        ),
        PoolSnapshot,
    )


@router.get("/snapshots", response_model=PoolSnapshotsPage)
async def get_snapshots(
    protocol: str,
    chain: str,
    asset: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    repo: PoolsRepository = Depends(get_pools_repo),
) -> PoolSnapshotsPage:
    items, total = await repo.get_snapshots(protocol, chain, asset, limit, offset)
    return PoolSnapshotsPage(items=items, total=total)
