from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from redis.asyncio import Redis

from app.cache import CACHE_TTL_HISTORY, CACHE_TTL_LATEST, get_or_set, make_key
from app.config.settings import settings
from app.dependencies import get_redis_client, get_vaults_repo
from app.models import VaultSnapshot, VaultSnapshotsPage
from app.repositories.vaults_repository import VaultsRepository

router = APIRouter()


def _parse_csv(value: str | None) -> list[str] | None:
    if value is None:
        return None
    parts = [p.strip() for p in value.split(",") if p.strip()]
    return parts or None


@router.get("/latest", response_model=list[VaultSnapshot])
async def get_latest(
    chains: str | None = Query(default=None, description="Comma-separated chain names"),
    protocols: str | None = Query(default=None, description="Comma-separated protocol slugs"),
    assets: str | None = Query(
        default=None,
        description="Comma-separated underlying stablecoins, e.g. USDC,DAI",
    ),
    max_age_minutes: int | None = Query(
        default=None,
        ge=1,
        description=(
            "Drop snapshots older than this many minutes. "
            "Omit to use the server default staleness cutoff."
        ),
    ),
    repo: VaultsRepository = Depends(get_vaults_repo),
    redis: Redis = Depends(get_redis_client),
) -> list[VaultSnapshot]:
    # No explicit cutoff → apply the server default so vaults that dropped
    # below the TVL floor (or were deprecated) fall off instead of lingering.
    effective_max_age = (
        max_age_minutes
        if max_age_minutes is not None
        else settings.effective_max_age_minutes
    )
    key = make_key(
        "vaults:latest",
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
            max_age_minutes=effective_max_age,
        ),
        VaultSnapshot,
    )


@router.get("/history/all", response_model=list[VaultSnapshot])
async def get_history_all(
    hours: int = 24,
    bucket_minutes: int = 60,
    chains: str | None = Query(default=None, description="Comma-separated chain names"),
    protocols: str | None = Query(default=None, description="Comma-separated protocol slugs"),
    assets: str | None = Query(
        default=None,
        description="Comma-separated underlying stablecoins, e.g. USDC,DAI",
    ),
    repo: VaultsRepository = Depends(get_vaults_repo),
    redis: Redis = Depends(get_redis_client),
) -> list[VaultSnapshot]:
    until = datetime.utcnow()
    since = until - timedelta(hours=hours)
    key = make_key(
        "vaults:history_all",
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
        VaultSnapshot,
    )


@router.get("/history", response_model=list[VaultSnapshot])
async def get_history(
    pool_id: str = Query(description="DeFi Llama pool id identifying the series"),
    since: datetime = Query(),
    until: datetime | None = None,
    bucket_minutes: int = 60,
    repo: VaultsRepository = Depends(get_vaults_repo),
    redis: Redis = Depends(get_redis_client),
) -> list[VaultSnapshot]:
    resolved_until = until if until is not None else datetime.utcnow()

    if since >= resolved_until:
        raise HTTPException(
            status_code=422,
            detail="`since` must be strictly before `until`",
        )

    key = make_key(
        "vaults:history",
        pool_id,
        since.isoformat(),
        resolved_until.isoformat(),
        str(bucket_minutes),
    )
    return await get_or_set(
        redis, key, CACHE_TTL_HISTORY,
        lambda: repo.get_history(
            pool_id=pool_id,
            since=since,
            until=resolved_until,
            bucket_minutes=bucket_minutes,
        ),
        VaultSnapshot,
    )


@router.get("/snapshots", response_model=VaultSnapshotsPage)
async def get_snapshots(
    pool_id: str = Query(description="DeFi Llama pool id identifying the series"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    repo: VaultsRepository = Depends(get_vaults_repo),
) -> VaultSnapshotsPage:
    items, total = await repo.get_snapshots(pool_id, limit, offset)
    return VaultSnapshotsPage(items=items, total=total)
