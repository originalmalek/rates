from collections.abc import Iterator
from datetime import datetime
from unittest.mock import AsyncMock

import httpx
import pytest

from app.config.settings import settings
from app.dependencies import get_redis_client, get_vaults_repo
from app.main import app
from tests.fixtures.factories import make_vault_snapshot


def _make_snapshot(**overrides):  # type: ignore[no-untyped-def]
    overrides.setdefault("ts", datetime(2024, 1, 1, 12, 0, 0))
    return make_vault_snapshot(**overrides)


@pytest.fixture
def mock_vaults_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.get_latest_all = AsyncMock(return_value=[_make_snapshot()])
    repo.get_history_all = AsyncMock(return_value=[_make_snapshot()])
    repo.get_history = AsyncMock(return_value=[_make_snapshot()])
    repo.get_snapshots = AsyncMock(return_value=([_make_snapshot()], 1))
    return repo


@pytest.fixture
def mock_redis() -> AsyncMock:
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)  # cache miss
    redis.set = AsyncMock(return_value=True)
    return redis


@pytest.fixture
def client(
    mock_vaults_repo: AsyncMock, mock_redis: AsyncMock
) -> Iterator[httpx.AsyncClient]:
    app.dependency_overrides[get_vaults_repo] = lambda: mock_vaults_repo
    app.dependency_overrides[get_redis_client] = lambda: mock_redis
    transport = httpx.ASGITransport(app=app)
    try:
        yield httpx.AsyncClient(transport=transport, base_url="http://test")
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_vaults_latest_returns_200(
    client: httpx.AsyncClient, mock_vaults_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/vaults/latest")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["meta"]["protocol"] == "morpho-blue"
    # vault_name is what the user recognises — it must survive serialisation.
    assert data[0]["meta"]["vault_name"] == "steakUSDC"
    assert data[0]["apy_reward"] == pytest.approx(2.3)
    mock_vaults_repo.get_latest_all.assert_called_once()


@pytest.mark.asyncio
async def test_get_vaults_latest_filters_forwarded(
    client: httpx.AsyncClient, mock_vaults_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get(
            "/vaults/latest",
            params={
                "chains": "ethereum,base",
                "protocols": "morpho-blue",
                "assets": "USDC,DAI",
            },
        )

    assert response.status_code == 200
    call_kwargs = mock_vaults_repo.get_latest_all.call_args.kwargs
    assert set(call_kwargs["chains"]) == {"ethereum", "base"}
    assert call_kwargs["protocols"] == ["morpho-blue"]
    assert set(call_kwargs["assets"]) == {"USDC", "DAI"}


@pytest.mark.asyncio
async def test_get_vaults_latest_no_filter_passes_none(
    client: httpx.AsyncClient, mock_vaults_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/vaults/latest")

    assert response.status_code == 200
    call_kwargs = mock_vaults_repo.get_latest_all.call_args.kwargs
    assert call_kwargs["chains"] is None
    assert call_kwargs["protocols"] is None
    assert call_kwargs["assets"] is None


@pytest.mark.asyncio
async def test_get_vaults_latest_without_max_age_applies_server_default(
    client: httpx.AsyncClient, mock_vaults_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/vaults/latest")

    assert response.status_code == 200
    call_kwargs = mock_vaults_repo.get_latest_all.call_args.kwargs
    assert call_kwargs["max_age_minutes"] == settings.effective_max_age_minutes


@pytest.mark.asyncio
async def test_get_vaults_latest_cache_hit_skips_repo(
    mock_vaults_repo: AsyncMock,
) -> None:
    snap = _make_snapshot()
    cached_payload = "[" + snap.model_dump_json() + "]"

    redis = AsyncMock()
    redis.get = AsyncMock(return_value=cached_payload)
    redis.set = AsyncMock(return_value=True)

    app.dependency_overrides[get_vaults_repo] = lambda: mock_vaults_repo
    app.dependency_overrides[get_redis_client] = lambda: redis
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/vaults/latest")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    mock_vaults_repo.get_latest_all.assert_not_called()


@pytest.mark.asyncio
async def test_get_vaults_history_all_returns_200(
    client: httpx.AsyncClient, mock_vaults_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get(
            "/vaults/history/all", params={"protocols": "morpho-blue,euler-v2"}
        )

    assert response.status_code == 200
    call_kwargs = mock_vaults_repo.get_history_all.call_args.kwargs
    assert set(call_kwargs["protocols"]) == {"morpho-blue", "euler-v2"}


@pytest.mark.asyncio
async def test_get_vaults_history_forwards_pool_id(
    client: httpx.AsyncClient, mock_vaults_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get(
            "/vaults/history",
            params={"pool_id": "p-steak", "since": "2024-01-01T00:00:00"},
        )

    assert response.status_code == 200
    call_kwargs = mock_vaults_repo.get_history.call_args.kwargs
    assert call_kwargs["pool_id"] == "p-steak"


@pytest.mark.asyncio
async def test_get_vaults_history_rejects_inverted_range(
    client: httpx.AsyncClient, mock_vaults_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get(
            "/vaults/history",
            params={
                "pool_id": "p-steak",
                "since": "2024-02-01T00:00:00",
                "until": "2024-01-01T00:00:00",
            },
        )

    assert response.status_code == 422
    mock_vaults_repo.get_history.assert_not_called()


@pytest.mark.asyncio
async def test_get_vaults_snapshots_returns_page(
    client: httpx.AsyncClient, mock_vaults_repo: AsyncMock
) -> None:
    async with client as ac:
        response = await ac.get("/vaults/snapshots", params={"pool_id": "p-steak"})

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["meta"]["vault_name"] == "steakUSDC"
    mock_vaults_repo.get_snapshots.assert_called_once_with("p-steak", 50, 0)
