// Chain accent colors used for badges in the table and lines in the chart.
// Picked to be distinct on a dark background.
const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#627eea",
  arbitrum: "#28a0f0",
  optimism: "#ff0420",
  base: "#0052ff",
  polygon: "#8247e5",
  avalanche: "#e84142",
  bnb: "#f3ba2f",
  gnosis: "#3e6957",
  linea: "#61dfff",
  mantle: "#9bc4cb",
  celo: "#fcff52",
  sonic: "#fe9a4c",
  aptos: "#06d6a0",
  megaeth: "#a78bfa",
  plasma: "#22d3ee",
  solana: "#14f195",
  monad: "#836ef9",
  scroll: "#ecc094",
  unichain: "#ff007a",
  xlayer: "#94a3b8",
  "robinhood-chain": "#00c805",
  // Fantom's own blue is too close to Base; muted variant instead.
  fantom: "#5b8def",
  fraxtal: "#d4d4d8",
  // Kava's brand red collides with Optimism and Avalanche; amber instead.
  kava: "#d97706",
  // Chains the Vaults tab brought in. With 30+ chains in one palette some
  // pairs inevitably read alike (Sui's brand blue sits near Arbitrum's);
  // the label always renders next to the dot, so the dot is a hint, not
  // the identifier.
  etherlink: "#84cc16",
  "hyperliquid-l1": "#97fce4",
  katana: "#fb7185",
  pharos: "#c4b5fd",
  "plume-mainnet": "#f0abfc",
  stable: "#a8a29e",
  sui: "#4da2ff",
  tempo: "#14b8a6",
};

export function chainColor(chain: string): string {
  return CHAIN_COLORS[chain] ?? "#71717a"; // zinc-500 fallback
}
