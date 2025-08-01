const express = require('express');
const path = require('path');
const session = require('express-session');

const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const fs = require('fs');

const adapter = new JSONFile('db.json');
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data ||= { bookings: [], spots: [], timeslots: [] };

  // Initialize 20 parking spots if empty
  if (db.data.spots.length === 0) {
    db.data.spots = Array.from({ length: 20 }, (_, i) => ({ id: 10000 + i }));
  }

  await db.write();
}

initDB();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true if HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60, // 1 hour
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

// Bookings array (in-memory)
const bookings = [];

// Parking spots as objects with active flag
let parkingSpots = [];
for (let i = 10000; i < 10020; i++) {
  parkingSpots.push({ id: i.toString(), active: true });
}

// Admin auth middleware
function requireAdminAuth(req, res, next) {
  if (req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Get available spots for users: only active and not booked
app.get('/api/spots', (req, res) => {
  const bookedSpotIds = bookings.map(b => b.parkingSpotId);
  const availableSpots = parkingSpots.filter(spot => spot.active && !bookedSpotIds.includes(spot.id));
  res.json(availableSpots);
});

// Create booking
app.post('/api/bookings', (req, res) => {
  const { parkingSpotId, duration, licensePlate } = req.body;
  if (!parkingSpotId || !duration || !licensePlate) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (!parkingSpots.find(s => s.id === parkingSpotId && s.active)) {
    return res.status(400).json({ error: 'Invalid or inactive spot' });
  }
  if (bookings.some(b => b.parkingSpotId === parkingSpotId)) {
    return res.status(409).json({ error: 'Spot already booked' });
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

// Admin get all bookings
app.get('/admin/bookings', requireAdminAuth, (req, res) => {
  res.json(bookings);
});

// Admin get all spots
app.get('/admin/spots', requireAdminAuth, (req, res) => {
  res.json(parkingSpots);
});

// Admin add new spot
app.post('/admin/spots', requireAdminAuth, (req, res) => {
  const { id } = req.body;
  if (!id || parkingSpots.find(s => s.id === id)) {
    return res.status(400).json({ error: 'Invalid or duplicate spot id' });
  }
  parkingSpots.push({ id, active: true });
  res.json({ message: 'Spot added', spot: { id, active: true } });
});

// Admin update spot active status
app.put('/admin/spots/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  const spot = parkingSpots.find(s => s.id === id);
  if (!spot) return res.status(404).json({ error: 'Spot not found' });
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'Invalid active value' });

  spot.active = active;
  res.json({ message: 'Spot updated', spot });
});

// Admin delete spot
app.delete('/admin/spots/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const index = parkingSpots.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Spot not found' });

  parkingSpots.splice(index, 1);
  res.json({ message: 'Spot deleted' });
});

// Serve SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GPark server running on port ${PORT}`);
});
