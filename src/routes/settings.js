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

        res.json({ success: true, settings: db.getAllSettings() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
