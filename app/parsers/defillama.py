"""DeFi Llama Yields parser.

Fetches supply data from /pools and borrow data from /lendBorrow,
then emits RateSnapshot objects. Filters:

- protocol must be whitelisted in app/config/protocols.py
- chain (after canonicalisation) must be enabled for that protocol
- pool must be flagged `stablecoin: true` by DeFi Llama
"""

from datetime import datetime

import httpx

from app.config import (
    VAULT_MIN_TVL_USD,
    canonical_chain,
    is_liquidity_supported,
    is_supported,
    is_vault_supported,
)
from app.models import PoolSnapshot, RateSnapshot, SnapshotMeta, VaultMeta, VaultSnapshot

_POOLS_URL = "https://yields.llama.fi/pools"
_LEND_BORROW_URL = "https://yields.llama.fi/lendBorrow"

# Vault symbols are curator brand names wrapped around a deposit token:
# `steakUSDC`, `gtUSDCcore`, `skyMoneyUSDSFlagship`. The underlying is
# recoverable by substring, which is what makes the asset filter useful —
# otherwise every vault is its own one-row "asset".
#
# ORDER IS SIGNIFICANT: the first hit wins, so a symbol that contains another
# must come first. `USDT0` before `USDT` (else `bitgetUSDT0` reads as USDT),
# `USDC` before `AUSD` (else `aUSDC` reads as AUSD). Only add a short entry
# after checking it can't appear inside an unrelated symbol — `USP` was left
# out for exactly that reason (it hides inside `gamicUSPC`).
_UNDERLYING_STABLES: tuple[str, ...] = (
    "USDT0",
    "FRXUSD",
    "CRVUSD",
    "PYUSD",
    "RLUSD",
    "REUSD",
    "USDC",
    "USDT",
    "USDE",
    "USDS",
    "USDG",
    "USD0",
    "USD3",
    "AUSD",
    "EURC",
    "XSGD",
    "TGBP",
    "DAI",
)


def underlying_stablecoin(symbol: str) -> str:
    """Deposit token behind a vault symbol, or the symbol itself if unclear.

    ~85% of vaults resolve; the rest are genuinely exotic stables (`BOLD`,
    `synUSD`, `yvUSD`) that are their own underlying anyway, so echoing the
    symbol is both correct-looking and honest.
    """
    upper = symbol.upper()
    for stable in _UNDERLYING_STABLES:
        if stable in upper:
            return stable
    return symbol


def _is_whitelisted(pool: dict) -> bool:  # type: ignore[type-arg]
    if pool.get("stablecoin") is not True:
        return False
    project = pool.get("project", "")
    chain = canonical_chain(pool.get("chain", ""))
    return is_supported(project, chain)


def _is_liquidity_pool(pool: dict) -> bool:  # type: ignore[type-arg]
    if pool.get("stablecoin") is not True:
        return False
    if pool.get("exposure") != "multi":
        return False
    project = pool.get("project", "")
    chain = canonical_chain(pool.get("chain", ""))
    return is_liquidity_supported(project, chain)


async def fetch_snapshots(client: httpx.AsyncClient) -> list[RateSnapshot]:
    pools_resp, lb_resp = await _fetch_both(client)

    # Build borrow APY lookup: pool_id -> borrow_apy
    borrow_by_pool: dict[str, float | None] = {}
    for entry in lb_resp:
        pool_id = entry.get("pool")
        if pool_id is None:
            continue
        borrow_apy = entry.get("apyBaseBorrow")
        borrow_by_pool[pool_id] = float(borrow_apy) if borrow_apy is not None else None

    ts = datetime.utcnow()
    snapshots: list[RateSnapshot] = []

    for pool in pools_resp:
        if not _is_whitelisted(pool):
            continue

        pool_id = pool.get("pool") or ""
        if not pool_id:
            # No id means no stable series key — we'd be unable to tell this
            # market apart from its siblings on the same protocol/chain/asset.
            continue
        symbol = pool.get("symbol", "")

        # supply_apy: prefer apy, fall back to apyBase
        raw_apy = pool.get("apy") if pool.get("apy") is not None else pool.get("apyBase")
        supply_apy = float(raw_apy) if raw_apy is not None else None

        borrow_apy = borrow_by_pool.get(pool_id)

        tvl_raw = pool.get("tvlUsd")
        tvl_usd = float(tvl_raw) if tvl_raw is not None else None

        snapshot = RateSnapshot(
            ts=ts,
            meta=SnapshotMeta(
                protocol=pool["project"],
                chain=canonical_chain(pool["chain"]),
                asset=symbol,
                pool_id=pool_id,
            ),
            supply_apy=supply_apy,
            borrow_apy=borrow_apy,
            utilization=None,
            tvl_usd=tvl_usd,
        )
        snapshots.append(snapshot)

    return snapshots


async def _fetch_both(
    client: httpx.AsyncClient,
) -> tuple[list[dict], list[dict]]:  # type: ignore[type-arg]
    pools_resp = await client.get(_POOLS_URL)
    pools_resp.raise_for_status()
    pools_data = pools_resp.json()
    pools: list[dict] = pools_data.get("data", pools_data)  # type: ignore[type-arg]

    lb_resp = await client.get(_LEND_BORROW_URL)
    lb_resp.raise_for_status()
    lb_data = lb_resp.json()
    lb: list[dict] = lb_data if isinstance(lb_data, list) else lb_data.get("data", [])  # type: ignore[type-arg]

    return pools, lb


def _is_vault(pool: dict) -> bool:  # type: ignore[type-arg]
    if pool.get("stablecoin") is not True:
        return False
    # `single` is what separates a vault from an LP position: one deposit
    # token, no impermanent loss.
    if pool.get("exposure") != "single":
        return False
    if (pool.get("tvlUsd") or 0) < VAULT_MIN_TVL_USD:
        return False
    project = pool.get("project", "")
    chain = canonical_chain(pool.get("chain", ""))
    return is_vault_supported(project, chain)


async def fetch_vault_snapshots(client: httpx.AsyncClient) -> list[VaultSnapshot]:
    """Fetch stablecoin yield vaults (single-exposure, curated) from DeFi Llama."""
    pools_resp = await client.get(_POOLS_URL)
    pools_resp.raise_for_status()
    pools_data = pools_resp.json()
    pools: list[dict] = pools_data.get("data", pools_data)  # type: ignore[type-arg]

    ts = datetime.utcnow()
    snapshots: list[VaultSnapshot] = []

    for pool in pools:
        if not _is_vault(pool):
            continue

        pool_id = pool.get("pool") or ""
        if not pool_id:
            continue
        symbol = pool.get("symbol", "")

        # Vault APY splits three ways and the split is the point: a 15%
        # headline that is 12% `apyReward` is a farm that ends. Keep all
        # three and let the UI show the difference.
        raw_apy = pool.get("apy") if pool.get("apy") is not None else pool.get("apyBase")
        supply_apy = float(raw_apy) if raw_apy is not None else None
        apy_base = _opt_float(pool.get("apyBase"))
        apy_reward = _opt_float(pool.get("apyReward"))
        apy_mean_30d = _opt_float(pool.get("apyMean30d"))
        tvl_usd = _opt_float(pool.get("tvlUsd"))

        snapshots.append(
            VaultSnapshot(
                ts=ts,
                meta=VaultMeta(
                    protocol=pool["project"],
                    chain=canonical_chain(pool["chain"]),
                    asset=underlying_stablecoin(symbol),
                    pool_id=pool_id,
                    vault_name=symbol,
                ),
                supply_apy=supply_apy,
                apy_base=apy_base,
                apy_reward=apy_reward,
                apy_mean_30d=apy_mean_30d,
                tvl_usd=tvl_usd,
            )
        )

    return snapshots


def _opt_float(value: object) -> float | None:
    """DeFi Llama uses null for 'not reported' — never coerce that to 0."""
    return float(value) if isinstance(value, (int, float)) else None


async def fetch_pool_snapshots(client: httpx.AsyncClient) -> list[PoolSnapshot]:
    """Fetch stablecoin LP pools (multi-token, AMM/DEX) from DeFi Llama."""
    pools_resp = await client.get(_POOLS_URL)
    pools_resp.raise_for_status()
    pools_data = pools_resp.json()
    pools: list[dict] = pools_data.get("data", pools_data)  # type: ignore[type-arg]

    ts = datetime.utcnow()
    snapshots: list[PoolSnapshot] = []

    for pool in pools:
        if not _is_liquidity_pool(pool):
            continue

        pool_id = pool.get("pool") or ""
        if not pool_id:
            continue
        symbol = pool.get("symbol", "")
        raw_apy = pool.get("apy") if pool.get("apy") is not None else pool.get("apyBase")
        supply_apy = float(raw_apy) if raw_apy is not None else None

        tvl_raw = pool.get("tvlUsd")
        tvl_usd = float(tvl_raw) if tvl_raw is not None else None

        snapshots.append(
            PoolSnapshot(
                ts=ts,
                meta=SnapshotMeta(
                    protocol=pool["project"],
                    chain=canonical_chain(pool["chain"]),
                    asset=symbol,
                    pool_id=pool_id,
                ),
                supply_apy=supply_apy,
                tvl_usd=tvl_usd,
            )
        )

    return snapshots
