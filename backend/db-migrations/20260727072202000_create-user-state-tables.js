// Per-user server-side storage for the watchlist and Learn-module progress,
// so both survive a localStorage clear / new device for logged-in users.
// jsonb keeps this schema-flexible since the shapes (a ticker list, and the
// Learn module's { xp, streak, completed, cash, holdings, ... } blob) are
// owned and validated by the frontend/route layer, not the database.
exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS user_watchlists (
            user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            tickers jsonb NOT NULL DEFAULT '[]',
            updated_at timestamptz NOT NULL DEFAULT now()
        );
    `);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS user_learning_progress (
            user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            progress jsonb NOT NULL DEFAULT '{}',
            updated_at timestamptz NOT NULL DEFAULT now()
        );
    `);
};

exports.down = (pgm) => {
    pgm.sql("DROP TABLE IF EXISTS user_watchlists;");
    pgm.sql("DROP TABLE IF EXISTS user_learning_progress;");
};
