'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColorChartCard {
  colors: string[]
}

interface ColorChartProps {
  cards: ColorChartCard[]
}

// ─── MTG color config ─────────────────────────────────────────────────────────

const MTG_COLOR_CONFIG = [
  { symbol: 'W', label: 'White',     hex: '#F0E8C8' },
  { symbol: 'U', label: 'Blue',      hex: '#0E68AB' },
  { symbol: 'B', label: 'Black',     hex: '#4a4a4a' },
  { symbol: 'R', label: 'Red',       hex: '#D3202A' },
  { symbol: 'G', label: 'Green',     hex: '#00733E' },
  { symbol: 'C', label: 'Colorless', hex: '#9b9490' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildColorData(cards: ColorChartCard[]) {
  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }

  for (const card of cards) {
    if (!card.colors || card.colors.length === 0) {
      counts['C']++
    } else {
      for (const color of card.colors) {
        if (color in counts) counts[color]++
      }
    }
  }

  return MTG_COLOR_CONFIG
    .map(({ symbol, label, hex }) => ({
      symbol,
      label,
      hex,
      value: counts[symbol] ?? 0,
    }))
    .filter((entry) => entry.value > 0)
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ColorTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { symbol: string } }>
}) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <span className="font-medium text-foreground">{entry.name}</span>
      <span className="ml-2 text-muted-foreground">{entry.value} pip{entry.value !== 1 ? 's' : ''}</span>
    </div>
  )
}

// ─── Custom Legend ─────────────────────────────────────────────────────────────

function ColorLegend({ payload }: {
  payload?: Array<{ value: string; color: string; payload: { symbol: string; value: number } }>
}) {
  if (!payload?.length) return null
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
      {payload.map((entry) => (
        <div key={entry.payload.symbol} className="flex items-center gap-1">
          <span
            className="inline-block size-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[10px] text-muted-foreground leading-none">
            {entry.value} <span className="font-medium text-foreground tabular-nums">{entry.payload.value}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── ColorChart ───────────────────────────────────────────────────────────────

export function ColorChart({ cards }: ColorChartProps) {
  const data = buildColorData(cards)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[150px] text-xs text-muted-foreground">
        No color data
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={150}>
      <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="42%"
          outerRadius={48}
          innerRadius={22}
          strokeWidth={1}
          stroke="var(--background)"
        >
          {data.map((entry) => (
            <Cell key={entry.symbol} fill={entry.hex} />
          ))}
        </Pie>
        <Tooltip content={<ColorTooltip />} />
        <Legend content={<ColorLegend />} />
      </PieChart>
    </ResponsiveContainer>
  )
}
