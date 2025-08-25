const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

const app = express();

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// File session store
app.use(session({
  store: new FileStore({
    path: './sessions',
    ttl: 86400,
    reapInterval: 3600
  }),
  secret: 'file-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

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

app.listen(3002, () => {
  console.log('Server running on http://localhost:3002');
});