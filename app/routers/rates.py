from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from redis.asyncio import Redis

from app.cache import CACHE_TTL_HISTORY, CACHE_TTL_LATEST, get_or_set, make_key
from app.dependencies import get_rates_repo, get_redis_client
from app.models import RateSnapshot
from app.repositories.rates_repository import RatesRepository

router = APIRouter()


def _parse_csv(value: str | None) -> list[str] | None:
    if value is None:
        return None
    parts = [p.strip() for p in value.split(",") if p.strip()]
    return parts or None


@router.get("/latest", response_model=list[RateSnapshot])
async def get_latest(
    chains: str | None = Query(default=None, description="Comma-separated chain names"),
    protocols: str | None = Query(default=None, description="Comma-separated protocol slugs"),
    assets: str | None = Query(default=None, description="Comma-separated asset symbols"),
    max_age_minutes: int | None = Query(
        default=None,
        ge=1,
        description="Drop snapshots older than this many minutes",
    ),
    repo: RatesRepository = Depends(get_rates_repo),
    redis: Redis = Depends(get_redis_client),
) -> list[RateSnapshot]:
    key = make_key(
        "rates:latest",
        chains or "",
        protocols or "",
        assets or "",
        str(max_age_minutes) if max_age_minutes is not None else "",
    )
    return await get_or_set(
        redis, key, CACHE_TTL_LATEST,
        lambda: repo.get_latest_all(
            chains=_parse_csv(chains),
            protocols=_parse_csv(protocols),
            assets=_parse_csv(assets),
            max_age_minutes=max_age_minutes,
        ),
        RateSnapshot,
    )


@router.get("/history/all", response_model=list[RateSnapshot])
async def get_history_all(
    hours: int = 24,
    bucket_minutes: int = 60,
    chains: str | None = Query(default=None, description="Comma-separated chain names"),
    protocols: str | None = Query(default=None, description="Comma-separated protocol slugs"),
    assets: str | None = Query(default=None, description="Comma-separated asset symbols"),
    repo: RatesRepository = Depends(get_rates_repo),
    redis: Redis = Depends(get_redis_client),
) -> list[RateSnapshot]:
    until = datetime.utcnow()
    since = until - timedelta(hours=hours)
    key = make_key(
        "rates:history_all",
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
        RateSnapshot,
    )


@router.get("/history", response_model=list[RateSnapshot])
async def get_history(
    protocol: str,
    chain: str,
    asset: str,
    since: datetime,
    until: datetime | None = None,
    bucket_minutes: int = 60,
    repo: RatesRepository = Depends(get_rates_repo),
    redis: Redis = Depends(get_redis_client),
) -> list[RateSnapshot]:
    resolved_until = until if until is not None else datetime.utcnow()

    if since >= resolved_until:
        raise HTTPException(
            status_code=422,
            detail="`since` must be strictly before `until`",
        )

    key = make_key(
        "rates:history",
        protocol,
        chain,
        asset,
        since.isoformat(),
        resolved_until.isoformat(),
        str(bucket_minutes),
    )
    return await get_or_set(
        redis, key, CACHE_TTL_HISTORY,
        lambda: repo.get_history(
            protocol=protocol,
            chain=chain,
            asset=asset,
            since=since,
            until=resolved_until,
            bucket_minutes=bucket_minutes,
        ),
        RateSnapshot,
    )
