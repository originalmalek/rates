from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis

from app.cache import CACHE_TTL_HISTORY, CACHE_TTL_LATEST, get_or_set, make_key
from app.config.settings import settings
from app.models import PoolSnapshot, RateSnapshot, VaultSnapshot
from app.repositories.pools_repository import PoolsRepository
from app.repositories.rates_repository import RatesRepository
from app.repositories.vaults_repository import VaultsRepository
from app.routers import pools, rates, vaults


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # startup
    client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongodb_url)  # type: ignore[type-arg]
    db = client[settings.mongodb_db]
    repo = RatesRepository(db)
    pools_repo = PoolsRepository(db)
    vaults_repo = VaultsRepository(db)
    await repo.ensure_indexes()
    await pools_repo.ensure_indexes()
    await vaults_repo.ensure_indexes()
    redis: Redis = Redis.from_url(settings.redis_url, decode_responses=True)
    app.state.repo = repo
    app.state.pools_repo = pools_repo
    app.state.vaults_repo = vaults_repo
    app.state.redis = redis
    app.state.mongo_client = client

    # Pre-warm the most common cache keys so the first user request is instant.
    await get_or_set(
        redis,
        make_key("rates:latest", "", "", "", ""),
        CACHE_TTL_LATEST,
        repo.get_latest_all,
        RateSnapshot,
    )
    until = datetime.utcnow()
    since = until - timedelta(hours=24)
    await get_or_set(
        redis,
        make_key("rates:history_all", "24", "60", "", "", ""),
        CACHE_TTL_HISTORY,
        lambda: repo.get_history_all(since=since, until=until, bucket_minutes=60),
        RateSnapshot,
    )
    await get_or_set(
        redis,
        make_key("pools:latest", "", "", ""),
        CACHE_TTL_LATEST,
        pools_repo.get_latest_all,
        PoolSnapshot,
    )
    await get_or_set(
        redis,
        make_key("pools:history_all", "24", "60", "", "", ""),
        CACHE_TTL_HISTORY,
        lambda: pools_repo.get_history_all(since=since, until=until, bucket_minutes=60),
        PoolSnapshot,
    )
    await get_or_set(
        redis,
        # Five parts and the staleness cutoff, exactly as /vaults/latest builds
        # them — a key or an argument that differs makes the pre-warm dead
        # weight, which is what happened to "pools:latest" above.
        make_key("vaults:latest", "", "", "", ""),
        CACHE_TTL_LATEST,
        lambda: vaults_repo.get_latest_all(
            max_age_minutes=settings.effective_max_age_minutes
        ),
        VaultSnapshot,
    )
    await get_or_set(
        redis,
        make_key("vaults:history_all", "24", "60", "", "", ""),
        CACHE_TTL_HISTORY,
        lambda: vaults_repo.get_history_all(since=since, until=until, bucket_minutes=60),
        VaultSnapshot,
    )

    yield
    # shutdown
    await redis.aclose()
    client.close()


app = FastAPI(
    title="DeFi Stablecoin Rates Monitor",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(rates.router, prefix="/rates")
app.include_router(pools.router, prefix="/pools")
app.include_router(vaults.router, prefix="/vaults")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
