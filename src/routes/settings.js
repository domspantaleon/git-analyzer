const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/settings - Get all settings
router.get('/', (req, res) => {
    try {
        const settings = db.getAllSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/settings - Update settings
router.put('/', (req, res) => {
    try {
        const settings = req.body;

        for (const [key, value] of Object.entries(settings)) {
            db.setSetting(key, String(value));
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/settings/test-ollama - Test Ollama connection
router.post('/test-ollama', async (req, res) => {
    try {
        const { testConnection } = require('../services/ollama');
        const result = await testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to test connection'
        });
    }
});

// POST /api/settings/clear-data - Clear all data locally matches user request
router.post('/clear-data', (req, res) => {
    try {
        db.transaction(() => {
            // Delete data in specific order to respect foreign keys (though ON DELETE CASCADE handles most)
            // But let's be explicit
            db.run("DELETE FROM sync_log");
            db.run("DELETE FROM commit_flags");
            db.run("DELETE FROM commit_files");
            db.run("DELETE FROM commits");
            db.run("DELETE FROM developer_identities");
            db.run("DELETE FROM developers");
            db.run("DELETE FROM branches");
            db.run("DELETE FROM repositories");
            // Do NOT delete platforms or settings

            // Reset AUTOINCREMENT counters for clean IDs?
            // Optional, but good for "reset" feel.
            db.run("DELETE FROM sqlite_sequence WHERE name IN ('repositories', 'branches', 'developers', 'developer_identities', 'commits', 'commit_files', 'commit_flags', 'sync_log')");
        });

        res.json({ success: true, message: 'All data cleared successfully' });
    } catch (error) {
        console.error('Clear data error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
