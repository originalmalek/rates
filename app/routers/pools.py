from datetime import datetime, timedelta
from typing import cast

from fastapi import APIRouter, Query, Request
from redis.asyncio import Redis

from app.cache import get_or_set, make_key
from app.models import PoolSnapshot
from app.repositories.pools_repository import PoolsRepository

router = APIRouter()

_TTL_LATEST = 55
_TTL_HISTORY = 300


def _parse_csv(value: str | None) -> list[str] | None:
    if value is None:
        return None
    parts = [p.strip() for p in value.split(",") if p.strip()]
    return parts or None


@router.get("/latest", response_model=list[PoolSnapshot])
async def get_latest(
    request: Request,
    chains: str | None = Query(default=None, description="Comma-separated chain names"),
    protocols: str | None = Query(default=None, description="Comma-separated protocol slugs"),
    assets: str | None = Query(default=None, description="Comma-separated LP symbols"),
) -> list[PoolSnapshot]:
    repo = cast(PoolsRepository, request.app.state.pools_repo)
    redis = cast(Redis, request.app.state.redis)
    key = make_key(
        "pools:latest",
        chains or "",
        protocols or "",
        assets or "",
    )
    return await get_or_set(
        redis, key, _TTL_LATEST,
        lambda: repo.get_latest_all(
            chains=_parse_csv(chains),
            protocols=_parse_csv(protocols),
            assets=_parse_csv(assets),
        ),
        PoolSnapshot,
    )


@router.get("/history/all", response_model=list[PoolSnapshot])
async def get_history_all(
    request: Request,
    hours: int = 24,
    bucket_minutes: int = 60,
    chains: str | None = Query(default=None, description="Comma-separated chain names"),
    protocols: str | None = Query(default=None, description="Comma-separated protocol slugs"),
    assets: str | None = Query(default=None, description="Comma-separated LP symbols"),
) -> list[PoolSnapshot]:
    until = datetime.utcnow()
    since = until - timedelta(hours=hours)
    repo = cast(PoolsRepository, request.app.state.pools_repo)
    redis = cast(Redis, request.app.state.redis)
    key = make_key(
        "pools:history_all",
        str(hours),
        str(bucket_minutes),
        chains or "",
        protocols or "",
        assets or "",
    )
    return await get_or_set(
        redis, key, _TTL_HISTORY,
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
