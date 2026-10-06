(() => {
"use strict";

const USERS_KEY = "locationAppUsers";
const SESSION_KEY = "locationAppSession";
const SETTINGS_KEY = "locationAppSettings";
const LOCATION_KEY = "locationAppApproxLocation";

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); }
  catch { return {}; }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession() {
  return localStorage.getItem(SESSION_KEY);
}

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{"sharing":false,"radius":1}');
  } catch {
    return { sharing:false, radius:1 };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

async function hashPassword(password) {
  if (window.crypto && crypto.subtle) {
    const data = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return password;
}

function showMessage(id, text, success = false) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("success", success);
}

function redirectIfLoggedIn() {
  if (getSession()) window.location.href = "aimap.html";
}

async function handleRegister(event) {
  event.preventDefault();
  const username = document.getElementById("registerUsername").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirm = document.getElementById("registerConfirm").value;
  const users = getUsers();

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    showMessage("registerMessage", "Username must be 3–20 letters, numbers, or underscores.");
    return;
  }
  if (password.length < 8) {
    showMessage("registerMessage", "Password must be at least 8 characters.");
    return;
  }
  if (password !== confirm) {
    showMessage("registerMessage", "Passwords do not match.");
    return;
  }
  if (users[username.toLowerCase()]) {
    showMessage("registerMessage", "That username already exists in this browser.");
    return;
  }

  users[username.toLowerCase()] = {
    username,
    password: await hashPassword(password),
    created: new Date().toISOString()
  };
  saveUsers(users);
  localStorage.setItem(SESSION_KEY, username);
  saveSettings({ sharing:false, radius:1 });
  window.location.href = "aimap.html";
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const user = getUsers()[username.toLowerCase()];

  if (!user || user.password !== await hashPassword(password)) {
    showMessage("loginMessage", "Invalid username or password.");
    return;
  }

  localStorage.setItem(SESSION_KEY, user.username);
  window.location.href = "aimap.html";
}

function requireLogin() {
  if (!getSession()) {
    window.location.href = "ailogin.html";
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LOCATION_KEY);
  window.location.href = "aiindex.html";
}

function loadProfile() {
  const username = getSession() || "Unknown";
  const settings = getSettings();
  const avatar = document.getElementById("profileAvatar");
  const name1 = document.getElementById("profileUsername");
  const name2 = document.getElementById("profileUsername2");
  const status = document.getElementById("profileLocationStatus");
  const radius = document.getElementById("profileRadius");

  if (avatar) avatar.textContent = username.charAt(0).toUpperCase();
  if (name1) name1.textContent = username;
  if (name2) name2.textContent = username;
  if (status) status.textContent = settings.sharing ? "On" : "Off";
  if (radius) radius.textContent = settings.radius + " mile" + (Number(settings.radius) === 1 ? "" : "s");
}

function loadPrivacySettings() {
  const settings = getSettings();
  const toggle = document.getElementById("locationToggle");
  const radius = document.getElementById("privacyRadius");
  if (toggle) toggle.checked = !!settings.sharing;
  if (radius) radius.value = String(settings.radius);
}

function savePrivacySettings() {
  const toggle = document.getElementById("locationToggle");
  const radius = document.getElementById("privacyRadius");
  const settings = {
    sharing: !!toggle?.checked,
    radius: Number(radius?.value || 1)
  };
  saveSettings(settings);

  if (!settings.sharing) {
    localStorage.removeItem(LOCATION_KEY);
    showMessage("privacyMessage", "Location sharing is off. Stored location data was cleared.", true);
  } else {
    showMessage("privacyMessage", "Privacy settings saved.", true);
  }
}

function milesToDegrees(miles, latitude) {
  const lat = miles / 69;
  const lon = miles / (69 * Math.cos(latitude * Math.PI / 180));
  return { lat, lon };
}

function randomOffset(radius) {
  const distance = Math.random() * Math.max(0.05, Number(radius));
  const angle = Math.random() * Math.PI * 2;
  return { distance, angle };
}

function getApproximatePosition(position, radius) {
  const { latitude, longitude } = position.coords;
  const offset = randomOffset(radius);
  const degrees = milesToDegrees(offset.distance, latitude);
  return {
    lat: latitude + Math.sin(offset.angle) * degrees.lat,
    lng: longitude + Math.cos(offset.angle) * degrees.lon,
    timestamp: Date.now()
  };
}

let mapInstance = null;
let selfMarker = null;
let nearbyLayer = null;

function initializeMap() {
  if (!window.L || !document.getElementById("map")) return;

  mapInstance = L.map("map").setView([39.0, -95.0], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(mapInstance);

  nearbyLayer = L.layerGroup().addTo(mapInstance);
  updateMapFromSettings();
}

function updateMapFromSettings() {
  const settings = getSettings();
  const status = document.getElementById("locationStatus");
  const button = document.getElementById("locationButton");
  const welcome = document.getElementById("welcomeText");
  const privacy = document.getElementById("privacyStatus");

  if (welcome) welcome.textContent = "Welcome, " + (getSession() || "user") + ".";
  if (privacy) privacy.textContent = settings.sharing ? "Approximate location sharing on" : "Location protected";
  if (button) button.textContent = settings.sharing ? "Turn Off Location" : "Turn On Location";

  if (!settings.sharing) {
    if (status) status.textContent = "Location sharing is off.";
    if (selfMarker) {
      mapInstance.removeLayer(selfMarker);
      selfMarker = null;
    }
    if (nearbyLayer) nearbyLayer.clearLayers();
    return;
  }

  const saved = localStorage.getItem(LOCATION_KEY);
  if (saved) {
    try {
      const location = JSON.parse(saved);
      drawLocation(location, settings);
      return;
    } catch {}
  }

  if (status) status.textContent = "Requesting permission for your device location...";
  if (!navigator.geolocation) {
    if (status) status.textContent = "Geolocation is not supported by this browser.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const approximate = getApproximatePosition(position, settings.radius);
      localStorage.setItem(LOCATION_KEY, JSON.stringify(approximate));
      drawLocation(approximate, settings);
    },
    error => {
      if (status) status.textContent = "Location permission was not granted. Your exact location is not displayed.";
      console.warn("Geolocation:", error.message);
    },
    { enableHighAccuracy:false, maximumAge:300000, timeout:10000 }
  );
}

function drawLocation(location, settings) {
  if (!mapInstance) return;
  const point = [location.lat, location.lng];

  if (selfMarker) mapInstance.removeLayer(selfMarker);
  selfMarker = L.marker(point).addTo(mapInstance).bindPopup(
    "<strong>You</strong><br>Approximate location only"
  );

  mapInstance.setView(point, 11);

  if (nearbyLayer) {
    nearbyLayer.clearLayers();

    // Demo markers are deliberately fictional and are not real users.
    const demoOffsets = [[0.012,0.018],[-0.016,0.009],[0.021,-0.014]];
    demoOffsets.forEach((offset, index) => {
      L.circleMarker([location.lat + offset[0], location.lng + offset[1]], {
        radius:7
      }).addTo(nearbyLayer).bindPopup("<strong>Demo user " + (index + 1) + "</strong><br>Fictional marker for prototype testing");
    });
  }

  const status = document.getElementById("locationStatus");
  if (status) status.textContent = "Approximate location is being displayed.";
}

function toggleLocation() {
  const settings = getSettings();
  settings.sharing = !settings.sharing;
  saveSettings(settings);

  if (!settings.sharing) {
    localStorage.removeItem(LOCATION_KEY);
    if (selfMarker && mapInstance) {
      mapInstance.removeLayer(selfMarker);
      selfMarker = null;
    }
    if (nearbyLayer) nearbyLayer.clearLayers();
  }

  updateMapFromSettings();
}

function refreshNearbyUsers() {
  localStorage.removeItem(LOCATION_KEY);
  if (nearbyLayer) nearbyLayer.clearLayers();
  updateMapFromSettings();
}

document.addEventListener("DOMContentLoaded", () => {
  const register = document.getElementById("registerForm");
  const login = document.getElementById("loginForm");
  if (register) register.addEventListener("submit", handleRegister);
  if (login) login.addEventListener("submit", handleLogin);
  if (document.body.dataset.locationApp === "login") redirectIfLoggedIn();
});

window.requireLogin = requireLogin;
window.logout = logout;
window.loadProfile = loadProfile;
window.loadPrivacySettings = loadPrivacySettings;
window.savePrivacySettings = savePrivacySettings;
window.initializeMap = initializeMap;
window.toggleLocation = toggleLocation;
window.refreshNearbyUsers = refreshNearbyUsers;
})();