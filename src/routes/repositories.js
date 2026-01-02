const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncRepositories } = require('../services/sync');

// GET /api/repositories - List all repos with filters
router.get('/', (req, res) => {
    try {
        const { platform_id, is_selected, search } = req.query;

        let sql = `
            SELECT r.*, p.name as platform_name, p.type as platform_type,
                   (SELECT COUNT(*) FROM branches WHERE repository_id = r.id) as branch_count,
                   (SELECT COUNT(*) FROM commits WHERE repository_id = r.id) as commit_count
            FROM repositories r
            JOIN platforms p ON r.platform_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (platform_id) {
            sql += ' AND r.platform_id = ?';
            params.push(platform_id);
        }

        if (is_selected !== undefined) {
            sql += ' AND r.is_selected = ?';
            params.push(is_selected === 'true' ? 1 : 0);
        }

        if (search) {
            sql += ' AND (r.name LIKE ? OR r.full_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY r.full_name';

        const repos = db.all(sql, params);
        res.json(repos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/repositories/sync - Sync repos from all platforms
router.post('/sync', async (req, res) => {
    try {
        const result = await syncRepositories();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/repositories/:id/select - Toggle repo selection
router.put('/:id/select', (req, res) => {
    try {
        const { id } = req.params;
        const { selected } = req.body;

        db.run(`
            UPDATE repositories SET is_selected = ? WHERE id = ?
        `, [selected ? 1 : 0, id]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/repositories/select-all - Select/deselect all
router.put('/select-all', (req, res) => {
    try {
        const { selected, platform_id } = req.body;

        let sql = 'UPDATE repositories SET is_selected = ?';
        const params = [selected ? 1 : 0];

        if (platform_id) {
            sql += ' WHERE platform_id = ?';
            params.push(platform_id);
        }

        db.run(sql, params);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
