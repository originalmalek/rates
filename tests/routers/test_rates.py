from datetime import datetime
from unittest.mock import AsyncMock

import pytest
import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.models import RateSnapshot, SnapshotMeta


def _make_snapshot(
    protocol: str = "aave-v3",
    chain: str = "ethereum",
    asset: str = "USDC",
    supply_apy: float | None = 5.2,
    borrow_apy: float | None = 6.41,
    ts: datetime | None = None,
) -> RateSnapshot:
    if ts is None:
        ts = datetime(2024, 1, 1, 12, 0, 0)
    return RateSnapshot(
        ts=ts,
        meta=SnapshotMeta(protocol=protocol, chain=chain, asset=asset),
        supply_apy=supply_apy,
        borrow_apy=borrow_apy,
        utilization=None,
        tvl_usd=500_000_000.0,
    )


@pytest.fixture
def mock_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.get_latest_all = AsyncMock(return_value=[_make_snapshot()])
    repo.get_history = AsyncMock(return_value=[_make_snapshot()])
    return repo


@pytest.fixture
def client(mock_repo: AsyncMock) -> httpx.AsyncClient:
    app.state.repo = mock_repo
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
