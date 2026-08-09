require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const pool = require("./db");
const authRoutes = require("./routes/auth");
const aiRoutes = require("./routes/ai");
const stocksRoutes = require("./routes/stocks");
const userStateRoutes = require("./routes/userState");

const DEFAULT_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://alphaquantmarkets.github.io",
    "https://alphaquant-api-yfae.onrender.com"
];

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : DEFAULT_DEV_ORIGINS;

// Auth and AI are sensitive/abuse-prone (brute-force risk, real per-call
// Gemini cost) — each kept at the original limit, unchanged, but as
// independent instances so heavy legitimate use of one (e.g. a premium user
// asking the AI Tutor several questions) can't lock the user out of the
// other (e.g. logging back in).
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." }
});

const aiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." }
});

// Stock/user-state reads are cheap, server-side DB reads, and a single
// dashboard page load legitimately fires ~30+ of them at once (one per
// ticker). Sharing the strict bucket above meant 3-4 page reloads alone
// exhausted it and locked the user out of login/AI for the rest of the
// window. This tier is sized for that real read volume while still being a
// genuine cap against scraping/abuse.
const readApiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." }
});

const app = express();

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        callback(new Error("Not allowed by CORS"));
    }
}));
app.use(express.json());
app.use("/api/ai", aiRateLimiter, aiRoutes);
app.use("/api/stocks", readApiRateLimiter, stocksRoutes);
app.use("/api/user-state", readApiRateLimiter, userStateRoutes);

app.use("/api/auth", authRateLimiter, authRoutes);

// Clean URLs for the public/auth/dashboard pages. Redirecting (rather than
// sendFile-ing) keeps the browser's URL under /frontend/*, so each page's
// own relative asset paths (config.js, style.css, ...) keep resolving
// correctly.
app.get("/", (req, res) => {
    res.redirect("/frontend/index.html");
});

app.get("/auth", (req, res) => {
    const query = req.url.split("?")[1];
    res.redirect(query ? `/frontend/auth.html?${query}` : "/frontend/auth.html");
});

app.get("/pricing", (req, res) => {
    res.redirect("/frontend/pricing.html");
});

app.get("/dashboard", (req, res) => {
    res.redirect("/frontend/dashboard.html");
});

app.get("/api/health", readApiRateLimiter, (req, res) => {
    res.json({
        status: "ok",
        databaseConfigured: Boolean(process.env.DATABASE_URL),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
    });
});

app.get("/api/db-health", readApiRateLimiter, async (req, res) => {
    if (!process.env.DATABASE_URL) {
        return res.status(503).json({
            status: "unavailable",
            error: "DATABASE_URL is not configured"
        });
    }

    try {
        const result = await pool.query("SELECT NOW()");
        res.json({
            status: "ok",
            time: result.rows[0].now
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: "error",
            error: err.message
        });
    }
});

app.get("/ai-tutor", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "ai-tutor", "index.html"));
});

app.use("/ai-tutor", express.static(path.join(__dirname, "..", "ai-tutor")));
app.use("/frontend", express.static(path.join(__dirname, "..", "frontend")));

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({
            error: "Invalid JSON request body"
        });
    }

    if (err.message === "Not allowed by CORS") {
        return res.status(403).json({
            error: "Origin not allowed"
        });
    }

    next(err);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
