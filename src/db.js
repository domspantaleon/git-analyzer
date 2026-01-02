const Database = require('better-sqlite3');
const { DB_PATH } = require('../database/init');

let db = null;

function getDb() {
    if (!db) {
        console.log('Connecting to database at:', DB_PATH);
        db = new Database(DB_PATH);
        db.pragma('foreign_keys = ON');

        // Log table info for debugging
        try {
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            console.log('Available tables:', tables.map(t => t.name).join(', '));
        } catch (e) {
            console.log('Could not list tables:', e.message);
        }
    }
    return db;
}

// Reset database connection (useful after schema changes)
function resetDb() {
    if (db) {
        db.close();
        db = null;
    }
}

// Helper to run a query and return all results
function all(sql, params = []) {
    return getDb().prepare(sql).all(...params);
}

// Helper to run a query and return first result
function get(sql, params = []) {
    return getDb().prepare(sql).get(...params);
}

// Helper to run an insert/update/delete and return info
function run(sql, params = []) {
    return getDb().prepare(sql).run(...params);
}

// Transaction helper
function transaction(fn) {
    return getDb().transaction(fn)();
}

// Get setting by key
function getSetting(key) {
    const row = get('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : null;
}

// Set setting value
function setSetting(key, value) {
    run(`
        INSERT INTO settings (key, value, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `, [key, value, value]);
}

// Get all settings as object
function getAllSettings() {
    const rows = all('SELECT key, value FROM settings');
    const settings = {};
    for (const row of rows) {
        settings[row.key] = row.value;
    }
    return settings;
}

// Close database connection
function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = {
    getDb,
    all,
    get,
    run,
    transaction,
    getSetting,
    setSetting,
    getAllSettings,
    closeDb
};
