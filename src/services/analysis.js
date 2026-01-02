const { isFileExcluded, isConfigFile } = require('../utils/file-exclusions');
const { parseDiff, isCommentOnlyChange, detectCopyPaste } = require('../utils/diff-parser');
const db = require('../db');

// Vague commit message patterns
const VAGUE_PATTERNS = [
    /^fix$/i,
    /^update$/i,
    /^changes?$/i,
    /^wip$/i,
    /^test$/i,
    /^asdf$/i,
    /^misc$/i,
    /^stuff$/i,
    /^done$/i,
    /^commit$/i,
    /^save$/i,
    /^\.+$/,
    /^-+$/,
    /^\w$/  // Single character
];

// AI-generated code patterns
const AI_PATTERNS = {
    verboseComments: /\/\/\s*(This|Here|The following|We|First|Next|Finally|Note:|TODO:)/gi,
    explanatoryComments: /\/\/\s*\w+\s+(is|are|will|should|must|can)\s+/gi,
    genericNames: /\b(data|result|response|value|item|element|temp|tmp)\d*\b/gi,
    consistentSpacing: true, // Check for unusual consistency
    boilerplatePatterns: /(\/\*\*[\s\S]*?\*\/\s*)?(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?\w+\s+\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g
};

/**
 * Analyze a commit and generate flags
 * @param {Object} commit - Commit object with details
 * @param {string} diffContent - Raw diff content (optional)
 * @returns {Array} - Array of flag objects
 */
function analyzeCommit(commit, diffContent = null) {
    const flags = [];

    // 1. Small commit with vague message
    const totalLines = (commit.linesAdded || 0) + (commit.linesRemoved || 0);
    const message = commit.message || '';
    const firstLine = message.split('\n')[0].trim();

    if (totalLines < 10 && isVagueMessage(firstLine)) {
        flags.push({
            type: 'small_vague_commit',
            details: JSON.stringify({
                linesChanged: totalLines,
                messageLength: firstLine.length,
                message: firstLine
            })
        });
    }

    // 2. Large commit
    if (totalLines > 500 || (commit.filesChanged || 0) > 20) {
        flags.push({
            type: 'large_commit',
            details: JSON.stringify({
                linesChanged: totalLines,
                filesChanged: commit.filesChanged
            })
        });
    }

    // 3. Config only (check files)
    if (commit.files && commit.files.length > 0) {
        const allConfig = commit.files.every(f => isConfigFile(f.filename));
        if (allConfig) {
            flags.push({
                type: 'config_only',
                details: JSON.stringify({
                    files: commit.files.map(f => f.filename)
                })
            });
        }
    }

    // If we have diff content, do deeper analysis
    if (diffContent) {
        // 4. Comment only changes
        if (isCommentOnlyChange(diffContent)) {
            flags.push({
                type: 'comment_only',
                details: JSON.stringify({
                    message: 'All changes appear to be comments'
                })
            });
        }

        // 5. Possible copy-paste
        const duplicates = detectCopyPaste(diffContent);
        if (duplicates.length > 0) {
            flags.push({
                type: 'possible_copy_paste',
                details: JSON.stringify({
                    duplicateBlocks: duplicates.length,
                    files: duplicates.flatMap(d => d.files)
                })
            });
        }

        // 6. Possible AI-generated code
        const aiScore = detectAIPatterns(diffContent);
        if (aiScore > 0.6) {
            flags.push({
                type: 'possible_ai_generated',
                details: JSON.stringify({
                    confidence: Math.round(aiScore * 100),
                    indicators: getAIIndicators(diffContent)
                })
            });
        }
    }

    return flags;
}

/**
 * Check if a commit message is vague
 */
function isVagueMessage(message) {
    if (!message || message.length < 10) return true;

    // Check against vague patterns
    for (const pattern of VAGUE_PATTERNS) {
        if (pattern.test(message.trim())) return true;
    }

    // Single word messages
    if (!/\s/.test(message.trim()) && message.length < 20) return true;

    return false;
}

/**
 * Detect AI-generated code patterns
 * Returns a score from 0 to 1
 */
function detectAIPatterns(diffContent) {
    if (!diffContent) return 0;

    let score = 0;
    const addedLines = diffContent.split('\n')
        .filter(line => line.startsWith('+') && !line.startsWith('+++'))
        .map(line => line.substring(1));

    if (addedLines.length === 0) return 0;

    const content = addedLines.join('\n');

    // Check for verbose comments
    const verboseComments = (content.match(AI_PATTERNS.verboseComments) || []).length;
    if (verboseComments > 3) score += 0.2;

    // Check for explanatory comments
    const explanatoryComments = (content.match(AI_PATTERNS.explanatoryComments) || []).length;
    if (explanatoryComments > 2) score += 0.2;

    // Check for generic variable names with numbers
    const genericNames = (content.match(AI_PATTERNS.genericNames) || []).length;
    if (genericNames > 5) score += 0.15;

    // Check for consistent formatting (unusual for human code)
    const lines = addedLines.filter(l => l.trim().length > 0);
    if (lines.length > 10) {
        const indentations = lines.map(l => l.match(/^(\s*)/)[1].length);
        const uniqueIndents = new Set(indentations);
        if (uniqueIndents.size <= 3) score += 0.1;
    }

    // Check for boilerplate patterns
    const boilerplate = (content.match(AI_PATTERNS.boilerplatePatterns) || []).length;
    if (boilerplate > 3) score += 0.15;

    // Check for docstring/JSDoc density
    const docComments = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
    const functionCount = (content.match(/function\s+\w+|=>\s*{|\w+\s*\([^)]*\)\s*{/g) || []).length;
    if (functionCount > 0 && docComments / functionCount > 0.8) score += 0.2;

    return Math.min(score, 1);
}

/**
 * Get specific AI indicators found in code
 */
function getAIIndicators(diffContent) {
    const indicators = [];

    if ((diffContent.match(AI_PATTERNS.verboseComments) || []).length > 3) {
        indicators.push('Verbose explanatory comments');
    }
    if ((diffContent.match(AI_PATTERNS.explanatoryComments) || []).length > 2) {
        indicators.push('Comments explaining obvious code');
    }
    if ((diffContent.match(AI_PATTERNS.genericNames) || []).length > 5) {
        indicators.push('Generic variable names');
    }

    return indicators;
}

/**
 * Save flags for a commit
 */
function saveCommitFlags(commitId, flags) {
    const stmt = db.getDb().prepare(`
        INSERT INTO commit_flags (commit_id, flag_type, details)
        VALUES (?, ?, ?)
    `);

    for (const flag of flags) {
        stmt.run(commitId, flag.type, flag.details);
    }
}

/**
 * Get flags for a commit
 */
function getCommitFlags(commitId) {
    return db.all(`
        SELECT flag_type, details
        FROM commit_flags
        WHERE commit_id = ?
    `, [commitId]);
}

/**
 * Analyze all commits in a range (batch operation)
 */
async function analyzeCommitsInRange(fromDate, toDate, getClient) {
    const commits = db.all(`
        SELECT c.id, c.sha, c.message, c.lines_added, c.lines_removed, 
               c.files_changed, r.full_name as repo_full_name, r.platform_id
        FROM commits c
        JOIN repositories r ON c.repository_id = r.id
        WHERE c.committed_at BETWEEN ? AND ?
        AND c.id NOT IN (SELECT commit_id FROM commit_flags)
    `, [fromDate, toDate]);

    for (const commit of commits) {
        try {
            // Get files for the commit
            const files = db.all(`
                SELECT filename, status, lines_added, lines_removed
                FROM commit_files
                WHERE commit_id = ?
            `, [commit.id]);

            const commitData = {
                ...commit,
                files,
                linesAdded: commit.lines_added,
                linesRemoved: commit.lines_removed,
                filesChanged: commit.files_changed
            };

            const flags = analyzeCommit(commitData);

            if (flags.length > 0) {
                saveCommitFlags(commit.id, flags);
            }
        } catch (error) {
            console.error(`Failed to analyze commit ${commit.sha}:`, error.message);
        }
    }
}

module.exports = {
    analyzeCommit,
    isVagueMessage,
    detectAIPatterns,
    saveCommitFlags,
    getCommitFlags,
    analyzeCommitsInRange,
    VAGUE_PATTERNS
};
