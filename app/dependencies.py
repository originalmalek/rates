"""FastAPI dependency-injection providers.

Routers should access shared state through these instead of poking
`request.app.state` directly — this lets tests override via
`app.dependency_overrides`.
"""

from typing import cast

from fastapi import Request
from redis.asyncio import Redis

from app.repositories.pools_repository import PoolsRepository
from app.repositories.rates_repository import RatesRepository
from app.repositories.vaults_repository import VaultsRepository


async def get_rates_repo(request: Request) -> RatesRepository:
    return cast(RatesRepository, request.app.state.repo)


async def get_pools_repo(request: Request) -> PoolsRepository:
    return cast(PoolsRepository, request.app.state.pools_repo)


async def get_vaults_repo(request: Request) -> VaultsRepository:
    return cast(VaultsRepository, request.app.state.vaults_repo)


async def get_redis_client(request: Request) -> Redis:
    return cast(Redis, request.app.state.redis)
