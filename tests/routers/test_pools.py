from collections.abc import Iterator
from datetime import datetime
from unittest.mock import AsyncMock

import httpx
import pytest

from app.config.settings import settings
from app.dependencies import get_pools_repo, get_redis_client
from app.main import app
from tests.fixtures.factories import make_pool_snapshot


def _make_snapshot(**overrides):
    overrides.setdefault("ts", datetime(2024, 1, 1, 12, 0, 0))
    return make_pool_snapshot(**overrides)


@pytest.fixture
def mock_pools_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.get_latest_all = AsyncMock(return_value=[_make_snapshot()])
    repo.get_history_all = AsyncMock(return_value=[_make_snapshot()])
    return repo


@pytest.fixture
def mock_redis() -> AsyncMock:
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)  # cache miss
    redis.set = AsyncMock(return_value=True)
    return redis


@pytest.fixture
def client(
    mock_pools_repo: AsyncMock, mock_redis: AsyncMock
) -> Iterator[httpx.AsyncClient]:
    app.dependency_overrides[get_pools_repo] = lambda: mock_pools_repo
    app.dependency_overrides[get_redis_client] = lambda: mock_redis
    transport = httpx.ASGITransport(app=app)
    try:
        yield httpx.AsyncClient(transport=transport, base_url="http://test")
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_pools_latest_returns_200(
    client: httpx.AsyncClient, mock_pools_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/pools/latest")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["meta"]["protocol"] == "curve-dex"
    mock_pools_repo.get_latest_all.assert_called_once()


@pytest.mark.asyncio
async def test_get_pools_latest_chains_filter_forwarded(
    client: httpx.AsyncClient, mock_pools_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/pools/latest", params={"chains": "ethereum,solana"})

    assert response.status_code == 200
    call_kwargs = mock_pools_repo.get_latest_all.call_args.kwargs
    assert set(call_kwargs["chains"]) == {"ethereum", "solana"}


@pytest.mark.asyncio
async def test_get_pools_latest_no_filter_passes_none(
    client: httpx.AsyncClient, mock_pools_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/pools/latest")

    assert response.status_code == 200
    call_kwargs = mock_pools_repo.get_latest_all.call_args.kwargs
    assert call_kwargs["chains"] is None
    assert call_kwargs["protocols"] is None
    assert call_kwargs["assets"] is None


@pytest.mark.asyncio
async def test_get_pools_latest_without_max_age_applies_server_default(
    client: httpx.AsyncClient, mock_pools_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/pools/latest")

    assert response.status_code == 200
    call_kwargs = mock_pools_repo.get_latest_all.call_args.kwargs
    assert call_kwargs["max_age_minutes"] == settings.effective_max_age_minutes


@pytest.mark.asyncio
async def test_get_pools_latest_max_age_minutes_forwarded_to_repo(
    client: httpx.AsyncClient, mock_pools_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/pools/latest", params={"max_age_minutes": 10})

    assert response.status_code == 200
    call_kwargs = mock_pools_repo.get_latest_all.call_args.kwargs
    assert call_kwargs["max_age_minutes"] == 10


@pytest.mark.asyncio
async def test_get_pools_latest_cache_hit_skips_repo(
    mock_pools_repo: AsyncMock,
) -> None:
    snap = _make_snapshot()
    cached_payload = "[" + snap.model_dump_json() + "]"

    redis = AsyncMock()
    redis.get = AsyncMock(return_value=cached_payload)
    redis.set = AsyncMock(return_value=True)

    app.dependency_overrides[get_pools_repo] = lambda: mock_pools_repo
    app.dependency_overrides[get_redis_client] = lambda: redis
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/pools/latest")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    mock_pools_repo.get_latest_all.assert_not_called()


@pytest.mark.asyncio
async def test_get_pools_history_all_returns_200(
    client: httpx.AsyncClient, mock_pools_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/pools/history/all")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    mock_pools_repo.get_history_all.assert_called_once()


@pytest.mark.asyncio
async def test_get_pools_history_all_protocols_filter_forwarded(
    client: httpx.AsyncClient, mock_pools_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get(
            "/pools/history/all", params={"protocols": "curve-dex,uniswap-v3"}
        )

    assert response.status_code == 200
    call_kwargs = mock_pools_repo.get_history_all.call_args.kwargs
    assert set(call_kwargs["protocols"]) == {"curve-dex", "uniswap-v3"}
