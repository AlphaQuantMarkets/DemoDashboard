const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

function requireDatabase(req, res, next) {
    if (!process.env.DATABASE_URL) {
        return res.status(503).json({
            error: "DATABASE_URL is not configured"
        });
    }

    next();
}

router.use(authMiddleware, requireDatabase);

router.get("/watchlist", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT tickers FROM user_watchlists WHERE user_id = $1",
            [req.user.id]
        );

        res.json({ tickers: result.rows[0]?.tickers ?? null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Unable to load watchlist." });
    }
});

router.put("/watchlist", async (req, res) => {
    const { tickers } = req.body;

    if (!Array.isArray(tickers) || !tickers.every((ticker) => typeof ticker === "string")) {
        return res.status(400).json({ error: "tickers must be an array of strings." });
    }

    try {
        await pool.query(
            `INSERT INTO user_watchlists (user_id, tickers, updated_at)
             VALUES ($1, $2, now())
             ON CONFLICT (user_id) DO UPDATE SET tickers = EXCLUDED.tickers, updated_at = now()`,
            [req.user.id, JSON.stringify(tickers)]
        );

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Unable to save watchlist." });
    }
});

router.get("/learning-progress", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT progress FROM user_learning_progress WHERE user_id = $1",
            [req.user.id]
        );

        res.json({ progress: result.rows[0]?.progress ?? null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Unable to load learning progress." });
    }
});

router.put("/learning-progress", async (req, res) => {
    const { progress } = req.body;

    if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
        return res.status(400).json({ error: "progress must be an object." });
    }

    try {
        await pool.query(
            `INSERT INTO user_learning_progress (user_id, progress, updated_at)
             VALUES ($1, $2, now())
             ON CONFLICT (user_id) DO UPDATE SET progress = EXCLUDED.progress, updated_at = now()`,
            [req.user.id, JSON.stringify(progress)]
        );

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Unable to save learning progress." });
    }
});

module.exports = router;
