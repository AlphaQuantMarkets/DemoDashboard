const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = "7d";

function signToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );
}

function requireDatabase(req, res, next) {
    if (!process.env.DATABASE_URL) {
        return res.status(503).json({
            error: "DATABASE_URL is not configured"
        });
    }

    next();
}

function requireJwtSecret(req, res, next) {
    if (!process.env.JWT_SECRET) {
        return res.status(503).json({
            error: "JWT_SECRET is not configured"
        });
    }

    next();
}

router.post("/signup", requireDatabase, requireJwtSecret, async (req, res) => {

    const { username, password } = req.body;

    try {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await pool.query(
            `
            INSERT INTO users(username, password)
            VALUES ($1, $2)
            RETURNING id, username
            `,
            [username, passwordHash]
        );

        const user = result.rows[0];

        res.status(201).json({
            id: user.id,
            username: user.username,
            token: signToken(user)
        });

    } catch (err) {

        if (err.code === "23505") {
            return res.status(400).json({
                error: "Tên đăng nhập đã tồn tại."
            });
        }

        console.error(err);

        res.status(500).json({
            error: "Lỗi máy chủ."
        });

    }

});

router.post("/login", requireDatabase, requireJwtSecret, async (req, res) => {

    const { username, password } = req.body;

    try {

        const result = await pool.query(
            `
            SELECT *
            FROM users
            WHERE username = $1
            `,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Không tìm thấy tài khoản."
            });
        }

        const user = result.rows[0];

        const passwordMatches = await bcrypt.compare(password, user.password);

        if (!passwordMatches) {
            return res.status(401).json({
                error: "Sai mật khẩu."
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username
            },
            token: signToken(user)
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});

router.get("/me", authMiddleware, requireDatabase, async (req, res) => {

    try {
        const result = await pool.query(
            "SELECT id, username, is_premium FROM users WHERE id = $1",
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Không tìm thấy tài khoản."
            });
        }

        res.json({
            user: result.rows[0]
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Lỗi máy chủ."
        });

    }

});

module.exports = router;
