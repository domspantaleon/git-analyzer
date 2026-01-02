const express = require('express');
const router = express.Router();
const db = require('../db');
const { getClientForPlatform } = require('../services/sync');

// GET /api/platforms - List all platforms
router.get('/', (req, res) => {
    try {
        const platforms = db.all(`
            SELECT id, type, name, url, username, created_at, updated_at,
                   (SELECT COUNT(*) FROM repositories WHERE platform_id = platforms.id) as repo_count
            FROM platforms
            ORDER BY name
        `);

        // Don't send tokens to frontend
        res.json(platforms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/platforms - Add new platform
router.post('/', (req, res) => {
    try {
        const { type, name, url, token, username } = req.body;

        if (!type || !name || !url || !token) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (type !== 'azure_devops') {
            return res.status(400).json({ error: 'Only Azure DevOps is supported' });
        }

        const result = db.run(`
            INSERT INTO platforms (type, name, url, token, username)
            VALUES (?, ?, ?, ?, ?)
        `, [type, name, url, token, username || null]);

        res.json({
            success: true,
            id: result.lastInsertRowid
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/platforms/:id - Update platform
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { type, name, url, token, username } = req.body;

        const platform = db.get('SELECT * FROM platforms WHERE id = ?', [id]);
        if (!platform) {
            return res.status(404).json({ error: 'Platform not found' });
        }

        db.run(`
            UPDATE platforms 
            SET type = COALESCE(?, type),
                name = COALESCE(?, name),
                url = COALESCE(?, url),
                token = COALESCE(?, token),
                username = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [type, name, url, token, username !== undefined ? username : platform.username, id]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/platforms/:id - Remove platform
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        // Delete cascade will handle related records
        db.run('DELETE FROM platforms WHERE id = ?', [id]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/platforms/:id/test - Test connection
router.post('/:id/test', async (req, res) => {
    try {
        const { id } = req.params;

        const platform = db.get('SELECT * FROM platforms WHERE id = ?', [id]);
        if (!platform) {
            return res.status(404).json({ error: 'Platform not found' });
        }

        const client = getClientForPlatform(platform);
        const result = await client.testConnection();

        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
