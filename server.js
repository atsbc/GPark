const express = require('express');
const path = require('path');
const session = require('express-session');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const adapter = new JSONFile('db.json');
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data ||= { bookings: [], spots: [], timeslots: [] };

  // Initialize 20 parking spots if empty
  if (db.data.spots.length === 0) {
    db.data.spots = Array.from({ length: 20 }, (_, i) => ({
      id: (10000 + i).toString(),
      active: true
    }));
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
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 // 1 hour
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

// Middleware for admin auth
function requireAdminAuth(req, res, next) {
  if (req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// -------------------- USER ROUTES -------------------- //

// Get available spots (active + not booked)
app.get('/api/spots', async (req, res) => {
  await db.read();
  const bookedSpotIds = db.data.bookings.map(b => b.parkingSpotId);
  const availableSpots = db.data.spots.filter(
    spot => spot.active && !bookedSpotIds.includes(spot.id)
  );
  res.json(availableSpots);
});

// Create booking
app.post('/api/bookings', async (req, res) => {
  const { parkingSpotId, duration, licensePlate } = req.body;

  if (!parkingSpotId || !duration || !licensePlate) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  await db.read();

  const spot = db.data.spots.find(s => s.id === parkingSpotId && s.active);
  if (!spot) return res.status(400).json({ error: 'Invalid or inactive spot' });

  if (db.data.bookings.some(b => b.parkingSpotId === parkingSpotId)) {
    return res.status(409).json({ error: 'Spot already booked' });
  }

  const booking = { parkingSpotId, duration, licensePlate, timestamp: Date.now() };
  db.data.bookings.push(booking);
  await db.write();

  res.json({ message: 'Booked', booking });
});

// -------------------- ADMIN AUTH -------------------- //

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out' });
  });
});

// -------------------- ADMIN BOOKINGS & SPOTS -------------------- //

app.get('/admin/bookings', requireAdminAuth, async (req, res) => {
  await db.read();
  res.json(db.data.bookings);
});

app.get('/admin/spots', requireAdminAuth, async (req, res) => {
  await db.read();
  res.json(db.data.spots);
});

app.post('/admin/spots', requireAdminAuth, async (req, res) => {
  const { id } = req.body;
  await db.read();
  if (!id || db.data.spots.find(s => s.id === id)) {
    return res.status(400).json({ error: 'Invalid or duplicate spot id' });
  }
  const newSpot = { id, active: true };
  db.data.spots.push(newSpot);
  await db.write();
  res.json({ message: 'Spot added', spot: newSpot });
});

app.put('/admin/spots/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  await db.read();
  const spot = db.data.spots.find(s => s.id === id);
  if (!spot) return res.status(404).json({ error: 'Spot not found' });
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'Invalid active value' });

  spot.active = active;
  await db.write();
  res.json({ message: 'Spot updated', spot });
});

app.delete('/admin/spots/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  await db.read();
  const index = db.data.spots.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Spot not found' });

  db.data.spots.splice(index, 1);
  await db.write();
  res.json({ message: 'Spot deleted' });
});

// -------------------- ADMIN TIME SLOTS -------------------- //

app.get('/admin/timeslots', requireAdminAuth, async (req, res) => {
  await db.read();
  res.json(db.data.timeslots);
});

app.post('/admin/timeslots', requireAdminAuth, async (req, res) => {
  const { label, minutes } = req.body;
  if (!label || !minutes) return res.status(400).json({ error: 'Missing fields' });

  await db.read();
  const newSlot = { id: Date.now().toString(), label, minutes: Number(minutes) };
  db.data.timeslots.push(newSlot);
  await db.write();

  res.json({ message: 'Time slot added', slot: newSlot });
});

// -------------------- FALLBACK -------------------- //

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GPark server running on port ${PORT}`);
});
