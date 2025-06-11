export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';


export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

export interface LongTrip {
  trip_id: string;
  start_time: string;
  end_time: string;
  station_type: string;
  station_name: string;
  lat: number;
  lng: number;
  member_casual: string;
}

export interface Trip {
  id: number;
  start_time: string;
  end_time: string;
  start_station_id: string;
  end_station_id: string;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  member_casual: string;
}

export interface Station {
  station_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
}

// Add all your new interfaces here
export interface StationStat {
  station_name: string;
  trip_count: number;
}

export interface Route {
  start_station: string;
  end_station: string;
  trip_count: number;
}

export interface HourlyData {
  hour: number;
  trip_count: number;
}

export interface MonthlyData {
  month: number;
  trip_count: number;
}

export interface MemberData {
  member_type: string;
  count: number;
}

export interface BikeTypeData {
  bike_type: string;
  count: number;
}

export interface DayData {
  day_of_week: number;
  trip_count: number;
}

export interface DurationData {
  member_type: string;
  avg_duration: number;
}

export interface MemberData {
  month: number;
  member_count : number;
  casual_count: number;
}

// Updated Analytics interface
export interface Analytics {
  long_uchicago_trips: LongTrip[];
  top_start_stations: StationStat[];
  top_end_stations: StationStat[];
  common_routes: Route[];
  trips_by_hour: HourlyData[];
  monthly_stats: MonthlyData[];
  popular_days: DayData[];
  member_breakdown: MemberData[];
  bike_types: BikeTypeData[];
  member_avg_duration: DurationData[];
  total_trips: [{ count: number }];
  total_stations: [{ count: number }];
  avg_duration: [{ avg: number }];
  avg_distance: [{ avg: number }];
  total_distance: [{ count: number }];
  total_duration: [{ count: number }];
  start_stations_after_9_pm: StationStat[];
  end_stations_after_9_pm: StationStat[];
  member_casual_user_count: MemberData[];
  time_trips: HourlyData[];
}

export interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export interface TableData {
  data: any[];
  total: number;
  limit: number;
  offset: number;
}

// Updated divvyApi to use only static data
export const divvyApi = {
  async getTrips(_filters?: {
    start_date?: string;
    end_date?: string;
    station?: string;
    limit?: number;
  }): Promise<ApiResponse<Trip[]>> {
    // For static deployment, return empty or mock data
    return {
      success: true,
      data: [],
      message: 'Static mode - trips data not available'
    };
  },

  async getStations(): Promise<ApiResponse<Station[]>> {
    // For static deployment, return empty or mock data
    return {
      success: true,
      data: [],
      message: 'Static mode - stations data not available'
    };
  },

  async getAnalytics(): Promise<ApiResponse<Analytics>> {
    try {
      // Always use static JSON file
      const response = await fetch('/analytics.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Loaded static analytics data:', data.data.generated_at);
      return data;
    } catch (error) {
      console.error('Error fetching static analytics:', error);
      return {
        success: false,
        data: {} as Analytics,
        message: error instanceof Error ? error.message : 'Failed to fetch static analytics'
      };
    }
  }
};

export const databaseApi = {
  async getTables(): Promise<ApiResponse<string[]>> {
    // For static deployment, return empty data
    return {
      success: true,
      data: [],
      message: 'Static mode - database access not available'
    };
  },
};
