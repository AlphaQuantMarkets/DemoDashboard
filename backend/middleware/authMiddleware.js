const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
    if (!process.env.JWT_SECRET) {
        return res.status(503).json({
            error: "JWT_SECRET is not configured"
        });
    }

    const [scheme, token] = (req.headers.authorization || "").split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            error: "Authentication token is required."
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({
            error: "Invalid or expired token."
        });
    }
}

module.exports = authMiddleware;
