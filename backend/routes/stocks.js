const express = require("express");
const router = express.Router();

const { getStockHistory } = require("../services/stockService");

const SYMBOL_PATTERN = /^[A-Z0-9._-]{1,15}$/;

router.get("/:symbol/history", async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();

    if (!SYMBOL_PATTERN.test(symbol)) {
        return res.status(400).json({ error: "Invalid stock symbol" });
    }

    try {
        const history = await getStockHistory(symbol);
        // Price history only changes once/day (the scheduled sync job) — a
        // short cache lets repeated page loads within the same browsing
        // session skip a re-fetch entirely instead of counting against the
        // rate limit every time.
        res.set("Cache-Control", "public, max-age=300");
        res.json({ symbol, history });
    } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;

        // Keep provider details in Render logs only; the browser receives the
        // same safe, generic 502 response as before.
        console.error("Stock history request failed", {
            symbol,
            status,
            source: error.source || "unknown",
            error: {
                name: error.name,
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                cause: error.cause?.message
            }
        });

        res.status(status).json({
            error: status === 503
                ? error.message
                : "Unable to load stock data"
        });
    }
});

module.exports = router;
