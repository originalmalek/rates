import json
from pathlib import Path

import pytest
import respx
import httpx

from app.config import canonical_chain
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


def _mock_apis(pools_json: str, lb_json: str) -> None:
    respx.get(_POOLS_URL).mock(
        return_value=httpx.Response(200, content=pools_json.encode())
    )
    respx.get(_LEND_BORROW_URL).mock(
        return_value=httpx.Response(200, content=lb_json.encode())
    )


@respx.mock
@pytest.mark.asyncio
async def test_aave_multichain_pools_pass(pools_json: str, lb_json: str) -> None:
    """AAVE v3 should pull from every whitelisted chain."""
    _mock_apis(pools_json, lb_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    aave_chains = {
        s.meta.chain for s in snapshots if s.meta.protocol == "aave-v3"
    }
    # Fixture has aave on Ethereum, Arbitrum, OP Mainnet, BSC, Mantle
    assert aave_chains == {"ethereum", "arbitrum", "optimism", "bnb", "mantle"}


@respx.mock
@pytest.mark.asyncio
async def test_pool_id_carried_into_meta(pools_json: str, lb_json: str) -> None:
    """pool_id is what makes a series unique — the parser must not drop it."""
    _mock_apis(pools_json, lb_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    assert all(s.meta.pool_id for s in snapshots)
    # And it must be unique: the whole point of adding it to the key.
    ids = [s.meta.pool_id for s in snapshots]
    assert len(ids) == len(set(ids))

    aave_usdc_eth = next(
        s for s in snapshots
        if s.meta.protocol == "aave-v3"
        and s.meta.asset == "USDC"
        and s.meta.chain == "ethereum"
    )
    assert aave_usdc_eth.meta.pool_id == "pool-aave-usdc-eth"


def test_multiword_chain_name_hyphenated() -> None:
    """Chain names must never carry a space — they travel in CSV query params."""
    assert canonical_chain("Robinhood Chain") == "robinhood-chain"
    assert canonical_chain("Monad") == "monad"


@respx.mock
@pytest.mark.asyncio
async def test_compound_all_chains_kept(pools_json: str, lb_json: str) -> None:
    """Whitelisting is per-protocol: every chain a listed protocol reports counts.

    compound-v3 used to be pinned to Ethereum, which silently hid its Base,
    Arbitrum, Polygon, Optimism and Scroll markets.
    """
    _mock_apis(pools_json, lb_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    compound_chains = {
        s.meta.chain for s in snapshots if s.meta.protocol == "compound-v3"
    }
    assert compound_chains == {"ethereum", "base"}


@respx.mock
@pytest.mark.asyncio
async def test_unknown_protocol_filtered(pools_json: str, lb_json: str) -> None:
    _mock_apis(pools_json, lb_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    protocols = {s.meta.protocol for s in snapshots}
    assert "some-unknown-protocol" not in protocols


@respx.mock
@pytest.mark.asyncio
async def test_non_stablecoin_pool_filtered(pools_json: str, lb_json: str) -> None:
    """Pool with `stablecoin: false` (e.g. ETH) must be skipped."""
    _mock_apis(pools_json, lb_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    assets = {s.meta.asset for s in snapshots}
    assert "ETH" not in assets


@respx.mock
@pytest.mark.asyncio
async def test_bridged_token_kept_distinct(pools_json: str, lb_json: str) -> None:
    """USDC.E on Arbitrum is a separate asset from USDC."""
    _mock_apis(pools_json, lb_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    arb_assets = {
        s.meta.asset for s in snapshots if s.meta.chain == "arbitrum"
    }
    assert arb_assets == {"USDC", "USDC.E"}


@respx.mock
@pytest.mark.asyncio
async def test_chain_alias_canonicalised(pools_json: str, lb_json: str) -> None:
    """`OP Mainnet` → `optimism`, `BSC` → `bnb`."""
    _mock_apis(pools_json, lb_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    chains = {s.meta.chain for s in snapshots}
    # Raw names should never appear
    assert "op mainnet" not in chains
    assert "bsc" not in chains
    # Canonical names should
    assert "optimism" in chains
    assert "bnb" in chains


@respx.mock
@pytest.mark.asyncio
async def test_apy_values_not_divided_by_100(
    pools_json: str, lb_json: str
) -> None:
    """DeFi Llama returns percent directly — 5.2 means 5.2%, not 0.052."""
    _mock_apis(pools_json, lb_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    aave_usdc_eth = next(
        s for s in snapshots
        if s.meta.protocol == "aave-v3"
        and s.meta.asset == "USDC"
        and s.meta.chain == "ethereum"
    )
    assert aave_usdc_eth.supply_apy == pytest.approx(5.2)
    assert aave_usdc_eth.borrow_apy == pytest.approx(6.41)


@respx.mock
@pytest.mark.asyncio
async def test_spark_borrow_apy_is_none_not_zero(
    pools_json: str, lb_json: str
) -> None:
    """Spark has apyBaseBorrow=null in fixture — must be None, not 0.

    Slug is `sparklend`; plain `spark` does not exist in DeFi Llama and
    matched nothing for months.
    """
    _mock_apis(pools_json, lb_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    spark_dai = next(
        s for s in snapshots
        if s.meta.protocol == "sparklend" and s.meta.asset == "DAI"
    )
    assert spark_dai.borrow_apy is None


@respx.mock
@pytest.mark.asyncio
async def test_utilization_is_always_none(
    pools_json: str, lb_json: str
) -> None:
    _mock_apis(pools_json, lb_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    assert all(s.utilization is None for s in snapshots)


@respx.mock
@pytest.mark.asyncio
async def test_tvl_mapped_correctly(pools_json: str, lb_json: str) -> None:
    _mock_apis(pools_json, lb_json)
    async with httpx.AsyncClient() as client:
        snapshots = await fetch_snapshots(client)

    compound_usdt = next(
        s for s in snapshots
        if s.meta.protocol == "compound-v3" and s.meta.asset == "USDT"
    )
    assert compound_usdt.tvl_usd == pytest.approx(120_000_000.0)
