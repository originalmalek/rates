"""Protocol whitelist for the DeFi Llama parser.

We whitelist *protocols*, not chains: every chain DeFi Llama serves for a
listed protocol is collected. Restricting chains meant a new deployment
(Monad on AAVE v3, Arbitrum on Sky) stayed invisible until someone noticed
and edited a frozenset by hand, which is exactly what happened.

Asset filtering uses DeFi Llama's `stablecoin: true` flag — no manual
asset whitelist. Symbols are kept verbatim, so bridged variants
(USDC.E, DAI.E, USD₮0) stay distinct from native tokens.

Slugs must match DeFi Llama's `project` field exactly. A slug that doesn't
exist there fails silently — it simply matches nothing — so verify against
https://yields.llama.fi/pools before adding one. `spark` was wrong for
months for this reason; the real markets are `sparklend` and
`spark-savings`.
"""

# Lending markets: supply / borrow APY.
PROTOCOLS: frozenset[str] = frozenset(
    {
        "aave-v3",
        "compound-v3",
        "fluid-lending",
        "sparklend",
        "spark-savings",
        "sky-lending",
        "jupiter-lend",
        "kamino-lend",
        "save",
    }
)


# Stablecoin LP / AMM pools (separate from the lending protocols above).
# Filter applied: stablecoin=true AND exposure=multi.
LIQUIDITY_PROTOCOLS: frozenset[str] = frozenset(
    {
        "curve-dex",
        "convex-finance",
        "fluid-dex",
        "uniswap-v3",
        "uniswap-v4",
        "kamino-liquidity",
    }
)


# Yield vaults / curated lending markets: one deposit token, managed by a
# curator. Filter applied: stablecoin=true AND exposure=single AND
# tvlUsd >= VAULT_MIN_TVL_USD.
#
# These are *not* in PROTOCOLS: a vault is a different product from a money
# market — no borrow side, and its headline APY is usually a curator's blend
# of several markets. Keeping the sets disjoint also stops a pool showing up
# on two tabs.
VAULT_PROTOCOLS: frozenset[str] = frozenset(
    {
        "morpho-blue",
        "euler-v2",
        "yearn-finance",
        "curve-llamalend",
        "midas-rwa",
        "centrifuge-protocol",
        "ember-protocol",
        "resupply",
        "silo-v2",
        "fraxlend",
        "curvance",
        "lagoon",
        "fusion-by-ipor",
        "harvest-finance",
        "wildcat-protocol",
        "accountable",
        "strata-markets",
    }
)

# Vaults have a long tail of dust: 686 pools carry the flags, but below $1M
# most are test deployments or abandoned curators whose APY is noise.
VAULT_MIN_TVL_USD = 1_000_000.0


# DeFi Llama uses some non-canonical chain names — map them to ours.
# Anything not in this map is lower-cased and space-joined with hyphens
# ("Robinhood Chain" -> "robinhood-chain"), so a chain name never carries a
# space into `meta.chain` or a CSV query param.
_CHAIN_ALIASES: dict[str, str] = {
    "OP Mainnet": "optimism",
    "BSC": "bnb",
    "Solana": "solana",
}


def canonical_chain(name: str) -> str:
    """Convert a DeFi Llama chain name to our canonical lowercase form."""
    alias = _CHAIN_ALIASES.get(name)
    if alias is not None:
        return alias
    return "-".join(name.lower().split())


def is_supported(project: str, chain: str) -> bool:
    """Whether `project` is a whitelisted lending protocol.

    `chain` is accepted and ignored: every chain the protocol reports counts.
    """
    return project in PROTOCOLS


def is_liquidity_supported(project: str, chain: str) -> bool:
    """Whether `project` is a whitelisted LP protocol. `chain` is ignored."""
    return project in LIQUIDITY_PROTOCOLS


def is_vault_supported(project: str, chain: str) -> bool:
    """Whether `project` is a whitelisted vault protocol. `chain` is ignored."""
    return project in VAULT_PROTOCOLS
