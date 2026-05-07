const PROTOCOL_LABELS: Record<string, string> = {
  "aave-v3": "AAVE v3",
  "compound-v3": "Compound v3",
  "morpho-blue": "Morpho Blue",
  "fluid-lending": "Fluid",
  "spark": "Spark",
  "sky-lending": "Sky",
};

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
