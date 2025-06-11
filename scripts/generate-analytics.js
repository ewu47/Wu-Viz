import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function generateAnalytics() {
  try {
    console.log('Fetching analytics data...');
    
    const queries = await Promise.all([
      // Your existing queries from divvy.js
      pool.query('SELECT * FROM total_number_of_trips'),
      pool.query('SELECT * FROM total_number_of_stations'),
      pool.query('SELECT * FROM most_used_start_stations ORDER BY 4 DESC'),
      pool.query('SELECT * FROM most_used_end_stations ORDER BY 4 DESC'),
      pool.query(`SELECT * FROM member_casual_user_count ORDER BY CASE month WHEN 10 THEN 1 WHEN 11 THEN 2 WHEN 12 THEN 3 WHEN 1 THEN 4 WHEN 2 THEN 5 WHEN 3 THEN 6 WHEN 4 THEN 7 WHEN 5 THEN 8 ELSE 9 END`),
      pool.query('SELECT * FROM member_casual_avg_trip_duration'),
      pool.query('SELECT * FROM bike_type_count'),
      pool.query('SELECT * FROM bike_type_breakdown'),
      pool.query('SELECT * FROM bike_type_usage_by_member_casual'),
      pool.query(`SELECT * FROM most_popular_days_of_week ORDER BY CASE TRIM(UPPER(day_of_week)) WHEN 'MONDAY' THEN 1 WHEN 'TUESDAY' THEN 2 WHEN 'WEDNESDAY' THEN 3 WHEN 'THURSDAY' THEN 4 WHEN 'FRIDAY' THEN 5 WHEN 'SATURDAY' THEN 6 WHEN 'SUNDAY' THEN 7 ELSE 8 END`),
      pool.query('SELECT * FROM number_of_trips_time_of_day'),
      pool.query('SELECT * FROM monthly_trip_stats'),
      pool.query('SELECT * FROM avg_overall_trip_duration'),
      pool.query('SELECT * FROM avg_trip_distance'),
      pool.query('SELECT * FROM most_common_trip_station_routes ORDER BY trip_count DESC LIMIT 10'),
      pool.query('SELECT * FROM total_number_of_trips_not_at_stations'),
      pool.query('SELECT * FROM total_distance_covered'),
      pool.query('SELECT * FROM total_time_of_all_rides'),
      pool.query('SELECT * FROM long_uchicago_trips order by 3 ASC'),
      pool.query('SELECT * FROM start_stations_after_9pm'),
      pool.query('SELECT * FROM end_stations_after_9pm'),
      pool.query(`SELECT month, member_count, casual_count, member_percentage, casual_percentage FROM member_casual_user_count ORDER BY CASE month WHEN 10 THEN 1 WHEN 11 THEN 2 WHEN 12 THEN 3 WHEN 1 THEN 4 WHEN 2 THEN 5 WHEN 3 THEN 6 WHEN 4 THEN 7 WHEN 5 THEN 8 ELSE 9 END`),
      pool.query('SELECT * FROM number_of_trips_based_on_time')
    ]);

    const analyticsData = {
      success: true,
      data: {
        total_trips: queries[0].rows,
        total_stations: queries[1].rows,
        top_start_stations: queries[2].rows,
        top_end_stations: queries[3].rows,
        member_breakdown: queries[4].rows,
        member_avg_duration: queries[5].rows,
        bike_types: queries[6].rows,
        bike_breakdown: queries[7].rows,
        bike_usage_by_member: queries[8].rows,
        popular_days: queries[9].rows,
        trips_by_hour: queries[10].rows,
        monthly_stats: queries[11].rows,
        avg_duration: queries[12].rows,
        avg_distance: queries[13].rows,
        common_routes: queries[14].rows,
        trips_not_at_stations: queries[15].rows,
        total_distance: queries[16].rows,
        total_time: queries[17].rows,
        long_uchicago_trips: queries[18].rows,
        start_stations_after_9pm: queries[19].rows,
        end_stations_after_9pm: queries[20].rows,
        member_casual_user_count: queries[21].rows,
        time_trips: queries[22].rows,
        raw_data: true,
        generated_at: new Date().toISOString()
      }
    };

    // Ensure public directory exists
    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Write analytics data to public/analytics.json
    const outputPath = path.join(publicDir, 'analytics.json');
    fs.writeFileSync(outputPath, JSON.stringify(analyticsData, null, 2));

    console.log('Analytics data generated successfully at:', outputPath);
    console.log('Data timestamp:', analyticsData.data.generated_at);
    
  } catch (error) {
    console.error('Error generating analytics:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

generateAnalytics();
