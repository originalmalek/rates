// Keys are DeFi Llama project slugs (app/config/protocols.py). Anything not
// listed falls back to the raw slug, so a missing entry is cosmetic only —
// but the labels also feed the dashboard search box, so keep them in sync.
const PROTOCOL_LABELS: Record<string, string> = {
  // lending
  "aave-v3": "AAVE v3",
  "compound-v3": "Compound v3",
  "fluid-lending": "Fluid",
  sparklend: "SparkLend",
  "spark-savings": "Spark Savings",
  "sky-lending": "Sky",
  "jupiter-lend": "Jupiter Lend",
  "kamino-lend": "Kamino Lend",
  save: "Save",
  // liquidity pools
  "curve-dex": "Curve",
  "convex-finance": "Convex",
  "fluid-dex": "Fluid DEX",
  "uniswap-v3": "Uniswap v3",
  "uniswap-v4": "Uniswap v4",
  "kamino-liquidity": "Kamino Liquidity",
  // vaults
  "morpho-blue": "Morpho",
  "euler-v2": "Euler v2",
  "yearn-finance": "Yearn",
  "curve-llamalend": "LlamaLend",
  "midas-rwa": "Midas",
  "centrifuge-protocol": "Centrifuge",
  "ember-protocol": "Ember",
  resupply: "Resupply",
  "silo-v2": "Silo v2",
  fraxlend: "Fraxlend",
  curvance: "Curvance",
  lagoon: "Lagoon",
  "fusion-by-ipor": "IPOR Fusion",
  "harvest-finance": "Harvest",
  "wildcat-protocol": "Wildcat",
  accountable: "Accountable",
  "strata-markets": "Strata",
};

// Chains arrive from DeFi Llama via `canonical_chain()`, so this map only
// exists for names the auto-capitalising fallback gets wrong (BNB, MegaETH,
// X Layer, multi-word names). New chains appear on their own now that the
// backend whitelists protocols rather than chains.
const CHAIN_LABELS: Record<string, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  base: "Base",
  polygon: "Polygon",
  avalanche: "Avalanche",
  bnb: "BNB",
  gnosis: "Gnosis",
  linea: "Linea",
  mantle: "Mantle",
  celo: "Celo",
  sonic: "Sonic",
  aptos: "Aptos",
  megaeth: "MegaETH",
  plasma: "Plasma",
  solana: "Solana",
  monad: "Monad",
  scroll: "Scroll",
  unichain: "Unichain",
  xlayer: "X Layer",
  "robinhood-chain": "Robinhood Chain",
  fantom: "Fantom",
  fraxtal: "Fraxtal",
  kava: "Kava",
  // Vault chains whose slug the fallback would mangle. The rest
  // (Etherlink, Katana, Pharos, Stable, Sui, Tempo) capitalise correctly
  // on their own and are deliberately absent.
  "hyperliquid-l1": "Hyperliquid",
  "plume-mainnet": "Plume",
};

export function formatProtocol(protocol: string): string {
  return PROTOCOL_LABELS[protocol] ?? protocol;
}

export function formatChain(chain: string): string {
  return CHAIN_LABELS[chain] ?? chain.charAt(0).toUpperCase() + chain.slice(1);
}

export function formatTvl(tvl: number | null): string {
  if (tvl === null) return "—";
  if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(1)}B`;
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(0)}M`;
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(0)}K`;
  return `$${tvl.toFixed(0)}`;
}

export function formatApy(apy: number | null): string {
  if (apy === null) return "—";
  return `${apy.toFixed(2)}%`;
}

export function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
