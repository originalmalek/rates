from datetime import datetime, timezone

import pytest
import pytest_asyncio
from mongomock_motor import AsyncMongoMockClient

from app.models import RateSnapshot, SnapshotMeta
from app.repositories.rates_repository import RatesRepository


def _make_snapshot(
    protocol: str = "aave-v3",
    chain: str = "ethereum",
    asset: str = "USDC",
    supply_apy: float | None = 5.2,
    borrow_apy: float | None = 6.41,
    ts: datetime | None = None,
) -> RateSnapshot:
    if ts is None:
        ts = datetime.utcnow()
    return RateSnapshot(
        ts=ts,
        meta=SnapshotMeta(protocol=protocol, chain=chain, asset=asset),
        supply_apy=supply_apy,
        borrow_apy=borrow_apy,
        utilization=None,
        tvl_usd=500_000_000.0,
    )


@pytest_asyncio.fixture
async def repo() -> RatesRepository:
    client = AsyncMongoMockClient()
    db = client["test_rates"]
    return RatesRepository(db)


@pytest.mark.asyncio
async def test_insert_and_get_latest_all(repo: RatesRepository) -> None:
    snap1 = _make_snapshot(protocol="aave-v3", asset="USDC")
    snap2 = _make_snapshot(protocol="compound-v3", asset="USDT", supply_apy=3.1, borrow_apy=3.85)

    await repo.insert_snapshots([snap1, snap2])
    results = await repo.get_latest_all()

    assert len(results) == 2
    protocols = {r.meta.protocol for r in results}
    assert "aave-v3" in protocols
    assert "compound-v3" in protocols


@pytest.mark.asyncio
async def test_get_latest_returns_most_recent(repo: RatesRepository) -> None:
    older = _make_snapshot(
        supply_apy=4.0,
        ts=datetime(2024, 1, 1, 10, 0, 0),
    )
    newer = _make_snapshot(
        supply_apy=5.5,
        ts=datetime(2024, 1, 1, 11, 0, 0),
    )
    await repo.insert_snapshots([older, newer])

    result = await repo.get_latest("aave-v3", "ethereum", "USDC")
    assert result is not None
    assert result.supply_apy == pytest.approx(5.5)


@pytest.mark.asyncio
async def test_get_latest_not_found_returns_none(repo: RatesRepository) -> None:
    result = await repo.get_latest("nonexistent", "ethereum", "USDC")
    assert result is None


@pytest.mark.asyncio
async def test_get_latest_all_empty(repo: RatesRepository) -> None:
    results = await repo.get_latest_all()
    assert results == []


@pytest.mark.asyncio
async def test_insert_empty_snapshots(repo: RatesRepository) -> None:
    # Should not raise
    await repo.insert_snapshots([])
    results = await repo.get_latest_all()
    assert results == []


@pytest.mark.asyncio
async def test_get_latest_filters_by_protocol_chain_asset(
    repo: RatesRepository,
) -> None:
    snap_usdc = _make_snapshot(protocol="aave-v3", chain="ethereum", asset="USDC", supply_apy=5.2)
    snap_usdt = _make_snapshot(protocol="aave-v3", chain="ethereum", asset="USDT", supply_apy=3.1)
    await repo.insert_snapshots([snap_usdc, snap_usdt])

    result = await repo.get_latest("aave-v3", "ethereum", "USDT")
    assert result is not None
    assert result.meta.asset == "USDT"
    assert result.supply_apy == pytest.approx(3.1)


@pytest.mark.asyncio
async def test_spark_borrow_apy_none(repo: RatesRepository) -> None:
    snap = _make_snapshot(protocol="spark", asset="DAI", borrow_apy=None)
    await repo.insert_snapshots([snap])

    result = await repo.get_latest("spark", "ethereum", "DAI")
    assert result is not None
    assert result.borrow_apy is None
