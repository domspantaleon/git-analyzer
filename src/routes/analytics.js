const express = require('express');
const router = express.Router();
const db = require('../db');
const { getTimeEstimate } = require('../services/time-estimation');

// GET /api/analytics/summary - Overall summary
router.get('/summary', (req, res) => {
    try {
        const { from, to } = req.query;

        let dateFilter = '';
        const params = [];

        if (from && to) {
            dateFilter = 'AND commits.committed_at BETWEEN ? AND ?';
            params.push(from, to + ' 23:59:59');
        }

        const summary = db.get(`
            SELECT 
                COUNT(*) as total_commits,
                COUNT(DISTINCT commits.developer_id) as total_developers,
                COUNT(DISTINCT commits.repository_id) as total_repositories,
                SUM(commits.lines_added) as total_lines_added,
                SUM(commits.lines_removed) as total_lines_removed,
                SUM(commits.lines_net) as total_lines_net,
                SUM(commits.files_changed) as total_files_changed
            FROM commits
            WHERE 1=1 ${dateFilter}
        `, params);

        // Get flag counts
        const flagCounts = db.all(`
            SELECT cf.flag_type, COUNT(*) as count
            FROM commit_flags cf
            JOIN commits ON cf.commit_id = commits.id
            WHERE 1=1 ${dateFilter}
            GROUP BY cf.flag_type
        `, params);

        summary.flags = {};
        for (const flag of flagCounts) {
            summary.flags[flag.flag_type] = flag.count;
        }

        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/by-developer - Stats grouped by developer
router.get('/by-developer', (req, res) => {
    try {
        const { from, to } = req.query;

        let dateFilter = '';
        const params = [];

        if (from && to) {
            dateFilter = 'AND commits.committed_at BETWEEN ? AND ?';
            params.push(from, to + ' 23:59:59');
        }

        const stats = db.all(`
            SELECT 
                d.id,
                d.canonical_name,
                COUNT(*) as commit_count,
                SUM(commits.lines_added) as lines_added,
                SUM(commits.lines_removed) as lines_removed,
                SUM(commits.lines_net) as lines_net,
                SUM(commits.files_changed) as files_changed,
                COUNT(DISTINCT commits.repository_id) as repos_touched,
                0 as flag_count
            FROM commits
            JOIN developers d ON commits.developer_id = d.id
            WHERE d.is_active = 1 ${dateFilter}
            GROUP BY d.id
            ORDER BY commit_count DESC
        `, params);

        // Calculate time estimates and flag counts for each developer
        for (const dev of stats) {
            const devDateFilter = from && to ? 'AND committed_at BETWEEN ? AND ?' : '';
            const commits = db.all(`
                SELECT * FROM commits 
                WHERE developer_id = ? ${devDateFilter}
            `, from && to ? [dev.id, from, to + ' 23:59:59'] : [dev.id]);

            const estimate = getTimeEstimate(commits);
            dev.estimated_hours = estimate.estimatedHours;

            // Get flag count
            const flagResult = db.get(`
                SELECT COUNT(*) as count FROM commit_flags cf
                JOIN commits ON cf.commit_id = commits.id
                WHERE commits.developer_id = ? ${devDateFilter}
            `, from && to ? [dev.id, from, to + ' 23:59:59'] : [dev.id]);
            dev.flag_count = flagResult?.count || 0;
        }

        res.json(stats);
    } catch (error) {
        console.error('by-developer error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/by-repository - Stats grouped by repo
router.get('/by-repository', (req, res) => {
    try {
        const { from, to } = req.query;

        let dateFilter = '';
        const params = [];

        if (from && to) {
            dateFilter = 'AND commits.committed_at BETWEEN ? AND ?';
            params.push(from, to + ' 23:59:59');
        }

        const stats = db.all(`
            SELECT 
                r.id,
                r.name,
                r.full_name,
                COUNT(*) as commit_count,
                SUM(commits.lines_added) as lines_added,
                SUM(commits.lines_removed) as lines_removed,
                SUM(commits.lines_net) as lines_net,
                COUNT(DISTINCT commits.developer_id) as contributors
            FROM commits
            JOIN repositories r ON commits.repository_id = r.id
            WHERE 1=1 ${dateFilter}
            GROUP BY r.id
            ORDER BY commit_count DESC
        `, params);

        // Get top contributor for each repo
        for (const repo of stats) {
            const topContrib = db.get(`
                SELECT d.canonical_name 
                FROM commits
                JOIN developers d ON commits.developer_id = d.id
                WHERE commits.repository_id = ? ${dateFilter}
                GROUP BY commits.developer_id
                ORDER BY COUNT(*) DESC
                LIMIT 1
            `, from && to ? [repo.id, from, to + ' 23:59:59'] : [repo.id]);
            repo.top_contributor = topContrib?.canonical_name || null;
        }

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/timeline - Daily/weekly commit trends
router.get('/timeline', (req, res) => {
    try {
        const { from, to, granularity = 'day' } = req.query;

        let dateFormat = '%Y-%m-%d';
        if (granularity === 'week') {
            dateFormat = '%Y-W%W';
        }

        let dateFilter = '';
        const params = [];

        if (from && to) {
            dateFilter = 'AND commits.committed_at BETWEEN ? AND ?';
            params.push(from, to + ' 23:59:59');
        }

        const timeline = db.all(`
            SELECT 
                strftime('${dateFormat}', commits.committed_at) as period,
                COUNT(*) as commit_count,
                SUM(commits.lines_added) as lines_added,
                SUM(commits.lines_removed) as lines_removed,
                COUNT(DISTINCT commits.developer_id) as active_developers
            FROM commits
            WHERE 1=1 ${dateFilter}
            GROUP BY period
            ORDER BY period
        `, params);

        res.json(timeline);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/flags - Flag distribution
router.get('/flags', (req, res) => {
    try {
        const { from, to } = req.query;

        let dateFilter = '';
        const params = [];

        if (from && to) {
            dateFilter = 'AND commits.committed_at BETWEEN ? AND ?';
            params.push(from, to + ' 23:59:59');
        }

        // Flag distribution
        const distribution = db.all(`
            SELECT cf.flag_type, COUNT(*) as count
            FROM commit_flags cf
            JOIN commits ON cf.commit_id = commits.id
            WHERE 1=1 ${dateFilter}
            GROUP BY cf.flag_type
            ORDER BY count DESC
        `, params);

        // Commits with most flags
        const topFlagged = db.all(`
            SELECT commits.*, 
                   r.full_name as repo_full_name,
                   d.canonical_name as developer_name,
                   COUNT(cf.id) as flag_count,
                   GROUP_CONCAT(cf.flag_type) as flags
            FROM commits
            JOIN commit_flags cf ON cf.commit_id = commits.id
            JOIN repositories r ON commits.repository_id = r.id
            LEFT JOIN developers d ON commits.developer_id = d.id
            WHERE 1=1 ${dateFilter}
            GROUP BY commits.id
            ORDER BY flag_count DESC
            LIMIT 20
        `, params);

        res.json({ distribution, topFlagged });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
