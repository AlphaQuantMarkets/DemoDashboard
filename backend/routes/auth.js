const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const validators = require("../utils/validators");
const emailVerificationService = require("../services/emailVerificationService");

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

function validateSignupFields({ username, email, phoneNumber, gender, password, confirmPassword }) {
    if (typeof username !== "string" || !username.trim()) {
        return "Username is required.";
    }

    if (!validators.isValidEmail(email)) {
        return "A valid email address is required.";
    }

    if (!validators.isValidVnPhoneNumber(phoneNumber)) {
        return "A valid Vietnamese phone number is required (e.g. 0912345678).";
    }

    if (!validators.isValidGender(gender)) {
        return "Gender must be one of: " + validators.GENDERS.join(", ");
    }

    if (!validators.isValidPassword(password)) {
        return `Password must be at least ${validators.MIN_PASSWORD_LENGTH} characters.`;
    }

    if (!validators.passwordsMatch(password, confirmPassword)) {
        return "Password and confirm password do not match.";
    }

    return null;
}

router.post("/signup", requireDatabase, requireJwtSecret, async (req, res) => {

    const { username, email, phoneNumber, gender, password, confirmPassword } = req.body;

    const validationError = validateSignupFields({ username, email, phoneNumber, gender, password, confirmPassword });

    if (validationError) {
        return res.status(400).json({
            error: validationError
        });
    }

    try {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const { rawToken, tokenHash, expiresAt } = emailVerificationService.generateVerificationToken();

        const result = await pool.query(
            `
            INSERT INTO users(
                username, email, phone_number, gender, password,
                is_email_verified, email_verification_token_hash, email_verification_expires_at
            )
            VALUES ($1, $2, $3, $4, $5, false, $6, $7)
            RETURNING id, username, email
            `,
            [username, email, phoneNumber, gender, passwordHash, tokenHash, expiresAt]
        );

        const user = result.rows[0];

        await emailVerificationService.sendVerificationEmail(user, rawToken);

        res.status(201).json({
            id: user.id,
            username: user.username,
            email: user.email,
            message: "Please check your email to verify your account."
        });

    } catch (err) {

        if (err.code === "23505") {
            if (err.constraint === "users_email_key") {
                return res.status(400).json({
                    error: "This email is already registered."
                });
            }

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

        if (!user.is_email_verified) {
            return res.status(403).json({
                error: "Please verify your email before logging in.",
                code: "EMAIL_NOT_VERIFIED",
                email: user.email
            });
        }

        if (!user.is_email_verified && process.env.SKIP_EMAIL_VERIFICATION !== "true") {
            return res.status(403).json({
                error: "Please verify your email before logging in.",
                code: "EMAIL_NOT_VERIFIED",
                email: user.email
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

router.post("/verify-email", requireDatabase, async (req, res) => {

    const { token } = req.body;

    try {
        const { status } = await emailVerificationService.consumeVerificationToken(token);

        if (status === "verified") {
            return res.json({ status });
        }

        if (status === "expired") {
            return res.status(410).json({ status });
        }

        return res.status(400).json({ status });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Lỗi máy chủ."
        });

    }

});

router.post("/resend-verification", requireDatabase, async (req, res) => {

    const { email } = req.body;

    if (!validators.isValidEmail(email)) {
        return res.status(400).json({
            error: "A valid email address is required."
        });
    }

    try {
        await emailVerificationService.reissueToken(email);

        res.json({
            message: "If that email is registered and not yet verified, a verification email has been sent."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Lỗi máy chủ."
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
