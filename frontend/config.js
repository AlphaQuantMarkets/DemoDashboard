// frontend/config.js — single source of truth for the backend base URL.
// Loaded before every other frontend/ai-tutor script (non-module, so this
// top-level `const` is visible to them as a shared global).
const API_BASE_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? `${window.location.protocol}//${window.location.host}`
    : "https://alphaquant-api-yfae.onrender.com";

// Reads the locally-stored session token WITHOUT verifying its signature —
// safe for optimistic UI (e.g. deciding whether to redirect before a
// protected page renders). Anything security-sensitive must still be
// confirmed against the backend (see auth.js's verifySession()).
function decodeToken(token) {
    try {
        const payload = token.split(".")[1];
        return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
        return null;
    }
}

function getCurrentUser() {
    const token = localStorage.getItem("authToken");

    if (!token) {
        return null;
    }

    const payload = decodeToken(token);

    if (!payload || (payload.exp && Date.now() >= payload.exp * 1000)) {
        return null;
    }

    return {
        id: payload.id,
        username: payload.username
    };
}

window.getCurrentUser = getCurrentUser;
