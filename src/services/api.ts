export interface AnalyticsSummary {
  trips: number
  /** @deprecated Prefer `trips`; kept for compatibility */
  total_trips: number
  member: number
  casual: number
  classic: number
  electric: number
  not_published: number
  member_share: number
  electric_share_among_typed: number | null
  avg_duration_minutes: number
  median_duration_minutes: number
  p90_duration_minutes: number
  total_duration_hours: number
  member_duration_hours: number
  casual_duration_hours: number
  total_stations: number
  stationless_starts: number
  unique_routes: number
  after_dark_trips: number
  after_dark_share: number
  station_metadata_complete_share: number
  coordinate_metadata_complete_share: number
  estimated_miles_total: number | null
  estimated_miles_avg: number | null
  estimated_miles_trip_coverage: number
  first_trip: string
  latest_trip: string
  active_days: number
  trips_per_active_day: number
}

export interface PeriodStat {
  trips: number
  member: number
  casual: number
  classic: number
  electric: number
  not_published: number
  member_share: number
  electric_share_among_typed: number | null
  avg_duration_minutes: number
  median_duration_minutes: number
  p90_duration_minutes: number
  total_duration_hours: number
  member_duration_hours: number
  casual_duration_hours: number
  after_dark_trips: number
  after_dark_share: number
  estimated_miles_total: number | null
  estimated_miles_avg: number | null
  estimated_miles_trip_coverage: number
  coordinate_metadata_complete_share: number
  station_metadata_complete_share: number
}

export interface MonthlyStat extends PeriodStat {
  month: string
}

export interface DailyStat extends PeriodStat {
  date: string
  temp_mean_f: number | null
  precip_in: number | null
}

export interface YearlyStat extends PeriodStat {
  year: number
}

export interface WeekdayHourStat {
  weekday: number
  hour: number
  trips: number
  member: number
  casual: number
}

export interface StationStat {
  station: string
  trips: number
  avg_duration_minutes: number | null
  estimated_miles_avg: number | null
}

export interface RouteStat {
  start_station: string
  end_station: string
  trips: number
  avg_duration_minutes: number | null
  estimated_miles_avg: number | null
}

export interface MemberSummary {
  type: 'casual' | 'member'
  trips: number
  avg_duration_minutes: number
  median_duration_minutes: number
  total_duration_hours: number
  estimated_miles_total: number | null
  estimated_miles_avg: number | null
}

export interface BikeSummary {
  type: 'classic_bike' | 'electric_bike' | 'not_published'
  trips: number
  avg_duration_minutes: number | null
  estimated_miles_total: number | null
  estimated_miles_avg: number | null
}

export interface StationMapPoint {
  station: string
  lat: number
  lng: number
  /** Coordinate-backed start+end observations only; name-only trips excluded */
  mapped_trips: number
  mapped_starts: number
  mapped_ends: number
}

export interface DemoDayTrip {
  start_station: string
  end_station: string
  start_lat: number
  start_lng: number
  end_lat: number
  end_lng: number
  /** Minutes from local midnight */
  start_minute: number
  duration_seconds: number
  member_casual: string
  rideable_type: string
}

export interface DemoDay {
  date: string
  label: string
  blurb: string
  trip_count: number
  station_count: number
  trips: DemoDayTrip[]
}

export interface MapBounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export interface YearAnalytics {
  summary: AnalyticsSummary
  monthly: MonthlyStat[]
  weekday_hour: WeekdayHourStat[]
  top_start_stations: StationStat[]
  top_end_stations: StationStat[]
  after_dark_start_stations: StationStat[]
  after_dark_end_stations: StationStat[]
  common_routes: RouteStat[]
  member_summary: MemberSummary[]
  bike_summary: BikeSummary[]
  stations: StationMapPoint[]
}

export interface Analytics {
  summary: AnalyticsSummary
  monthly: MonthlyStat[]
  daily?: DailyStat[]
  yearly: YearlyStat[]
  weekday_hour: WeekdayHourStat[]
  top_start_stations: StationStat[]
  top_end_stations: StationStat[]
  after_dark_start_stations: StationStat[]
  after_dark_end_stations: StationStat[]
  common_routes: RouteStat[]
  member_summary: MemberSummary[]
  bike_summary: BikeSummary[]
  stations: StationMapPoint[]
  stations_by_month: Record<string, StationMapPoint[]>
  demo_days: DemoDay[]
  covid: CovidComparison
  weather: WeatherAnalysis
  ridership?: RidershipAnalysis
  forecast: MonthForecast
  by_year: Record<string, YearAnalytics>
  map_bounds: MapBounds
  generated_at: string
}

export interface CovidEraSlice {
  summary: AnalyticsSummary
  weekday_hour: WeekdayHourStat[]
}

export interface CovidComparison {
  definition: {
    pre_end: string
    post_start: string
    note: string
  }
  pre: CovidEraSlice
  post: CovidEraSlice
}

export interface WeatherTempBin {
  label: string
  days: number
  trips: number
  avg_trips_per_day: number
}

export interface WeatherAnalysis {
  source: string
  attribution: string
  days_joined: number
  by_temperature_bin: WeatherTempBin[]
  precip: {
    dry_days: number
    wet_days: number
    dry_avg_trips: number
    wet_avg_trips: number
    wet_threshold_inches: number
  }
  monthly: Array<{
    month: string
    trips: number
    avg_temp_f: number
    precip_inches: number
    avg_trips_per_day: number
  }>
}

export interface MonthForecast {
  target_month: string
  based_on_latest_trip: string
  method: string
  predicted_trips: number | null
  low: number | null
  high: number | null
  predicted_trips_per_day: number | null
  components: {
    seasonal_same_month: number | null
    same_month_last_year: number | null
    trend_ratio: number
    weather_adjustment: number
    expected_temp_f: number | null
    expected_precip_in: number | null
    same_month_samples: number
  }
  backtest: {
    months_scored: number
    mae_trips: number | null
    mape: number | null
    error_stdev: number | null
    recent: Array<{
      month: string
      actual: number
      predicted: number
      abs_error: number
      pct_error: number
    }>
  }
  learning_notes: string[]
}

export interface RidershipPeriod {
  trips: number
  member: number
  casual: number
  classic: number
  electric: number
  duration_minutes: number
  member_share: number
  electric_share: number | null
  avg_duration_minutes: number
  walkup_cost: number
  member_usage_cost: number
  member_walkup_cost: number
  estimated_savings: number
  cta_equivalent: number
  savings_per_member_trip: number
}

export interface RidershipYear extends RidershipPeriod {
  year: number
}

export interface RidershipMonth extends RidershipPeriod {
  year: number
  month: string
}

export interface RidershipAnalysis {
  era_start: number
  cta_fare: number
  note: string
  sources: string[]
  by_year: RidershipYear[]
  monthly: RidershipMonth[]
  totals: RidershipPeriod
}

export type AnalyticsPeriod =
  | { mode: 'all' }
  | { mode: 'year'; year: number }
  | { mode: 'month'; year: number; month: string }
  | { mode: 'day'; year: number; month: string; date: string }

export interface AnalyticsSlice {
  period: AnalyticsPeriod
  label: string
  summary: AnalyticsSummary
  monthly: MonthlyStat[]
  daily: DailyStat[]
  yearly: YearlyStat[]
  weekday_hour: WeekdayHourStat[]
  top_start_stations: StationStat[]
  top_end_stations: StationStat[]
  after_dark_start_stations: StationStat[]
  after_dark_end_stations: StationStat[]
  common_routes: RouteStat[]
  member_summary: MemberSummary[]
  bike_summary: BikeSummary[]
  stations: StationMapPoint[]
  map_bounds: MapBounds
  /** Full-history monthly series for the pulse chart */
  pulseMonthly: MonthlyStat[]
  brushStartIndex: number
  brushEndIndex: number
  rankingsScopedToYear: boolean
}

interface AnalyticsResponse {
  success: boolean
  data: Analytics
  message?: string
}

export const divvyApi = {
  async getAnalytics(): Promise<AnalyticsResponse> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}analytics.json`)
      if (!response.ok) {
        throw new Error(`Analytics request failed (${response.status})`)
      }
      return await response.json() as AnalyticsResponse
    } catch (error) {
      return {
        success: false,
        data: {} as Analytics,
        message: error instanceof Error ? error.message : 'Analytics could not be loaded',
      }
    }
  },
}
