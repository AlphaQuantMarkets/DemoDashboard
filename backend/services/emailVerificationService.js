const crypto = require("crypto");
const pool = require("../db");
const emailService = require("./emailService");

const EMAIL_VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

function getFrontendBaseUrl() {
    return process.env.FRONTEND_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
}

function hashToken(rawToken) {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateVerificationToken() {
    const rawToken = crypto.randomBytes(32).toString("hex");

    return {
        rawToken,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRY_MS)
    };
}

async function sendVerificationEmail(user, rawToken) {
    const verificationUrl = `${getFrontendBaseUrl()}/frontend/verify-email.html?token=${rawToken}`;

    await emailService.sendEmail({
        to: user.email,
        subject: "Verify your AlphaQuant account",
        text:
            `Hi ${user.username},\n\n` +
            `Please verify your email by visiting the link below:\n${verificationUrl}\n\n` +
            "This link expires in 24 hours.",
        html:
            `<p>Hi ${user.username},</p>` +
            "<p>Please verify your email by clicking the link below:</p>" +
            `<p><a href="${verificationUrl}">${verificationUrl}</a></p>` +
            "<p>This link expires in 24 hours.</p>"
    });
}

async function consumeVerificationToken(rawToken) {
    if (typeof rawToken !== "string" || !rawToken) {
        return { status: "invalid" };
    }

    const tokenHash = hashToken(rawToken);

    const result = await pool.query(
        `
        SELECT id, email_verification_expires_at
        FROM users
        WHERE email_verification_token_hash = $1
        `,
        [tokenHash]
    );

    if (result.rows.length === 0) {
        return { status: "invalid" };
    }

    const user = result.rows[0];

    if (!user.email_verification_expires_at || new Date(user.email_verification_expires_at) < new Date()) {
        return { status: "expired" };
    }

    await pool.query(
        `
        UPDATE users
        SET is_email_verified = true,
            email_verification_token_hash = NULL,
            email_verification_expires_at = NULL
        WHERE id = $1
        `,
        [user.id]
    );

    return { status: "verified" };
}

async function reissueToken(email) {
    const result = await pool.query(
        `
        SELECT id, username, email, is_email_verified
        FROM users
        WHERE email = $1
        `,
        [email]
    );

    if (result.rows.length === 0) {
        return;
    }

    const user = result.rows[0];

    if (user.is_email_verified) {
        return;
    }

    const { rawToken, tokenHash, expiresAt } = generateVerificationToken();

    await pool.query(
        `
        UPDATE users
        SET email_verification_token_hash = $1,
            email_verification_expires_at = $2
        WHERE id = $3
        `,
        [tokenHash, expiresAt, user.id]
    );

    await sendVerificationEmail(user, rawToken);
}

module.exports = {
    generateVerificationToken,
    sendVerificationEmail,
    consumeVerificationToken,
    reissueToken
};
