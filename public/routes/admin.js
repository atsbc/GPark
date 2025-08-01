const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const spotsPath = path.join(__dirname, '../data/spots.json');
let parkingSpots = require(spotsPath);

// Helper to save JSON
function saveSpots() {
  fs.writeFileSync(spotsPath, JSON.stringify(parkingSpots, null, 2));
}

// PUT /admin/spots/:id/rates — Save rate info
router.put('/spots/:id/rates', (req, res) => {
  const { id } = req.params;
  const { rates } = req.body;

  if (!rates || typeof rates !== 'object') {
    return res.status(400).json({ error: 'Invalid rates object.' });
  }

  const spot = parkingSpots.find(s => s.id === id);
  if (!spot) {
    return res.status(404).json({ error: 'Spot not found.' });
  }

  // Validate durations
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

  res.json({ message: 'Rates updated successfully.', spot });
});
