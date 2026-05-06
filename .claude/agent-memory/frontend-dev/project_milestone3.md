---
name: Milestone 3 frontend scaffold
description: Next.js frontend dashboard at /root/rates/web — stack details, structure, env setup
type: project
---

Milestone 3 frontend is live at /root/rates/web. pnpm create next-app installed Next.js 16.2.4 (not 15 as expected — latest at time of scaffold). Recharts 3.8.1 added separately.

**Why:** The `pnpm create next-app@latest` resolves to whatever is latest at run time.

**How to apply:** When reading docs or checking behavior, verify against Next.js 16, not 15. File structure: app router, no src-dir, @/* import alias.

Structure:
- /web/hooks/useRates.ts — fetches /rates/latest, 60s auto-refresh
- /web/hooks/useHistory.ts — fetches /rates/history/all, 60s auto-refresh
- /web/lib/types.ts — RateSnapshot interface
- /web/lib/format.ts — formatProtocol, formatTvl, formatApy, formatTime
- /web/lib/chartData.ts — buildChartData() transforms snapshots into Recharts-ready series+points
- /web/components/RatesTable.tsx — table grouped by asset, sorted by TVL desc
- /web/components/ApyChart.tsx — Recharts LineChart, one line per protocol+asset

API base URL: NEXT_PUBLIC_API_URL in .env.local = http://95.81.118.170:8000

Dev server runs on port 3000. pnpm binary is at $(npm root -g)/.bin/pnpm — must export PATH before calling.
