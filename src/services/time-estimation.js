const db = require('../db');

/**
 * Time estimation service
 * Provides multiple estimation methods since actual time can't be known
 */

// Constants for estimation
const LINES_PER_HOUR = 30;  // Industry average for production code
const SESSION_GAP_HOURS = 2;  // Gap that indicates a new session
const MAX_GAP_HOURS = 2;  // Maximum time to count for a single gap

/**
 * Session-based estimate
 * Groups commits by developer within 2-hour windows
 */
function estimateBySession(commits) {
    if (!commits || commits.length === 0) return { hours: 0, sessions: 0 };

    // Group commits by developer
    const byDeveloper = new Map();
    for (const commit of commits) {
        const devId = commit.developer_id || commit.author_email;
        if (!byDeveloper.has(devId)) {
            byDeveloper.set(devId, []);
        }
        byDeveloper.get(devId).push(commit);
    }

    let totalSessions = 0;

    for (const [devId, devCommits] of byDeveloper) {
        // Sort by date
        devCommits.sort((a, b) => new Date(a.committed_at) - new Date(b.committed_at));

        let sessions = 1;
        for (let i = 1; i < devCommits.length; i++) {
            const prev = new Date(devCommits[i - 1].committed_at);
            const curr = new Date(devCommits[i].committed_at);
            const gapHours = (curr - prev) / (1000 * 60 * 60);

            if (gapHours > SESSION_GAP_HOURS) {
                sessions++;
            }
        }

        totalSessions += sessions;
    }

    // Assume average session is 2 hours
    return {
        hours: totalSessions * 2,
        sessions: totalSessions
    };
}

/**
 * Commit gap analysis
 * Time between consecutive commits, capped at 2 hours
 */
function estimateByGaps(commits) {
    if (!commits || commits.length < 2) return { hours: 0, gaps: [] };

    // Group by developer
    const byDeveloper = new Map();
    for (const commit of commits) {
        const devId = commit.developer_id || commit.author_email;
        if (!byDeveloper.has(devId)) {
            byDeveloper.set(devId, []);
        }
        byDeveloper.get(devId).push(commit);
    }

    let totalHours = 0;
    const gaps = [];

    for (const [devId, devCommits] of byDeveloper) {
        devCommits.sort((a, b) => new Date(a.committed_at) - new Date(b.committed_at));

        for (let i = 1; i < devCommits.length; i++) {
            const prev = new Date(devCommits[i - 1].committed_at);
            const curr = new Date(devCommits[i].committed_at);
            const gapHours = (curr - prev) / (1000 * 60 * 60);

            const cappedGap = Math.min(gapHours, MAX_GAP_HOURS);
            totalHours += cappedGap;

            gaps.push({
                developerId: devId,
                from: prev,
                to: curr,
                hours: cappedGap,
                wasExceeded: gapHours > MAX_GAP_HOURS
            });
        }
    }

    return { hours: totalHours, gaps };
}

/**
 * Lines-based estimate
 * Rough estimate using industry average of ~30 lines per hour
 */
function estimateByLines(commits, adjustForFileTypes = true) {
    if (!commits || commits.length === 0) return { hours: 0, breakdown: {} };

    let totalLines = 0;
    const breakdown = {
        code: 0,
        tests: 0,
        config: 0
    };

    for (const commit of commits) {
        const linesAdded = commit.lines_added || 0;
        const linesRemoved = commit.lines_removed || 0;
        const netLines = Math.abs(linesAdded - linesRemoved);

        // If we have file details, categorize
        if (commit.files) {
            for (const file of commit.files) {
                if (file.is_excluded) continue;

                const lines = (file.lines_added || 0) + (file.lines_removed || 0);

                if (isTestFile(file.filename)) {
                    breakdown.tests += lines;
                } else if (isConfigFile(file.filename)) {
                    breakdown.config += lines;
                } else {
                    breakdown.code += lines;
                }
            }
        } else {
            breakdown.code += netLines;
        }

        totalLines += linesAdded + linesRemoved;
    }

    // Adjust rates by file type
    const hours = adjustForFileTypes
        ? (breakdown.code / LINES_PER_HOUR) +
        (breakdown.tests / (LINES_PER_HOUR * 1.5)) +  // Tests are faster
        (breakdown.config / (LINES_PER_HOUR * 3))     // Config is much faster
        : totalLines / LINES_PER_HOUR;

    return {
        hours: Math.round(hours * 10) / 10,
        totalLines,
        breakdown
    };
}

/**
 * Complexity score based on multiple factors
 */
function calculateComplexityScore(commits) {
    if (!commits || commits.length === 0) return { score: 0, factors: {} };

    const factors = {
        fileCount: 0,
        codeComplexity: 0,
        contextSwitching: 0
    };

    let totalFiles = 0;
    let uniqueFileTypes = new Set();
    let complexityIndicators = 0;

    for (const commit of commits) {
        totalFiles += commit.files_changed || 0;

        if (commit.files) {
            for (const file of commit.files) {
                const ext = file.filename.split('.').pop()?.toLowerCase();
                if (ext) uniqueFileTypes.add(ext);
            }
        }

        // Count complexity indicators in diff (if available)
        if (commit.diff) {
            const indicators = [
                /if\s*\(/g,
                /else\s*{/g,
                /for\s*\(/g,
                /while\s*\(/g,
                /switch\s*\(/g,
                /try\s*{/g,
                /catch\s*\(/g,
                /\?\s*.*\s*:/g  // Ternary
            ];

            for (const pattern of indicators) {
                complexityIndicators += (commit.diff.match(pattern) || []).length;
            }
        }
    }

    // Score file count (more files = more context switching)
    factors.fileCount = Math.min(totalFiles / 10, 10);

    // Score context switching (different file types)
    factors.contextSwitching = Math.min(uniqueFileTypes.size * 2, 10);

    // Score code complexity
    factors.codeComplexity = Math.min(complexityIndicators / 20, 10);

    const score = (factors.fileCount + factors.contextSwitching + factors.codeComplexity) / 3;

    return {
        score: Math.round(score * 10) / 10,
        factors
    };
}

/**
 * Get combined time estimate using all methods
 */
function getTimeEstimate(commits) {
    const session = estimateBySession(commits);
    const gaps = estimateByGaps(commits);
    const lines = estimateByLines(commits);
    const complexity = calculateComplexityScore(commits);

    // Weighted average - session-based is usually most accurate
    const weightedHours = (session.hours * 0.4) + (gaps.hours * 0.3) + (lines.hours * 0.3);

    return {
        estimatedHours: Math.round(weightedHours * 10) / 10,
        methods: {
            session,
            gaps: { hours: gaps.hours },
            lines,
            complexity
        }
    };
}

// Helper functions
function isTestFile(filename) {
    const testPatterns = [
        /test/i,
        /spec/i,
        /_test\./,
        /_spec\./,
        /\.test\./,
        /\.spec\./
    ];
    return testPatterns.some(p => p.test(filename));
}

function isConfigFile(filename) {
    const configExtensions = ['.json', '.xml', '.config', '.yml', '.yaml', '.env', '.ini', '.toml'];
    return configExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

module.exports = {
    estimateBySession,
    estimateByGaps,
    estimateByLines,
    calculateComplexityScore,
    getTimeEstimate,
    LINES_PER_HOUR,
    SESSION_GAP_HOURS,
    MAX_GAP_HOURS
};
