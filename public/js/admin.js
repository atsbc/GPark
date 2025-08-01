const durations = [
  { label: '30 min', value: '30' },
  { label: '45 min', value: '45' },
  { label: '1 hour', value: '60' },
  { label: '2 hours', value: '120' },
  { label: '4 hours', value: '240' },
  { label: '8 hours', value: '480' },
  { label: '12 hours', value: '720' },
  { label: '24 hours', value: '1440' },
];

let spots = []; // store spots globally for event handlers

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadSpots();
  loadBookings();
  setupBulkActions();
  setupAddSpotForm();
  setupLogout();
});

function initNavigation() {
  const navItems = document.querySelectorAll('#nav li[data-section]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const sectionId = item.getAttribute('data-section');
      document.querySelectorAll('.section').forEach(sec => {
        sec.classList.toggle('active', sec.id === sectionId);
      });

      if (sectionId === 'spots') loadSpots();
      else if (sectionId === 'bookings') loadBookings();
    });
  });
}

async function loadSpots() {
  const spotsList = document.getElementById('spotsList');
  spotsList.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  try {
    const res = await fetch('/admin/spots');
    spots = await res.json();

    if (spots.length === 0) {
      spotsList.innerHTML = '<tr><td colspan="4">No spots available. Add new spots above.</td></tr>';
      return;
    }

    spotsList.innerHTML = '';
    spots.forEach(spot => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="spot-checkbox" data-id="${spot.id}"></td>
        <td>${spot.id}</td>
        <td>${spot.active ? 'Active' : 'Inactive'}</td>
        <td>
          <button class="edit-rates-btn" data-id="${spot.id}">Edit Rates</button>
        </td>
      `;
      spotsList.appendChild(tr);
    });

    // Attach click listeners AFTER rendering buttons
    document.querySelectorAll('.edit-rates-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const spotId = btn.getAttribute('data-id');
        const spot = spots.find(s => s.id === spotId);
        if (spot) openRateModal(spot);
      });
    });

  } catch (err) {
    spotsList.innerHTML = '<tr><td colspan="4">Error loading spots</td></tr>';
  }
}

async function loadBookings() {
  const bookingsTableBody = document.querySelector('#bookingsTable tbody');
  bookingsTableBody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  try {
    const res = await fetch('/admin/bookings');
    const bookings = await res.json();

    if (bookings.length === 0) {
      bookingsTableBody.innerHTML = '<tr><td colspan="4">No active bookings.</td></tr>';
      return;
    }

    bookingsTableBody.innerHTML = '';
    bookings.forEach(booking => {
      const timePassedMs = Date.now() - booking.timestamp;
      const durationMs = booking.duration * 60 * 1000;
      const timeLeftMs = durationMs - timePassedMs;
      const timeLeft = timeLeftMs > 0 ? msToTime(timeLeftMs) : 'Expired';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${booking.parkingSpotId}</td>
        <td>${booking.licensePlate}</td>
        <td>${booking.duration} minutes</td>
        <td>${timeLeft}</td>
      `;
      bookingsTableBody.appendChild(tr);
    });
  } catch (err) {
    bookingsTableBody.innerHTML = '<tr><td colspan="4">Error loading bookings</td></tr>';
  }
}

function msToTime(duration) {
  let seconds = Math.floor((duration / 1000) % 60),
      minutes = Math.floor((duration / (1000 * 60)) % 60),
      hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  let timeStr = '';
  if (hours > 0) timeStr += hours + 'h ';
  if (minutes > 0) timeStr += minutes + 'm ';
  if (seconds > 0) timeStr += seconds + 's';
  return timeStr.trim() || '0s';
}

function setupBulkActions() {
  document.getElementById('selectAll').addEventListener('change', e => {
    const checked = e.target.checked;
    document.querySelectorAll('.spot-checkbox').forEach(cb => cb.checked = checked);
  });

  document.getElementById('activateSelected').addEventListener('click', () => bulkUpdateSpots(true));
  document.getElementById('deactivateSelected').addEventListener('click', () => bulkUpdateSpots(false));
  document.getElementById('deleteSelected').addEventListener('click', () => bulkDeleteSpots());
}

async function bulkUpdateSpots(active) {
  const checkedBoxes = Array.from(document.querySelectorAll('.spot-checkbox:checked'));
  if (checkedBoxes.length === 0) return alert('Select at least one spot.');

  const updates = checkedBoxes.map(cb => {
    return fetch(`/admin/spots/${cb.dataset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
  });

  await Promise.all(updates);
  loadSpots();
}

async function bulkDeleteSpots() {
  const checkedBoxes = Array.from(document.querySelectorAll('.spot-checkbox:checked'));
  if (checkedBoxes.length === 0) return alert('Select at least one spot.');

  if (!confirm(`Delete ${checkedBoxes.length} spots?`)) return;

  const deletes = checkedBoxes.map(cb => {
    return fetch(`/admin/spots/${cb.dataset.id}`, { method: 'DELETE' });
  });

  await Promise.all(deletes);
  loadSpots();
}

function setupAddSpotForm() {
  const form = document.getElementById('addSpotForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const spotId = document.getElementById('newSpotId').value.trim();
    if (!spotId) return alert('Enter Spot ID');

    const res = await fetch('/admin/spots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: spotId }),
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || 'Error adding spot');
    }

    alert('Spot added!');
    form.reset();
    loadSpots();
  });
}

function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', () => {
    fetch('/admin/logout', { method: 'POST' })
      .then(() => window.location.href = '/admin-login.html');
  });
}

// ---- Rate Modal functions ----

function openRateModal(spot) {
  document.getElementById('rateSpotId').textContent = spot.id;
  const rateForm = document.getElementById('rateForm');
  rateForm.innerHTML = ''; // Clear previous inputs

  durations.forEach(({ label, value }) => {
    const rateValue = spot.rates && spot.rates[value] !== undefined ? spot.rates[value] : 0;

    const div = document.createElement('div');
    div.classList.add('rate-input');

    div.innerHTML = `
      <label>${label}:</label>
      <input type="number" min="0" step="0.01" name="${value}" value="${rateValue}" />
    `;

    rateForm.appendChild(div);
  });

  document.getElementById('rateModal').style.display = 'flex';

  document.getElementById('saveRatesBtn').onclick = () => saveRates(spot.id);
}

async function saveRates(spotId) {
  const form = document.getElementById('rateForm');
  const formData = new FormData(form);
  const rates = {};

  for (const [key, value] of formData.entries()) {
    rates[key] = parseFloat(value) || 0;
  }

  try {
    const res = await fetch(`/admin/spots/${spotId}/rates`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rates }),
    });

    if (!res.ok) {
      const error = await res.json();
      alert('Error saving rates: ' + (error.error || res.statusText));
      return;
    }

    alert('Rates saved successfully!');
    closeRateModal();
    loadSpots();

  } catch (err) {
    alert('Network error saving rates');
  }
}

function closeRateModal() {
  document.getElementById('rateModal').style.display = 'none';
}
