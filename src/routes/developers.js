const express = require('express');
const router = express.Router();
const db = require('../db');
const { mergeDevelopers, getDevelopersWithIdentities, updateCanonicalName } = require('../services/developer-grouping');

// GET /api/developers - List all developers
router.get('/', (req, res) => {
    try {
        const { active_only } = req.query;

        let sql = `
            SELECT d.*, 
                   (SELECT COUNT(*) FROM commits WHERE developer_id = d.id) as commit_count,
                   (SELECT SUM(lines_added) FROM commits WHERE developer_id = d.id) as total_lines_added,
                   (SELECT SUM(lines_removed) FROM commits WHERE developer_id = d.id) as total_lines_removed,
                   (SELECT GROUP_CONCAT(DISTINCT email) FROM developer_identities WHERE developer_id = d.id) as emails
            FROM developers d
            WHERE 1=1
        `;

        if (active_only === 'true') {
            sql += ' AND d.is_active = 1';
        }

        sql += ' ORDER BY commit_count DESC';

        const developers = db.all(sql);
        res.json(developers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/developers/:id - Update developer
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { canonical_name, is_active } = req.body;

        db.run(`
            UPDATE developers
            SET canonical_name = COALESCE(?, canonical_name),
                is_active = COALESCE(?, is_active)
            WHERE id = ?
        `, [canonical_name, is_active !== undefined ? (is_active ? 1 : 0) : null, id]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/developers/merge - Merge two developers
router.post('/merge', (req, res) => {
    try {
        const { source_id, target_id } = req.body;

        if (!source_id || !target_id) {
            return res.status(400).json({ error: 'source_id and target_id are required' });
        }

        if (source_id === target_id) {
            return res.status(400).json({ error: 'Cannot merge developer with self' });
        }

        mergeDevelopers(source_id, target_id);
        updateCanonicalName(target_id);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/developers/:id/identities - List identities for developer
router.get('/:id/identities', (req, res) => {
    try {
        const { id } = req.params;

        const identities = db.all(`
            SELECT * FROM developer_identities WHERE developer_id = ?
        `, [id]);

        res.json(identities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
