require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./db");
const authRoutes = require("./routes/auth");
const aiRoutes = require("./routes/ai");


const app = express();

app.use(cors());
app.use(express.json());
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

    next(err);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
