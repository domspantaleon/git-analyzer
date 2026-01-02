const express = require('express');
const router = express.Router();
const db = require('../db');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

// GET /api/export/summary/csv - Export summary as CSV
router.get('/summary/csv', (req, res) => {
    try {
        const { from, to, type = 'developer' } = req.query;

        let data;
        let fields;

        if (type === 'developer') {
            let dateFilter = '';
            const params = [];

            if (from && to) {
                dateFilter = 'AND c.committed_at BETWEEN ? AND ?';
                params.push(from, to + ' 23:59:59');
            }

            data = db.all(`
                SELECT 
                    d.canonical_name as "Developer",
                    COUNT(*) as "Commits",
                    SUM(c.lines_added) as "Lines Added",
                    SUM(c.lines_removed) as "Lines Removed",
                    SUM(c.lines_net) as "Net Lines",
                    SUM(c.files_changed) as "Files Changed",
                    COUNT(DISTINCT c.repository_id) as "Repositories"
                FROM commits c
                JOIN developers d ON c.developer_id = d.id
                WHERE d.is_active = 1 ${dateFilter}
                GROUP BY d.id
                ORDER BY "Commits" DESC
            `, params);

            fields = ['Developer', 'Commits', 'Lines Added', 'Lines Removed', 'Net Lines', 'Files Changed', 'Repositories'];
        } else {
            let dateFilter = '';
            const params = [];

            if (from && to) {
                dateFilter = 'AND c.committed_at BETWEEN ? AND ?';
                params.push(from, to + ' 23:59:59');
            }

            data = db.all(`
                SELECT 
                    r.full_name as "Repository",
                    COUNT(*) as "Commits",
                    SUM(c.lines_added) as "Lines Added",
                    SUM(c.lines_removed) as "Lines Removed",
                    SUM(c.lines_net) as "Net Lines",
                    COUNT(DISTINCT c.developer_id) as "Contributors"
                FROM commits c
                JOIN repositories r ON c.repository_id = r.id
                WHERE 1=1 ${dateFilter}
                GROUP BY r.id
                ORDER BY "Commits" DESC
            `, params);

            fields = ['Repository', 'Commits', 'Lines Added', 'Lines Removed', 'Net Lines', 'Contributors'];
        }

        const parser = new Parser({ fields });
        const csv = parser.parse(data);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=git-analyzer-${type}-${from || 'all'}-${to || 'all'}.csv`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/export/summary/pdf - Export summary as PDF
router.get('/summary/pdf', (req, res) => {
    try {
        const { from, to, type = 'developer' } = req.query;

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=git-analyzer-${type}-${from || 'all'}-${to || 'all'}.pdf`);

        doc.pipe(res);

        // Title
        doc.fontSize(20).font('Helvetica-Bold').text('Git Analyzer Report', { align: 'center' });
        doc.moveDown();

        // Date range
        doc.fontSize(12).font('Helvetica')
            .text(`Report Type: By ${type === 'developer' ? 'Developer' : 'Repository'}`, { align: 'center' })
            .text(`Date Range: ${from || 'All time'} to ${to || 'present'}`, { align: 'center' });
        doc.moveDown(2);

        // Get data
        let dateFilter = '';
        const params = [];

        if (from && to) {
            dateFilter = 'AND c.committed_at BETWEEN ? AND ?';
            params.push(from, to + ' 23:59:59');
        }

        // Summary stats
        const summary = db.get(`
            SELECT 
                COUNT(*) as total_commits,
                COUNT(DISTINCT c.developer_id) as total_developers,
                COUNT(DISTINCT c.repository_id) as total_repositories,
                SUM(c.lines_added) as total_lines_added,
                SUM(c.lines_removed) as total_lines_removed
            FROM commits c
            WHERE 1=1 ${dateFilter}
        `, params);

        doc.fontSize(14).font('Helvetica-Bold').text('Summary');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');
        doc.text(`Total Commits: ${summary.total_commits || 0}`);
        doc.text(`Total Developers: ${summary.total_developers || 0}`);
        doc.text(`Total Repositories: ${summary.total_repositories || 0}`);
        doc.text(`Lines Added: ${(summary.total_lines_added || 0).toLocaleString()}`);
        doc.text(`Lines Removed: ${(summary.total_lines_removed || 0).toLocaleString()}`);
        doc.moveDown(2);

        // Detailed breakdown
        doc.fontSize(14).font('Helvetica-Bold').text(`Breakdown by ${type === 'developer' ? 'Developer' : 'Repository'}`);
        doc.moveDown(0.5);

        if (type === 'developer') {
            const devStats = db.all(`
                SELECT 
                    d.canonical_name,
                    COUNT(*) as commit_count,
                    SUM(c.lines_added) as lines_added,
                    SUM(c.lines_removed) as lines_removed
                FROM commits c
                JOIN developers d ON c.developer_id = d.id
                WHERE d.is_active = 1 ${dateFilter}
                GROUP BY d.id
                ORDER BY commit_count DESC
                LIMIT 20
            `, params);

            // Table header
            const startX = 50;
            let y = doc.y;
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Developer', startX, y, { width: 200 });
            doc.text('Commits', startX + 200, y, { width: 60, align: 'right' });
            doc.text('Lines+', startX + 270, y, { width: 60, align: 'right' });
            doc.text('Lines-', startX + 340, y, { width: 60, align: 'right' });
            doc.moveDown(0.5);

            // Table rows
            doc.font('Helvetica').fontSize(9);
            for (const dev of devStats) {
                y = doc.y;
                doc.text(dev.canonical_name?.substring(0, 30) || 'Unknown', startX, y, { width: 200 });
                doc.text(String(dev.commit_count || 0), startX + 200, y, { width: 60, align: 'right' });
                doc.text(String(dev.lines_added || 0), startX + 270, y, { width: 60, align: 'right' });
                doc.text(String(dev.lines_removed || 0), startX + 340, y, { width: 60, align: 'right' });
                doc.moveDown(0.3);
            }
        } else {
            const repoStats = db.all(`
                SELECT 
                    r.full_name,
                    COUNT(*) as commit_count,
                    SUM(c.lines_added) as lines_added,
                    SUM(c.lines_removed) as lines_removed
                FROM commits c
                JOIN repositories r ON c.repository_id = r.id
                WHERE 1=1 ${dateFilter}
                GROUP BY r.id
                ORDER BY commit_count DESC
                LIMIT 20
            `, params);

            const startX = 50;
            let y = doc.y;
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Repository', startX, y, { width: 200 });
            doc.text('Commits', startX + 200, y, { width: 60, align: 'right' });
            doc.text('Lines+', startX + 270, y, { width: 60, align: 'right' });
            doc.text('Lines-', startX + 340, y, { width: 60, align: 'right' });
            doc.moveDown(0.5);

            doc.font('Helvetica').fontSize(9);
            for (const repo of repoStats) {
                y = doc.y;
                doc.text(repo.full_name?.substring(0, 30) || 'Unknown', startX, y, { width: 200 });
                doc.text(String(repo.commit_count || 0), startX + 200, y, { width: 60, align: 'right' });
                doc.text(String(repo.lines_added || 0), startX + 270, y, { width: 60, align: 'right' });
                doc.text(String(repo.lines_removed || 0), startX + 340, y, { width: 60, align: 'right' });
                doc.moveDown(0.3);
            }
        }

        // Footer
        doc.moveDown(2);
        doc.fontSize(8).font('Helvetica').fillColor('gray')
            .text(`Generated by Git Analyzer on ${new Date().toISOString()}`, { align: 'center' });

        doc.end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
