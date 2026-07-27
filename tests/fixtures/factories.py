"""Shared test fixture factories for snapshot models."""

from datetime import datetime

from app.models import (
    PoolSnapshot,
    RateSnapshot,
    SnapshotMeta,
    VaultMeta,
    VaultSnapshot,
)


def make_rate_snapshot(
    protocol: str = "aave-v3",
    chain: str = "ethereum",
    asset: str = "USDC",
    supply_apy: float | None = 5.2,
    borrow_apy: float | None = 6.41,
    tvl_usd: float | None = 500_000_000.0,
    ts: datetime | None = None,
    pool_id: str | None = None,
) -> RateSnapshot:
    if ts is None:
        ts = datetime.utcnow()
    if pool_id is None:
        # Derived so that two calls with the same triple land in the same
        # series, mirroring how DeFi Llama keeps a pool id stable over time.
        pool_id = f"{protocol}:{chain}:{asset}"
    return RateSnapshot(
        ts=ts,
        meta=SnapshotMeta(
            protocol=protocol, chain=chain, asset=asset, pool_id=pool_id
        ),
        supply_apy=supply_apy,
        borrow_apy=borrow_apy,
        utilization=None,
        tvl_usd=tvl_usd,
    )


def make_pool_snapshot(
    protocol: str = "curve-dex",
    chain: str = "ethereum",
    asset: str = "USDC-USDT-DAI",
    supply_apy: float | None = 4.5,
    tvl_usd: float | None = 200_000_000.0,
    ts: datetime | None = None,
    pool_id: str | None = None,
) -> PoolSnapshot:
    if ts is None:
        ts = datetime.utcnow()
    if pool_id is None:
        pool_id = f"{protocol}:{chain}:{asset}"
    return PoolSnapshot(
        ts=ts,
        meta=SnapshotMeta(
            protocol=protocol, chain=chain, asset=asset, pool_id=pool_id
        ),
        supply_apy=supply_apy,
        tvl_usd=tvl_usd,
    )


def make_vault_snapshot(
    protocol: str = "morpho-blue",
    chain: str = "ethereum",
    asset: str = "USDC",
    vault_name: str = "steakUSDC",
    supply_apy: float | None = 7.4,
    apy_base: float | None = 5.1,
    apy_reward: float | None = 2.3,
    apy_mean_30d: float | None = 6.8,
    tvl_usd: float | None = 450_000_000.0,
    ts: datetime | None = None,
    pool_id: str | None = None,
) -> VaultSnapshot:
    if ts is None:
        ts = datetime.utcnow()
    if pool_id is None:
        # Vault names repeat across chains and curators reuse them, so key the
        # synthetic id off the name too — otherwise two fixtures that differ
        # only by vault_name would collapse into one series.
        pool_id = f"{protocol}:{chain}:{vault_name}"
    return VaultSnapshot(
        ts=ts,
        meta=VaultMeta(
            protocol=protocol,
            chain=chain,
            asset=asset,
            pool_id=pool_id,
            vault_name=vault_name,
        ),
        supply_apy=supply_apy,
        apy_base=apy_base,
        apy_reward=apy_reward,
        apy_mean_30d=apy_mean_30d,
        tvl_usd=tvl_usd,
    )
