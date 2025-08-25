const express = require('express');
const axios = require('axios');

const app = express();

app.use(express.json());
app.use(express.static('public'));

// Backend API route
app.get('/api/weather/:city', async (req, res) => {
  try {
    const city = req.params.city;
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=demo&units=metric`);
    res.json(response.data);
  } catch (error) {
    // Mock weather data for demo
    res.json({
      name: req.params.city,
      main: { temp: 25, humidity: 60 },
      weather: [{ main: 'Clear', description: 'clear sky' }],
      wind: { speed: 5 }
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(3006, () => {
  console.log('API Utility Server running on http://localhost:3006');
});