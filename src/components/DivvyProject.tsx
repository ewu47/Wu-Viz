import { useEffect, useMemo, useState } from 'react'
import { Bike, Clock3, CloudRain, Database, MapPin, Moon, Route, Sparkles } from 'lucide-react'

import { AcademicCalendar } from '@/components/divvy/AcademicCalendar'
import {
  ActivityPatternsChart,
  BikeEvolutionChart,
  CampusPulseChart,
  CovidHourCompareChart,
  DurationByRiderChart,
  type PulseMetric,
  RiderMixChart,
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
import { availableYears, filledDaysForMonth, selectAnalyticsSlice } from '@/lib/analytics-period'
import { divvyApi, type Analytics, type AnalyticsPeriod, type WeekdayHourStat } from '@/services/api'

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

function formatMiles(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
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
    const member = slice.member_summary.find((row) => row.type === 'member')
    const typedBikes = slice.summary.classic + slice.summary.electric
    const electricShare = typedBikes > 0
      ? slice.summary.electric / typedBikes * 100
      : slice.summary.electric_share_among_typed ?? 0

    return {
      peakMonth,
      memberShare: slice.summary.member_share,
      electricShare,
      topStart: slice.top_start_stations[0],
      nightEnd: slice.after_dark_end_stations[0],
      memberHours: member?.total_duration_hours,
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
  const mixYear = period.mode === 'all' ? null : period.year
  const mixData = mixYear == null
    ? analytics.yearly
    : analytics.by_year[String(mixYear)]?.monthly ?? slice.monthly
  const mixMode = mixYear == null ? 'yearly' as const : 'monthly' as const
  const years = availableYears(analytics)
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
              value={formatMiles(summary.estimated_miles_total)}
              detail={
                summary.estimated_miles_trip_coverage > 0
                  ? `Avg ${summary.estimated_miles_avg?.toFixed(2) ?? '—'} mi · ${summary.estimated_miles_trip_coverage}% of trips have coords`
                  : 'Coords unavailable for this period'
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
          description="Watch a few high-activity days unfold station to station, or browse the historical station overview. Toggle live GBFS for current bike and dock inventory."
        />
        <div className="mt-9">
          <StationMap
            stations={slice.stations}
            archiveStations={analytics.stations}
            demoDays={analytics.demo_days}
            bounds={analytics.map_bounds}
            periodLabel={slice.label}
          />
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Replay moves between published station centroids. Off-station e-bike locks and coarse GPS are omitted.
          </p>
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
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Route className="size-4" aria-hidden="true" />
              <span className="font-mono text-xs uppercase tracking-wider">OD pairs</span>
            </div>
            <CardTitle>Most common station-to-station routes</CardTitle>
            <CardDescription>Same-station loops are excluded so movement between places stays visible.</CardDescription>
          </CardHeader>
          <CardContent>
            <RoutesChart data={slice.common_routes} />
          </CardContent>
        </Card>
      </section>

      <section id="riders" className="atlas-section atlas-shell">
        <SectionIntro
          eyebrow="Riders"
          title="Membership and bikes changed with the system"
          description="The archive spans two data eras. Bike type was not published before 2020, so the evolution chart begins where the field becomes available."
        />
        <div className="mt-9 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Member and casual share</CardTitle>
              <CardDescription>
                {period.mode === 'all' ? 'Share of analysis-ready rides by year.' : `Monthly mix inside ${period.year}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RiderMixChart data={mixData} mode={mixMode} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Classic and electric bikes</CardTitle>
              <CardDescription>
                {period.mode === 'all'
                  ? 'Published rideable types, 2020 onward.'
                  : `Published types for ${period.year}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BikeEvolutionChart data={mixData} mode={mixMode} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Trip duration</CardTitle>
              <CardDescription>Average and median minutes by membership type.</CardDescription>
            </CardHeader>
            <CardContent>
              <DurationByRiderChart data={slice.member_summary} />
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-accent">
            <CardHeader>
              <Bike className="size-6 text-accent-foreground" aria-hidden="true" />
              <CardTitle>{slice.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-4xl font-medium text-accent-foreground">
                {findings.electricShare > 0 ? `${findings.electricShare.toFixed(0)}%` : '—'}
              </div>
              <p className="mt-2 text-sm text-accent-foreground/75">
                electric share among rides with a published bike type
              </p>
              <p className="mt-8 text-base leading-7 text-accent-foreground/85">
                Members account for {findings.memberShare.toFixed(1)}% of cleaned trips in this view.
                Station metadata is complete for {summary.station_metadata_complete_share.toFixed(0)}%
                of trips; coordinates for {summary.coordinate_metadata_complete_share.toFixed(0)}%.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="method" className="atlas-section atlas-shell">
        <SectionIntro
          eyebrow="Method"
          title="A small zone, treated carefully"
          description="Every chart uses the same reproducible analysis surface. Estimated miles are crow-flies distances between published endpoints—not routed path length."
        />
        <div className="mt-9 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <img
              src={mapZoneImage}
              alt="Map showing the UChicago and Hyde Park Divvy study boundary"
              className="h-full min-h-80 w-full object-cover"
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
                ['Distance', 'Haversine miles only when start and end coordinates exist'],
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
