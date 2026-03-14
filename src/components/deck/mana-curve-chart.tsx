'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ManaCurveCard {
  cmc: number | string | null
}

interface ManaCurveChartProps {
  cards: ManaCurveCard[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CMC_BUCKETS = [0, 1, 2, 3, 4, 5, 6, 7] as const

function buildCurveData(cards: ManaCurveCard[]) {
  const counts: Record<number, number> = {}
  for (const bucket of CMC_BUCKETS) counts[bucket] = 0

  for (const card of cards) {
    const raw = typeof card.cmc === 'string' ? parseFloat(card.cmc) : (card.cmc ?? 0)
    const cmc = isNaN(raw) ? 0 : Math.round(raw)
    const bucket = cmc >= 7 ? 7 : cmc
    counts[bucket] = (counts[bucket] ?? 0) + 1
  }

  return CMC_BUCKETS.map((bucket) => ({
    cmc: bucket === 7 ? '7+' : String(bucket),
    count: counts[bucket],
  }))
}

// ─── Gradient stops ───────────────────────────────────────────────────────────

const BAR_COLORS = [
  '#94a3b8', // 0 — slate-400
  '#7dd3fc', // 1 — sky-300
  '#60a5fa', // 2 — blue-400
  '#3b82f6', // 3 — blue-500
  '#2563eb', // 4 — blue-600
  '#1d4ed8', // 5 — blue-700
  '#1e3a8a', // 6 — blue-900
  '#0f172a', // 7+ — slate-950
]

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ManaCurveTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <span className="font-medium text-foreground">CMC {label}</span>
      <span className="ml-2 text-muted-foreground">{payload[0].value} card{payload[0].value !== 1 ? 's' : ''}</span>
    </div>
  )
}

// ─── ManaCurveChart ───────────────────────────────────────────────────────────

export function ManaCurveChart({ cards }: ManaCurveChartProps) {
  const data = buildCurveData(cards)

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
        barCategoryGap="20%"
      >
        <defs>
          <linearGradient id="manaCurveGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="cmc"
          tick={{ fontSize: 10, fill: 'currentColor', className: 'text-muted-foreground' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: 'currentColor', className: 'text-muted-foreground' }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip content={<ManaCurveTooltip />} cursor={{ fill: 'transparent' }} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={BAR_COLORS[index] ?? '#3b82f6'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
