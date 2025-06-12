import React, { useState, useEffect } from 'react';
import { divvyApi } from '../services/api';
import ReactECharts from 'echarts-for-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadarController,
  RadialLinearScale,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

// Import the image
import mapZoneImage from '/map-zone.png';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadarController,
  RadialLinearScale
);

const DivvyProject: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown states for combined charts
  const [startStationsView, setStartStationsView] = useState<'all_day' | 'after_9pm'>('all_day');
  const [endStationsView, setEndStationsView] = useState<'all_day' | 'after_9pm'>('all_day');
  const [hourlyView, setHourlyView] = useState<'by_period' | 'by_hour'>('by_period');
  const [monthlyView, setMonthlyView] = useState<'total_trips' | 'user_distribution' | 'bike_types' | 'avg_duration'>('total_trips');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching static analytics data...');
        
        const response = await divvyApi.getAnalytics();
        if (response.success) {
          setAnalytics(response.data);
          console.log('Static data loaded successfully');
        } else {
          setError(response.message || 'Failed to fetch data');
        }
      } catch (err) {
        console.error('Error loading static data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred loading static data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Chart data preparation functions
  const getTopStartStationsChartData = () => {
    if (!analytics?.top_start_stations) return null;

    const stations = analytics.top_start_stations;
    const barThickness = stations.length > 20 ? 15 : stations.length > 10 ? 25 : 35;

    return {
      labels: stations.map((station: any) => {
        const name = Object.values(station)[0] as string;
        return name.length > 30 ? name.substring(0, 30) + '...' : name;
      }),
      datasets: [
        {
          label: 'Number of Trips',
          data: stations.map((station: any) => Object.values(station)[3]),
          backgroundColor: 'rgba(128, 0, 0, 0.8)',
          borderColor: 'rgba(128, 0, 0, 1)',
          borderWidth: 1,
          barThickness: barThickness,
          maxBarThickness: 40,
        },
      ],
    };
  };

  const getTopEndStationsChartData = () => {
    if (!analytics?.top_end_stations) return null;

    const stations = analytics.top_end_stations;
    const barThickness = stations.length > 20 ? 15 : stations.length > 10 ? 25 : 35;

    return {
      labels: stations.map((station: any) => {
        const name = Object.values(station)[0] as string;
        return name.length > 30 ? name.substring(0, 30) + '...' : name;
      }),
      datasets: [
        {
          label: 'Number of Trips',
          data: stations.map((station: any) => Object.values(station)[3]),
          backgroundColor: 'rgba(128, 0, 0, 0.8)',
          borderColor: 'rgba(128, 0, 0, 1)',
          borderWidth: 1,
          barThickness: barThickness,
          maxBarThickness: 40,
        },
      ],
    };
  };
  const getHourlyTripsData = () => {
    if (!analytics?.trips_by_hour) return null;

    return {
      labels: ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'],
      datasets: [
        {
          label: 'Overnight Trips',
          data: analytics.trips_by_hour.map((hour: any) => Object.values(hour)[1]),
          borderColor: 'rgba(128, 0, 0, 1)',
          backgroundColor: 'rgba(128, 0, 0, 0.1)',
          tension: 0.1,
        },
        {
          label: 'Morning Trips',
          data: analytics.trips_by_hour.map((row: any) => Object.values(row)[2]),
          borderColor: 'rgba(255, 140, 0, 1)',
          backgroundColor: 'rgba(255, 140, 0, 0.1)',
          tension: 0.1,
        },
        {
          label: 'Afternoon Trips',
          data: analytics.trips_by_hour.map((row: any) => Object.values(row)[3]),
          borderColor: 'rgba(220, 20, 60, 1)',
          backgroundColor: 'rgba(220, 20, 60, 0.1)',
          tension: 0.1,
        },
        {
          label: 'Evening Trips',
          data: analytics.trips_by_hour.map((row: any) => Object.values(row)[4]),
          borderColor: 'rgba(128, 0, 128, 1)',
          backgroundColor: 'rgba(128, 0, 128, 0.1)',
          tension: 0.1,
        },
      ],
    };
  };

  const getMonthlyTripsData = () => {
    if (!analytics?.monthly_stats) return null;

    const months = ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'];
    const data = analytics.monthly_stats;
    const barThickness = data.length > 8 ? 20 : 30;

    return {
      labels: data.map((_: any, index: number) => months[index] || `Month ${index + 1}`),
      datasets: [
        {
          label: 'Monthly Trips',
          data: data.map((month: any) => Object.values(month)[1]),
          backgroundColor: 'rgba(128, 0, 0, 0.8)',
          borderColor: 'rgba(128, 0, 0, 1)',
          borderWidth: 1,
          barThickness: barThickness,
          maxBarThickness: 35,
        },
      ],
    };
  };

  const getMemberDistributionData = () => {
    if(!analytics?.member_casual_user_count) return null;

    return {
      labels: ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'],
      datasets: [
        {
          label: 'Member Count',
          data: analytics.member_casual_user_count.map((row: any) => Object.values(row)[1]), // member_count column
          backgroundColor: 'rgba(128, 0, 0, 0.8)',
          borderColor: 'rgba(128, 0, 0, 1)',
          borderWidth: 1,
          barThickness: 20,
          maxBarThickness: 35,
        },
        {
          label: 'Casual User Count',
          data: analytics.member_casual_user_count.map((row: any) => Object.values(row)[2]), // casual_count column
          backgroundColor: 'rgba(220, 20, 60, 0.8)',
          borderColor: 'rgba(220, 20, 60, 1)',
          borderWidth: 1,
          barThickness: 20,
          maxBarThickness: 35,
        },
      ],
    };
  };

  const getBikeTypesData = () => {
    if (!analytics?.bike_breakdown) return null;

    return {
      labels: ['Classic Bikes', 'Electric Bikes'],
      datasets: [
        {
          label: 'Count',
          data: analytics.bike_breakdown.map((item: any) => Object.values(item)[1]),
          backgroundColor: [
            'rgba(128, 0, 0, 0.8)',
            'rgba(165, 42, 42, 0.8)',
            'rgba(220, 20, 60, 0.8)',
            'rgba(178, 34, 34, 0.8)',
          ],
          borderColor: [
            'rgba(128, 0, 0, 1)',
            'rgba(165, 42, 42, 1)',
            'rgba(220, 20, 60, 1)',
            'rgba(178, 34, 34, 1)',
          ],
          borderWidth: 2,
        },
      ],
    };
  };

  const getPopularDaysData = () => {
    if (!analytics?.popular_days) return null;

    return {
      labels: analytics.popular_days.map((day: any) => Object.values(day)[0]),
      datasets: [
        {
          label: 'Total ',
          data: analytics.popular_days.map((day: any) => Object.values(day)[1]),
          borderColor: 'rgba(128, 0, 0, 1)',
          backgroundColor: 'rgba(128, 0, 0, 0.1)',
          tension: 0.1,
        },
      ],
    };
  };

  const getCommonRoutesData = () => {
    if (!analytics?.common_routes) return null;

    const routes = analytics.common_routes;
    const barThickness = routes.length > 20 ? 12 : routes.length > 10 ? 20 : 30;

    return {
      labels: routes.map((route: any) => {
        const values = Object.values(route);
        const routeName = `${values[0]} → ${values[3]}`;
        return routeName.length > 35 ? routeName.substring(0, 35) + '...' : routeName;
      }),
      datasets: [
        {
          label: 'Trip Count',
          data: routes.map((route: any) => Object.values(route)[6]),
          backgroundColor: 'rgba(165, 42, 42, 0.8)',
          borderColor: 'rgba(165, 42, 42, 1)',
          borderWidth: 1,
          barThickness: barThickness,
          maxBarThickness: 35,
          // Store full route names for tooltip
          fullRouteNames: routes.map((route: any) => {
            const values = Object.values(route);
            return `${values[0]} → ${values[3]}`;
          }),
        },
      ],
    };
  };

  const getDurationComparisonData = () => {
    if (!analytics?.member_avg_duration) return null;

    const data = analytics.member_avg_duration;
    const barThickness = data.length > 5 ? 30 : 50;

    return {
      labels: ['Casual Users', 'Members'],
      datasets: [
        {
          label: 'Average Duration (minutes)',
          data: data.map((item: any) => Object.values(item)[1]),
          backgroundColor: [
            'rgba(220, 20, 60, 0.8)',
            'rgba(178, 34, 34, 0.8)',
          ],
          borderColor: [
            'rgba(220, 20, 60, 1)',
            'rgba(178, 34, 34, 1)',
          ],
          borderWidth: 2,
          barThickness: barThickness,
          maxBarThickness: 60,
        },
      ],
    };
  };

  const getStartStationsAfter9pmData = () => {
    if (!analytics?.start_stations_after_9pm) return null;

    const stations = analytics.start_stations_after_9pm;
    const barThickness = stations.length > 20 ? 15 : stations.length > 10 ? 25 : 35;

    return {
      labels: stations.map((station: any) => {
        const name = Object.values(station)[0] as string;
        return name.length > 30 ? name.substring(0, 30) + '...' : name;
      }),
      datasets: [
        {
          label: 'Trips After 9 PM',
          data: stations.map((station: any) => Object.values(station)[1]),
          backgroundColor: 'rgba(165, 42, 42, 0.8)',
          borderColor: 'rgba(165, 42, 42, 1)',
          borderWidth: 1,
          barThickness: barThickness,
          maxBarThickness: 35,
        },
      ],
    };
  };

  const getEndStationsAfter9pmData = () => {
    if (!analytics?.end_stations_after_9pm) return null;

    const stations = analytics.end_stations_after_9pm;
    const barThickness = stations.length > 20 ? 15 : stations.length > 10 ? 25 : 35;

    return {
      labels: stations.map((station: any) => {
        const name = Object.values(station)[0] as string;
        return name.length > 30 ? name.substring(0, 30) + '...' : name;
      }),
      datasets: [
        {
          label: 'Trips After 9 PM',
          data: stations.map((station: any) => Object.values(station)[1]),
          backgroundColor: 'rgba(165, 42, 42, 0.8)',
          borderColor: 'rgba(165, 42, 42, 1)',
          borderWidth: 1,
          barThickness: barThickness,
          maxBarThickness: 35,
        },
      ],
    };
  };

  const getHourlyTimeData = () => {
    if (!analytics?.time_trips) return null;
    const hours = analytics.time_trips;
    return {
      labels: hours.map((hour: any) => Object.values(hour)[0]),
      datasets: [
        {
          label: 'Total Trips',
          data: hours.map((hour: any) => Object.values(hour)[1]),
          borderColor: 'rgba(128, 0, 0, 1)',
          backgroundColor: 'rgba(128, 0, 0, 0.1)',
          tension: 0.1,
        },
      ],
    };
  };

  const getMonthlyBikeTypesData = () => {
    if (!analytics?.monthly_stats) return null;
    const months = ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'];
    const data = analytics.monthly_stats;
    const barThickness = data.length > 8 ? 20 : 30;
    return {
      labels: data.map((_: any, index: number) => months[index] || `Month ${index + 1}`),
      datasets: [
        {
          label: 'Classic Bikes',
          data: data.map((month: any) => Object.values(month)[4]), 
          backgroundColor: 'rgba(128, 0, 0, 0.8)',
          borderColor: 'rgba(128, 0, 0, 1)',
          borderWidth: 1,
          barThickness: barThickness,
          maxBarThickness: 35,
        },
        {
          label: 'Electric Bikes',
          data: data.map((month: any) => Object.values(month)[3]), 
          backgroundColor: 'rgba(220, 20, 60, 0.8)',
          borderColor: 'rgba(220, 20, 60, 1)',
          borderWidth: 1,
          barThickness: barThickness,
          maxBarThickness: 35,
        },
      ]
    };
  }

  const getMonthAvgDurationData = () => {
    if (!analytics?.monthly_stats) return null;
    const months = ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'];
    const data = analytics.monthly_stats;
    const barThickness = data.length > 8 ? 20 : 30;
    return {
      labels: data.map((_: any, index: number) => months[index] || `Month ${index + 1}`),
      datasets: [
        {
          label: 'Average Duration (minutes)',
          data: data.map((month: any) => Object.values(month)[2]),
          backgroundColor: 'rgba(128, 0, 0, 0.8)',
          borderColor: 'rgba(128, 0, 0, 1)',
          borderWidth: 1,
          barThickness: barThickness,
          maxBarThickness: 35,
        },
      ],
    };
  };

  const getAnimatedTripsOption = () => {
    if (!analytics?.monthly_stats) return null;

    const months = ['October 2024', 'November 2024', 'December 2024', 'January 2025', 'February 2025', 'March 2025', 'April 2025', 'May 2025'];
    
    // Calculate cumulative trips
    let cumulativeTotal = 0;
    const data = analytics.monthly_stats.map((month: any, index: number) => {
      cumulativeTotal += Number(Object.values(month)[1]);
      return {
        name: months[index],
        value: [months[index], cumulativeTotal],
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: '#ff6b6b'
            }, {
              offset: 0.5, color: '#800000'
            }, {
              offset: 1, color: '#4a0000'
            }]
          }
        }
      };
    });

    // Get current window dimensions for responsive sizing
    const isSmallScreen = window.innerWidth < 768;
    const isMediumScreen = window.innerWidth < 1024;

    return {
      backgroundColor: {
        type: 'radial',
        x: 0.3,
        y: 0.3,
        r: 0.8,
        colorStops: [{
          offset: 0, color: 'rgba(255,255,255,1)'
        }, {
          offset: 1, color: 'rgba(248,248,255,0.8)'
        }]
      },
      title: {
        text: 'Trips over Time',
        subtext: 'UChicago/Hyde Park Divvy Bike Usage',
        left: 'center',
        top: isSmallScreen ? '3%' : '5%',
        textStyle: {
          color: '#800000',
          fontSize: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
          fontWeight: 'bold',
          textShadowColor: 'rgba(0, 0, 0, 0.1)',
          textShadowBlur: 3,
          textShadowOffsetX: 2,
          textShadowOffsetY: 2
        },
        subtextStyle: {
          color: '#666',
          fontSize: isSmallScreen ? 10 : isMediumScreen ? 12 : 14,
          fontStyle: 'italic'
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: '#800000',
        borderWidth: 2,
        textStyle: {
          color: '#fff',
          fontSize: isSmallScreen ? 12 : 14
        },
        formatter: function(params: any) {
          const dataPoint = params[0];
          return `
            <div style="padding: ${isSmallScreen ? '6px' : '8px'};">
              <div style="font-weight: bold; color: #ff6b6b; margin-bottom: 5px; font-size: ${isSmallScreen ? '11px' : '13px'};">${dataPoint.axisValue}</div>
              <div style="color: #fff; font-size: ${isSmallScreen ? '10px' : '12px'};">🚲 ${dataPoint.seriesName}: <span style="color: #ffeb3b; font-weight: bold;">${dataPoint.value[1].toLocaleString()}</span></div>
            </div>
          `;
        },
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: '#800000',
            width: 2,
            type: 'dashed'
          }
        }
      },
      grid: {
        top: isSmallScreen ? '20%' : '25%',
        left: isSmallScreen ? '5%' : '8%',
        right: isSmallScreen ? '5%' : '8%',
        bottom: isSmallScreen ? '20%' : '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: {
          rotate: isSmallScreen ? 50 : 45,
          fontSize: isSmallScreen ? 8 : isMediumScreen ? 10 : 12,
          color: '#666',
          fontWeight: 'bold',
          interval: 0, // Show all labels
          margin: isSmallScreen ? 8 : 12
        },
        axisLine: {
          lineStyle: {
            color: '#800000',
            width: isSmallScreen ? 1 : 2
          }
        },
        axisTick: {
          alignWithLabel: true,
          lineStyle: {
            color: '#800000'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: isSmallScreen ? 'Total Trips' : 'Total Cumulative Trips',
        nameLocation: 'middle',
        nameGap: isSmallScreen ? 40 : 60,
        nameTextStyle: {
          color: '#800000',
          fontSize: isSmallScreen ? 10 : isMediumScreen ? 12 : 16,
          fontWeight: 'bold',
          rotation: 90
        },
        axisLabel: {
          formatter: function(value: number) {
            if (value >= 1000000) {
              return (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              return (value / 1000).toFixed(0) + 'K';
            }
            return value.toString();
          },
          fontSize: isSmallScreen ? 8 : isMediumScreen ? 10 : 12,
          color: '#666',
          fontWeight: 'bold'
        },
        axisLine: {
          lineStyle: {
            color: '#800000',
            width: isSmallScreen ? 1 : 2
          }
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(128, 0, 0, 0.1)',
            type: 'dashed'
          }
        }
      },
      series: [{
        name: 'Cumulative Trips',
        type: 'line',
        data: data,
        smooth: true,
        symbol: 'circle',
        symbolSize: function(_value: any, params: any) {
          const baseSize = isSmallScreen ? 6 : 8;
          const increment = isSmallScreen ? 1 : 2;
          return Math.max(baseSize, Math.min(baseSize + 6, params.dataIndex * increment + baseSize));
        },
        lineStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [{
              offset: 0, color: '#ff6b6b'
            }, {
              offset: 0.5, color: '#800000'
            }, {
              offset: 1, color: '#4a0000'
            }]
          },
          width: isSmallScreen ? 3 : 4,
          shadowColor: 'rgba(128, 0, 0, 0.3)',
          shadowBlur: isSmallScreen ? 8 : 10,
          shadowOffsetY: isSmallScreen ? 2 : 3
        },
        itemStyle: {
          color: '#800000',
          borderColor: '#fff',
          borderWidth: isSmallScreen ? 2 : 3,
          shadowColor: 'rgba(128, 0, 0, 0.4)',
          shadowBlur: isSmallScreen ? 6 : 8
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: 'rgba(255, 107, 107, 0.4)'
            }, {
              offset: 0.5, color: 'rgba(128, 0, 0, 0.2)'
            }, {
              offset: 1, color: 'rgba(128, 0, 0, 0.05)'
            }]
          }
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            shadowBlur: isSmallScreen ? 15 : 20,
            shadowColor: 'rgba(255, 107, 107, 0.8)'
          }
        },
        animationDuration: 8000,
        animationEasing: 'quadraticInOut',
        animationDelay: function(idx: number) {
          return idx * 800;
        }
      }],
      animationDuration: 8000,
      animationEasing: 'quadraticInOut'
    };
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: {
            size: window.innerWidth < 768 ? 12 : 14,
          },
        },
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: window.innerWidth < 768 ? 12 : 14,
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          font: {
            size: window.innerWidth < 768 ? 10 : 12,
          },
        },
      },
      y: {
        ticks: {
          font: {
            size: window.innerWidth < 768 ? 11 : 13,
          },
        },
      },
    },
  };


  return (
    <main className="project-content responsive-container" style={{ paddingBottom: '60px' }}>

      {/* Animated Trip Progression - moved to the very beginning */}
      {analytics && (
        <div className="data-summary" style={{ marginTop: '20px', marginBottom: '40px' }}>
          <h3 style={{ 
            textAlign: 'center',
            background: 'linear-gradient(45deg, #800000, #ff6b6b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: window.innerWidth < 768 ? '1.5rem' : '2rem',
            fontWeight: 'bold',
            marginBottom: '20px'
          }}>
            Welcome
          </h3>
          <div style={{ 
            width: '100%', 
            height: window.innerWidth < 480 ? '280px' : window.innerWidth < 768 ? '320px' : '450px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 50%, #fff5f5 100%)',
            borderRadius: window.innerWidth < 768 ? '12px' : '16px',
            padding: window.innerWidth < 768 ? '15px' : '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 16px rgba(128,0,0,0.08)',
            marginBottom: '30px',
            border: '1px solid rgba(128, 0, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative elements - smaller on mobile */}
            <div style={{
              position: 'absolute',
              top: window.innerWidth < 768 ? '-30px' : '-50px',
              right: window.innerWidth < 768 ? '-30px' : '-50px',
              width: window.innerWidth < 768 ? '60px' : '100px',
              height: window.innerWidth < 768 ? '60px' : '100px',
              background: 'radial-gradient(circle, rgba(255,107,107,0.1) 0%, transparent 70%)',
              borderRadius: '50%'
            }} />
            <div style={{
              position: 'absolute',
              bottom: window.innerWidth < 768 ? '-20px' : '-30px',
              left: window.innerWidth < 768 ? '-20px' : '-30px',
              width: window.innerWidth < 768 ? '40px' : '60px',
              height: window.innerWidth < 768 ? '40px' : '60px',
              background: 'radial-gradient(circle, rgba(128,0,0,0.08) 0%, transparent 70%)',
              borderRadius: '50%'
            }} />
            
            {getAnimatedTripsOption() && (
              <ReactECharts 
                option={getAnimatedTripsOption()!}
                style={{ height: '100%', width: '100%', position: 'relative', zIndex: 1 }}
                opts={{ 
                  renderer: 'canvas', 
                  devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2), // Limit pixel ratio for performance
                  width: 'auto',
                  height: 'auto'
                }}
                notMerge={false}
                lazyUpdate={false}
                shouldSetOption={(prevProps: any, nextProps: any) => {
                  return prevProps.option !== nextProps.option;
                }}
              />
            )}
          </div>
        </div>
      )}

      <section className="project-section">
        <h2>Introduction</h2>
        <p>
          I got curious about where all the Divvy bikes went late at night, so I decided to compile
          some stats for these bikes around the UChicago and Hyde park area...
        </p>
        <br/>
        <p> For those who don't know what Divvy is, it's a public bike-sharing program in Chicago and nearby suburbs.
          You can rent a bike from one station and return it to another making it a quick and 
          convenient way to get around the city or commute to nearby areas.
          It's similar to the Citi Bikes in New York City.
          Both of these programs are operated by Lyft.
        </p>
        <br/>
        <p>
          Before you scroll down for the actual stats, I want to give a quick rundown of where the data has come from. The data
          is open source from the divvy website and I essentially just took the data and filtered it in
          to this zone shown below:
        </p>
        <div className="centered-image responsive-image">
          <img
            src={mapZoneImage}
            alt="Divvy bikes zone map"
            className="map-image"
          />
          <p>
            Since the raw data contained slight variations in latitude and longitude coordinates for the same station locations, 
            I cleaned and standardized the data by averaging these coordinates to create 20 distinct lat/lng for station locations. 
            Using this, I updated the large divvy data tables and then 
            started analyzing the quick stats and cool trends. I didn't want to be super intricate with all of the dates, 
            so I kept the data between October 2024 and May 2025.</p>
          <br/>
          <p>
            <strong>Enjoy the Divvy stats of the 2024-2025 school year!</strong>
          </p>
        </div>
      </section>

      <section className="project-section">
        <h2>Analytics Dashboard</h2>
        <h3 className="subtitle">Academic Year (2024 Oct. - 2025 May)</h3>
        
        {error && (
          <div className="error-message" style={{
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '4px',
            padding: '12px',
            color: '#c62828',
            marginBottom: '20px'
          }}>
            ⚠️ Error loading data: {error}
          </div>
        )}
        
        {loading && (
          <div className="loading" style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666',
            fontSize: '16px'
          }}>
            📈 Loading analytics data...
          </div>
        )}

        {analytics && (
          <>
            {/* Quick Stats */}
            <div className="data-summary">
              <h3>Quick Stats</h3>
              <div className="stats-grid responsive-stats-grid">
                <div className="stat-item">
                  <span className="stat-number">
                    {analytics.total_trips?.[0]
                      ? Number(Object.values(analytics.total_trips[0])[0]).toLocaleString()
                      : 'N/A'}
                  </span>
                  <span className="stat-label">Total Trips</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">
                    {analytics.total_stations?.[0]
                      ? Number(Object.values(analytics.total_stations[0])[0])
                      : 'N/A'}
                  </span>
                  <span className="stat-label">Total Stations</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">
                    {analytics.total_distance?.[0]
                      ? Math.round(Number(Object.values(analytics.total_distance[0])[0])).toLocaleString()
                      : 'N/A'}
                  </span>
                  <span className="stat-label">Total Distance (miles)</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">
                    {analytics.total_time?.[0]
                      ? Math.round(Number(Object.values(analytics.total_time[0])[1])).toLocaleString()
                      : 'N/A'}
                  </span>
                  <span className="stat-label">Total Duration (Hours)</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">
                    {analytics.trips_not_at_stations?.[0]
                      ? Number(Object.values(analytics.trips_not_at_stations[0])[1]).toLocaleString()
                      : 'N/A'}
                  </span>
                  <span className="stat-label">Trips started not at a station</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">
                    304
                  </span>
                  <span className="stat-label">Unique Station Routes</span>
                </div>
              </div>
            </div>

            {/* Main Charts Grid */}
            <div className="charts-grid responsive-charts-grid">
              <div className="chart-container">
                <div className="chart-header">
                  <h3>Top Start Stations</h3>
                  <select 
                    value={startStationsView} 
                    onChange={(e) => setStartStationsView(e.target.value as 'all_day' | 'after_9pm')}
                    className="chart-type-selector"
                  >
                    <option value="all_day">All Day</option>
                    <option value="after_9pm">After 9 PM</option>
                  </select>
                </div>
                {startStationsView === 'all_day' ? (
                  getTopStartStationsChartData() && (
                    <Bar data={getTopStartStationsChartData()!} />
                  )
                ) : (
                  getStartStationsAfter9pmData() && (
                    <Bar data={getStartStationsAfter9pmData()!} />
                  )
                )}
                <div className="chart-note-style">
                  📍 Regenstein Library, Renee Granville-Grossman Residential Commons, and Ratner are top 3.
                </div>
              </div>

              <div className="chart-container">
                <div className="chart-header">
                  <h3>Top End Stations</h3>
                  <select 
                    value={endStationsView} 
                    onChange={(e) => setEndStationsView(e.target.value as 'all_day' | 'after_9pm')}
                    className="chart-type-selector"
                  >
                    <option value="all_day">All Day</option>
                    <option value="after_9pm">After 9 PM</option>
                  </select>
                </div>
                {endStationsView === 'all_day' ? (
                  getTopEndStationsChartData() && (
                    <Bar data={getTopEndStationsChartData()!} />
                  )
                ) : (
                  getEndStationsAfter9pmData() && (
                    <Bar data={getEndStationsAfter9pmData()!} />
                  )
                )}
                <div className="chart-note-style">
                  {endStationsView === 'all_day' 
                    ? '📍 Regenstein Library, Renee-Granville-Grossman Residential Commons, and Ratner are top 3.'
                    : '📍 Renee Granville-Grossman Residential Commons, Regenstein Library, and IHouse are top 3.'
                  }
                </div>
              </div>

              <div className="chart-container">
                <div className="chart-header">
                  <h3>Usage During the Day</h3>
                  <select 
                    value={hourlyView} 
                    onChange={(e) => setHourlyView(e.target.value as 'by_period' | 'by_hour')}
                    className="chart-type-selector"
                  >
                    <option value="by_period">By Time Period</option>
                    <option value="by_hour">By Hour</option>
                  </select>
                </div>
                {hourlyView === 'by_period' ? (
                  <>
                    <p>
                    Hours: Overnight [0-5], Morning [6-11], Afternoon [12 - 17], Evening [18-23]
                    </p>
                    {getHourlyTripsData() && <Line data={getHourlyTripsData()!} options={lineOptions} />}
                  </>
                ) : (
                  getHourlyTimeData() && <Line data={getHourlyTimeData()!} options={lineOptions} />
                )}
              </div>

              <div className="chart-container">
                <div className="chart-header">
                  <h3>Monthly Trip Analysis</h3>
                  <select 
                    value={monthlyView} 
                    onChange={(e) => setMonthlyView(e.target.value as 'total_trips' | 'user_distribution' | 'bike_types' | 'avg_duration')}
                    className="chart-type-selector"
                  >
                    <option value="total_trips">Total Trips</option>
                    <option value="user_distribution">User Distribution</option>
                    <option value="bike_types">Bike Types</option>
                    <option value="avg_duration">Average Duration</option>
                  </select>
                </div>
                {monthlyView === 'total_trips' ? (
                  getMonthlyTripsData() && <Bar data={getMonthlyTripsData()!} />
                ) : monthlyView === 'user_distribution' ? (
                  getMemberDistributionData() && <Bar data={getMemberDistributionData()!}/>
                ) : monthlyView === 'bike_types' ? (
                  getMonthlyBikeTypesData() && <Bar data={getMonthlyBikeTypesData()!} />
                ) : (
                  getMonthAvgDurationData() && <Bar data={getMonthAvgDurationData()!} />
                )}
              </div>

              <div className="chart-container">
                <h3>Most Popular Days of the Week</h3>
                {getPopularDaysData() && <Line data={getPopularDaysData()!} options={lineOptions} />}
              </div>

              <div className="chart-container">
                <h3>Average Trip Duration by User Type</h3>
                {getDurationComparisonData() && (
                  <Bar data={getDurationComparisonData()!} />
                )}
              </div>

              <div className="chart-container">
                <h3>Bike Type Usage</h3>
                {getBikeTypesData() && (
                  <Doughnut data={getBikeTypesData()!} options={doughnutOptions} />
                )}
              </div>
              
              <div className="chart-container">
                <h3>Most Common Routes</h3>
                {getCommonRoutesData() && (
                  <Bar data={getCommonRoutesData()!} />
                )}
                <p className="chart-note-style">Top 10 routes shown.</p>
              </div>
            </div>
            <div className="tableau-section">
              <h2>See It Visually</h2>
              <p>Explore the Tableau visualizations with real map views.</p>
              
              {/* animated tableau */}
              <div className="tableau-container responsive-tableau-large">
                <h3 className="tableau-title"> Start and End Stations shown day by day, every 4 hours.</h3>
                <iframe
                  src="https://public.tableau.com/views/DivvyTripsStartandEndStations/DivvyTripsUChicagoSTAEND?:embed=yes&:display_count=yes&:showVizHome=no&:toolbar=yes&:scrollbars=no"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  allowFullScreen
                  title="Divvy Trips Start and End Stations"
                  scrolling="no"
                />
              </div>
              
              {/* Side by side tableau visualizations */}
              <div className="tableau-row responsive-tableau-row">
                {/* start station viz */}
                <div className="tableau-container responsive-tableau-half">
                  <iframe
                    src="https://public.tableau.com/views/DivvyTripsStartStationUsageUChicago/StartStationCount?:embed=yes&:display_count=yes&:showVizHome=no&:toolbar=yes"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    allowFullScreen
                    title="Divvy Start Station Usage"
                  />
                </div>
                
                {/* end station viz */}
                <div className="tableau-container responsive-tableau-half">
                  <iframe
                    src="https://public.tableau.com/views/DivvyTripsEndStationUsageUChicago/EndStationCount?:embed=yes&:display_count=yes&:showVizHome=no&:toolbar=yes"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    allowFullScreen
                    title="Divvy End Station Usage"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="project-section"> 
        <h2>My Thoughts</h2>
        <div style={{ textAlign: 'left' }}>
          <p> 
            I learned a lot about the trends with the Divvy Bikes around the UChicago area. 
            Considering that I use the divvy bikes a lot (203 rides, 96 miles, 
            14 hours 16 minutes, and $414.66 saved), doing this project was a pretty fun thing to do! 
          </p>
          <br/>
          <p>Here are some things that I learned:</p>
          <br/>
          <p>
            <strong>Residential Dorms are quite popular...</strong><br/>
            I think it was super interesting to see the amount of people using the 
            bikes at Renee Granville-Grossman Residential Commons (SOUTH) with 14,665 trips started and 14,200 trips ended (about 130 uses per day!). 
            Based on the most common routes data, most of these routes consisted of South to the Reg Library and back, as well as to Ratner and back.
            In addition, the bikes at the International House(IHOUSE) was also a pretty popular destination, 
            although they had less trips because fewer students live there. 
            This raises a question: Should Woodlawn have a station? Definitely. Considering that 
            it is one of the most occupied dorms and also has a very decent dining hall, the numbers at Woodlawn, if they had a station,
            I think they would have the most trips overall.
          </p>
          <br/>
          <p>
            <strong> Regenstein Dominance</strong><br/>
            Now it's no doubt that the Reg station has the most amount of uses considering 
            its station size and it's centrality around the campus but I was suprised
            too see how much this station is used. It had around 15,000 trips started and ended being the
            number 1 station for both start and end stations. Most people definitely use it for 
            its proximinity to the quad and the library, but also because of its availability in terms of bikes and open docks.
          </p>
          <br/>
          <p>
            <strong> So where do all the bikes go late at night?</strong><br/>
            Everytime I come out of the Reg Library late at night, there are always no bikes. Now... I get a sense of where they go.
            From the after 9 pm charts, it seems that the dorms are the popular destinations.
            Renee Granville-Grossman Residential topped the end station count by a large margin with about 1,600 trips being parked after 9 pm.
            Excluding the Reg station, IHouse was 3rd with around 600 trips, Ratner was 4th with around 600 trips, and the station
            (Kimbark Ave & 53rd) was 5th with around 500 trips. These stations are near apartments or dorms which makes 
            sense as students/staff are heading home for the night.
            I'm still suprised that the Reg station is still 2nd on the end stations chart, but I think that just comes 
            with it being a popular station.
          </p>
          <br/>
          <p>
            <strong> October topped it all</strong><br/>
            October was the month for Divvy's around Uchicago and Hyde park with around 26,000 trips.
            Weather does seem to play a huge role in the amount of trips taken as we can see the numbers decreasing during the winter quarter, 
            and gradually increasing for the spring quarter. Maybe I should look more into the weather averages with this data. 
            I was a little suprised how May didn't have higher numbers considering the weather was quite nice.
          </p>
          <br/>
          <p>
            <strong> Member vs. Casual Demographics</strong><br/>
            There was a consistent ~75-80% member usage, while around a 20-25% casual usage. 
            This definitely shows that people using the Divvy Bikes are those that live here 
            such as students/staff with regular access, while the casual users are for 
            those using it occasionally. I was suprised by the large difference in average trip duration between
            Member and Casual users. This suggests that casual users tend to take longer, most likely exploratory trips, 
            while members use the bikes for efficient, short-distance transportation 
            between familiar locations like dorms, classes, and dining halls.
          </p>
          <br/>
          <p>
            <strong> E-bike or classics?</strong><br/>
              E-bikes are really popular around the area especially with its convenience of not being able to park at a station. 
              I couldn't get the exact coordinates of those that parked outside of the station, because the data didn't seem right (a majority of the end-station lat/lng were the same numbers...).
              What's fascinating is the seasonal shift in e-bike preference. While October had the highest amount of trips, May actually 
              had the highest amount of e-bike trips with around 9,000 trips. From a cost persepctive, e-bikes do cost more per ride,
              but as winter/spring quarter went by, the usage of e-bikes was almost consistently the same as the classic bikes.
              I wonder what caused this shift. Is it the weather? Are people more in a rush? Did people finally realize the thrill of an e-bike?
              I'm excited for next school year's Divvy stats to see if this trend continues.


          </p>
        </div>
        <p>
        <br/>
          <u>I hope you enjoyed the stats and visuals!</u>
          <br/>
          If you have any questions or comments, feel free to reach out to me at
          <a href="mailto:emwu@uchicago.edu"> {''}
             emwu@uchicago.edu
          </a>
        </p>

      </section>
    </main>
  );
};

export default DivvyProject;
