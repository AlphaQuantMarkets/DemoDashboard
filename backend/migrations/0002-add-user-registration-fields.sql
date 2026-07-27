-- New columns are nullable (except is_email_verified) so this ALTER TABLE
-- is safe to run against a database that already has rows.
--
-- is_email_verified defaults to TRUE, not FALSE: existing accounts were
-- created before email verification existed, have no email on file, and
-- must not be locked out of login by this migration. Only new signups
-- (via the application INSERT in backend/routes/auth.js) explicitly set
-- this to FALSE.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email text UNIQUE,
    ADD COLUMN IF NOT EXISTS phone_number text,
    ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    ADD COLUMN IF NOT EXISTS is_email_verified boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS email_verification_token_hash text,
    ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz;
