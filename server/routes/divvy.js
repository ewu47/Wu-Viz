const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// Get analytics from your actual tables
router.get('/analytics', async (req, res) => {
  try {
    const queries = await Promise.all([
      // Basic stats
      pool.query('SELECT * FROM total_number_of_trips'),
      pool.query('SELECT * FROM total_number_of_stations'),
      
      // Station analysis
      pool.query('SELECT * FROM most_used_start_stations ORDER BY 4 DESC'),
      pool.query('SELECT * FROM most_used_end_stations ORDER BY 4 DESC'),
      
      // User analysis
      pool.query(`
        SELECT * FROM member_casual_user_count 
        ORDER BY 
          CASE month
            WHEN 10 THEN 1
            WHEN 11 THEN 2
            WHEN 12 THEN 3
            WHEN 1 THEN 4
            WHEN 2 THEN 5
            WHEN 3 THEN 6
            WHEN 4 THEN 7
            WHEN 5 THEN 8
            ELSE 9
          END
      `),
      pool.query('SELECT * FROM member_casual_avg_trip_duration'),
      
      // Bike analysis
      pool.query('SELECT * FROM bike_type_count'),
      pool.query('SELECT * FROM bike_type_breakdown'),
      pool.query('SELECT * FROM bike_type_usage_by_member_casual'),
      
      // Trends analysis
      pool.query(`SELECT * FROM most_popular_days_of_week 
            ORDER BY
              CASE TRIM(UPPER(day_of_week))
                WHEN 'MONDAY' THEN 1
                WHEN 'TUESDAY' THEN 2
                WHEN 'WEDNESDAY' THEN 3
                WHEN 'THURSDAY' THEN 4
                WHEN 'FRIDAY' THEN 5
                WHEN 'SATURDAY' THEN 6
                WHEN 'SUNDAY' THEN 7
                ELSE 8
              END;`),
      pool.query('SELECT * FROM number_of_trips_time_of_day'),
      pool.query('SELECT * FROM monthly_trip_stats'),
      
      // Trip analysis
      pool.query('SELECT * FROM avg_overall_trip_duration'),
      pool.query('SELECT * FROM avg_trip_distance'),
      pool.query('SELECT * FROM most_common_trip_station_routes ORDER BY trip_count DESC LIMIT 10'),
      
      // Other stats
      pool.query('SELECT * FROM total_number_of_trips_not_at_stations'),
      pool.query('SELECT * FROM total_distance_covered'),
      pool.query('SELECT * FROM total_time_of_all_rides'),

      // long trips
      pool.query('SELECT * FROM long_uchicago_trips order by 3 ASC'),

      // stations after 9 PM
      pool.query('SELECT * FROM start_stations_after_9pm'),
      pool.query('SELECT * FROM end_stations_after_9pm'),
      
      // member distribution
      pool.query(`SELECT month, member_count, casual_count, member_percentage, casual_percentage
          FROM member_casual_user_count 
          ORDER BY 
            CASE month
              WHEN 10 THEN 1
              WHEN 11 THEN 2
              WHEN 12 THEN 3
              WHEN 1 THEN 4
              WHEN 2 THEN 5
              WHEN 3 THEN 6
              WHEN 4 THEN 7
              WHEN 5 THEN 8
              ELSE 9
            END;`),         
    
    // time query
    pool.query('SELECT * FROM number_of_trips_based_on_time;')
    ]);
    res.json({
      success: true,
      data: {
        // Basic stats
        total_trips: queries[0].rows,
        total_stations: queries[1].rows,
        
        // Station analysis
        top_start_stations: queries[2].rows,
        top_end_stations: queries[3].rows,
        
        // User analysis
        member_breakdown: queries[4].rows,
        member_avg_duration: queries[5].rows,
        
        // Bike analysis
        bike_types: queries[6].rows,
        bike_breakdown: queries[7].rows,
        bike_usage_by_member: queries[8].rows,
        
        // Temporal analysis
        popular_days: queries[9].rows,
        trips_by_hour: queries[10].rows,
        monthly_stats: queries[11].rows,
        
        // Trip analysis
        avg_duration: queries[12].rows,
        avg_distance: queries[13].rows,
        common_routes: queries[14].rows,
        
        // Other
        trips_not_at_stations: queries[15].rows,
        total_distance: queries[16].rows,
        total_time: queries[17].rows,
        
        long_uchicago_trips : queries[18].rows,
        //after 9 pm
        start_stations_after_9pm: queries[19].rows,
        end_stations_after_9pm: queries[20].rows,

        // member distribution
        member_casual_user_count: queries[21].rows,
        time_trips: queries[22].rows,
        
        raw_data: true
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

module.exports = router;
