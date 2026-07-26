// Consolidated, idempotent schema for the `users` table — this is the single
// source of truth for standing up a fresh database. Written with IF NOT
// EXISTS/ADD COLUMN IF NOT EXISTS so it's also safe to run against a database
// that already has some or all of these columns from the older, hand-run
// scripts in backend/migrations/ (0001-add-users-is-premium.sql,
// 0002-add-user-registration-fields.sql) — it converges to the same shape
// either way and node-pg-migrate then tracks it as applied going forward.
//
// is_email_verified defaults to TRUE, not FALSE: this mirrors
// 0002-add-user-registration-fields.sql's own reasoning (see that file) so a
// fresh database and a retrofitted older database end up with identical
// column defaults. New signups (backend/routes/auth.js) explicitly set this
// to FALSE at insert time regardless of the column default.
exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS users (
            id serial PRIMARY KEY,
            username text UNIQUE NOT NULL,
            password text NOT NULL,
            is_premium boolean NOT NULL DEFAULT false,
            email text UNIQUE,
            phone_number text,
            gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
            is_email_verified boolean NOT NULL DEFAULT true,
            email_verification_token_hash text,
            email_verification_expires_at timestamptz
        );
    `);
};

exports.down = (pgm) => {
    pgm.sql("DROP TABLE IF EXISTS users;");
};
