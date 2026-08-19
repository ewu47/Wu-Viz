import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip as MapTooltip,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { cn } from '@/lib/utils'
import { fetchLiveStationsInZone, type LiveStation } from '@/services/gbfs'
import type {
  DemoDay,
  DemoDayTrip,
  MapBounds,
  StationMapPoint,
} from '@/services/api'

type MapMode = 'overview' | string

interface StationMapProps {
  stations: StationMapPoint[]
  archiveStations: StationMapPoint[]
  demoDays: DemoDay[]
  bounds: MapBounds
  periodLabel: string
  highlightedRoute?: { start_station: string; end_station: string } | null
}

function FitBounds({ bounds }: { bounds: MapBounds }) {
  const map = useMap()

  useEffect(() => {
    const apply = () => {
      map.invalidateSize()
      map.fitBounds(
        [
          [bounds.minLat, bounds.minLng],
          [bounds.maxLat, bounds.maxLng],
        ],
        { padding: [28, 28], maxZoom: 15 },
      )
    }

    apply()
    const frame = window.requestAnimationFrame(apply)
    const timeout = window.setTimeout(apply, 200)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [bounds, map])

  return null
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-8 rounded-full px-3.5 text-sm font-medium transition-[color,background-color,transform] duration-200',
        'hover:scale-[1.04] active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function markerRadius(trips: number, maxTrips: number) {
  if (maxTrips <= 0 || trips <= 0) return 5
  const t = Math.sqrt(trips / maxTrips)
  return 6 + t * 22
}

function formatClock(minute: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - 0.01, minute))
  const hours = Math.floor(clamped / 60)
  const mins = Math.floor(clamped % 60)
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function tripProgress(trip: DemoDayTrip, clockMinute: number) {
  const durationMinutes = Math.max(trip.duration_seconds / 60, 1.5)
  const endMinute = trip.start_minute + durationMinutes
  if (clockMinute < trip.start_minute || clockMinute > endMinute) return null
  return (clockMinute - trip.start_minute) / durationMinutes
}

function activeRidePositions(trips: DemoDayTrip[], clockMinute: number) {
  const rides: Array<{
    key: string
    lat: number
    lng: number
    start_station: string
    end_station: string
  }> = []

  trips.forEach((trip, index) => {
    const progress = tripProgress(trip, clockMinute)
    if (progress == null) return
    rides.push({
      key: `${trip.start_station}-${trip.end_station}-${trip.start_minute}-${index}`,
      lat: trip.start_lat + (trip.end_lat - trip.start_lat) * progress,
      lng: trip.start_lng + (trip.end_lng - trip.start_lng) * progress,
      start_station: trip.start_station,
      end_station: trip.end_station,
    })
  })

  return rides
}

const DAY_START = 5 * 60
const DAY_END = 23 * 60
const SPEEDS = [8, 20, 45] as const

function findStationPoint(name: string, lists: StationMapPoint[][]) {
  for (const list of lists) {
    const exact = list.find((row) => row.station === name)
    if (exact) return exact
  }
  const lower = name.toLowerCase()
  for (const list of lists) {
    const fuzzy = list.find((row) => row.station.toLowerCase() === lower)
    if (fuzzy) return fuzzy
  }
  return null
}

const START_COLOR = '#800000'
const END_COLOR = '#366d75'

export function StationMap({
  stations,
  archiveStations,
  demoDays,
  bounds,
  periodLabel,
  highlightedRoute = null,
}: StationMapProps) {
  const [mode, setMode] = useState<MapMode>('overview')
  const [showLive, setShowLive] = useState(false)
  const [liveStations, setLiveStations] = useState<LiveStation[]>([])
  const [liveError, setLiveError] = useState<string | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)

  const [playing, setPlaying] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(1)
  const [clockMinute, setClockMinute] = useState(DAY_START)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)

  const selectedDay = demoDays.find((day) => day.date === mode) ?? null
  const speed = SPEEDS[speedIndex] ?? 20
  const animating = playing && clockMinute < DAY_END
  const overviewStations = stations.length > 0 ? stations : archiveStations
  const usingArchiveFallback = mode === 'overview' && stations.length === 0 && archiveStations.length > 0
  const pairStart = highlightedRoute
    ? findStationPoint(highlightedRoute.start_station, [overviewStations, stations, archiveStations])
    : null
  const pairEnd = highlightedRoute
    ? findStationPoint(highlightedRoute.end_station, [overviewStations, stations, archiveStations])
    : null
  const pairOnMap = pairStart != null && pairEnd != null

  function selectMode(next: MapMode) {
    setMode(next)
    setPlaying(false)
    setClockMinute(DAY_START)
    lastTsRef.current = null
  }

  useEffect(() => {
    if (!showLive) return
    let cancelled = false

    fetchLiveStationsInZone(bounds)
      .then((rows) => {
        if (!cancelled) {
          setLiveStations(rows)
          setLiveError(null)
          setLiveLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLiveStations([])
          setLiveError(error instanceof Error ? error.message : 'Live GBFS feed unavailable')
          setLiveLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [showLive, bounds])

  useEffect(() => {
    if (!animating || !selectedDay) return

    const tick = (timestamp: number) => {
      if (lastTsRef.current == null) lastTsRef.current = timestamp
      const deltaSeconds = (timestamp - lastTsRef.current) / 1000
      lastTsRef.current = timestamp

      setClockMinute((current) => {
        const next = current + deltaSeconds * speed
        return next >= DAY_END ? DAY_END : next
      })

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTsRef.current = null
    }
  }, [animating, selectedDay, speed])

  const maxTrips = useMemo(
    () => overviewStations.reduce((max, row) => Math.max(max, row.mapped_trips), 0),
    [overviewStations],
  )

  const dayStations = useMemo(() => {
    if (!selectedDay) return []
    const names = new Set<string>()
    for (const trip of selectedDay.trips) {
      names.add(trip.start_station)
      names.add(trip.end_station)
    }
    const byName = new Map(archiveStations.map((row) => [row.station, row]))
    return [...names].flatMap((name) => {
      const row = byName.get(name)
      if (!row) return []
      return [row]
    })
  }, [selectedDay, archiveStations])

  const activeRides = useMemo(
    () => (selectedDay ? activeRidePositions(selectedDay.trips, clockMinute) : []),
    [selectedDay, clockMinute],
  )

  const center: [number, number] = [
    (bounds.minLat + bounds.maxLat) / 2,
    (bounds.minLng + bounds.maxLng) / 2,
  ]

  function toggleLive() {
    setShowLive((enabled) => {
      if (!enabled) {
        setLiveLoading(true)
        setLiveError(null)
        setLiveStations([])
      } else {
        setLiveLoading(false)
      }
      return !enabled
    })
  }

  const emptyOverview = overviewStations.length === 0 && mode === 'overview' && !showLive && !pairOnMap

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Map view">
        <Chip active={mode === 'overview'} onClick={() => selectMode('overview')}>
          Station overview
        </Chip>
        {demoDays.map((day) => (
          <Chip
            key={day.date}
            active={mode === day.date}
            onClick={() => selectMode(day.date)}
          >
            {day.label}
          </Chip>
        ))}
        <Chip active={showLive} onClick={toggleLive}>
          Live GBFS
        </Chip>
      </div>

      {selectedDay ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {selectedDay.blurb}{' '}
            <span className="font-mono text-xs">
              {selectedDay.trip_count.toLocaleString()} mapped trips · {selectedDay.station_count} stations · {selectedDay.date}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="min-h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
              onClick={() => {
                if (clockMinute >= DAY_END) setClockMinute(DAY_START)
                setPlaying((value) => !value)
              }}
            >
              {animating ? 'Pause' : clockMinute >= DAY_END ? 'Replay' : 'Play day'}
            </button>
            <button
              type="button"
              className="min-h-9 rounded-full bg-muted px-3 text-sm font-medium text-muted-foreground"
              onClick={() => setSpeedIndex((index) => (index + 1) % SPEEDS.length)}
            >
              {speed}×
            </button>
            <span className="font-mono text-sm text-foreground" aria-live="polite">
              {formatClock(clockMinute)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {activeRides.length} bikes moving
            </span>
          </div>
          <label className="block">
            <span className="sr-only">Scrub time of day</span>
            <input
              type="range"
              min={DAY_START}
              max={DAY_END}
              step={0.5}
              value={clockMinute}
              onChange={(event) => {
                setPlaying(false)
                setClockMinute(Number(event.target.value))
              }}
              className="w-full accent-[var(--primary)]"
            />
          </label>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {usingArchiveFallback
            ? `No map-quality coordinates in ${periodLabel}, so the overview shows all-time station locations.`
            : 'Pick a demo day to watch station-to-station movement unfold, or stay on the overview map. Demo days are fixed high-activity samples. Hover an OD pair to light up both stations.'}
        </p>
      )}

      {highlightedRoute ? (
        <p className="mt-3 font-mono text-xs text-foreground" aria-live="polite">
          {pairOnMap
            ? `Pairing ${highlightedRoute.start_station} → ${highlightedRoute.end_station} · maroon start, teal end`
            : `This pair is in the trip files, but ${!pairStart && !pairEnd ? 'neither station has' : 'one station is missing'} a published map centroid.`}
        </p>
      ) : null}

      {emptyOverview ? (
        <div className="mt-5 flex h-[460px] items-center justify-center rounded-2xl border border-border bg-muted/40 px-6 text-center text-sm text-muted-foreground">
          No map-quality station activity in {periodLabel}.
        </div>
      ) : (
        <div className="relative mt-5 h-[460px] w-full overflow-hidden rounded-2xl border border-border bg-muted">
          <MapContainer
            center={center}
            zoom={14}
            className="h-full w-full [&_.leaflet-control-attribution]:text-[10px]"
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds bounds={bounds} />

            {(selectedDay ? dayStations : overviewStations).map((station) => {
              const isStart = pairStart != null && station.station === pairStart.station
              const isEnd = pairEnd != null && station.station === pairEnd.station
              const isPairStation = isStart || isEnd
              const dimmed = highlightedRoute != null && !isPairStation
              const color = isEnd ? END_COLOR : START_COLOR

              return (
                <CircleMarker
                  key={station.station}
                  center={[station.lat, station.lng]}
                  radius={isPairStation ? 13 : selectedDay ? 6 : markerRadius(station.mapped_trips, maxTrips)}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: dimmed ? 0.08 : isPairStation ? 0.88 : selectedDay ? 0.22 : 0.38,
                    weight: isPairStation ? 3 : 1.5,
                    opacity: dimmed ? 0.16 : isPairStation ? 1 : selectedDay ? 0.55 : 0.9,
                  }}
                >
                  {isStart ? (
                    <MapTooltip permanent direction="top" offset={[0, -12]}>
                      Start · {station.station}
                    </MapTooltip>
                  ) : isEnd ? (
                    <MapTooltip permanent direction="bottom" offset={[0, 12]}>
                      End · {station.station}
                    </MapTooltip>
                  ) : (
                    <Popup>
                      <div className="min-w-40 font-sans text-sm">
                        <div className="font-semibold text-foreground">{station.station}</div>
                        {!selectedDay ? (
                          <>
                            <div className="mt-2 font-mono text-xs text-muted-foreground">
                              {station.mapped_trips.toLocaleString()} mapped trips
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {station.mapped_starts.toLocaleString()} starts · {station.mapped_ends.toLocaleString()} ends
                            </div>
                          </>
                        ) : (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Active on this demo day
                          </div>
                        )}
                      </div>
                    </Popup>
                  )}
                </CircleMarker>
              )
            })}

            {pairOnMap && pairStart && pairEnd ? (
              <>
                <Polyline
                  positions={[
                    [pairStart.lat, pairStart.lng],
                    [pairEnd.lat, pairEnd.lng],
                  ]}
                  pathOptions={{
                    color: END_COLOR,
                    weight: 3,
                    dashArray: '8 7',
                    opacity: 0.95,
                  }}
                />
                {!(selectedDay ? dayStations : overviewStations).some((row) => row.station === pairStart.station) ? (
                  <CircleMarker
                    key={`pair-start-${pairStart.station}`}
                    center={[pairStart.lat, pairStart.lng]}
                    radius={13}
                    pathOptions={{
                      color: START_COLOR,
                      fillColor: START_COLOR,
                      fillOpacity: 0.88,
                      weight: 3,
                    }}
                  >
                    <MapTooltip permanent direction="top" offset={[0, -12]}>
                      Start · {pairStart.station}
                    </MapTooltip>
                  </CircleMarker>
                ) : null}
                {!(selectedDay ? dayStations : overviewStations).some((row) => row.station === pairEnd.station) ? (
                  <CircleMarker
                    key={`pair-end-${pairEnd.station}`}
                    center={[pairEnd.lat, pairEnd.lng]}
                    radius={13}
                    pathOptions={{
                      color: END_COLOR,
                      fillColor: END_COLOR,
                      fillOpacity: 0.88,
                      weight: 3,
                    }}
                  >
                    <MapTooltip permanent direction="bottom" offset={[0, 12]}>
                      End · {pairEnd.station}
                    </MapTooltip>
                  </CircleMarker>
                ) : null}
              </>
            ) : null}

            {activeRides.map((ride) => (
              <CircleMarker
                key={ride.key}
                center={[ride.lat, ride.lng]}
                radius={5}
                pathOptions={{
                  color: '#4a6fa5',
                  fillColor: '#4a6fa5',
                  fillOpacity: 0.85,
                  weight: 1,
                }}
              >
                <Popup>
                  <div className="min-w-40 font-sans text-sm">
                    <div className="font-semibold text-foreground">
                      {ride.start_station} → {ride.end_station}
                    </div>
                    <div className="mt-2 text-[11px] leading-snug text-muted-foreground">
                      Station-to-station interpolation for demo playback—not a routed street path.
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {showLive
              ? liveStations.map((station) => (
                <CircleMarker
                  key={`live-${station.station_id}`}
                  center={[station.lat, station.lng]}
                  radius={7}
                  pathOptions={{
                    color: '#2f6f4e',
                    fillColor: '#2f6f4e',
                    fillOpacity: station.is_renting ? 0.55 : 0.2,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="min-w-40 font-sans text-sm">
                      <div className="font-semibold text-foreground">{station.name}</div>
                      <div className="mt-2 font-mono text-xs text-muted-foreground">
                        {station.num_bikes_available} bikes · {station.num_docks_available} docks
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))
              : null}
          </MapContainer>
        </div>
      )}

      <p className="mt-3 font-mono text-xs text-muted-foreground" aria-live="polite">
        {[
          selectedDay
            ? `Replay ${selectedDay.date}`
            : usingArchiveFallback
              ? `${overviewStations.length} all-time stations`
              : `${overviewStations.length} historical stations`,
          showLive
            ? liveLoading
              ? 'Loading live inventory…'
              : liveError
                ? `Live: ${liveError}`
                : `Live: ${liveStations.length} stations`
            : null,
        ].filter(Boolean).join(' · ')}
      </p>
    </div>
  )
}
