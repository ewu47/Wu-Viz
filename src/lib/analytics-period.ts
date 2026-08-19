import type {
  Analytics,
  AnalyticsPeriod,
  AnalyticsSlice,
  AnalyticsSummary,
  DailyStat,
  MonthlyStat,
  RidershipMonth,
  RidershipYear,
} from '@/services/api'

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function availableYears(analytics: Analytics): number[] {
  return Object.keys(analytics.by_year)
    .map(Number)
    .sort((a, b) => a - b)
}

export function monthsForYear(analytics: Analytics, year: number): MonthlyStat[] {
  return analytics.by_year[String(year)]?.monthly ?? []
}

export function daysForMonth(analytics: Analytics, month: string): DailyStat[] {
  return (analytics.daily ?? []).filter((row) => row.date.startsWith(`${month}-`))
}

export function periodLabel(period: AnalyticsPeriod): string {
  if (period.mode === 'all') return 'All years'
  if (period.mode === 'year') return String(period.year)
  if (period.mode === 'month') {
    const [, month] = period.month.split('-')
    return `${MONTH_LABELS[Number(month) - 1]} ${period.year}`
  }
  return new Date(`${period.date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function lastDayOfMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
}

function round1(value: number) {
  return Number(value.toFixed(1))
}

function summaryFromPeriodRow(
  row: MonthlyStat | DailyStat,
  yearSummary: AnalyticsSummary,
  range: { first_trip: string; latest_trip: string; active_days: number },
): AnalyticsSummary {
  return {
    trips: row.trips,
    total_trips: row.trips,
    member: row.member,
    casual: row.casual,
    classic: row.classic,
    electric: row.electric,
    not_published: row.not_published,
    member_share: row.member_share,
    electric_share_among_typed: row.electric_share_among_typed,
    avg_duration_minutes: row.avg_duration_minutes,
    median_duration_minutes: row.median_duration_minutes,
    p90_duration_minutes: row.p90_duration_minutes,
    total_duration_hours: row.total_duration_hours,
    member_duration_hours: row.member_duration_hours ?? 0,
    casual_duration_hours: row.casual_duration_hours ?? 0,
    total_stations: yearSummary.total_stations,
    stationless_starts: yearSummary.stationless_starts,
    unique_routes: yearSummary.unique_routes,
    after_dark_trips: row.after_dark_trips,
    after_dark_share: row.after_dark_share,
    station_metadata_complete_share: row.station_metadata_complete_share,
    coordinate_metadata_complete_share: row.coordinate_metadata_complete_share,
    estimated_miles_total: row.estimated_miles_total,
    estimated_miles_avg: row.estimated_miles_avg,
    estimated_miles_trip_coverage: row.estimated_miles_trip_coverage,
    first_trip: range.first_trip,
    latest_trip: range.latest_trip,
    active_days: range.active_days,
    trips_per_active_day: range.active_days > 0 ? round1(row.trips / range.active_days) : 0,
  }
}

function brushRange(monthly: MonthlyStat[], period: AnalyticsPeriod) {
  if (period.mode === 'all' || monthly.length === 0) {
    return { brushStartIndex: 0, brushEndIndex: Math.max(monthly.length - 1, 0) }
  }

  const prefix = `${period.year}-`
  let start = monthly.findIndex((row) => row.month.startsWith(prefix))
  if (start < 0) start = 0
  let end = start
  while (end + 1 < monthly.length && monthly[end + 1].month.startsWith(prefix)) end += 1

  if (period.mode === 'year') {
    return { brushStartIndex: start, brushEndIndex: end }
  }

  const index = monthly.findIndex((row) => row.month === period.month)
  if (index < 0) {
    return { brushStartIndex: start, brushEndIndex: end }
  }
  return { brushStartIndex: index, brushEndIndex: index }
}

function calendarCells(month: string, days: DailyStat[]) {
  const [year, monthNumber] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year, monthNumber - 1, 1))
  const weekdayIndex = (first.getUTCDay() + 6) % 7
  const totalDays = lastDayOfMonth(month)
  const byDate = new Map(days.map((row) => [row.date, row]))
  const leading = Array.from({ length: weekdayIndex }, () => null)
  const cells = Array.from({ length: totalDays }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`
    return byDate.get(date) ?? {
      date,
      trips: 0,
      member: 0,
      casual: 0,
      classic: 0,
      electric: 0,
      not_published: 0,
      member_share: 0,
      electric_share_among_typed: null,
      avg_duration_minutes: 0,
      median_duration_minutes: 0,
      p90_duration_minutes: 0,
      total_duration_hours: 0,
      member_duration_hours: 0,
      casual_duration_hours: 0,
      after_dark_trips: 0,
      after_dark_share: 0,
      estimated_miles_total: null,
      estimated_miles_avg: null,
      estimated_miles_trip_coverage: 0,
      coordinate_metadata_complete_share: 0,
      station_metadata_complete_share: 0,
      temp_mean_f: null,
      precip_in: null,
    } satisfies DailyStat
  })
  return [...leading, ...cells]
}

export function monthCalendar(analytics: Analytics, month: string) {
  const days = daysForMonth(analytics, month)
  return {
    weekdayLabels: WEEKDAY_LABELS,
    cells: calendarCells(month, days),
    maxTrips: days.reduce((max, row) => Math.max(max, row.trips), 0),
  }
}

export function filledDaysForMonth(analytics: Analytics, month: string): DailyStat[] {
  return monthCalendar(analytics, month).cells.filter((cell): cell is DailyStat => cell != null)
}

export function selectAnalyticsSlice(
  analytics: Analytics,
  period: AnalyticsPeriod,
): AnalyticsSlice {
  const pulseMonthly = analytics.monthly
  const brush = brushRange(pulseMonthly, period)
  const map_bounds = analytics.map_bounds
  const allDaily = analytics.daily ?? []

  if (period.mode === 'all') {
    return {
      period,
      label: periodLabel(period),
      summary: analytics.summary,
      monthly: analytics.monthly,
      daily: allDaily,
      yearly: analytics.yearly,
      weekday_hour: analytics.weekday_hour,
      top_start_stations: analytics.top_start_stations,
      top_end_stations: analytics.top_end_stations,
      after_dark_start_stations: analytics.after_dark_start_stations,
      after_dark_end_stations: analytics.after_dark_end_stations,
      common_routes: analytics.common_routes,
      member_summary: analytics.member_summary,
      bike_summary: analytics.bike_summary,
      stations: analytics.stations,
      map_bounds,
      pulseMonthly,
      ...brush,
      rankingsScopedToYear: false,
    }
  }

  const yearKey = String(period.year)
  const yearSlice = analytics.by_year[yearKey]
  if (!yearSlice) {
    return selectAnalyticsSlice(analytics, { mode: 'all' })
  }

  const yearDaily = allDaily.filter((row) => row.date.startsWith(`${period.year}-`))

  if (period.mode === 'year') {
    return {
      period,
      label: periodLabel(period),
      summary: yearSlice.summary,
      monthly: yearSlice.monthly,
      daily: yearDaily,
      yearly: analytics.yearly.filter((row) => row.year === period.year),
      weekday_hour: yearSlice.weekday_hour,
      top_start_stations: yearSlice.top_start_stations,
      top_end_stations: yearSlice.top_end_stations,
      after_dark_start_stations: yearSlice.after_dark_start_stations,
      after_dark_end_stations: yearSlice.after_dark_end_stations,
      common_routes: yearSlice.common_routes,
      member_summary: yearSlice.member_summary,
      bike_summary: yearSlice.bike_summary,
      stations: yearSlice.stations,
      map_bounds,
      pulseMonthly,
      ...brush,
      rankingsScopedToYear: false,
    }
  }

  const monthDays = daysForMonth(analytics, period.month)
  const monthRow = yearSlice.monthly.find((row) => row.month === period.month)
  const monthSummary = monthRow
    ? summaryFromPeriodRow(monthRow, yearSlice.summary, {
      first_trip: monthDays[0]?.date ?? `${period.month}-01`,
      latest_trip: monthDays[monthDays.length - 1]?.date ?? `${period.month}-${String(lastDayOfMonth(period.month)).padStart(2, '0')}`,
      active_days: monthDays.length,
    })
    : yearSlice.summary

  const monthStations = analytics.stations_by_month[period.month] ?? []

  if (period.mode === 'month') {
    return {
      period,
      label: periodLabel(period),
      summary: monthSummary,
      monthly: monthRow ? [monthRow] : [],
      daily: monthDays,
      yearly: analytics.yearly.filter((row) => row.year === period.year),
      weekday_hour: yearSlice.weekday_hour,
      top_start_stations: yearSlice.top_start_stations,
      top_end_stations: yearSlice.top_end_stations,
      after_dark_start_stations: yearSlice.after_dark_start_stations,
      after_dark_end_stations: yearSlice.after_dark_end_stations,
      common_routes: yearSlice.common_routes,
      member_summary: yearSlice.member_summary,
      bike_summary: yearSlice.bike_summary,
      stations: monthStations,
      map_bounds,
      pulseMonthly,
      ...brush,
      rankingsScopedToYear: true,
    }
  }

  const dayRow = monthDays.find((row) => row.date === period.date)
  const daySummary = dayRow
    ? summaryFromPeriodRow(dayRow, yearSlice.summary, {
      first_trip: period.date,
      latest_trip: period.date,
      active_days: dayRow.trips > 0 ? 1 : 0,
    })
    : monthSummary

  return {
    period,
    label: periodLabel(period),
    summary: daySummary,
    monthly: monthRow ? [monthRow] : [],
    daily: monthDays,
    yearly: analytics.yearly.filter((row) => row.year === period.year),
    weekday_hour: yearSlice.weekday_hour,
    top_start_stations: yearSlice.top_start_stations,
    top_end_stations: yearSlice.top_end_stations,
    after_dark_start_stations: yearSlice.after_dark_start_stations,
    after_dark_end_stations: yearSlice.after_dark_end_stations,
    common_routes: yearSlice.common_routes,
    member_summary: yearSlice.member_summary,
    bike_summary: yearSlice.bike_summary,
    stations: monthStations,
    map_bounds,
    pulseMonthly,
    ...brush,
    rankingsScopedToYear: true,
  }
}

export { MONTH_LABELS, WEEKDAY_LABELS }

export function selectRidershipSlice(analytics: Analytics, period: AnalyticsPeriod) {
  const empty = [] as Array<RidershipYear | RidershipMonth>
  const ridership = analytics.ridership
  if (!ridership) {
    return {
      available: false as const,
      eraStart: 2020,
      grain: 'year' as const,
      series: empty,
      totals: null,
      selectedKey: null as string | null,
      label: '2020–present',
    }
  }

  const eraStart = ridership.era_start
  if (period.mode !== 'all' && period.year < eraStart) {
    return {
      available: false as const,
      eraStart,
      grain: 'year' as const,
      series: empty,
      totals: null,
      selectedKey: null as string | null,
      label: String(period.year),
    }
  }

  if (period.mode === 'all') {
    return {
      available: true as const,
      eraStart,
      grain: 'year' as const,
      series: ridership.by_year,
      totals: ridership.totals,
      selectedKey: null as string | null,
      label: `${eraStart}–present`,
    }
  }

  const yearMonthly = ridership.monthly.filter((row) => row.year === period.year)
  if (period.mode === 'year') {
    return {
      available: true as const,
      eraStart,
      grain: 'month' as const,
      series: yearMonthly,
      totals: ridership.by_year.find((row) => row.year === period.year) ?? null,
      selectedKey: null as string | null,
      label: String(period.year),
    }
  }

  return {
    available: true as const,
    eraStart,
    grain: 'month' as const,
    series: yearMonthly,
    totals: yearMonthly.find((row) => row.month === period.month) ?? null,
    selectedKey: period.month,
    label: periodLabel(period),
  }
}
