const STORAGE_KEY = "locationAppUsers";
const CURRENT_KEY = "locationAppCurrentUser";

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function getCurrentUser() {
    return localStorage.getItem(CURRENT_KEY);
}

function findCurrentUser() {
    const username = getCurrentUser();
    if (!username) return null;
    return getUsers().find(user => user.username.toLowerCase() === username.toLowerCase()) || null;
}

function requireLogin() {
    if (!getCurrentUser()) {
        window.location.href = "ailogin.html";
    }
}

function logout() {
    localStorage.removeItem(CURRENT_KEY);
    window.location.href = "aiindex.html";
}

function validUsername(username) {
    return /^[A-Za-z0-9_]{3,20}$/.test(username);
}

function showMessage(id, message, error = false) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.style.color = error ? "#ff7d8d" : "#28d7f5";
}

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", event => {
        event.preventDefault();

        const username = document.getElementById("registerUsername").value.trim();
        const password = document.getElementById("registerPassword").value;
        const confirm = document.getElementById("registerConfirm").value;

        if (!validUsername(username)) {
            showMessage("registerMessage", "Use 3–20 letters, numbers, or underscores.", true);
            return;
        }

        if (password.length < 8) {
            showMessage("registerMessage", "Password must be at least 8 characters.", true);
            return;
        }

        if (password !== confirm) {
            showMessage("registerMessage", "Passwords do not match.", true);
            return;
        }

        const users = getUsers();

        if (users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
            showMessage("registerMessage", "That username is already taken.", true);
            return;
        }

        users.push({
            username,
            password,
            locationSharing: false,
            radius: 1,
            latitude: null,
            longitude: null,
            approximateLatitude: null,
            approximateLongitude: null
        });

        saveUsers(users);
        localStorage.setItem(CURRENT_KEY, username);
        window.location.href = "aimap.html";
    });
}

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", event => {
        event.preventDefault();

        const username = document.getElementById("loginUsername").value.trim();
        const password = document.getElementById("loginPassword").value;
        const user = getUsers().find(u =>
            u.username.toLowerCase() === username.toLowerCase() &&
            u.password === password
        );

        if (!user) {
            showMessage("loginMessage", "Incorrect username or password.", true);
            return;
        }

        localStorage.setItem(CURRENT_KEY, user.username);
        window.location.href = "aimap.html";
    });
}

let locationMap = null;
let userMarker = null;
let otherMarkers = [];

function initializeMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement) return;

    const user = findCurrentUser();
    if (!user) return;

    document.getElementById("welcomeText").textContent = "Welcome, " + user.username;
    locationMap = L.map("map").setView([39.8283, -98.5795], 4);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19
    }).addTo(locationMap);

    updateLocationUI();
    refreshNearbyUsers();
}

function milesToLatitudeDegrees(miles) {
    return miles / 69;
}

function randomApproximation(latitude, longitude, radiusMiles) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radiusMiles;
    const latOffset = Math.cos(angle) * milesToLatitudeDegrees(distance);
    const longitudeMilesPerDegree = Math.max(20, 69 * Math.cos(latitude * Math.PI / 180));
    const lngOffset = Math.sin(angle) * distance / longitudeMilesPerDegree;

    return {
        latitude: latitude + latOffset,
        longitude: longitude + lngOffset
    };
}

function toggleLocation() {
    const users = getUsers();
    const username = getCurrentUser();
    const userIndex = users.findIndex(u => u.username === username);

    if (userIndex === -1) return;

    const user = users[userIndex];

    if (user.locationSharing) {
        user.locationSharing = false;
        user.latitude = null;
        user.longitude = null;
        user.approximateLatitude = null;
        user.approximateLongitude = null;

        users[userIndex] = user;
        saveUsers(users);
        updateLocationUI();
        refreshNearbyUsers();
        return;
    }

    if (!navigator.geolocation) {
        alert("Your browser does not support location services.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            const currentRadius = Number(user.radius || 1);
            const approximate = randomApproximation(
                position.coords.latitude,
                position.coords.longitude,
                currentRadius
            );

            user.locationSharing = true;
            user.latitude = position.coords.latitude;
            user.longitude = position.coords.longitude;
            user.approximateLatitude = approximate.latitude;
            user.approximateLongitude = approximate.longitude;

            users[userIndex] = user;
            saveUsers(users);

            updateLocationUI();
            refreshNearbyUsers();
        },
        () => {
            alert("Location permission was not granted. Your location remains hidden.");
        },
        {
            enableHighAccuracy: false,
            maximumAge: 60000,
            timeout: 10000
        }
    );
}

function updateLocationUI() {
    const user = findCurrentUser();
    if (!user) return;

    const status = document.getElementById("locationStatus");
    const button = document.getElementById("locationButton");
    const privacyStatus = document.getElementById("privacyStatus");

    if (!status || !button) return;

    if (user.locationSharing && user.approximateLatitude && user.approximateLongitude) {
        status.textContent = "Your approximate location is being shared.";
        button.textContent = "Turn Off Location";
        if (privacyStatus) privacyStatus.textContent = "Location sharing ON";
    } else {
        status.textContent = "Location sharing is off. You are hidden from the map.";
        button.textContent = "Turn On Location";
        if (privacyStatus) privacyStatus.textContent = "Location protected";
    }
}

function clearMarkers() {
    if (!locationMap) return;

    if (userMarker) {
        locationMap.removeLayer(userMarker);
        userMarker = null;
    }

    otherMarkers.forEach(marker => locationMap.removeLayer(marker));
    otherMarkers = [];
}

function refreshNearbyUsers() {
    if (!locationMap) return;

    clearMarkers();

    const users = getUsers();
    const currentUsername = getCurrentUser();

    const visibleUsers = users.filter(user =>
        user.locationSharing &&
        user.approximateLatitude &&
        user.approximateLongitude
    );

    visibleUsers.forEach(user => {
        const isSelf = user.username === currentUsername;

        const marker = L.circleMarker(
            [user.approximateLatitude, user.approximateLongitude],
            {
                radius: isSelf ? 10 : 8,
                color: isSelf ? "#28d7f5" : "#ffb454",
                fillColor: isSelf ? "#28d7f5" : "#ffb454",
                fillOpacity: 0.8,
                weight: 2
            }
        ).addTo(locationMap);

        marker.bindPopup(
            "<strong>" +
            escapeHtml(user.username) +
            "</strong><br>" +
            (isSelf ? "Your approximate location" : "Approximate location")
        );

        if (isSelf) {
            userMarker = marker;
            locationMap.setView(
                [user.approximateLatitude, user.approximateLongitude],
                12
            );
        } else {
            otherMarkers.push(marker);
        }
    });

    if (!visibleUsers.length) {
        locationMap.setView([39.8283, -98.5795], 4);
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function loadProfile() {
    const user = findCurrentUser();
    if (!user) return;

    const usernameElements = [
        document.getElementById("profileUsername"),
        document.getElementById("profileUsername2")
    ];

    usernameElements.forEach(element => {
        if (element) element.textContent = user.username;
    });

    const avatar = document.getElementById("profileAvatar");
    if (avatar) avatar.textContent = user.username.charAt(0).toUpperCase();

    const status = document.getElementById("profileLocationStatus");
    if (status) status.textContent = user.locationSharing ? "On" : "Off";

    const radius = document.getElementById("profileRadius");
    if (radius) radius.textContent = (user.radius || 1) + " mile" + (Number(user.radius || 1) === 1 ? "" : "s");
}

function loadPrivacySettings() {
    const user = findCurrentUser();
    if (!user) return;

    const toggle = document.getElementById("locationToggle");
    const radius = document.getElementById("privacyRadius");

    if (toggle) toggle.checked = Boolean(user.locationSharing);
    if (radius) radius.value = String(user.radius || 1);
}

function savePrivacySettings() {
    const users = getUsers();
    const username = getCurrentUser();
    const index = users.findIndex(u => u.username === username);

    if (index === -1) return;

    const user = users[index];
    const enabled = document.getElementById("locationToggle").checked;
    const radius = Number(document.getElementById("privacyRadius").value);

    user.locationSharing = enabled;
    user.radius = radius;

    if (!enabled) {
        user.latitude = null;
        user.longitude = null;
        user.approximateLatitude = null;
        user.approximateLongitude = null;
    } else if (user.latitude && user.longitude) {
        const approximate = randomApproximation(
            user.latitude,
            user.longitude,
            radius
        );

        user.approximateLatitude = approximate.latitude;
        user.approximateLongitude = approximate.longitude;
    }

    users[index] = user;
    saveUsers(users);

    showMessage(
        "privacyMessage",
        enabled
            ? "Location sharing enabled with your selected privacy radius."
            : "Location sharing disabled. Your saved location was removed."
    );
}