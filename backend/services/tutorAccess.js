const pool = require("../db");

async function requirePremiumTutorAccess(req, res, next) {
    if (!process.env.DATABASE_URL) {
        return res.status(503).json({
            error: "DATABASE_URL is not configured"
        });
    }

    try {
        const result = await pool.query(
            "SELECT is_premium FROM users WHERE id = $1",
            [req.user.id]
        );

        const isPremium = result.rows[0]?.is_premium === true;

        if (!isPremium) {
            return res.status(403).json({
                error: "AI Investment Tutor requires a Premium subscription",
                code: "PREMIUM_REQUIRED"
            });
        }

        next();

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: "Unable to verify premium access."
        });
    }
}

module.exports = {
    requirePremiumTutorAccess
};
