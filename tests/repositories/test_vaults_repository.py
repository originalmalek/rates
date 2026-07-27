from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from mongomock_motor import AsyncMongoMockClient

from app.repositories.vaults_repository import VaultsRepository
from tests.fixtures.factories import make_vault_snapshot as _make_snapshot


@pytest_asyncio.fixture
async def repo() -> VaultsRepository:
    client = AsyncMongoMockClient()
    db = client["test_vaults"]
    return VaultsRepository(db)


@pytest.mark.asyncio
async def test_insert_and_get_latest_all(repo: VaultsRepository) -> None:
    snap1 = _make_snapshot(protocol="morpho-blue", vault_name="steakUSDC")
    snap2 = _make_snapshot(
        protocol="euler-v2", vault_name="eUSDC-2", supply_apy=4.9
    )

    await repo.insert_snapshots([snap1, snap2])
    results = await repo.get_latest_all()

    assert len(results) == 2
    assert {r.meta.protocol for r in results} == {"morpho-blue", "euler-v2"}


@pytest.mark.asyncio
async def test_get_latest_all_empty(repo: VaultsRepository) -> None:
    assert await repo.get_latest_all() == []


@pytest.mark.asyncio
async def test_insert_empty_snapshots(repo: VaultsRepository) -> None:
    await repo.insert_snapshots([])
    assert await repo.get_latest_all() == []


@pytest.mark.asyncio
async def test_get_latest_all_returns_most_recent_per_series(
    repo: VaultsRepository,
) -> None:
    older = _make_snapshot(supply_apy=4.0, ts=datetime(2024, 1, 1, 10, 0, 0))
    newer = _make_snapshot(supply_apy=5.5, ts=datetime(2024, 1, 1, 11, 0, 0))
    await repo.insert_snapshots([older, newer])

    results = await repo.get_latest_all()
    assert len(results) == 1
    assert results[0].supply_apy == pytest.approx(5.5)


@pytest.mark.asyncio
async def test_same_underlying_different_vaults_stay_separate(
    repo: VaultsRepository,
) -> None:
    """Two USDC vaults from one curator on one chain are two series, not one."""
    await repo.insert_snapshots([
        _make_snapshot(vault_name="steakUSDC", supply_apy=7.4),
        _make_snapshot(vault_name="gtUSDCcore", supply_apy=5.2),
    ])

    results = await repo.get_latest_all()
    assert len(results) == 2
    assert {r.meta.vault_name for r in results} == {"steakUSDC", "gtUSDCcore"}


@pytest.mark.asyncio
async def test_get_latest_all_drops_stale_series(repo: VaultsRepository) -> None:
    now = datetime.utcnow()
    fresh = _make_snapshot(protocol="morpho-blue", ts=now)
    stale = _make_snapshot(
        protocol="euler-v2", vault_name="eUSDC-2", ts=now - timedelta(days=10)
    )
    await repo.insert_snapshots([fresh, stale])

    assert len(await repo.get_latest_all()) == 2

    results = await repo.get_latest_all(max_age_minutes=60)
    assert len(results) == 1
    assert results[0].meta.protocol == "morpho-blue"


@pytest.mark.asyncio
async def test_get_latest_all_filters_by_chain(repo: VaultsRepository) -> None:
    await repo.insert_snapshots([
        _make_snapshot(chain="ethereum"),
        _make_snapshot(chain="base"),
    ])

    results = await repo.get_latest_all(chains=["base"])
    assert len(results) == 1
    assert results[0].meta.chain == "base"


@pytest.mark.asyncio
async def test_get_latest_all_filters_by_protocol(repo: VaultsRepository) -> None:
    await repo.insert_snapshots([
        _make_snapshot(protocol="morpho-blue"),
        _make_snapshot(protocol="yearn-finance"),
    ])

    results = await repo.get_latest_all(protocols=["yearn-finance"])
    assert len(results) == 1
    assert results[0].meta.protocol == "yearn-finance"


@pytest.mark.asyncio
async def test_get_latest_all_filters_by_underlying_asset(
    repo: VaultsRepository,
) -> None:
    """The asset filter targets the underlying, not the curator's brand name."""
    await repo.insert_snapshots([
        _make_snapshot(asset="USDC", vault_name="steakUSDC"),
        _make_snapshot(asset="DAI", vault_name="yvDAI-1"),
    ])

    results = await repo.get_latest_all(assets=["DAI"])
    assert len(results) == 1
    assert results[0].meta.vault_name == "yvDAI-1"


@pytest.mark.asyncio
async def test_get_snapshots_scoped_to_one_series(repo: VaultsRepository) -> None:
    await repo.insert_snapshots([
        _make_snapshot(
            vault_name="steakUSDC", pool_id="p-steak",
            ts=datetime(2024, 1, 1, 10, 0, 0), supply_apy=7.0,
        ),
        _make_snapshot(
            vault_name="steakUSDC", pool_id="p-steak",
            ts=datetime(2024, 1, 1, 11, 0, 0), supply_apy=7.5,
        ),
        _make_snapshot(vault_name="gtUSDCcore", pool_id="p-gt"),
    ])

    items, total = await repo.get_snapshots("p-steak")
    assert total == 2
    assert [i.supply_apy for i in items] == [pytest.approx(7.5), pytest.approx(7.0)]


@pytest.mark.asyncio
async def test_get_snapshots_paginates(repo: VaultsRepository) -> None:
    await repo.insert_snapshots([
        _make_snapshot(
            pool_id="p1", supply_apy=float(i), ts=datetime(2024, 1, 1, i, 0, 0)
        )
        for i in range(1, 6)
    ])

    items, total = await repo.get_snapshots("p1", limit=2, offset=2)
    assert total == 5
    assert [i.supply_apy for i in items] == [pytest.approx(3.0), pytest.approx(2.0)]


@pytest.mark.asyncio
async def test_get_snapshots_unknown_pool_id(repo: VaultsRepository) -> None:
    await repo.insert_snapshots([_make_snapshot(pool_id="p1")])
    items, total = await repo.get_snapshots("nope")
    assert (items, total) == ([], 0)
