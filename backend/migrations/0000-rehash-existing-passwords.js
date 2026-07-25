/**
 * One-time maintenance script: hashes any `users.password` rows that are
 * still stored in plaintext (from before bcrypt hashing was introduced in
 * routes/auth.js). Safe to run multiple times — already-hashed rows are
 * left untouched, and existing passwords keep working after the migration
 * since the hash is derived from the same plaintext value.
 *
 * Usage: node backend/migrations/0000-rehash-existing-passwords.js
 */

require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("../db");

const SALT_ROUNDS = 10;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

async function rehashExistingPasswords() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL is not configured. Aborting.");
        process.exitCode = 1;
        return;
    }

    const { rows: users } = await pool.query(
        "SELECT id, password FROM users"
    );

    const plaintextUsers = users.filter(
        (user) => !BCRYPT_HASH_PATTERN.test(user.password)
    );

    for (const user of plaintextUsers) {
        const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

        await pool.query(
            "UPDATE users SET password = $1 WHERE id = $2",
            [passwordHash, user.id]
        );
    }

    console.log(
        `Rehashed ${plaintextUsers.length} of ${users.length} user password(s).`
    );
}

rehashExistingPasswords()
    .catch((err) => {
        console.error("Password rehash failed:", err);
        process.exitCode = 1;
    })
    .finally(() => {
        pool.end();
    });
