from datetime import datetime

import pytest
import pytest_asyncio
from mongomock_motor import AsyncMongoMockClient

from app.repositories.rates_repository import RatesRepository
from tests.fixtures.factories import make_rate_snapshot as _make_snapshot


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


@pytest.mark.asyncio
async def test_get_latest_all_filters_by_chain(repo: RatesRepository) -> None:
    await repo.insert_snapshots([
        _make_snapshot(chain="ethereum"),
        _make_snapshot(chain="arbitrum"),
    ])

    results = await repo.get_latest_all(chains=["arbitrum"])
    assert len(results) == 1
    assert results[0].meta.chain == "arbitrum"


@pytest.mark.asyncio
async def test_get_latest_all_filters_by_protocol(repo: RatesRepository) -> None:
    await repo.insert_snapshots([
        _make_snapshot(protocol="aave-v3"),
        _make_snapshot(protocol="compound-v3"),
    ])

    results = await repo.get_latest_all(protocols=["compound-v3"])
    assert len(results) == 1
    assert results[0].meta.protocol == "compound-v3"


@pytest.mark.asyncio
async def test_get_latest_all_filters_by_asset(repo: RatesRepository) -> None:
    await repo.insert_snapshots([
        _make_snapshot(asset="USDC"),
        _make_snapshot(asset="USDT"),
    ])

    results = await repo.get_latest_all(assets=["USDT"])
    assert len(results) == 1
    assert results[0].meta.asset == "USDT"


@pytest.mark.asyncio
async def test_get_latest_all_no_filter_returns_all(repo: RatesRepository) -> None:
    await repo.insert_snapshots([
        _make_snapshot(protocol="aave-v3", chain="ethereum", asset="USDC"),
        _make_snapshot(protocol="aave-v3", chain="arbitrum", asset="USDC"),
        _make_snapshot(protocol="compound-v3", chain="ethereum", asset="USDT"),
    ])

    results = await repo.get_latest_all()
    assert len(results) == 3


@pytest.mark.asyncio
async def test_get_snapshots_paginates_and_reports_total(repo: RatesRepository) -> None:
    snaps = [
        _make_snapshot(
            protocol="aave-v3",
            chain="ethereum",
            asset="USDC",
            supply_apy=float(i),
            ts=datetime(2024, 1, 1, 0, i, 0),
        )
        for i in range(10)
    ]
    # Also insert a different series — must not appear.
    snaps.append(_make_snapshot(protocol="compound-v3", chain="ethereum", asset="USDT"))
    await repo.insert_snapshots(snaps)

    page1, total = await repo.get_snapshots("aave-v3", "ethereum", "USDC", limit=3, offset=0)
    assert total == 10
    assert len(page1) == 3
    # newest first
    assert page1[0].supply_apy == pytest.approx(9.0)

    page2, total2 = await repo.get_snapshots("aave-v3", "ethereum", "USDC", limit=3, offset=3)
    assert total2 == 10
    assert page2[0].supply_apy == pytest.approx(6.0)


@pytest.mark.asyncio
async def test_get_snapshots_unknown_series_returns_empty(
    repo: RatesRepository,
) -> None:
    items, total = await repo.get_snapshots("nonexistent", "ethereum", "USDC")
    assert items == []
    assert total == 0
