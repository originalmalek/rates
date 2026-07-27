export interface SnapshotMeta {
  protocol: string;
  chain: string;
  asset: string;
  /**
   * DeFi Llama's pool UUID — the only field that identifies a series
   * uniquely. (protocol, chain, asset) repeats: kamino-lend/solana/USDC
   * alone is 17 distinct markets. Use this for links, keys and grouping.
   */
  pool_id: string;
}

export interface BaseSnapshot {
  ts: string;
  meta: SnapshotMeta;
  supply_apy: number | null;
  tvl_usd: number | null;
}

export interface RateSnapshot extends BaseSnapshot {
  borrow_apy: number | null;
  utilization: number | null;
}

export type PoolSnapshot = BaseSnapshot;

export interface VaultMeta extends SnapshotMeta {
  /**
   * DeFi Llama's raw symbol — the curator's product name (`steakUSDC`,
   * `gtUSDCcore`). `asset` holds the underlying stablecoin instead, so the
   * asset filter groups vaults the way the other tabs group markets.
   */
  vault_name: string;
}

export interface VaultSnapshot extends BaseSnapshot {
  meta: VaultMeta;
  /** Organic yield alone. `supply_apy` is the total (base + rewards). */
  apy_base: number | null;
  /** Farm incentives — these end, so they're shown apart from the headline. */
  apy_reward: number | null;
  apy_mean_30d: number | null;
}
