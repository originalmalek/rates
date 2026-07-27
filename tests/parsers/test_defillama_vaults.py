import json
from pathlib import Path

import httpx
import pytest
import respx

from app.parsers.defillama import (
    _POOLS_URL,
    fetch_vault_snapshots,
    underlying_stablecoin,
)

FIXTURES = Path(__file__).parent.parent / "fixtures"


@pytest.fixture
def vault_pools_json() -> str:
    return (FIXTURES / "defillama_vault_pools.json").read_text()


def _mock_pools(vault_pools_json: str) -> None:
    respx.get(_POOLS_URL).mock(
        return_value=httpx.Response(200, content=vault_pools_json.encode())
    )


@respx.mock
@pytest.mark.asyncio
async def test_vault_whitelisted_protocols_pass(vault_pools_json: str) -> None:
    _mock_pools(vault_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    projects = {s.meta.protocol for s in snapshots}
    assert projects == {"morpho-blue", "euler-v2", "yearn-finance"}


@respx.mock
@pytest.mark.asyncio
async def test_vault_drops_multi_exposure(vault_pools_json: str) -> None:
    """exposure=multi is an LP position — it belongs on the Pools tab."""
    _mock_pools(vault_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    assert all(s.meta.vault_name != "USDC-USDT" for s in snapshots)


@respx.mock
@pytest.mark.asyncio
async def test_vault_drops_non_stablecoin(vault_pools_json: str) -> None:
    _mock_pools(vault_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    assert all(s.meta.vault_name != "eWETH-1" for s in snapshots)


@respx.mock
@pytest.mark.asyncio
async def test_vault_drops_below_tvl_floor(vault_pools_json: str) -> None:
    """$250k of TVL at 41% APY is noise, not an opportunity."""
    _mock_pools(vault_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    assert all(s.meta.vault_name != "dustUSDC" for s in snapshots)


@respx.mock
@pytest.mark.asyncio
async def test_vault_drops_lending_protocol(vault_pools_json: str) -> None:
    """aave-v3 is single-exposure too, but it's a money market — Lending tab."""
    _mock_pools(vault_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    assert all(s.meta.protocol != "aave-v3" for s in snapshots)


@respx.mock
@pytest.mark.asyncio
async def test_vault_apy_split_preserved(vault_pools_json: str) -> None:
    _mock_pools(vault_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    steak = next(s for s in snapshots if s.meta.vault_name == "steakUSDC")
    assert steak.supply_apy == pytest.approx(7.4)
    assert steak.apy_base == pytest.approx(5.1)
    assert steak.apy_reward == pytest.approx(2.3)
    assert steak.apy_mean_30d == pytest.approx(6.8)
    assert steak.tvl_usd == pytest.approx(450_000_000.0)


@respx.mock
@pytest.mark.asyncio
async def test_vault_missing_apy_fields_stay_none(vault_pools_json: str) -> None:
    """null means 'not reported' — coercing it to 0 would invent a fact."""
    _mock_pools(vault_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    euler = next(s for s in snapshots if s.meta.vault_name == "eUSDC-2")
    assert euler.apy_reward is None
    assert euler.apy_mean_30d == pytest.approx(5.2)

    bold = next(s for s in snapshots if s.meta.vault_name == "BOLD")
    assert bold.apy_mean_30d is None


@respx.mock
@pytest.mark.asyncio
async def test_vault_underlying_and_name_split(vault_pools_json: str) -> None:
    _mock_pools(vault_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    by_name = {s.meta.vault_name: s for s in snapshots}
    assert by_name["steakUSDC"].meta.asset == "USDC"
    assert by_name["eUSDC-2"].meta.asset == "USDC"
    assert by_name["yvDAI-1"].meta.asset == "DAI"
    # No known stablecoin hides in "BOLD", so it stands as its own underlying.
    assert by_name["BOLD"].meta.asset == "BOLD"


@respx.mock
@pytest.mark.asyncio
async def test_vault_chain_canonicalised(vault_pools_json: str) -> None:
    _mock_pools(vault_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    bold = next(s for s in snapshots if s.meta.vault_name == "BOLD")
    assert bold.meta.chain == "optimism"


@respx.mock
@pytest.mark.asyncio
async def test_vault_pool_id_carried_into_meta(vault_pools_json: str) -> None:
    _mock_pools(vault_pools_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    assert snapshots
    ids = [s.meta.pool_id for s in snapshots]
    assert all(ids)
    assert len(ids) == len(set(ids))


@respx.mock
@pytest.mark.asyncio
async def test_vault_apy_falls_back_to_apyBase() -> None:
    payload = {
        "data": [
            {
                "pool": "v1",
                "chain": "Ethereum",
                "project": "morpho-blue",
                "symbol": "steakUSDT",
                "stablecoin": True,
                "exposure": "single",
                "tvlUsd": 5_000_000.0,
                "apy": None,
                "apyBase": 3.9,
            }
        ]
    }
    respx.get(_POOLS_URL).mock(
        return_value=httpx.Response(200, content=json.dumps(payload).encode())
    )
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    assert len(snapshots) == 1
    assert snapshots[0].supply_apy == pytest.approx(3.9)


@respx.mock
@pytest.mark.asyncio
async def test_vault_without_id_is_skipped() -> None:
    payload = {
        "data": [
            {
                "chain": "Ethereum",
                "project": "morpho-blue",
                "symbol": "steakUSDC",
                "stablecoin": True,
                "exposure": "single",
                "tvlUsd": 5_000_000.0,
                "apy": 3.0,
            }
        ]
    }
    respx.get(_POOLS_URL).mock(
        return_value=httpx.Response(200, content=json.dumps(payload).encode())
    )
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_vault_snapshots(client)

    assert snapshots == []


@pytest.mark.parametrize(
    ("symbol", "expected"),
    [
        ("steakUSDC", "USDC"),
        ("gtUSDCcore", "USDC"),
        ("aUSDC", "USDC"),  # USDC wins over AUSD — ordering matters
        ("bitgetUSDT0", "USDT0"),  # USDT0 wins over USDT
        ("smokehouseUSDT", "USDT"),
        ("scrvUSD", "CRVUSD"),
        ("yvDAI-1", "DAI"),
        ("re7frxUSD", "FRXUSD"),
        ("AUSD", "AUSD"),
        ("BOLD", "BOLD"),  # unknown stays itself
        ("synUSD", "synUSD"),
    ],
)
def test_underlying_stablecoin(symbol: str, expected: str) -> None:
    assert underlying_stablecoin(symbol) == expected
