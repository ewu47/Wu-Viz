import type { MapBounds } from '@/services/api'

const GBFS_DISCOVERY = 'https://gbfs.divvybikes.com/gbfs/2.3/gbfs.json'

export interface LiveStation {
  station_id: string
  name: string
  lat: number
  lng: number
  capacity: number
  num_bikes_available: number
  num_docks_available: number
  is_renting: boolean
  is_returning: boolean
}

interface GbfsFeedIndex {
  data?: {
    en?: {
      feeds?: Array<{ name: string; url: string }>
    }
  }
}

interface StationInformationFeed {
  data?: {
    stations?: Array<{
      station_id: string
      name: string
      lat: number
      lon: number
      capacity?: number
    }>
  }
}

interface StationStatusFeed {
  data?: {
    stations?: Array<{
      station_id: string
      num_bikes_available?: number
      num_docks_available?: number
      is_renting?: boolean | number
      is_returning?: boolean | number
    }>
  }
}

function inBounds(lat: number, lng: number, bounds: MapBounds) {
  return (
    lat >= bounds.minLat
    && lat <= bounds.maxLat
    && lng >= bounds.minLng
    && lng <= bounds.maxLng
  )
}

function asBool(value: boolean | number | undefined, fallback = true) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  return fallback
}

export async function fetchLiveStationsInZone(bounds: MapBounds): Promise<LiveStation[]> {
  const discovery = await fetch(GBFS_DISCOVERY).then((response) => {
    if (!response.ok) throw new Error(`GBFS discovery failed (${response.status})`)
    return response.json() as Promise<GbfsFeedIndex>
  })

  const feeds = discovery.data?.en?.feeds ?? []
  const informationUrl = feeds.find((feed) => feed.name === 'station_information')?.url
  const statusUrl = feeds.find((feed) => feed.name === 'station_status')?.url
  if (!informationUrl || !statusUrl) {
    throw new Error('GBFS station feeds were not listed')
  }

  const [information, status] = await Promise.all([
    fetch(informationUrl).then((response) => {
      if (!response.ok) throw new Error(`station_information failed (${response.status})`)
      return response.json() as Promise<StationInformationFeed>
    }),
    fetch(statusUrl).then((response) => {
      if (!response.ok) throw new Error(`station_status failed (${response.status})`)
      return response.json() as Promise<StationStatusFeed>
    }),
  ])

  const statusById = new Map(
    (status.data?.stations ?? []).map((row) => [row.station_id, row]),
  )

  return (information.data?.stations ?? [])
    .filter((station) => inBounds(station.lat, station.lon, bounds))
    .map((station) => {
      const live = statusById.get(station.station_id)
      return {
        station_id: station.station_id,
        name: station.name,
        lat: station.lat,
        lng: station.lon,
        capacity: station.capacity ?? 0,
        num_bikes_available: live?.num_bikes_available ?? 0,
        num_docks_available: live?.num_docks_available ?? 0,
        is_renting: asBool(live?.is_renting),
        is_returning: asBool(live?.is_returning),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
