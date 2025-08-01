const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const spotsPath = path.join(__dirname, '../data/spots.json');
const bookingsPath = path.join(__dirname, '../data/bookings.json');

let parkingSpots = [];
let bookings = [];

// Load or create spots.json
if (fs.existsSync(spotsPath)) {
  parkingSpots = require(spotsPath);
} else {
  fs.writeFileSync(spotsPath, JSON.stringify(parkingSpots, null, 2));
}

// Load or create bookings.json
if (fs.existsSync(bookingsPath)) {
  bookings = require(bookingsPath);
} else {
  fs.writeFileSync(bookingsPath, JSON.stringify(bookings, null, 2));
}

// Helper to save spots
function saveSpots() {
  fs.writeFileSync(spotsPath, JSON.stringify(parkingSpots, null, 2));
}

// Helper to save bookings
function saveBookings() {
  fs.writeFileSync(bookingsPath, JSON.stringify(bookings, null, 2));
}

// --- SPOTS ROUTES ---

// Get all spots
router.get('/spots', (req, res) => {
  res.json(parkingSpots);
});

// Add new spot
router.post('/spots', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Spot ID required' });

  if (parkingSpots.find(s => s.id === id)) {
    return res.status(400).json({ error: 'Spot already exists' });
  }

  parkingSpots.push({ id, active: true, rates: {} });
  saveSpots();
  res.status(201).json({ message: 'Spot added' });
});

// Update spot active status
router.put('/spots/:id', (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  const spot = parkingSpots.find(s => s.id === id);
  if (!spot) return res.status(404).json({ error: 'Spot not found' });

  spot.active = !!active;
  saveSpots();
  res.json({ message: 'Spot updated' });
});

// Delete spot
router.delete('/spots/:id', (req, res) => {
  const { id } = req.params;
  const index = parkingSpots.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Spot not found' });

  parkingSpots.splice(index, 1);
  saveSpots();
  res.json({ message: 'Spot deleted' });
});

// Update rates for spot
router.put('/spots/:id/rates', (req, res) => {
  const { id } = req.params;
  const { rates } = req.body;

  if (!rates || typeof rates !== 'object') {
    return res.status(400).json({ error: 'Invalid rates object' });
  }

  const spot = parkingSpots.find(s => s.id === id);
  if (!spot) return res.status(404).json({ error: 'Spot not found' });

  const validDurations = ['30', '45', '60', '120', '240', '480', '720', '1440'];
  for (const [duration, rate] of Object.entries(rates)) {
    if (!validDurations.includes(duration)) {
      return res.status(400).json({ error: `Invalid duration: ${duration}` });
    }
    if (typeof rate !== 'number' || rate < 0) {
      return res.status(400).json({ error: `Invalid rate for ${duration}` });
    }
  }

  spot.rates = rates;
  saveSpots();
  res.json({ message: 'Rates updated', spot });
});

// --- BOOKINGS ROUTES ---

// Get all bookings
router.get('/bookings', (req, res) => {
  res.json(bookings);
});

// Add booking (optional: if you want admin to create bookings)
router.post('/bookings', (req, res) => {
  const { parkingSpotId, licensePlate, duration } = req.body;
  if (!parkingSpotId || !licensePlate || !duration) {
    return res.status(400).json({ error: 'Missing booking details' });
  }

  const spot = parkingSpots.find(s => s.id === parkingSpotId);
  if (!spot || !spot.active) {
    return res.status(400).json({ error: 'Invalid or inactive parking spot' });
  }

  const timestamp = Date.now();

  bookings.push({ parkingSpotId, licensePlate, duration, timestamp });
  saveBookings();
  res.status(201).json({ message: 'Booking created' });
});

module.exports = router;
