const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';

// Helper to query external HTTPS API using native module
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', err => resolve(null));
  });
}

// Simulated real-time weather generator when API key is unconfigured or rate limited
function getSimulatedWeather(lat = 28.6139, lng = 77.2090, cityName = "New Delhi") {
  return {
    city: cityName,
    lat,
    lng,
    temp_c: 29.4,
    feels_like_c: 33.1,
    humidity_percent: 84,
    wind_speed_kmh: 38.5,
    wind_direction: "ENE",
    pressure_hpa: 994.2,
    condition: "Heavy Monsoon Rain & Thunderstorm",
    icon: "11d",
    disaster_risk: "HIGH_FLOOD_ALERT",
    forecast: [
      { day: "Today", temp_max: 31, temp_min: 25, condition: "Heavy Rain", icon: "11d", precipitation_prob: "95%" },
      { day: "Tomorrow", temp_max: 30, temp_min: 24, condition: "Continuous Downpour", icon: "10d", precipitation_prob: "90%" },
      { day: "Day 3", temp_max: 32, temp_min: 26, condition: "Thunderstorms", icon: "11d", precipitation_prob: "75%" },
      { day: "Day 4", temp_max: 34, temp_min: 27, condition: "Scattered Showers", icon: "09d", precipitation_prob: "50%" },
      { day: "Day 5", temp_max: 35, temp_min: 27, condition: "Partly Cloudy", icon: "02d", precipitation_prob: "20%" }
    ],
    source: "IDRMS Meteorological Sensor Simulation"
  };
}

router.get('/', async (req, res) => {
  const lat = req.query.lat || process.env.DEFAULT_LAT || 28.6139;
  const lng = req.query.lng || process.env.DEFAULT_LNG || 77.2090;
  const city = req.query.city || process.env.DEFAULT_CITY || "New Delhi";

  if (OPENWEATHER_API_KEY) {
    const weatherUrl = city
      ? `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${OPENWEATHER_API_KEY}`
      : `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${OPENWEATHER_API_KEY}`;
    const weatherData = await fetchJson(weatherUrl);

    if (weatherData && weatherData.main) {
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${weatherData.coord.lat}&lon=${weatherData.coord.lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
      const forecastData = await fetchJson(forecastUrl);

      return res.json({
        city: weatherData.name || city,
        temperature: Math.round(weatherData.main.temp),
        feels_like: Math.round(weatherData.main.feels_like),
        humidity: weatherData.main.humidity,
        wind_speed_kmh: Math.round(weatherData.wind.speed * 3.6),
        pressure_hpa: weatherData.main.pressure,
        condition: weatherData.weather[0] ? weatherData.weather[0].description : 'Clear',
        icon: weatherData.weather[0] ? weatherData.weather[0].icon : '01d',
        data_source: "OPENWEATHERMAP_LIVE",
        forecast: forecastData && forecastData.list ? forecastData.list.filter((_, idx) => idx % 8 === 0).map(item => ({
          day: new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
          temp_max: Math.round(item.main.temp_max),
          temp_min: Math.round(item.main.temp_min),
          condition: item.weather[0].main,
          icon: item.weather[0].icon
        })) : []
      });
    }
  }

  const sim = getSimulatedWeather(lat, lng, city);
  return res.json({
    city: sim.city,
    temperature: sim.temp_c,
    feels_like: sim.feels_like_c,
    humidity: sim.humidity_percent,
    wind_speed_kmh: sim.wind_speed_kmh,
    pressure_hpa: sim.pressure_hpa,
    condition: sim.condition,
    icon: sim.icon,
    data_source: "SIMULATION_TELEMETRY",
    forecast: sim.forecast
  });
});

// Weather API Endpoint
router.get('/current', async (req, res) => {
  const lat = req.query.lat || process.env.DEFAULT_LAT || 28.6139;
  const lng = req.query.lng || process.env.DEFAULT_LNG || 77.2090;
  const city = req.query.city || process.env.DEFAULT_CITY || "New Delhi";

  if (OPENWEATHER_API_KEY) {
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${OPENWEATHER_API_KEY}`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${OPENWEATHER_API_KEY}`;

    const [weatherData, forecastData] = await Promise.all([
      fetchJson(weatherUrl),
      fetchJson(forecastUrl)
    ]);

    if (weatherData && weatherData.main) {
      return res.json({
        city: weatherData.name || city,
        lat: weatherData.coord ? weatherData.coord.lat : lat,
        lng: weatherData.coord ? weatherData.coord.lon : lng,
        temp_c: weatherData.main.temp,
        feels_like_c: weatherData.main.feels_like,
        humidity_percent: weatherData.main.humidity,
        wind_speed_kmh: Math.round(weatherData.wind.speed * 3.6),
        pressure_hpa: weatherData.main.pressure,
        condition: weatherData.weather[0] ? weatherData.weather[0].description : 'Clear',
        icon: weatherData.weather[0] ? weatherData.weather[0].icon : '01d',
        forecast: forecastData && forecastData.list ? forecastData.list.filter((_, idx) => idx % 8 === 0).map(item => ({
          day: new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
          temp_max: Math.round(item.main.temp_max),
          temp_min: Math.round(item.main.temp_min),
          condition: item.weather[0].main,
          icon: item.weather[0].icon,
          precipitation_prob: `${Math.round((item.pop || 0) * 100)}%`
        })) : [],
        source: "OpenWeatherMap Live API"
      });
    }
  }

  // Return realistic meteorological telemetry
  return res.json(getSimulatedWeather(lat, lng, city));
});

module.exports = router;
