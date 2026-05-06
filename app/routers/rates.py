from datetime import datetime, timedelta
from typing import cast

from fastapi import APIRouter, HTTPException, Request

from app.models import RateSnapshot
from app.repositories.rates_repository import RatesRepository

router = APIRouter()


@router.get("/history/all", response_model=list[RateSnapshot])
async def get_history_all(
    request: Request,
    hours: int = 24,
    bucket_minutes: int = 60,
) -> list[RateSnapshot]:
    until = datetime.utcnow()
    since = until - timedelta(hours=hours)
    repo = cast(RatesRepository, request.app.state.repo)
    return await repo.get_history_all(since=since, until=until, bucket_minutes=bucket_minutes)


@router.get("/latest", response_model=list[RateSnapshot])
async def get_latest(request: Request) -> list[RateSnapshot]:
    repo = cast(RatesRepository, request.app.state.repo)
    return await repo.get_latest_all()


@router.get("/history", response_model=list[RateSnapshot])
async def get_history(
    request: Request,
    protocol: str,
    chain: str,
    asset: str,
    since: datetime,
    until: datetime | None = None,
    bucket_minutes: int = 60,
) -> list[RateSnapshot]:
    resolved_until = until if until is not None else datetime.utcnow()

    if since >= resolved_until:
        raise HTTPException(
            status_code=422,
            detail="`since` must be strictly before `until`",
        )

    repo = cast(RatesRepository, request.app.state.repo)
    return await repo.get_history(
        protocol=protocol,
        chain=chain,
        asset=asset,
        since=since,
        until=resolved_until,
        bucket_minutes=bucket_minutes,
    )
