const express = require('express');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares to parse JSON and URL encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key', // change in prod & set env var
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true if using HTTPS, false for local/dev
    httpOnly: true,
    maxAge: 1000 * 60 * 60 // 1 hour session expiry
  }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Sample admin credentials (replace with env vars for production)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

// In-memory data for demo
const bookings = [];
const parkingSpots = [];
for(let i = 10000; i < 10020; i++) parkingSpots.push(i.toString());

// Middleware to protect admin routes
function requireAdminAuth(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
}

// API: Get parking spots
app.get('/api/spots', (req, res) => {
  res.json(parkingSpots);
});

// API: Create booking
app.post('/api/bookings', (req, res) => {
  const { parkingSpotId, duration, licensePlate } = req.body;
  if (!parkingSpotId || !duration || !licensePlate) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (!parkingSpots.includes(parkingSpotId)) {
    return res.status(400).json({ error: 'Invalid spot' });
  }
  if (bookings.some(b => b.parkingSpotId === parkingSpotId)) {
    return res.status(409).json({ error: 'Spot booked' });
  }
  bookings.push({ parkingSpotId, duration, licensePlate, timestamp: Date.now() });
  res.json({ message: 'Booked', booking: { parkingSpotId, duration, licensePlate } });
});

// Admin login
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Admin logout
app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out' });
  });
});

// Admin: Get all bookings (protected)
app.get('/admin/bookings', requireAdminAuth, (req, res) => {
  res.json(bookings);
});

// Fallback route: serve index.html for SPA (optional)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GPark server running on port ${PORT}`);
});
