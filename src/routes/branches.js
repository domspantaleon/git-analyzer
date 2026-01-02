const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncBranches } = require('../services/sync');

// GET /api/repositories/:id/branches - List branches for repo
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;

        const branches = db.all(`
            SELECT b.*, 
                   (SELECT COUNT(*) FROM commits WHERE branch_id = b.id) as commit_count
            FROM branches b
            WHERE b.repository_id = ?
            ORDER BY b.name
        `, [id]);

        res.json(branches);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/branches/sync - Sync branches for selected repos
router.post('/sync', async (req, res) => {
    try {
        const result = await syncBranches();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
