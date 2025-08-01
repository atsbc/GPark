const navItems = document.querySelectorAll('#nav li');
const sections = document.querySelectorAll('.section');
let currentSpots = [];

// Navigation
navItems.forEach(item => {
  item.addEventListener('click', () => {
    if (item.id === 'logoutBtn') return logout();
    navItems.forEach(i => i.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(item.dataset.section).classList.add('active');
    if (item.dataset.section === 'bookings') fetchBookings();
    if (item.dataset.section === 'spots') fetchSpots();
  });
});

// Logout
async function logout() {
  await fetch('/admin/logout', { method: 'POST' });
  window.location.href = '/admin-login.html';
}

// Format time left from booking
function formatTimeLeft(timestamp, duration) {
  const now = Date.now();
  const end = timestamp + duration * 60 * 1000;
  const left = end - now;
  if (left <= 0) return 'Expired';
  const min = Math.floor(left / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Fetch bookings
async function fetchBookings() {
  const table = document.getElementById('bookingsTable').querySelector('tbody');
  try {
    const res = await fetch('/admin/bookings');
    const data = await res.json();
    if (data.length === 0) {
      table.innerHTML = '<tr><td colspan="4">No bookings</td></tr>';
      return;
    }
    table.innerHTML = data.map(b => `
      <tr>
        <td>${b.parkingSpotId}</td>
        <td>${b.licensePlate}</td>
        <td>${b.duration} mins</td>
        <td>${formatTimeLeft(b.timestamp, b.duration)}</td>
      </tr>
    `).join('');
  } catch {
    table.innerHTML = '<tr><td colspan="4">Error loading bookings</td></tr>';
  }
}

// Fetch spots
async function fetchSpots() {
  try {
    const res = await fetch('/admin/spots');
    currentSpots = await res.json();
    const tbody = document.getElementById('spotsList');
    if (currentSpots.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No spots</td></tr>';
      return;
    }
    tbody.innerHTML = currentSpots.map(s => `
      <tr>
        <td><input type="checkbox" class="rowCheckbox" /></td>
        <td>${s.id}</td>
        <td>${s.active ? '✅' : '❌'}</td>
        <td><button onclick='openRateModal(${JSON.stringify(s)})'>Edit Rates</button></td>
      </tr>
    `).join('');
  } catch {
    document.getElementById('spotsList').innerHTML = '<tr><td colspan="4">Error loading spots</td></tr>';
  }
}

// Add new spot
document.getElementById('addSpotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('newSpotId').value.trim();
  if (!id) return;
  await fetch('/admin/spots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  document.getElementById('newSpotId').value = '';
  fetchSpots();
});

// Select all checkboxes
document.getElementById('selectAll').addEventListener('change', (e) => {
  document.querySelectorAll('.rowCheckbox').forEach(cb => cb.checked = e.target.checked);
});

// Get selected spot IDs
function getSelectedIds() {
  return Array.from(document.querySelectorAll('.rowCheckbox'))
    .map((cb, i) => cb.checked ? currentSpots[i].id : null)
    .filter(Boolean);
}

// Bulk activate/deactivate
async function bulkUpdate(active) {
  const ids = getSelectedIds();
  if (!ids.length) return alert('Select at least one spot');
  await Promise.all(ids.map(id =>
    fetch(`/admin/spots/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
  ));
  fetchSpots();
}

// Bulk delete
async function bulkDelete() {
  const ids = getSelectedIds();
  if (!ids.length || !confirm(`Delete ${ids.length} spot(s)?`)) return;
  await Promise.all(ids.map(id =>
    fetch(`/admin/spots/${id}`, { method: 'DELETE' })
  ));
  fetchSpots();
}

document.getElementById('activateSelected').addEventListener('click', () => bulkUpdate(true));
document.getElementById('deactivateSelected').addEventListener('click', () => bulkUpdate(false));
document.getElementById('deleteSelected').addEventListener('click', () => bulkDelete());


// ------------------------
// Rates Modal Logic Below
// ------------------------

// Open modal for editing spot rates
function openRateModal(spot) {
  const form = document.getElementById('rateForm');
  form.innerHTML = '';
  document.getElementById('rateSpotId').textContent = spot.id;
  form.dataset.id = spot.id;

  const durations = [30, 45, 60, 120, 240, 480, 720, 1440];
  durations.forEach(d => {
    const rate = spot.rates?.[d] ?? '';
    form.innerHTML += `
      <label>${d} min: 
        <input type="number" step="0.01" name="${d}" value="${rate}" required />
      </label>
    `;
  });

  document.getElementById('rateModal').style.display = 'flex';
}

// Close modal
function closeRateModal() {
  document.getElementById('rateModal').style.display = 'none';
}

// Save new rates
document.getElementById('saveRatesBtn').addEventListener('click', async () => {
  const form = document.getElementById('rateForm');
  const spotId = form.dataset.id;
  const rates = {};

  for (let input of form.querySelectorAll('input')) {
    const duration = input.name;
    const value = parseFloat(input.value);
    if (!isNaN(value)) rates[duration] = value;
  }

  await fetch(`/admin/spots/${spotId}/rates`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rates })
  });

  closeRateModal();
  fetchSpots();
});
