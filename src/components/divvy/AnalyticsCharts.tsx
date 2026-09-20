import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  academicCalendar,
  academicKindFill,
  academicKindLabel,
  clampTermToDates,
  clampTermToMonths,
  termsOverlappingDates,
  termsOverlappingMonths,
  type AcademicKind,
} from '@/lib/academic-calendar'
import { MONTH_LABELS } from '@/lib/analytics-period'
import { cn } from '@/lib/utils'
import type {
  MemberSummary,
  RouteStat,
  StationStat,
  WeekdayHourStat,
} from '@/services/api'

const countFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function axisCount(value: number) {
  return countFormatter.format(value)
}

export type PulseMetric = 'trips' | 'member_share' | 'total_duration_hours' | 'estimated_miles_total'

const pulseConfigs = {
  trips: { trips: { label: 'Trips', color: 'var(--chart-1)' } },
  member_share: { member_share: { label: 'Member share', color: 'var(--chart-1)' } },
  total_duration_hours: { total_duration_hours: { label: 'Ride hours', color: 'var(--chart-1)' } },
  estimated_miles_total: { estimated_miles_total: { label: 'Est. miles', color: 'var(--chart-1)' } },
} as const satisfies Record<PulseMetric, ChartConfig>

const pulseMetricLabels: Record<PulseMetric, string> = {
  trips: 'Trips',
  member_share: 'Member %',
  total_duration_hours: 'Hours',
  estimated_miles_total: 'Est. miles',
}

const overlayKinds: AcademicKind[] = ['instruction', 'break', 'exams', 'event']

export function AcademicLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] text-muted-foreground">
      {overlayKinds.map((kind) => (
        <span key={kind} className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[3px] ring-1 ring-border"
            style={{ backgroundColor: academicKindFill[kind] }}
            aria-hidden="true"
          />
          {academicKindLabel[kind]}
        </span>
      ))}
      <span className="text-[10px] uppercase tracking-wider">
        UChicago {academicCalendar.version.replace('uchicago-college-', '')}
      </span>
      <a
        href="#calendar"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('calendar')?.scrollIntoView({ behavior: 'smooth' })
        }}
        className="text-primary underline-offset-2 hover:underline"
      >
        View dates
      </a>
    </div>
  )
}

interface PulseRow {
  periodKey: string
  trips: number
  member_share: number
  total_duration_hours: number
  estimated_miles_total: number | null
}

interface CampusPulseChartProps {
  data: PulseRow[]
  grain: 'month' | 'day'
  selectedKey?: string | null
  brushStartIndex?: number
  brushEndIndex?: number
  showBrush?: boolean
  metric?: PulseMetric
  onMetricChange?: (metric: PulseMetric) => void
  showAcademicCalendar?: boolean
  onPointSelect?: (key: string) => void
}

export function CampusPulseChart({
  data,
  grain,
  selectedKey,
  brushStartIndex = 0,
  brushEndIndex = 0,
  showBrush = false,
  metric = 'trips',
  onMetricChange,
  showAcademicCalendar = true,
  onPointSelect,
}: CampusPulseChartProps) {
  const [startIndex, setStartIndex] = useState(brushStartIndex)
  const [endIndex, setEndIndex] = useState(brushEndIndex)
  const keys = data.map((row) => row.periodKey)
  const terms = showAcademicCalendar
    ? grain === 'day'
      ? termsOverlappingDates(keys)
      : termsOverlappingMonths(keys)
    : []

  const yFormatter = (value: number) => {
    if (metric === 'member_share') return `${value}%`
    return axisCount(value)
  }

  const milesUnavailable = metric === 'estimated_miles_total'
    && data.length > 0
    && data.every((row) => row.estimated_miles_total == null)

  return (
    <div>
      {onMetricChange ? (
        <Tabs value={metric} onValueChange={(value) => onMetricChange(value as PulseMetric)}>
          <TabsList aria-label="Campus pulse metric" className="flex-wrap">
            {(Object.keys(pulseMetricLabels) as PulseMetric[]).map((key) => (
              <TabsTrigger key={key} value={key}>{pulseMetricLabels[key]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <div className={cn('relative', onMetricChange && 'mt-5')}>
      <ChartContainer
        config={pulseConfigs[metric]}
        className="h-[420px] w-full min-w-0"
      >
        <AreaChart
          accessibilityLayer
          data={data}
          margin={{ top: 16, right: 14, left: 0, bottom: 6 }}
          onClick={(state) => {
            const key = state?.activeLabel
            if (typeof key === 'string') onPointSelect?.(key)
          }}
        >
          <CartesianGrid vertical={false} />
          {terms.map((term) => {
            const span = grain === 'day' ? clampTermToDates(term, keys) : clampTermToMonths(term, keys)
            return (
              <ReferenceArea
                key={term.id}
                x1={span.x1}
                x2={span.x2}
                fill={academicKindFill[term.kind]}
                fillOpacity={1}
                ifOverflow="visible"
                strokeOpacity={0}
              />
            )
          })}
          {selectedKey ? (
            <ReferenceLine
              x={selectedKey}
              stroke="var(--chart-3)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          ) : null}
          <XAxis
            dataKey="periodKey"
            tickLine={false}
            axisLine={false}
            minTickGap={grain === 'day' ? 16 : 28}
            interval={grain === 'day' ? 1 : data.length <= 14 ? 0 : 'preserveStartEnd'}
            tickFormatter={(value: string) => {
              if (grain === 'day') return String(Number(value.slice(8)))
              if (data.length <= 14) return MONTH_LABELS[Number(value.slice(5)) - 1] ?? value
              return value.endsWith('-01') ? value.slice(0, 4) : ''
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={yFormatter}
            width={48}
          />
          <ChartTooltip
            cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }}
            content={
              <ChartTooltipContent
                labelFormatter={(label) => {
                  const value = String(label)
                  if (grain === 'day') {
                    return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  }
                  return new Date(`${value}-01T12:00:00`).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                }}
                formatter={(value) => {
                  if (metric === 'member_share') return `${Number(value).toFixed(1)}%`
                  if (metric === 'estimated_miles_total') {
                    if (value == null || Number.isNaN(Number(value))) return 'No miles'
                    return `${Number(value).toLocaleString()} est. mi`
                  }
                  if (metric === 'total_duration_hours') {
                    return `${Number(value).toLocaleString()} hrs`
                  }
                  return Number(value).toLocaleString()
                }}
              />
            }
          />
          <Area
            type="monotone"
            dataKey={metric}
            animationDuration={750}
            stroke={`var(--color-${metric})`}
            fill={`var(--color-${metric})`}
            fillOpacity={0.12}
            strokeWidth={2.5}
            activeDot={{ r: 5, cursor: onPointSelect ? 'pointer' : undefined }}
            style={onPointSelect ? { cursor: 'pointer' } : undefined}
            connectNulls
          />
          {showBrush ? (
            <Brush
              dataKey="periodKey"
              height={26}
              stroke="var(--chart-1)"
              travellerWidth={8}
              startIndex={startIndex}
              endIndex={endIndex}
              onChange={(range) => {
                if (typeof range.startIndex === 'number') setStartIndex(range.startIndex)
                if (typeof range.endIndex === 'number') setEndIndex(range.endIndex)
              }}
              tickFormatter={(value) => String(value).slice(0, 4)}
            />
          ) : null}
        </AreaChart>
      </ChartContainer>
      {milesUnavailable ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8">
          <p className="max-w-sm text-center text-sm leading-6 text-muted-foreground">
            No miles for this view. Divvy did not publish trip coordinates until 2020, so distance cannot be estimated.
          </p>
        </div>
      ) : null}
      </div>
      {showAcademicCalendar && terms.length > 0 ? (
        <div className="mt-3">
          <AcademicLegend />
        </div>
      ) : null}
    </div>
  )
}

export function ActivityPatternsChart({
  series,
  years,
  defaultScope = 'all',
}: {
  series: Record<string, WeekdayHourStat[]>
  years: number[]
  defaultScope?: string
}) {
  const [view, setView] = useState<'hour' | 'weekday'>('hour')
  const [scope, setScope] = useState(defaultScope)

  const chartData = useMemo(() => {
    const data = series[scope] ?? series.all ?? []
    if (view === 'hour') {
      return Array.from({ length: 24 }, (_, hour) => ({
        label: `${String(hour).padStart(2, '0')}:00`,
        trips: data.filter((row) => row.hour === hour).reduce((sum, row) => sum + row.trips, 0),
      }))
    }
    return weekdays.map((label, index) => ({
      label,
      trips: data.filter((row) => row.weekday === index + 1).reduce((sum, row) => sum + row.trips, 0),
    }))
  }, [series, scope, view])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={(value) => setView(value as 'hour' | 'weekday')}>
          <TabsList aria-label="Activity chart grouping">
            <TabsTrigger value="hour">Hour</TabsTrigger>
            <TabsTrigger value="weekday">Weekday</TabsTrigger>
          </TabsList>
        </Tabs>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono text-xs uppercase tracking-wider">Scope</span>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="min-h-9 rounded-full border border-border bg-background px-3 text-sm text-foreground"
            aria-label="Activity pattern year or era"
          >
            <option value="all">All years</option>
            <option value="pre_covid">Pre-COVID</option>
            <option value="post_covid">Post-COVID</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>{year}</option>
            ))}
          </select>
        </label>
      </div>
      <span className="sr-only" aria-live="polite">
        Showing trips grouped by {view === 'hour' ? 'hour of day' : 'weekday'} for {scope}.
      </span>
      <ChartContainer config={{ trips: { label: 'Trips', color: 'var(--chart-1)' } }} className="mt-5 h-[320px] w-full min-w-0">
        <BarChart accessibilityLayer data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={view === 'hour' ? 2 : 0}
            tickFormatter={(value: string) => view === 'weekday' ? value.slice(0, 3) : value}
          />
          <YAxis tickLine={false} axisLine={false} tickFormatter={axisCount} width={48} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="trips" animationDuration={750} fill="var(--color-trips)" radius={[5, 5, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

interface StationRankingChartProps {
  allDay: StationStat[]
  afterDark: StationStat[]
  mode: 'start' | 'end'
}

export function StationRankingChart({ allDay, afterDark, mode }: StationRankingChartProps) {
  const [view, setView] = useState<'all' | 'night'>('all')
  const rows = (view === 'all' ? allDay : afterDark).slice(0, 10).reverse()

  return (
    <div>
      <Tabs value={view} onValueChange={(value) => setView(value as 'all' | 'night')}>
        <TabsList aria-label={`${mode} station time range`}>
          <TabsTrigger value="all">All day</TabsTrigger>
          <TabsTrigger value="night">After 9 pm</TabsTrigger>
        </TabsList>
      </Tabs>
      <span className="sr-only" aria-live="polite">
        Showing {mode} station rankings for {view === 'all' ? 'all day' : 'rides after 9 pm'}.
      </span>
      <ChartContainer config={{ trips: { label: 'Trips', color: 'var(--chart-1)' } }} className="mt-5 h-[390px] w-full min-w-0">
        <BarChart
          accessibilityLayer
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 18, left: 8, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="station"
            tickLine={false}
            axisLine={false}
            width={150}
            tick={{ fontSize: 11 }}
            tickFormatter={(value: string) => value.length > 23 ? `${value.slice(0, 22)}…` : value}
          />
          <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.55 }} content={<ChartTooltipContent />} />
          <Bar dataKey="trips" animationDuration={750} fill="var(--color-trips)" radius={[0, 5, 5, 0]} maxBarSize={22} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

export function RoutesChart({
  data,
  onHoverPair,
}: {
  data: RouteStat[]
  onHoverPair?: (pair: { start_station: string; end_station: string } | null) => void
}) {
  const rows = data.slice(0, 10).map((row) => ({
    ...row,
    route: `${row.start_station} → ${row.end_station}`,
  })).reverse()

  return (
    <ChartContainer config={{ trips: { label: 'Trips', color: 'var(--chart-1)' } }} className="h-[420px] w-full min-w-0">
      <BarChart
        accessibilityLayer
        data={rows}
        layout="vertical"
        margin={{ top: 6, right: 18, left: 8, bottom: 6 }}
        onMouseMove={(state) => {
          const row = state?.activePayload?.[0]?.payload as RouteStat | undefined
          if (row?.start_station && row?.end_station) {
            onHoverPair?.({ start_station: row.start_station, end_station: row.end_station })
          }
        }}
        onMouseLeave={() => onHoverPair?.(null)}
      >
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="route"
          tickLine={false}
          axisLine={false}
          width={190}
          tick={{ fontSize: 10 }}
          tickFormatter={(value: string) => value.length > 34 ? `${value.slice(0, 33)}…` : value}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.55 }}
          content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload.route} />}
        />
        <Bar dataKey="trips" animationDuration={750} fill="var(--color-trips)" radius={[0, 5, 5, 0]} maxBarSize={22} cursor="pointer" />
      </BarChart>
    </ChartContainer>
  )
}

const riderConfig = {
  member: { label: 'Members', color: 'var(--chart-1)' },
  casual: { label: 'Casual riders', color: 'var(--chart-2)' },
  member_share: { label: 'Member share', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function RiderMixChart({
  data,
  selectedKey,
}: {
  data: Array<{ label: string; member: number; casual: number; member_share: number }>
  selectedKey?: string | null
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[320px] items-center text-sm text-muted-foreground">
        Member and casual mix for this view starts in 2020.
      </p>
    )
  }

  return (
    <ChartContainer config={riderConfig} className="h-[320px] w-full min-w-0">
      <ComposedChart accessibilityLayer data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis yAxisId="trips" tickLine={false} axisLine={false} tickFormatter={axisCount} width={48} />
        <YAxis
          yAxisId="share"
          orientation="right"
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}%`}
          width={42}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => name === 'member_share'
                ? `${Number(value).toFixed(1)}%`
                : Number(value).toLocaleString()}
            />
          }
        />
        <Legend />
        <Bar yAxisId="trips" dataKey="member" animationDuration={750} stackId="riders" fill="var(--color-member)" radius={[0, 0, 4, 4]} />
        <Bar yAxisId="trips" dataKey="casual" animationDuration={750} stackId="riders" fill="var(--color-casual)" radius={[4, 4, 0, 0]} />
        <Line yAxisId="share" type="monotone" dataKey="member_share" animationDuration={750} stroke="var(--color-member_share)" strokeWidth={2} dot={false} />
        {selectedKey ? (
          <ReferenceLine yAxisId="trips" x={selectedKey} stroke="var(--chart-3)" strokeDasharray="4 4" />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  )
}

const bikeConfig = {
  classic: { label: 'Classic bikes', color: 'var(--chart-1)' },
  electric: { label: 'Electric bikes', color: 'var(--chart-2)' },
  electric_share: { label: 'Electric share', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function BikeEvolutionChart({
  data,
  selectedKey,
}: {
  data: Array<{ label: string; classic: number; electric: number; electric_share: number | null }>
  selectedKey?: string | null
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[320px] items-center text-sm text-muted-foreground">
        Bike type was not published for this period.
      </p>
    )
  }

  return (
    <ChartContainer config={bikeConfig} className="h-[320px] w-full min-w-0">
      <ComposedChart accessibilityLayer data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis yAxisId="trips" tickLine={false} axisLine={false} tickFormatter={axisCount} width={48} />
        <YAxis
          yAxisId="share"
          orientation="right"
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}%`}
          width={42}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => name === 'electric_share'
                ? `${Number(value).toFixed(1)}%`
                : Number(value).toLocaleString()}
            />
          }
        />
        <Legend />
        <Bar yAxisId="trips" dataKey="classic" animationDuration={750} stackId="bike" fill="var(--color-classic)" radius={[0, 0, 4, 4]} />
        <Bar yAxisId="trips" dataKey="electric" animationDuration={750} stackId="bike" fill="var(--color-electric)" radius={[4, 4, 0, 0]} />
        <Line yAxisId="share" type="monotone" dataKey="electric_share" animationDuration={750} stroke="var(--color-electric_share)" strokeWidth={2} dot={false} />
        {selectedKey ? (
          <ReferenceLine yAxisId="trips" x={selectedKey} stroke="var(--chart-3)" strokeDasharray="4 4" />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  )
}

const savingsConfig = {
  estimated_savings: { label: 'Member savings vs walk-up', color: 'var(--chart-1)' },
} satisfies ChartConfig

const moneyCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function RidershipSavingsChart({
  data,
  selectedKey,
}: {
  data: Array<{ label: string; estimated_savings: number }>
  selectedKey?: string | null
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[320px] items-center text-sm text-muted-foreground">
        Savings are estimated from 2020 onward, when bike type and modern fares exist.
      </p>
    )
  }

  return (
    <ChartContainer config={savingsConfig} className="h-[320px] w-full min-w-0">
      <BarChart accessibilityLayer data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => moneyCompact.format(Number(value))}
          width={52}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => Number(value).toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              })}
            />
          }
        />
        <Bar
          dataKey="estimated_savings"
          animationDuration={750}
          fill="var(--color-estimated_savings)"
          radius={[6, 6, 0, 0]}
          maxBarSize={42}
        />
        {selectedKey ? (
          <ReferenceLine x={selectedKey} stroke="var(--chart-3)" strokeDasharray="4 4" />
        ) : null}
      </BarChart>
    </ChartContainer>
  )
}

const durationConfig = {
  avg_duration_minutes: { label: 'Average minutes', color: 'var(--chart-1)' },
  median_duration_minutes: { label: 'Median minutes', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function DurationByRiderChart({ data }: { data: MemberSummary[] }) {
  const rows = data.map((row) => ({
    type: row.type === 'member' ? 'Members' : 'Casual riders',
    avg_duration_minutes: row.avg_duration_minutes,
    median_duration_minutes: row.median_duration_minutes,
  }))

  if (rows.length === 0) {
    return (
      <p className="flex h-[280px] items-center text-sm text-muted-foreground">
        Duration by rider type is shown from 2020 onward.
      </p>
    )
  }

  return (
    <ChartContainer config={durationConfig} className="h-[280px] w-full min-w-0">
      <BarChart accessibilityLayer data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="type" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}m`}
          width={44}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(1)} min`} />}
        />
        <Legend />
        <Bar
          dataKey="avg_duration_minutes"
          animationDuration={750}
          fill="var(--color-avg_duration_minutes)"
          radius={[6, 6, 0, 0]}
          maxBarSize={48}
        />
        <Bar
          dataKey="median_duration_minutes"
          animationDuration={750}
          fill="var(--color-median_duration_minutes)"
          radius={[6, 6, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ChartContainer>
  )
}

const covidHourConfig = {
  pre: { label: 'Pre-COVID', color: 'var(--chart-1)' },
  post: { label: 'Post-COVID', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function CovidHourCompareChart({
  pre,
  post,
}: {
  pre: WeekdayHourStat[]
  post: WeekdayHourStat[]
}) {
  const preTotal = pre.reduce((sum, row) => sum + row.trips, 0)
  const postTotal = post.reduce((sum, row) => sum + row.trips, 0)

  const rows = Array.from({ length: 24 }, (_, hour) => {
    const preTrips = pre.filter((row) => row.hour === hour).reduce((sum, row) => sum + row.trips, 0)
    const postTrips = post.filter((row) => row.hour === hour).reduce((sum, row) => sum + row.trips, 0)
    return {
      label: `${String(hour).padStart(2, '0')}:00`,
      pre: preTotal > 0 ? Number((preTrips / preTotal * 100).toFixed(2)) : 0,
      post: postTotal > 0 ? Number((postTrips / postTotal * 100).toFixed(2)) : 0,
    }
  })

  return (
    <ChartContainer config={covidHourConfig} className="h-[320px] w-full min-w-0">
      <LineChart accessibilityLayer data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={2} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}%`}
          width={42}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} />} />
        <Legend />
        <Line type="monotone" dataKey="pre" animationDuration={750} stroke="var(--color-pre)" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="post" animationDuration={750} stroke="var(--color-post)" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}

const weatherTempConfig = {
  avg_trips_per_day: { label: 'Avg trips / day', color: 'var(--chart-1)' },
} satisfies ChartConfig

const TEMP_BIN_COLORS = ['#3d5a73', '#366d75', '#4f7d6e', '#8a8179', '#c49a4a', '#b44a46', '#800000']

function weatherTooltipFrame(title: string, rows: Array<{ label: string; value: string }>) {
  return (
    <div className="grid min-w-44 gap-2 rounded-xl border border-border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg">
      <div className="font-medium">{title}</div>
      <div className="grid gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-6">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-mono font-medium tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function WeatherTempChart({
  data,
}: {
  data: Array<{ label: string; avg_trips_per_day: number; days: number }>
}) {
  return (
    <ChartContainer config={weatherTempConfig} className="h-[360px] w-full min-w-0">
      <BarChart accessibilityLayer data={data} margin={{ top: 28, right: 8, left: 4, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={axisCount}
          width={48}
          label={{ value: 'Trips / day', angle: -90, position: 'insideLeft', offset: 12, style: { fill: 'var(--muted-foreground)', fontSize: 11 } }}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.45 }}
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null
            const row = payload[0].payload as { label: string; avg_trips_per_day: number; days: number }
            return weatherTooltipFrame(row.label, [
              { label: 'Avg trips', value: `${row.avg_trips_per_day.toLocaleString()} / day` },
              { label: 'Days in bin', value: row.days.toLocaleString() },
            ])
          }}
        />
        <Bar dataKey="avg_trips_per_day" animationDuration={750} radius={[6, 6, 0, 0]} maxBarSize={48}>
          {data.map((row, index) => (
            <Cell key={row.label} fill={TEMP_BIN_COLORS[index] ?? 'var(--chart-1)'} />
          ))}
          <LabelList
            dataKey="avg_trips_per_day"
            position="top"
            className="fill-foreground"
            style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
            formatter={(value: number) => Math.round(Number(value)).toLocaleString()}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

type WeatherMonthPoint = {
  month: string
  trips: number
  avg_temp_f: number
  precip_inches: number
  avg_trips_per_day: number
}

const SEASON_COLORS = {
  Winter: '#366d75',
  Spring: '#6a8a4e',
  Summer: '#800000',
  Fall: '#c49a4a',
} as const

type Season = keyof typeof SEASON_COLORS

function seasonForMonth(month: string): Season {
  const monthNumber = Number(month.slice(5))
  if (monthNumber === 12 || monthNumber <= 2) return 'Winter'
  if (monthNumber <= 5) return 'Spring'
  if (monthNumber <= 8) return 'Summer'
  return 'Fall'
}

function pearson(xs: number[], ys: number[]) {
  const n = xs.length
  if (n < 3) return null
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n
  let numerator = 0
  let denomX = 0
  let denomY = 0
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }
  const denom = Math.sqrt(denomX * denomY)
  if (denom === 0) return null
  return numerator / denom
}

function linearFit(xs: number[], ys: number[]) {
  const n = xs.length
  if (n < 2) return null
  const sumX = xs.reduce((sum, value) => sum + value, 0)
  const sumY = ys.reduce((sum, value) => sum + value, 0)
  const sumXY = xs.reduce((sum, value, i) => sum + value * ys[i], 0)
  const sumXX = xs.reduce((sum, value) => sum + value * value, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

const weatherScatterConfig = {
  avg_trips_per_day: { label: 'Avg trips / day', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function WeatherCorrelationChart({ data }: { data: WeatherMonthPoint[] }) {
  const points = useMemo(
    () => data.filter((row) => Number.isFinite(row.avg_temp_f) && Number.isFinite(row.avg_trips_per_day)),
    [data],
  )
  const fit = useMemo(() => {
    const xs = points.map((row) => row.avg_temp_f)
    const ys = points.map((row) => row.avg_trips_per_day)
    const r = pearson(xs, ys)
    const line = linearFit(xs, ys)
    if (!line || xs.length === 0) return { r, trend: [] as Array<{ avg_temp_f: number; trend: number }> }
    const minT = Math.min(...xs)
    const maxT = Math.max(...xs)
    return {
      r,
      trend: [
        { avg_temp_f: minT, trend: line.intercept + line.slope * minT },
        { avg_temp_f: maxT, trend: line.intercept + line.slope * maxT },
      ],
    }
  }, [points])

  const temps = points.map((row) => row.avg_temp_f)
  const trips = points.map((row) => row.avg_trips_per_day)
  const tempPad = 4
  const xDomain: [number, number] = temps.length
    ? [Math.floor(Math.min(...temps) - tempPad), Math.ceil(Math.max(...temps) + tempPad)]
    : [0, 90]
  const yMax = trips.length ? Math.ceil(Math.max(...trips) * 1.12 / 10) * 10 : 100

  return (
    <div>
      <ChartContainer config={weatherScatterConfig} className="h-[360px] w-full min-w-0">
        <ComposedChart data={points} margin={{ top: 16, right: 16, left: 8, bottom: 28 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            type="number"
            dataKey="avg_temp_f"
            domain={xDomain}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}°`}
            label={{ value: 'Monthly mean temperature (°F)', position: 'insideBottom', offset: -18, style: { fill: 'var(--muted-foreground)', fontSize: 11 } }}
          />
          <YAxis
            type="number"
            domain={[0, yMax]}
            tickLine={false}
            axisLine={false}
            tickFormatter={axisCount}
            width={48}
            label={{ value: 'Trips / day', angle: -90, position: 'insideLeft', offset: 12, style: { fill: 'var(--muted-foreground)', fontSize: 11 } }}
          />
          <ChartTooltip
            cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const row = payload[0].payload as WeatherMonthPoint
              if (!row.month) return null
              return weatherTooltipFrame(
                new Date(`${row.month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                [
                  { label: 'Mean temp', value: `${row.avg_temp_f.toFixed(0)}°F` },
                  { label: 'Trips / day', value: row.avg_trips_per_day.toLocaleString() },
                  { label: 'Precip', value: `${row.precip_inches.toFixed(2)}"` },
                ],
              )
            }}
          />
          <Scatter
            name="Month"
            dataKey="avg_trips_per_day"
            fill="var(--chart-1)"
            animationDuration={750}
          >
            {points.map((row) => (
              <Cell
                key={row.month}
                fill={SEASON_COLORS[seasonForMonth(row.month)]}
                fillOpacity={0.72}
                stroke={SEASON_COLORS[seasonForMonth(row.month)]}
                strokeOpacity={0.95}
              />
            ))}
          </Scatter>
          <Line
            data={fit.trend}
            dataKey="trend"
            name="Trend"
            type="linear"
            animationDuration={750}
            stroke="var(--foreground)"
            strokeWidth={1.5}
            strokeDasharray="6 5"
            dot={false}
            legendType="none"
          />
        </ComposedChart>
      </ChartContainer>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
          {(Object.keys(SEASON_COLORS) as Season[]).map((season) => (
            <span key={season} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: SEASON_COLORS[season] }} aria-hidden="true" />
              {season}
            </span>
          ))}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          {fit.r == null ? 'Not enough months to score correlation' : `Pearson r = ${fit.r.toFixed(2)} · each point is one month`}
        </p>
      </div>
    </div>
  )
}

const weatherSeasonConfig = {
  avg_trips_per_day: { label: 'Avg trips / day', color: 'var(--chart-1)' },
  avg_temp_f: { label: 'Avg temp °F', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function WeatherSeasonChart({ data }: { data: WeatherMonthPoint[] }) {
  const seasonal = useMemo(() => {
    return MONTH_LABELS.map((label, index) => {
      const suffix = `-${String(index + 1).padStart(2, '0')}`
      const rows = data.filter((row) => row.month.endsWith(suffix))
      const n = rows.length
      if (n === 0) {
        return { label, avg_trips_per_day: 0, avg_temp_f: 0, months: 0 }
      }
      return {
        label,
        avg_trips_per_day: Number((rows.reduce((sum, row) => sum + row.avg_trips_per_day, 0) / n).toFixed(1)),
        avg_temp_f: Number((rows.reduce((sum, row) => sum + row.avg_temp_f, 0) / n).toFixed(1)),
        months: n,
      }
    })
  }, [data])

  return (
    <ChartContainer config={weatherSeasonConfig} className="h-[340px] w-full min-w-0">
      <ComposedChart accessibilityLayer data={seasonal} margin={{ top: 16, right: 12, left: 4, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="trips"
          tickLine={false}
          axisLine={false}
          tickFormatter={axisCount}
          width={48}
          label={{ value: 'Trips / day', angle: -90, position: 'insideLeft', offset: 12, style: { fill: 'var(--muted-foreground)', fontSize: 11 } }}
        />
        <YAxis
          yAxisId="temp"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}°`}
          width={44}
          domain={['dataMin - 8', 'dataMax + 8']}
          label={{ value: '°F', angle: 90, position: 'insideRight', offset: 8, style: { fill: 'var(--muted-foreground)', fontSize: 11 } }}
        />
        <ChartTooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const row = payload[0].payload as { label: string; avg_trips_per_day: number; avg_temp_f: number; months: number }
            return weatherTooltipFrame(String(label), [
              { label: 'Avg trips', value: `${row.avg_trips_per_day.toLocaleString()} / day` },
              { label: 'Avg temp', value: `${row.avg_temp_f.toFixed(0)}°F` },
              { label: 'Months averaged', value: String(row.months) },
            ])
          }}
        />
        <Legend />
        <Bar
          yAxisId="trips"
          dataKey="avg_trips_per_day"
          name="Avg trips / day"
          animationDuration={750}
          fill="var(--color-avg_trips_per_day)"
          fillOpacity={0.88}
          radius={[5, 5, 0, 0]}
          maxBarSize={36}
        />
        <Line
          yAxisId="temp"
          dataKey="avg_temp_f"
          name="Avg temp °F"
          type="monotone"
          animationDuration={750}
          stroke="var(--color-avg_temp_f)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: 'var(--color-avg_temp_f)', strokeWidth: 0 }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
