from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis

from app.cache import get_or_set, make_key
from app.config.settings import settings
from app.repositories.rates_repository import RatesRepository
from app.routers import rates

_TTL_LATEST = 55
_TTL_HISTORY = 300


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # startup
    client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongodb_url)  # type: ignore[type-arg]
    db = client[settings.mongodb_db]
    repo = RatesRepository(db)
    await repo.ensure_indexes()
    redis: Redis = Redis.from_url(settings.redis_url, decode_responses=True)
    app.state.repo = repo
    app.state.redis = redis
    app.state.mongo_client = client

    # Pre-warm the most common cache keys so the first user request is instant.
    await get_or_set(redis, make_key("rates:latest", "", "", ""), _TTL_LATEST, repo.get_latest_all)
    until = datetime.utcnow()
    since = until - timedelta(hours=24)
    await get_or_set(
        redis,
        make_key("rates:history_all", "24", "60", "", "", ""),
        _TTL_HISTORY,
        lambda: repo.get_history_all(since=since, until=until, bucket_minutes=60),
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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
