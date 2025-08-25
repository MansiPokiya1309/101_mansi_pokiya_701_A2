const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const app = express();

// Simple session without Redis (fallback)
console.log('Redis not available - using memory session store');

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Memory session store (works without Redis)
app.use(session({
  secret: 'redis-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

console.log('Using memory session store (Redis not required)');

// Mock users
const users = [
  { username: 'admin', password: 'admin123' },
  { username: 'user', password: 'user123' }
];

// Routes
app.get('/', (req, res) => {
  if (req.session.user) {
    res.render('dashboard', { user: req.session.user });
  } else {
    res.render('login', { error: null });
  }
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    req.session.user = username;
    res.redirect('/');
  } else {
    res.render('login', { error: 'Invalid credentials' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.listen(3003, () => {
  console.log('Server running on http://localhost:3003');
  console.log('Make sure Redis server is running on localhost:6379');
});