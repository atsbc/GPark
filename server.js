const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Middleware to parse JSON body
app.use(express.json());

// Serve static files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// In-memory bookings store (for demo)
const bookings = [];

// Helper: simple 5-digit spot list
const parkingSpots = [];
for(let i = 10000; i < 10020; i++) {
  parkingSpots.push(i.toString());
}

// API endpoint to get parking spots
app.get('/api/spots', (req, res) => {
  res.json(parkingSpots);
});

// API endpoint to receive booking
app.post('/api/bookings', (req, res) => {
  const { parkingSpotId, duration, licensePlate } = req.body;

  // Basic validation
  if (!parkingSpotId || !duration || !licensePlate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if spot exists
  if (!parkingSpots.includes(parkingSpotId)) {
    return res.status(400).json({ error: 'Invalid parking spot ID' });
  }

  // Check if spot already booked (simple check)
  const spotTaken = bookings.some(b => b.parkingSpotId === parkingSpotId);
  if (spotTaken) {
    return res.status(409).json({ error: 'Parking spot already booked' });
  }

  // Save booking
  bookings.push({ parkingSpotId, duration, licensePlate, timestamp: Date.now() });

  res.json({ message: 'Booking confirmed', booking: { parkingSpotId, duration, licensePlate } });
});

// Start server
app.listen(PORT, () => {
  console.log(`GPark server running on port ${PORT}`);
});
