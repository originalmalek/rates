from datetime import datetime

from pydantic import BaseModel


class SnapshotMeta(BaseModel):
    protocol: str
    chain: str
    asset: str
    # DeFi Llama's pool UUID. Without it the series key is ambiguous:
    # (protocol, chain, asset) maps to several distinct markets — 17 separate
    # kamino-lend/solana/USDC pools, 10 midas-rwa/Ethereum/USDC funds — and
    # get_latest_all() would surface an arbitrary one of them as the whole
    # series. It is stable across collection cycles, so history keys off it.
    pool_id: str


class RateSnapshot(BaseModel):
    ts: datetime  # UTC naive
    meta: SnapshotMeta
    supply_apy: float | None
    borrow_apy: float | None
    utilization: float | None  # 0..1
    tvl_usd: float | None


class PoolSnapshot(BaseModel):
    ts: datetime  # UTC naive
    meta: SnapshotMeta  # asset holds the LP symbol e.g. "USDC-USDT"
    supply_apy: float | None  # LP yield (fees + rewards), percent
    tvl_usd: float | None


class VaultMeta(SnapshotMeta):
    """Series identity for a yield vault.

    `asset` holds the *underlying* stablecoin (USDC for `steakUSDC`) so the
    asset filter behaves like the other tabs; `vault_name` keeps DeFi Llama's
    raw symbol, which is what a user recognises. When the underlying can't be
    read off the symbol both fields hold the raw symbol — an honest fallback
    beats a wrong guess.
    """

    vault_name: str


class VaultSnapshot(BaseModel):
    ts: datetime  # UTC naive
    meta: VaultMeta
    # Named supply_apy (not `apy`) to match the other two collections — the
    # frontend's shared table/chart/sparkline components key off this field.
    supply_apy: float | None  # total APY = base + rewards, percent
    apy_base: float | None  # organic yield alone, percent
    apy_reward: float | None  # farm incentives, percent — these evaporate
    apy_mean_30d: float | None  # 30-day mean, percent; smooths a spiky headline
    tvl_usd: float | None


class RateSnapshotsPage(BaseModel):
    items: list[RateSnapshot]
    total: int


class PoolSnapshotsPage(BaseModel):
    items: list[PoolSnapshot]
    total: int


class VaultSnapshotsPage(BaseModel):
    items: list[VaultSnapshot]
    total: int
