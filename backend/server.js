require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const pool = require("./db");
const authRoutes = require("./routes/auth");
const aiRoutes = require("./routes/ai");

const DEFAULT_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : DEFAULT_DEV_ORIGINS;

const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
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
app.use("/api", apiRateLimiter);
app.use("/api/ai", aiRoutes);

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "AlphaQuant API is running",
        health: "/api/health"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        databaseConfigured: Boolean(process.env.DATABASE_URL),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
    });
});

app.get("/api/db-health", async (req, res) => {
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
