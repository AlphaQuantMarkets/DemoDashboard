const nodemailer = require("nodemailer");

function isSmtpConfigured() {
    return Boolean(process.env.SMTP_HOST);
}

function createTransport() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
            : undefined
    });
}

async function sendEmail({ to, subject, html, text }) {
    if (!isSmtpConfigured()) {
        console.log("===== Email (console fallback — SMTP_HOST not configured) =====");
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(text || html);
        console.log("=================================================================");
        return;
    }

    const transport = createTransport();

    await transport.sendMail({
        from: process.env.EMAIL_FROM || "no-reply@alphaquant.local",
        to,
        subject,
        html,
        text
    });
}

module.exports = {
    sendEmail
};
