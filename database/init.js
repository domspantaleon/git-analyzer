const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'git-analyzer.db');

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        try {
            // Ensure database directory exists
            const dbDir = path.dirname(DB_PATH);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            const db = new Database(DB_PATH);

            // Enable foreign keys
            db.pragma('foreign_keys = ON');

            // Create tables
            db.exec(`
                -- Platform configurations
                CREATE TABLE IF NOT EXISTS platforms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    url TEXT NOT NULL,
                    token TEXT NOT NULL,
                    username TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- Repositories
                CREATE TABLE IF NOT EXISTS repositories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    platform_id INTEGER NOT NULL,
                    external_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    default_branch TEXT,
                    is_selected BOOLEAN DEFAULT 0,
                    last_synced_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE,
                    UNIQUE(platform_id, external_id)
                );

                -- Branches
                CREATE TABLE IF NOT EXISTS branches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    repository_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    last_commit_sha TEXT,
                    last_synced_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
                    UNIQUE(repository_id, name)
                );

                -- Developers
                CREATE TABLE IF NOT EXISTS developers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    canonical_name TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- Developer identities
                CREATE TABLE IF NOT EXISTS developer_identities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    developer_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    FOREIGN KEY (developer_id) REFERENCES developers(id) ON DELETE CASCADE,
                    UNIQUE(email)
                );

                -- Commits
                CREATE TABLE IF NOT EXISTS commits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    repository_id INTEGER NOT NULL,
                    branch_id INTEGER NOT NULL,
                    developer_id INTEGER,
                    sha TEXT NOT NULL,
                    message TEXT,
                    author_name TEXT,
                    author_email TEXT,
                    committed_at DATETIME NOT NULL,
                    lines_added INTEGER DEFAULT 0,
                    lines_removed INTEGER DEFAULT 0,
                    lines_net INTEGER DEFAULT 0,
                    files_changed INTEGER DEFAULT 0,
                    is_merge_commit BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
                    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
                    FOREIGN KEY (developer_id) REFERENCES developers(id) ON DELETE SET NULL,
                    UNIQUE(repository_id, sha)
                );

                -- Commit file details
                CREATE TABLE IF NOT EXISTS commit_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    commit_id INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    status TEXT,
                    lines_added INTEGER DEFAULT 0,
                    lines_removed INTEGER DEFAULT 0,
                    is_excluded BOOLEAN DEFAULT 0,
                    FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE
                );

                -- Commit flags
                CREATE TABLE IF NOT EXISTS commit_flags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    commit_id INTEGER NOT NULL,
                    flag_type TEXT NOT NULL,
                    details TEXT,
                    FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE
                );

                -- Sync log
                CREATE TABLE IF NOT EXISTS sync_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    repository_id INTEGER NOT NULL,
                    branch_id INTEGER,
                    sync_type TEXT NOT NULL,
                    from_date DATETIME,
                    to_date DATETIME,
                    last_sha TEXT,
                    status TEXT,
                    error_message TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
                );

                -- Settings
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- Create indexes for better query performance
                CREATE INDEX IF NOT EXISTS idx_commits_repository ON commits(repository_id);
                CREATE INDEX IF NOT EXISTS idx_commits_branch ON commits(branch_id);
                CREATE INDEX IF NOT EXISTS idx_commits_developer ON commits(developer_id);
                CREATE INDEX IF NOT EXISTS idx_commits_date ON commits(committed_at);
                CREATE INDEX IF NOT EXISTS idx_commit_files_commit ON commit_files(commit_id);
                CREATE INDEX IF NOT EXISTS idx_commit_flags_commit ON commit_flags(commit_id);
                CREATE INDEX IF NOT EXISTS idx_repositories_platform ON repositories(platform_id);
                CREATE INDEX IF NOT EXISTS idx_branches_repository ON branches(repository_id);
            `);

            // Insert default settings if they don't exist
            const insertSetting = db.prepare(`
                INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
            `);

            const defaultSettings = [
                ['ollama_endpoint', 'http://localhost:11434'],
                ['ollama_model', 'llama3'],
                ['default_date_range_days', '7'],
                ['timezone', 'Asia/Manila'],
                ['port', '3000']
            ];

            for (const [key, value] of defaultSettings) {
                insertSetting.run(key, value);
            }

            db.close();
            console.log('Database initialized successfully');
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { initializeDatabase, DB_PATH };
