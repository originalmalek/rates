from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from mongomock_motor import AsyncMongoMockClient

from app.repositories.pools_repository import PoolsRepository
from tests.fixtures.factories import make_pool_snapshot as _make_snapshot


@pytest_asyncio.fixture
async def repo() -> PoolsRepository:
    client = AsyncMongoMockClient()
    db = client["test_pools"]
    return PoolsRepository(db)


@pytest.mark.asyncio
async def test_insert_and_get_latest_all(repo: PoolsRepository) -> None:
    snap1 = _make_snapshot(protocol="curve-dex", asset="USDC-USDT-DAI")
    snap2 = _make_snapshot(protocol="uniswap-v3", asset="USDC-USDT", supply_apy=3.8)

    await repo.insert_snapshots([snap1, snap2])
    results = await repo.get_latest_all()

    assert len(results) == 2
    projects = {r.meta.protocol for r in results}
    assert projects == {"curve-dex", "uniswap-v3"}


@pytest.mark.asyncio
async def test_get_latest_all_empty(repo: PoolsRepository) -> None:
    results = await repo.get_latest_all()
    assert results == []


@pytest.mark.asyncio
async def test_insert_empty_snapshots(repo: PoolsRepository) -> None:
    await repo.insert_snapshots([])
    results = await repo.get_latest_all()
    assert results == []


@pytest.mark.asyncio
async def test_get_latest_all_returns_most_recent_per_series(
    repo: PoolsRepository,
) -> None:
    older = _make_snapshot(
        supply_apy=4.0, ts=datetime(2024, 1, 1, 10, 0, 0)
    )
    newer = _make_snapshot(
        supply_apy=5.5, ts=datetime(2024, 1, 1, 11, 0, 0)
    )
    await repo.insert_snapshots([older, newer])

    results = await repo.get_latest_all()
    assert len(results) == 1
    assert results[0].supply_apy == pytest.approx(5.5)


@pytest.mark.asyncio
async def test_get_latest_all_drops_stale_series(repo: PoolsRepository) -> None:
    now = datetime.utcnow()
    fresh = _make_snapshot(protocol="curve-dex", asset="USDC-USDT-DAI", ts=now)
    stale = _make_snapshot(
        protocol="uniswap-v3", asset="USDC-USDT",
        ts=now - timedelta(days=10),
    )
    await repo.insert_snapshots([fresh, stale])

    assert len(await repo.get_latest_all()) == 2

    results = await repo.get_latest_all(max_age_minutes=60)
    assert len(results) == 1
    assert results[0].meta.protocol == "curve-dex"


@pytest.mark.asyncio
async def test_get_latest_all_filters_by_chain(repo: PoolsRepository) -> None:
    await repo.insert_snapshots([
        _make_snapshot(chain="ethereum"),
        _make_snapshot(chain="arbitrum"),
    ])

    results = await repo.get_latest_all(chains=["arbitrum"])
    assert len(results) == 1
    assert results[0].meta.chain == "arbitrum"


@pytest.mark.asyncio
async def test_get_latest_all_filters_by_protocol(repo: PoolsRepository) -> None:
    await repo.insert_snapshots([
        _make_snapshot(protocol="curve-dex"),
        _make_snapshot(protocol="uniswap-v3"),
    ])

    results = await repo.get_latest_all(protocols=["uniswap-v3"])
    assert len(results) == 1
    assert results[0].meta.protocol == "uniswap-v3"


@pytest.mark.asyncio
async def test_get_latest_all_filters_by_asset(repo: PoolsRepository) -> None:
    await repo.insert_snapshots([
        _make_snapshot(asset="USDC-USDT-DAI"),
        _make_snapshot(asset="USDC-USDT"),
    ])

    results = await repo.get_latest_all(assets=["USDC-USDT"])
    assert len(results) == 1
    assert results[0].meta.asset == "USDC-USDT"
