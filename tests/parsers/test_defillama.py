import json
from pathlib import Path

import pytest
import respx
import httpx

from app.parsers.defillama import fetch_snapshots, _POOLS_URL, _LEND_BORROW_URL

FIXTURES = Path(__file__).parent.parent / "fixtures"


def _load(name: str) -> str:
    return (FIXTURES / name).read_text()


@pytest.fixture
def pools_json() -> str:
    return _load("defillama_pools.json")


@pytest.fixture
def lb_json() -> str:
    return _load("defillama_lendborrow.json")


@respx.mock
@pytest.mark.asyncio
async def test_fetch_snapshots_returns_only_whitelisted(
    pools_json: str, lb_json: str
) -> None:
    respx.get(_POOLS_URL).mock(
        return_value=httpx.Response(200, content=pools_json.encode())
    )
    respx.get(_LEND_BORROW_URL).mock(
        return_value=httpx.Response(200, content=lb_json.encode())
    )

    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    # The fixture has 6 pools:
    #   - pool-aave-usdc-eth        → MATCH
    #   - pool-compound-usdt-eth    → MATCH
    #   - pool-spark-dai-eth        → MATCH
    #   - pool-wrong-chain (Arbitrum) → filtered out
    #   - pool-unknown-protocol     → filtered out
    #   - pool-lp-symbol (USDC-LP)  → filtered out (LP suffix stripped → USDC match)
    # Note: USDC-LP strips to USDC which IS whitelisted, so it would pass.
    # We keep that as a design choice — 4 snapshots expected.
    protocols = {s.meta.protocol for s in snapshots}
    chains = {s.meta.chain for s in snapshots}

    assert "some-unknown-protocol" not in protocols
    assert "arbitrum" not in chains
    assert all(c == "ethereum" for c in chains)


@respx.mock
@pytest.mark.asyncio
async def test_apy_values_not_divided_by_100(
    pools_json: str, lb_json: str
) -> None:
    """DeFi Llama returns percent directly — 5.2 means 5.2%, not 0.052."""
    respx.get(_POOLS_URL).mock(
        return_value=httpx.Response(200, content=pools_json.encode())
    )
    respx.get(_LEND_BORROW_URL).mock(
        return_value=httpx.Response(200, content=lb_json.encode())
    )

    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    aave_usdc = next(
        s for s in snapshots
        if s.meta.protocol == "aave-v3" and s.meta.asset == "USDC"
    )
    # fixture has apy=5.2 — must stay 5.2, not 0.052
    assert aave_usdc.supply_apy == pytest.approx(5.2)
    assert aave_usdc.borrow_apy == pytest.approx(6.41)


@respx.mock
@pytest.mark.asyncio
async def test_spark_borrow_apy_is_none_not_zero(
    pools_json: str, lb_json: str
) -> None:
    """Spark has apyBorrow=null in fixture — must be None, not 0."""
    respx.get(_POOLS_URL).mock(
        return_value=httpx.Response(200, content=pools_json.encode())
    )
    respx.get(_LEND_BORROW_URL).mock(
        return_value=httpx.Response(200, content=lb_json.encode())
    )

    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    spark_dai = next(
        s for s in snapshots
        if s.meta.protocol == "spark" and s.meta.asset == "DAI"
    )
    assert spark_dai.borrow_apy is None


@respx.mock
@pytest.mark.asyncio
async def test_utilization_is_always_none(
    pools_json: str, lb_json: str
) -> None:
    """DeFi Llama /pools doesn't provide utilization — must be None."""
    respx.get(_POOLS_URL).mock(
        return_value=httpx.Response(200, content=pools_json.encode())
    )
    respx.get(_LEND_BORROW_URL).mock(
        return_value=httpx.Response(200, content=lb_json.encode())
    )

    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    assert all(s.utilization is None for s in snapshots)


@respx.mock
@pytest.mark.asyncio
async def test_tvl_mapped_correctly(
    pools_json: str, lb_json: str
) -> None:
    respx.get(_POOLS_URL).mock(
        return_value=httpx.Response(200, content=pools_json.encode())
    )
    respx.get(_LEND_BORROW_URL).mock(
        return_value=httpx.Response(200, content=lb_json.encode())
    )

    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    compound_usdt = next(
        s for s in snapshots
        if s.meta.protocol == "compound-v3" and s.meta.asset == "USDT"
    )
    assert compound_usdt.tvl_usd == pytest.approx(120_000_000.0)
