const DEFAULT_CENTER = [17.385, 78.486];
const DEFAULT_ZOOM = 12;
const FOCUSED_ZOOM = 13;

const statusEl = document.getElementById('status');
const searchInput = document.getElementById('searchInput');

const map = L.map('map', {
  zoomControl: false,
}).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

L.control
  .zoom({
    position: 'bottomright',
  })
  .addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

const clinicLayer = L.layerGroup().addTo(map);
let clinics = [];
let userLocation = null;

// Builds a friendly popup for each clinic marker.
function buildPopupContent(clinic, distanceText) {
  const actionButton = clinic.voxcare_supported
    ? `<a class="btn" href="${clinic.booking_link}" target="_blank" rel="noopener noreferrer">Book Appointment</a>`
    : '<button class="btn secondary" type="button">Request VoxCare</button>';

  return `
    <div class="popup">
      <h3>${clinic.name}</h3>
      <p><strong>Speciality:</strong> ${clinic.speciality}</p>
      <p><strong>Distance:</strong> ${distanceText}</p>
      ${actionButton}
    </div>
  `;
}

// Uses the Haversine formula for an approximate distance in kilometers.
function calculateDistanceKm(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function renderClinics(filterText = '') {
  clinicLayer.clearLayers();

  const query = filterText.trim().toLowerCase();
  const filtered = clinics.filter((clinic) => {
    if (!query) return true;
    const haystack = `${clinic.name} ${clinic.city ?? ''}`.toLowerCase();
    return haystack.includes(query);
  });

  filtered.forEach((clinic) => {
    const marker = L.marker([clinic.lat, clinic.lng]);

    const distanceText = userLocation
      ? `${calculateDistanceKm(userLocation, clinic).toFixed(1)} km away`
      : 'Distance unavailable';

    marker.bindPopup(buildPopupContent(clinic, distanceText), {
      closeButton: true,
      className: 'clinic-popup',
    });

    marker.addTo(clinicLayer);
  });

  statusEl.textContent = filtered.length
    ? `Showing ${filtered.length} clinic${filtered.length > 1 ? 's' : ''}.`
    : 'No clinics found for this search.';
}

async function loadClinics() {
  const response = await fetch('clinics.json');
  if (!response.ok) {
    throw new Error('Could not load clinics data.');
  }

  clinics = await response.json();
  renderClinics();
}

function locateUser() {
  if (!navigator.geolocation) {
    statusEl.textContent = 'Geolocation is not supported by your browser.';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      L.marker([userLocation.lat, userLocation.lng], {
        title: 'You are here',
      })
        .bindPopup('Your location')
        .addTo(map);

      map.setView([userLocation.lat, userLocation.lng], FOCUSED_ZOOM);
      renderClinics(searchInput.value);
      statusEl.textContent = 'Showing nearby clinics around your location.';
    },
    () => {
      statusEl.textContent = 'Location permission denied. Showing default area.';
      renderClinics(searchInput.value);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

searchInput.addEventListener('input', (event) => {
  renderClinics(event.target.value);
});

(async function init() {
  try {
    await loadClinics();
  } catch (error) {
    statusEl.textContent = 'Unable to load clinic data right now.';
    console.error(error);
  }

  locateUser();
})();
