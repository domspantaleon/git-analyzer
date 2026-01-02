const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncCommits, getClientForPlatform } = require('../services/sync');
const { generateCommitSummary } = require('../services/ollama');

// GET /api/commits - List commits with filters
router.get('/', (req, res) => {
    try {
        const {
            from, to, developer_id, repository_id, branch_id,
            has_flag, page = 1, limit = 50
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        let sql = `
            SELECT c.*, 
                   r.name as repo_name, r.full_name as repo_full_name,
                   b.name as branch_name,
                   d.canonical_name as developer_name,
                   p.type as platform_type, p.url as platform_url,
                   (SELECT GROUP_CONCAT(flag_type) FROM commit_flags WHERE commit_id = c.id) as flags
            FROM commits c
            JOIN repositories r ON c.repository_id = r.id
            JOIN platforms p ON r.platform_id = p.id
            LEFT JOIN branches b ON c.branch_id = b.id
            LEFT JOIN developers d ON c.developer_id = d.id
            WHERE 1=1
        `;
        const params = [];

        if (from) {
            sql += ' AND c.committed_at >= ?';
            params.push(from);
        }

        if (to) {
            sql += ' AND c.committed_at <= ?';
            params.push(to + ' 23:59:59');
        }

        if (developer_id) {
            sql += ' AND c.developer_id = ?';
            params.push(developer_id);
        }

        if (repository_id) {
            sql += ' AND c.repository_id = ?';
            params.push(repository_id);
        }

        if (branch_id) {
            sql += ' AND c.branch_id = ?';
            params.push(branch_id);
        }

        if (has_flag) {
            sql += ' AND c.id IN (SELECT commit_id FROM commit_flags WHERE flag_type = ?)';
            params.push(has_flag);
        }

        // Count total
        const countSql = sql.replace(/SELECT c\.\*.*FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = db.get(countSql, params);

        sql += ' ORDER BY c.committed_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const commits = db.all(sql, params);

        res.json({
            data: commits,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult?.total || 0,
                pages: Math.ceil((countResult?.total || 0) / parseInt(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/commits/sync - Sync commits for selected repos
router.post('/sync', async (req, res) => {
    try {
        const { from, to, force = false } = req.body;

        if (!from || !to) {
            return res.status(400).json({ error: 'from and to dates are required' });
        }

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const result = await syncCommits(from, to, force, (progress) => {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
        });

        res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
        res.end();
    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        }
    }
});

// GET /api/commits/:id - Get commit details
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;

        const commit = db.get(`
            SELECT c.*, 
                   r.name as repo_name, r.full_name as repo_full_name,
                   b.name as branch_name,
                   d.canonical_name as developer_name
            FROM commits c
            JOIN repositories r ON c.repository_id = r.id
            LEFT JOIN branches b ON c.branch_id = b.id
            LEFT JOIN developers d ON c.developer_id = d.id
            WHERE c.id = ?
        `, [id]);

        if (!commit) {
            return res.status(404).json({ error: 'Commit not found' });
        }

        // Get files
        commit.files = db.all(`
            SELECT * FROM commit_files WHERE commit_id = ?
        `, [id]);

        // Get flags
        commit.flags = db.all(`
            SELECT flag_type, details FROM commit_flags WHERE commit_id = ?
        `, [id]);

        res.json(commit);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/commits/:id/diff - Get commit diff (fetched on-demand)
router.get('/:id/diff', async (req, res) => {
    try {
        const { id } = req.params;

        const commit = db.get(`
            SELECT c.sha, r.full_name, r.platform_id,
                   p.type, p.url, p.token, p.username
            FROM commits c
            JOIN repositories r ON c.repository_id = r.id
            JOIN platforms p ON r.platform_id = p.id
            WHERE c.id = ?
        `, [id]);

        if (!commit) {
            return res.status(404).json({ error: 'Commit not found' });
        }

        const client = getClientForPlatform(commit);
        const diff = await client.getCommitDiff(commit.full_name, commit.sha);

        res.json({ diff });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/commits/:id/ai-summary - Get AI summary
router.get('/:id/ai-summary', async (req, res) => {
    try {
        const { id } = req.params;

        const commit = db.get(`
            SELECT c.sha, c.message, r.full_name, r.platform_id,
                   p.type, p.url, p.token, p.username
            FROM commits c
            JOIN repositories r ON c.repository_id = r.id
            JOIN platforms p ON r.platform_id = p.id
            WHERE c.id = ?
        `, [id]);

        if (!commit) {
            return res.status(404).json({ error: 'Commit not found' });
        }

        // Fetch diff
        const client = getClientForPlatform(commit);
        const diff = await client.getCommitDiff(commit.full_name, commit.sha);

        // Generate summary
        const result = await generateCommitSummary(commit.message, diff);
        res.json(result);
    } catch (error) {
        // Return 500 but with JSON error message for frontend to display
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
