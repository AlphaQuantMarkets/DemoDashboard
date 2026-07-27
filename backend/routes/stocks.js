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
        res.json({ symbol, history });
    } catch (error) {
        console.error(`Stock history error for ${symbol}:`, error);

        const status = Number.isInteger(error.status) ? error.status : 500;

        res.status(status).json({
            error: status === 503
                ? error.message
                : "Unable to load stock data"
        });
    }
});

module.exports = router;
