from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from app.config.settings import settings
from app.repositories.rates_repository import RatesRepository
from app.routers import rates


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # startup
    client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongodb_url)  # type: ignore[type-arg]
    db = client[settings.mongodb_db]
    repo = RatesRepository(db)
    await repo.ensure_indexes()
    app.state.repo = repo
    app.state.mongo_client = client
    yield
    # shutdown
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
