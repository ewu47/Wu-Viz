import { useEffect, useMemo, useState } from 'react'
import { Clock3, CloudRain, Database, MapPin, Moon, Route, Sparkles, Wallet } from 'lucide-react'

import { AcademicCalendar } from '@/components/divvy/AcademicCalendar'
import {
  ActivityPatternsChart,
  BikeEvolutionChart,
  CampusPulseChart,
  CovidHourCompareChart,
  DurationByRiderChart,
  type PulseMetric,
  RiderMixChart,
  RidershipSavingsChart,
  RoutesChart,
  StationRankingChart,
  WeatherCorrelationChart,
  WeatherSeasonChart,
  WeatherTempChart,
} from '@/components/divvy/AnalyticsCharts'
import { AtlasNav } from '@/components/divvy/AtlasNav'
import { PeriodControls } from '@/components/divvy/PeriodControls'
import { StationMap } from '@/components/divvy/StationMap'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { availableYears, filledDaysForMonth, MONTH_LABELS, selectAnalyticsSlice, selectRidershipSlice } from '@/lib/analytics-period'
import { divvyApi, type Analytics, type AnalyticsPeriod, type MemberSummary, type WeekdayHourStat } from '@/services/api'

const mapZoneImage = `${import.meta.env.BASE_URL}map-zone.png`

function formatMonth(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function formatDay(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function periodKey(period: AnalyticsPeriod) {
  if (period.mode === 'all') return 'all'
  if (period.mode === 'year') return String(period.year)
  if (period.mode === 'month') return period.month
  return period.date
}

function formatMiles(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatUsd(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function memberSummaryForEra(analytics: Analytics, eraStart: number): MemberSummary[] {
  const combined = new Map<MemberSummary['type'], {
    trips: number
    durationWeight: number
    medianWeight: number
    hours: number
  }>()

  for (const [year, yearSlice] of Object.entries(analytics.by_year)) {
    if (Number(year) < eraStart) continue
    for (const row of yearSlice.member_summary) {
      const current = combined.get(row.type) ?? {
        trips: 0,
        durationWeight: 0,
        medianWeight: 0,
        hours: 0,
      }
      current.trips += row.trips
      current.durationWeight += row.avg_duration_minutes * row.trips
      current.medianWeight += row.median_duration_minutes * row.trips
      current.hours += row.total_duration_hours
      combined.set(row.type, current)
    }
  }

  return [...combined.entries()].map(([type, row]) => ({
    type,
    trips: row.trips,
    avg_duration_minutes: row.trips > 0 ? Number((row.durationWeight / row.trips).toFixed(2)) : 0,
    median_duration_minutes: row.trips > 0 ? Number((row.medianWeight / row.trips).toFixed(2)) : 0,
    total_duration_hours: Number(row.hours.toFixed(1)),
    estimated_miles_total: null,
    estimated_miles_avg: null,
  }))
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="border-t border-border pt-4">
      <div key={value} className="atlas-metric-value font-mono text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        {value}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{label}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</div>
    </div>
  )
}

function SectionIntro({
  id,
  eyebrow,
  title,
  description,
}: {
  id?: string
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="atlas-rise max-w-3xl">
      <p id={id} className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">{title}</h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
    </div>
  )
}

export default function DivvyProject() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<AnalyticsPeriod>({ mode: 'all' })
  const [pulseMetric, setPulseMetric] = useState<PulseMetric>('trips')
  const [hoveredRoute, setHoveredRoute] = useState<{
    start_station: string
    end_station: string
    periodKey: string
  } | null>(null)

  useEffect(() => {
    divvyApi.getAnalytics().then((response) => {
      if (response.success) setAnalytics(response.data)
      else setError(response.message ?? 'Analytics could not be loaded')
    })
  }, [])

  const slice = useMemo(
    () => (analytics ? selectAnalyticsSlice(analytics, period) : null),
    [analytics, period],
  )

  const activitySeries = useMemo(() => {
    if (!analytics) return null
    const series: Record<string, WeekdayHourStat[]> = {
      all: analytics.weekday_hour,
      pre_covid: analytics.covid.pre.weekday_hour,
      post_covid: analytics.covid.post.weekday_hour,
    }
    for (const [year, yearSlice] of Object.entries(analytics.by_year)) {
      series[year] = yearSlice.weekday_hour
    }
    return series
  }, [analytics])

  const activityDefaultScope = period.mode === 'all' ? 'all' : String(period.year)

  const findings = useMemo(() => {
    if (!slice) return null
    const peakMonth = slice.monthly.reduce(
      (peak, row) => (row.trips > peak.trips ? row : peak),
      slice.monthly[0],
    )

    return {
      peakMonth,
      topStart: slice.top_start_stations[0],
      nightEnd: slice.after_dark_end_stations[0],
    }
  }, [slice])

  if (error) {
    return (
      <main className="mx-auto min-h-[55vh] max-w-3xl px-6 py-24">
        <Card>
          <CardHeader>
            <CardTitle>Analytics unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  if (!analytics || !slice || !findings || !activitySeries) {
    return (
      <main className="mx-auto min-h-[55vh] max-w-3xl px-6 py-24">
        <div role="status" aria-live="polite" aria-busy="true">
          <div className="h-2 w-24 animate-pulse rounded-full bg-primary" aria-hidden="true" />
          <p className="mt-5 font-mono text-sm text-muted-foreground">Loading the mobility archive…</p>
        </div>
      </main>
    )
  }

  const { summary } = slice
  const archiveRange = `${formatMonth(analytics.summary.first_trip)} – ${formatMonth(analytics.summary.latest_trip)}`
  const periodRange = period.mode === 'day'
    ? formatDay(period.date)
    : `${formatDay(summary.first_trip)} – ${formatDay(summary.latest_trip)}`
  const years = availableYears(analytics)
  const currentPeriodKey = periodKey(period)
  const ridershipSlice = selectRidershipSlice(analytics, period)
  const riderChartRows = ridershipSlice.series.map((row) => {
    const label = 'month' in row
      ? MONTH_LABELS[Number(row.month.slice(5)) - 1] ?? row.month
      : String(row.year)
    return {
      label,
      member: row.member,
      casual: row.casual,
      member_share: row.member_share,
      classic: row.classic,
      electric: row.electric,
      electric_share: row.electric_share,
      estimated_savings: row.estimated_savings,
    }
  })
  const riderSelectedKey = ridershipSlice.selectedKey
    ? MONTH_LABELS[Number(ridershipSlice.selectedKey.slice(5)) - 1] ?? null
    : null
  const riderDuration = period.mode === 'all'
    ? memberSummaryForEra(analytics, ridershipSlice.eraStart)
    : period.year >= ridershipSlice.eraStart
      ? slice.member_summary
      : []
  const covidPre = analytics.covid.pre.summary
  const covidPost = analytics.covid.post.summary
  const wetDrop = analytics.weather.precip.dry_avg_trips > 0
    ? (1 - analytics.weather.precip.wet_avg_trips / analytics.weather.precip.dry_avg_trips) * 100
    : 0
  const selectedDay = period.mode === 'day'
    ? slice.daily.find((row) => row.date === period.date)
    : null
  const showDaily = period.mode === 'month' || period.mode === 'day'
  const pulseGrain = showDaily ? 'day' as const : 'month' as const
  const pulseRows = showDaily && period.mode !== 'all' && period.mode !== 'year'
    ? filledDaysForMonth(analytics, period.month).map((row) => ({
      periodKey: row.date,
      trips: row.trips,
      member_share: row.member_share,
      total_duration_hours: row.total_duration_hours,
      estimated_miles_total: row.estimated_miles_total,
    }))
    : (period.mode === 'year' ? slice.monthly : slice.pulseMonthly).map((row) => ({
      periodKey: row.month,
      trips: row.trips,
      member_share: row.member_share,
      total_duration_hours: row.total_duration_hours,
      estimated_miles_total: row.estimated_miles_total,
    }))
  const pulseTitle = period.mode === 'day'
    ? `Campus pulse · ${formatMonth(`${period.month}-01`)}`
    : period.mode === 'month'
      ? `Campus pulse · days in ${formatMonth(`${period.month}-01`)}`
      : period.mode === 'year'
        ? `Campus pulse · ${period.year}`
        : 'Campus pulse · monthly archive'
  const pulseDescription = pulseGrain === 'day'
    ? 'Click a day on the chart or calendar to focus it. Metric tabs still apply.'
    : period.mode === 'year'
      ? 'Click a month to zoom into daily trips.'
      : 'Click a month to zoom into daily trips. Drag the brush to scan the archive.'

  return (
    <main>
      <AtlasNav />

      <section id="overview" className="atlas-hero">
        <div className="atlas-shell py-14 sm:py-16">
          <div className="flex flex-wrap gap-2">
            <Badge>UChicago / Hyde Park</Badge>
            <Badge variant="outline">{archiveRange}</Badge>
            {period.mode !== 'all' ? <Badge variant="outline">{slice.label}</Badge> : null}
          </div>
          <h1 className="mt-7 max-w-3xl text-[2.65rem] font-semibold leading-[0.98] tracking-[-0.055em] text-foreground sm:text-6xl">
            Thirteen years of campus movement.
          </h1>
          <p className="atlas-lede mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Jump to a section below. Campus pulse is the main chart: click a year, a month, or a
            day and it stays put and zooms with you. Station and hour rankings stay year-scoped.
          </p>
          <div className="atlas-kicker mt-8 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <span className="h-px w-10 bg-primary" />
            Official Divvy trip archives
          </div>

          <div className="mt-10">
            <PeriodControls analytics={analytics} period={period} onChange={setPeriod}>
              <Card id="pulse" className="scroll-mt-[calc(var(--nav-height)+3.4rem)]">
                <CardHeader>
                  <CardTitle>{pulseTitle}</CardTitle>
                  <CardDescription>{pulseDescription}</CardDescription>
                </CardHeader>
                <CardContent className="px-2 pb-5 pt-0 sm:px-5">
                  <CampusPulseChart
                    key={`${pulseGrain}-${slice.label}`}
                    data={pulseRows}
                    grain={pulseGrain}
                    selectedKey={period.mode === 'day' ? period.date : null}
                    brushStartIndex={slice.brushStartIndex}
                    brushEndIndex={slice.brushEndIndex}
                    showBrush={period.mode === 'all'}
                    metric={pulseMetric}
                    onMetricChange={setPulseMetric}
                    onPointSelect={(key) => {
                      if (pulseGrain === 'day' && period.mode !== 'all' && period.mode !== 'year') {
                        if (period.mode === 'day' && period.date === key) {
                          setPeriod({ mode: 'month', year: period.year, month: period.month })
                          return
                        }
                        setPeriod({
                          mode: 'day',
                          year: period.year,
                          month: period.month,
                          date: key,
                        })
                        return
                      }
                      if (/^\d{4}-\d{2}$/.test(key)) {
                        setPeriod({ mode: 'month', year: Number(key.slice(0, 4)), month: key })
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </PeriodControls>
          </div>

          <p className="mt-4 font-mono text-xs text-muted-foreground" aria-live="polite">
            Showing {slice.label}
            {period.mode !== 'all' ? ` · ${periodRange}` : ''}
          </p>

          <div className="atlas-stagger mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Clean trips"
              value={summary.trips.toLocaleString()}
              detail={`${summary.trips_per_active_day || '—'} per active day · ${summary.active_days || '—'} days`}
            />
            <Metric
              label="Member share"
              value={`${summary.member_share.toFixed(1)}%`}
              detail={`${summary.member.toLocaleString()} members · ${summary.casual.toLocaleString()} casual`}
            />
            <Metric
              label="Average / median"
              value={`${summary.avg_duration_minutes.toFixed(1)} / ${summary.median_duration_minutes.toFixed(1)} min`}
              detail={`${summary.total_duration_hours.toLocaleString()} total hours · p90 ${summary.p90_duration_minutes.toFixed(1)} min`}
            />
            <Metric
              label="Est. straight-line miles"
              value={
                summary.estimated_miles_total == null || summary.estimated_miles_trip_coverage === 0
                  ? 'No miles'
                  : formatMiles(summary.estimated_miles_total)
              }
              detail={
                summary.estimated_miles_total == null || summary.estimated_miles_trip_coverage === 0
                  ? 'Divvy did not publish trip coordinates until 2020, so distance cannot be estimated here.'
                  : `Avg ${summary.estimated_miles_avg?.toFixed(2) ?? '—'} mi · ${summary.estimated_miles_trip_coverage}% of trips have coords`
              }
            />
          </div>

          <div className="atlas-stagger mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Named stations"
              value={summary.total_stations.toLocaleString()}
              detail={`${summary.stationless_starts.toLocaleString()} stationless starts`}
            />
            <Metric
              label="Observed routes"
              value={summary.unique_routes.toLocaleString()}
              detail={showDaily ? `Named pairs in ${period.year}` : 'Named origin–destination pairs'}
            />
            <Metric
              label="After-dark share"
              value={`${summary.after_dark_share.toFixed(1)}%`}
              detail={`${summary.after_dark_trips.toLocaleString()} trips starting at 9 pm or later`}
            />
            {selectedDay && selectedDay.temp_mean_f != null ? (
              <Metric
                label="That day's weather"
                value={`${selectedDay.temp_mean_f.toFixed(0)}°F`}
                detail={
                  selectedDay.precip_in == null
                    ? 'Hyde Park daily mean from Open-Meteo'
                    : `${selectedDay.precip_in.toFixed(2)}" precip`
                }
              />
            ) : (
              <Metric
                label="Electric share"
                value={
                  summary.electric_share_among_typed == null
                    ? '—'
                    : `${summary.electric_share_among_typed.toFixed(0)}%`
                }
                detail={
                  summary.classic + summary.electric > 0
                    ? `${summary.electric.toLocaleString()} electric · ${summary.classic.toLocaleString()} classic`
                    : `${summary.not_published.toLocaleString()} rides without published bike type`
                }
              />
            )}
          </div>

          {analytics.forecast.predicted_trips != null ? (
            <Card className="mt-8 border-primary/25 bg-card/90">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="size-4" aria-hidden="true" />
                  <span className="font-mono text-xs uppercase tracking-wider">Next archive month</span>
                </div>
                <CardTitle>
                  Forecast for {analytics.forecast.target_month}
                </CardTitle>
                <CardDescription>
                  Built for the gap before the next Divvy monthly release (data currently through{' '}
                  {analytics.forecast.based_on_latest_trip}). Score it when that archive imports.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                  label="Predicted trips"
                  value={analytics.forecast.predicted_trips.toLocaleString()}
                  detail={`${analytics.forecast.low?.toLocaleString()}–${analytics.forecast.high?.toLocaleString()} uncertainty band`}
                />
                <Metric
                  label="Per day"
                  value={analytics.forecast.predicted_trips_per_day?.toLocaleString() ?? '—'}
                  detail="Seasonal + YoY + trend + weather climatology"
                />
                <Metric
                  label="Backtest MAPE"
                  value={analytics.forecast.backtest.mape == null ? '—' : `${analytics.forecast.backtest.mape}%`}
                  detail={`MAE ${analytics.forecast.backtest.mae_trips?.toLocaleString() ?? '—'} over ${analytics.forecast.backtest.months_scored} months`}
                />
                <Metric
                  label="Weather assumption"
                  value={
                    analytics.forecast.components.expected_temp_f == null
                      ? '—'
                      : `${analytics.forecast.components.expected_temp_f.toFixed(0)}°F`
                  }
                  detail={
                    analytics.forecast.components.expected_precip_in == null
                      ? 'Climatology for this calendar month'
                      : `${analytics.forecast.components.expected_precip_in.toFixed(1)}" typical precip`
                  }
                />
              </CardContent>
              <p className="border-t border-border px-6 py-4 font-mono text-xs text-muted-foreground">
                Learn the ML variant: <span className="text-foreground">npm run divvy:forecast-learn</span>
                {' · '}
                {analytics.forecast.method}
              </p>
            </Card>
          ) : null}
        </div>
      </section>

      <section id="calendar" className="atlas-section atlas-shell">
        <SectionIntro
          eyebrow="Calendar"
          title="UChicago College dates, 2025–26"
          description="These are the official instruction, break, exam, and convocation windows shaded on Campus pulse. Click a row to jump the pulse chart to that span."
        />
        <Card className="mt-9">
          <CardContent className="pt-2">
            <AcademicCalendar onSelectPeriod={setPeriod} />
          </CardContent>
        </Card>
      </section>

      <section id="rhythm" className="atlas-section atlas-shell">
        <SectionIntro
          eyebrow="Rhythm"
          title="When Hyde Park rides"
          description={
            period.mode === 'all'
              ? 'The daily rhythm is remarkably legible: class schedules, commute windows, weather, and the academic calendar all leave a trace.'
              : `Hour and weekday patterns for ${period.year}${slice.rankingsScopedToYear ? ' (year-level activity; month and day chips affect volume KPIs)' : ''}.`
          }
        />
        <div className="mt-9 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Trips by hour and weekday</CardTitle>
              <CardDescription>
                {period.mode === 'all'
                  ? 'Switch the grouping without losing the full historical population.'
                  : `Scoped to ${period.year}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityPatternsChart
                key={activityDefaultScope}
                series={activitySeries}
                years={years}
                defaultScope={activityDefaultScope}
              />
            </CardContent>
          </Card>
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <Clock3 className="size-6" aria-hidden="true" />
              <CardTitle className="text-primary-foreground">
                {period.mode === 'day' ? 'This day' : period.mode === 'month' ? 'This month' : 'The busiest month'}
              </CardTitle>
              <CardDescription className="text-primary-foreground/70">
                {period.mode === 'all'
                  ? 'A single month at the peak of the archive.'
                  : `Peak inside ${slice.label}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-4xl font-medium">
                {period.mode === 'day'
                  ? summary.trips.toLocaleString()
                  : findings.peakMonth?.trips.toLocaleString() ?? '—'}
              </div>
              <p className="mt-2 text-sm text-primary-foreground/75">
                trips {period.mode === 'day'
                  ? `on ${formatDay(period.date)}`
                  : `in ${findings.peakMonth ? formatMonth(`${findings.peakMonth.month}-01`) : '—'}`}
              </p>
              <p className="mt-8 max-w-sm text-base leading-7 text-primary-foreground/85">
                Member hours in this view: {(summary.member_duration_hours ?? 0).toLocaleString()}; casual
                hours: {(summary.casual_duration_hours ?? 0).toLocaleString()}.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="covid" className="atlas-section atlas-shell">
        <SectionIntro
          eyebrow="COVID"
          title="Pre-COVID vs post-COVID campus rhythm"
          description={analytics.covid.definition.note}
        />
        <div className="mt-9 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Pre trips / day"
            value={covidPre.trips_per_active_day.toLocaleString()}
            detail={`${covidPre.trips.toLocaleString()} trips · before ${analytics.covid.definition.pre_end}`}
          />
          <Metric
            label="Post trips / day"
            value={covidPost.trips_per_active_day.toLocaleString()}
            detail={`${covidPost.trips.toLocaleString()} trips · from ${analytics.covid.definition.post_start}`}
          />
          <Metric
            label="Member share"
            value={`${covidPre.member_share.toFixed(0)}% → ${covidPost.member_share.toFixed(0)}%`}
            detail="Pre → post membership mix"
          />
          <Metric
            label="After-dark share"
            value={`${covidPre.after_dark_share.toFixed(1)}% → ${covidPost.after_dark_share.toFixed(1)}%`}
            detail="Trips starting at 9 pm or later"
          />
        </div>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Hour-of-day share</CardTitle>
            <CardDescription>
              Normalized so each era sums to 100%, making shape differences easier to read than raw volume.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CovidHourCompareChart
              pre={analytics.covid.pre.weekday_hour}
              post={analytics.covid.post.weekday_hour}
            />
          </CardContent>
        </Card>
      </section>

      <section id="weather" className="atlas-section atlas-shell">
        <SectionIntro
          eyebrow="Weather"
          title="Temperature and rain leave a clear mark"
          description="Daily Hyde Park weather from Open-Meteo is joined to analysis-ready trip days. Cold and wet days suppress volume; mild mid-60s days are the sweet spot."
        />
        <div className="mt-9 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Dry-day average"
            value={analytics.weather.precip.dry_avg_trips.toLocaleString()}
            detail={`< ${analytics.weather.precip.wet_threshold_inches}" precip · ${analytics.weather.precip.dry_days.toLocaleString()} days`}
          />
          <Metric
            label="Wet-day average"
            value={analytics.weather.precip.wet_avg_trips.toLocaleString()}
            detail={`${analytics.weather.precip.wet_days.toLocaleString()} days with measurable rain/snow`}
          />
          <Metric
            label="Wet-day drop"
            value={`${wetDrop.toFixed(0)}%`}
            detail="Fewer trips on wet days vs dry days"
          />
          <Metric
            label="Weather days joined"
            value={analytics.weather.days_joined.toLocaleString()}
            detail={analytics.weather.source}
          />
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <CloudRain className="size-4" aria-hidden="true" />
                <span className="font-mono text-xs uppercase tracking-wider">Temperature bins</span>
              </div>
              <CardTitle>Average trips by daily mean temperature</CardTitle>
              <CardDescription>
                Cold-to-warm bins of Hyde Park days. Labels are trips per day in that bin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeatherTempChart data={analytics.weather.by_temperature_bin} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Temperature vs trips, month by month</CardTitle>
              <CardDescription>
                Each point is one month. The dashed line is the linear trend; color is season.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeatherCorrelationChart data={analytics.weather.monthly} />
            </CardContent>
          </Card>
        </div>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>A typical year: trips follow the temperature curve</CardTitle>
            <CardDescription>
              January–December averages across the archive. Bars are trips per day; the line is mean temperature.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeatherSeasonChart data={analytics.weather.monthly} />
          </CardContent>
        </Card>
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          {analytics.weather.attribution}
        </p>
      </section>

      <section id="map" className="atlas-section atlas-shell">
        <SectionIntro
          eyebrow="Map"
          title="The stations that organize the neighborhood"
          description="Hover a station pair to light up both endpoints on the map. Watch a few high-activity days unfold, or toggle live GBFS for current bike and dock inventory."
        />
        <div className="mt-9 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
          <div className="min-w-0 xl:sticky xl:top-[calc(var(--nav-height)+1rem)]">
            <StationMap
              stations={slice.stations}
              archiveStations={analytics.stations}
              demoDays={analytics.demo_days}
              bounds={analytics.map_bounds}
              periodLabel={slice.label}
              highlightedRoute={
                hoveredRoute?.periodKey === currentPeriodKey ? hoveredRoute : null
              }
            />
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              Replay moves between published station centroids. Off-station e-bike locks and coarse GPS are omitted.
            </p>
          </div>
          <Card className="min-w-0">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Route className="size-4" aria-hidden="true" />
                <span className="font-mono text-xs uppercase tracking-wider">OD pairs</span>
              </div>
              <CardTitle>Most common station-to-station routes</CardTitle>
              <CardDescription>
                Hover a pair to see the two stations on the map. Same-station loops are excluded.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoutesChart
                data={slice.common_routes}
                onHoverPair={(pair) => {
                  setHoveredRoute((current) => {
                    if (pair == null) {
                      return current?.periodKey === currentPeriodKey ? null : current
                    }
                    if (
                      current?.periodKey === currentPeriodKey
                      && current.start_station === pair.start_station
                      && current.end_station === pair.end_station
                    ) {
                      return current
                    }
                    return { ...pair, periodKey: currentPeriodKey }
                  })
                }}
              />
            </CardContent>
          </Card>
        </div>
        <div className="mt-9 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="size-4" aria-hidden="true" />
                <span className="font-mono text-xs uppercase tracking-wider">Origins</span>
              </div>
              <CardTitle>Top start stations</CardTitle>
            </CardHeader>
            <CardContent>
              <StationRankingChart
                allDay={slice.top_start_stations}
                afterDark={slice.after_dark_start_stations}
                mode="start"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Moon className="size-4" aria-hidden="true" />
                <span className="font-mono text-xs uppercase tracking-wider">Destinations</span>
              </div>
              <CardTitle>Top end stations</CardTitle>
            </CardHeader>
            <CardContent>
              <StationRankingChart
                allDay={slice.top_end_stations}
                afterDark={slice.after_dark_end_stations}
                mode="end"
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="riders" className="atlas-section atlas-shell">
        <SectionIntro
          eyebrow="Riders"
          title="The e-bike years, and what membership was worth"
          description="Divvy started publishing bike type in 2020, the same summer e-bikes arrived. This section stays in that era. Earlier years only tell us member versus casual, so 2013–2019 stay out of these charts."
        />
        {!ridershipSlice.available ? (
          <Card className="mt-9">
            <CardHeader>
              <CardTitle>Modern ridership starts in {ridershipSlice.eraStart}</CardTitle>
              <CardDescription>
                {ridershipSlice.label} is before e-bikes and published rideable types. Switch the period to 2020 or later to see membership mix, bike evolution, and estimated savings.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="mt-9 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border-t border-border pt-4 sm:col-span-2">
                <div className="atlas-metric-value font-mono text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                  {formatUsd(ridershipSlice.totals?.estimated_savings ?? 0)}
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wallet className="size-4 text-primary" aria-hidden="true" />
                  Estimated member savings vs walk-up fares
                </div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {ridershipSlice.label}
                  {ridershipSlice.totals
                    ? ` · ${formatUsd(ridershipSlice.totals.savings_per_member_trip)} per member trip · members would have paid ${formatUsd(ridershipSlice.totals.member_walkup_cost)} at casual rates, versus ${formatUsd(ridershipSlice.totals.member_usage_cost)} in usage fees`
                    : null}
                </div>
              </div>
              <Metric
                label="Member share"
                value={`${(ridershipSlice.totals?.member_share ?? 0).toFixed(1)}%`}
                detail={`${(ridershipSlice.totals?.member ?? 0).toLocaleString()} member trips · ${(ridershipSlice.totals?.casual ?? 0).toLocaleString()} casual`}
              />
              <Metric
                label="Electric share"
                value={
                  ridershipSlice.totals?.electric_share == null
                    ? '—'
                    : `${ridershipSlice.totals.electric_share.toFixed(0)}%`
                }
                detail={`${(ridershipSlice.totals?.electric ?? 0).toLocaleString()} e-bikes · ${(ridershipSlice.totals?.classic ?? 0).toLocaleString()} classic`}
              />
            </div>
            <div className="mt-9 grid gap-6 lg:grid-cols-2">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Walk-up fares members avoided</CardTitle>
                  <CardDescription>
                    Each member trip is billed at that year’s published casual rate, minus the usage fee members actually pay. Annual dues are not subtracted—trip files have no unique riders.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RidershipSavingsChart data={riderChartRows} selectedKey={riderSelectedKey} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Member and casual volume</CardTitle>
                  <CardDescription>
                    {ridershipSlice.grain === 'year'
                      ? 'Trips by year from 2020 on, with member share on the right axis.'
                      : `Monthly mix inside ${period.mode === 'all' ? ridershipSlice.label : period.year}.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RiderMixChart data={riderChartRows} selectedKey={riderSelectedKey} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Classic and electric bikes</CardTitle>
                  <CardDescription>
                    E-bikes arrived in July 2020. The line is electric share among rides with a published bike type.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BikeEvolutionChart data={riderChartRows} selectedKey={riderSelectedKey} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Trip duration</CardTitle>
                  <CardDescription>
                    Average and median minutes by membership type{period.mode === 'all' ? ', 2020–present' : ''}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DurationByRiderChart data={riderDuration} />
                </CardContent>
              </Card>
            </div>
            <p className="mt-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {ridershipSlice.totals
                ? `Same trips at a $${(analytics.ridership?.cta_fare ?? 2.5).toFixed(2)} CTA fare: ${formatUsd(ridershipSlice.totals.cta_equivalent)}. `
                : null}
              {analytics.ridership?.note}
            </p>
          </>
        )}
      </section>

      <section id="method" className="atlas-section atlas-shell">
        <SectionIntro
          eyebrow="Method"
          title="A small zone, treated carefully"
          description="Every chart uses the same reproducible analysis surface. Estimated miles are crow-flies distances between published endpoints—not routed path length."
        />
        <div className="mt-9 grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="overflow-hidden rounded-2xl border border-border bg-muted">
            <img
              src={mapZoneImage}
              alt="Map showing the UChicago and Hyde Park Divvy study boundary"
              className="block h-auto w-full object-contain p-3"
            />
          </div>
          <Card>
            <CardHeader>
              <Database className="size-6 text-primary" aria-hidden="true" />
              <CardTitle>Analysis contract</CardTitle>
              <CardDescription>Transparent enough to rerun when the next monthly archive lands.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              {[
                ['Source', '94 official Divvy S3 archives'],
                ['Zone', 'Both trip endpoints inside the configured Hyde Park boundary'],
                ['Duration', '15 seconds through 24 hours'],
                ['Time', 'Chicago local wall-clock timestamps'],
                ['Distance', 'Haversine miles only when start and end coordinates exist. Divvy did not publish lat/lng until 2020.'],
                ['Fares', 'Member savings vs published walk-up rates, 2020 onward. Annual dues omitted (no unique riders). Hyde Park e-bikes treated as included through 2021.'],
                ['Weather', 'Open-Meteo daily temps/precip joined to trip days'],
                ['Calendar', 'UChicago 2025–26 instruction, breaks, and exams on the pulse chart'],
                ['Forecast', 'Next archive month: seasonal + YoY + weather climatology'],
                ['Map layers', 'Station overview, curated day replay, optional live GBFS'],
                ['Refresh', 'Import → validate → static batch analyze'],
              ].map(([label, value]) => (
                <div key={label} className="border-t border-border pt-4">
                  <div className="font-mono text-xs uppercase tracking-wider text-primary">{label}</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="findings" className="atlas-section atlas-shell pb-28">
        <SectionIntro
          eyebrow="Findings"
          title="A few durable findings"
          description="These statements recalculate for the selected period, so they move with the archive and your year, month, or day filter."
        />
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {[
            {
              label: 'Network anchor',
              value: findings.topStart?.station ?? '—',
              detail: `${findings.topStart?.trips.toLocaleString() ?? 0} recorded departures`,
            },
            {
              label: 'After-dark destination',
              value: findings.nightEnd?.station ?? '—',
              detail: `${findings.nightEnd?.trips.toLocaleString() ?? 0} arrivals after 9 pm`,
            },
            {
              label: period.mode === 'day' ? 'Selected day' : period.mode === 'month' ? 'Selected month' : 'Peak month',
              value: period.mode === 'day'
                ? formatDay(period.date)
                : findings.peakMonth
                  ? formatMonth(`${findings.peakMonth.month}-01`)
                  : '—',
              detail: `${(period.mode === 'day' ? summary.trips : findings.peakMonth?.trips ?? 0).toLocaleString()} cleaned trips`,
            },
          ].map((finding) => (
            <Card key={finding.label}>
              <CardHeader>
                <p className="font-mono text-xs uppercase tracking-wider text-primary">{finding.label}</p>
                <CardTitle className="text-xl leading-snug">{finding.value}</CardTitle>
                <CardDescription>{finding.detail}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <p className="mt-8 font-mono text-xs text-muted-foreground">
          Generated {new Date(analytics.generated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </section>
    </main>
  )
}
