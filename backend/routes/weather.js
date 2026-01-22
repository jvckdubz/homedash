const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { loadConfig } = require('../utils/config');

// Get weather data (using wttr.in - free, no API key required)
router.get('/', async (req, res) => {
  try {
    const config = await loadConfig();
    const city = config.settings?.weatherCity;
    
    if (!city) {
      return res.json({ configured: false });
    }

    // Use wttr.in (free, no API key required)
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`
    );
    const data = await response.json();
    const current = data.current_condition[0];

    const desc = current.weatherDesc[0].value.toLowerCase();
    
    // Map description to icon code
    let iconCode = 'default';
    if (desc.includes('sunny') || desc.includes('clear')) {
      const hour = new Date().getHours();
      iconCode = (hour >= 6 && hour < 20) ? 'sunny' : 'clear';
    } else if (desc.includes('partly cloudy')) {
      iconCode = 'partly-cloudy';
    } else if (desc.includes('cloudy')) {
      iconCode = 'cloudy';
    } else if (desc.includes('overcast')) {
      iconCode = 'overcast';
    } else if (desc.includes('mist') || desc.includes('fog')) {
      iconCode = 'fog';
    } else if (desc.includes('rain') || desc.includes('drizzle')) {
      iconCode = 'rain';
    } else if (desc.includes('snow') || desc.includes('sleet')) {
      iconCode = 'snow';
    } else if (desc.includes('thunder')) {
      iconCode = 'thunder';
    }

    res.json({
      configured: true,
      temp: parseInt(current.temp_C),
      feelsLike: parseInt(current.FeelsLikeC),
      humidity: parseInt(current.humidity),
      wind: (parseInt(current.windspeedKmph) / 3.6).toFixed(1),
      description: current.weatherDesc[0].value,
      iconCode,
      city: data.nearest_area[0].areaName[0].value
    });
  } catch (err) {
    console.error('[Weather] Error:', err.message);
    res.json({ configured: true, error: err.message });
  }
});

module.exports = router;
