import json
from pathlib import Path

import httpx
import pytest
import respx

from app.parsers.defillama import _POOLS_URL, fetch_pool_snapshots

FIXTURES = Path(__file__).parent.parent / "fixtures"


@pytest.fixture
def lp_pools_json() -> str:
    return (FIXTURES / "defillama_lp_pools.json").read_text()


def _mock_pools(lp_pools_json: str) -> None:
    respx.get(_POOLS_URL).mock(
        return_value=httpx.Response(200, content=lp_pools_json.encode())
    )


@respx.mock
@pytest.mark.asyncio
async def test_lp_whitelisted_protocols_pass(lp_pools_json: str) -> None:
    _mock_pools(lp_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_pool_snapshots(client)

    projects = {s.meta.protocol for s in snapshots}
    assert projects == {"curve-dex", "uniswap-v3", "kamino-liquidity"}


@respx.mock
@pytest.mark.asyncio
async def test_lp_drops_single_exposure(lp_pools_json: str) -> None:
    _mock_pools(lp_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_pool_snapshots(client)

    # The single-exposure curve pool with symbol="USDC" must not appear.
    assert all(s.meta.asset != "USDC" for s in snapshots)


@respx.mock
@pytest.mark.asyncio
async def test_lp_drops_non_stablecoin(lp_pools_json: str) -> None:
    _mock_pools(lp_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_pool_snapshots(client)

    assert all("ETH-WBTC" != s.meta.asset for s in snapshots)


@respx.mock
@pytest.mark.asyncio
async def test_lp_drops_non_whitelisted_project(lp_pools_json: str) -> None:
    _mock_pools(lp_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_pool_snapshots(client)

    assert all(s.meta.protocol != "sushiswap" for s in snapshots)


@respx.mock
@pytest.mark.asyncio
async def test_lp_solana_chain_canonicalised(lp_pools_json: str) -> None:
    _mock_pools(lp_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_pool_snapshots(client)

    kamino = [s for s in snapshots if s.meta.protocol == "kamino-liquidity"]
    assert len(kamino) == 1
    assert kamino[0].meta.chain == "solana"


@respx.mock
@pytest.mark.asyncio
async def test_lp_apy_and_tvl_mapped(lp_pools_json: str) -> None:
    _mock_pools(lp_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_pool_snapshots(client)

    curve_3pool = next(
        s
        for s in snapshots
        if s.meta.protocol == "curve-dex" and s.meta.chain == "ethereum"
    )
    assert curve_3pool.supply_apy == pytest.approx(4.5)
    assert curve_3pool.tvl_usd == pytest.approx(200_000_000.0)
    assert curve_3pool.meta.asset == "USDC-USDT-DAI"


@respx.mock
@pytest.mark.asyncio
async def test_lp_apy_fallback_to_apyBase(lp_pools_json: str) -> None:
    # If `apy` is None we should fall back to apyBase. The fixture doesn't
    # exercise this directly, so build a stub payload here.
    payload = {
        "data": [
            {
                "pool": "p1",
                "chain": "Ethereum",
                "project": "curve-dex",
                "symbol": "USDC-USDT",
                "stablecoin": True,
                "exposure": "multi",
                "tvlUsd": 1_000_000.0,
                "apy": None,
                "apyBase": 2.7,
            }
        ]
    }
    respx.get(_POOLS_URL).mock(
        return_value=httpx.Response(200, content=json.dumps(payload).encode())
    )
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_pool_snapshots(client)

    assert len(snapshots) == 1
    assert snapshots[0].supply_apy == pytest.approx(2.7)
