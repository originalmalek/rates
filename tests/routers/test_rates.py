from datetime import datetime
from unittest.mock import AsyncMock

import httpx
import pytest

from app.main import app
from tests.fixtures.factories import make_rate_snapshot


def _make_snapshot(**overrides):
    overrides.setdefault("ts", datetime(2024, 1, 1, 12, 0, 0))
    return make_rate_snapshot(**overrides)


@pytest.fixture
def mock_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.get_latest_all = AsyncMock(return_value=[_make_snapshot()])
    repo.get_history = AsyncMock(return_value=[_make_snapshot()])
    repo.get_history_all = AsyncMock(return_value=[_make_snapshot()])
    return repo


@pytest.fixture
def mock_redis() -> AsyncMock:
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    return redis


@pytest.fixture
def client(mock_repo: AsyncMock, mock_redis: AsyncMock) -> httpx.AsyncClient:
    app.state.repo = mock_repo
    app.state.redis = mock_redis
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_get_latest_returns_200(
    client: httpx.AsyncClient, mock_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/rates/latest")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["meta"]["protocol"] == "aave-v3"
    mock_repo.get_latest_all.assert_called_once()


@pytest.mark.asyncio
async def test_get_latest_cache_hit_skips_repo(
    mock_repo: AsyncMock,
) -> None:
    snap = _make_snapshot()
    cached_payload = "[" + snap.model_dump_json() + "]"

    redis = AsyncMock()
    redis.get = AsyncMock(return_value=cached_payload)
    redis.set = AsyncMock(return_value=True)

    app.state.repo = mock_repo
    app.state.redis = redis
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/rates/latest")

    assert response.status_code == 200
    mock_repo.get_latest_all.assert_not_called()


@pytest.mark.asyncio
async def test_get_history_valid_params_returns_200(
    client: httpx.AsyncClient, mock_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get(
            "/rates/history",
            params={
                "protocol": "aave-v3",
                "chain": "ethereum",
                "asset": "USDC",
                "since": "2024-01-01T00:00:00",
                "until": "2024-01-02T00:00:00",
                "bucket_minutes": 60,
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    mock_repo.get_history.assert_called_once_with(
        protocol="aave-v3",
        chain="ethereum",
        asset="USDC",
        since=datetime(2024, 1, 1, 0, 0, 0),
        until=datetime(2024, 1, 2, 0, 0, 0),
        bucket_minutes=60,
    )


@pytest.mark.asyncio
async def test_get_history_since_equals_until_returns_422(
    client: httpx.AsyncClient,
) -> None:
    async with client as ac:
        response = await ac.get(
            "/rates/history",
            params={
                "protocol": "aave-v3",
                "chain": "ethereum",
                "asset": "USDC",
                "since": "2024-01-01T00:00:00",
                "until": "2024-01-01T00:00:00",
            },
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_history_since_after_until_returns_422(
    client: httpx.AsyncClient,
) -> None:
    async with client as ac:
        response = await ac.get(
            "/rates/history",
            params={
                "protocol": "aave-v3",
                "chain": "ethereum",
                "asset": "USDC",
                "since": "2024-01-02T00:00:00",
                "until": "2024-01-01T00:00:00",
            },
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_health_regression(client: httpx.AsyncClient) -> None:
    async with client as ac:
        response = await ac.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_get_latest_chains_filter_forwarded_to_repo(
    client: httpx.AsyncClient, mock_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/rates/latest", params={"chains": "arbitrum,base"})

    assert response.status_code == 200
    call_kwargs = mock_repo.get_latest_all.call_args.kwargs
    assert set(call_kwargs["chains"]) == {"arbitrum", "base"}


@pytest.mark.asyncio
async def test_get_latest_no_filter_passes_none_to_repo(
    client: httpx.AsyncClient, mock_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/rates/latest")

    assert response.status_code == 200
    call_kwargs = mock_repo.get_latest_all.call_args.kwargs
    assert call_kwargs["chains"] is None
    assert call_kwargs["protocols"] is None
    assert call_kwargs["assets"] is None


@pytest.mark.asyncio
async def test_get_latest_empty_chains_param_treated_as_no_filter(
    client: httpx.AsyncClient, mock_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/rates/latest", params={"chains": ""})

    assert response.status_code == 200
    call_kwargs = mock_repo.get_latest_all.call_args.kwargs
    assert call_kwargs["chains"] is None


@pytest.mark.asyncio
async def test_get_latest_cache_miss_stores_result(
    client: httpx.AsyncClient, mock_repo: AsyncMock, mock_redis: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/rates/latest")

    assert response.status_code == 200
    mock_repo.get_latest_all.assert_called_once()
    mock_redis.set.assert_called_once()


@pytest.mark.asyncio
async def test_get_latest_max_age_minutes_forwarded_to_repo(
    client: httpx.AsyncClient, mock_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/rates/latest", params={"max_age_minutes": 10})

    assert response.status_code == 200
    call_kwargs = mock_repo.get_latest_all.call_args.kwargs
    assert call_kwargs["max_age_minutes"] == 10
