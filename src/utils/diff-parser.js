/**
 * Parse unified diff format into structured data
 */

/**
 * Parse a unified diff string into file changes
 * @param {string} diffContent - The raw diff content
 * @returns {Array} - Array of file change objects
 */
function parseDiff(diffContent) {
    if (!diffContent) return [];

    const files = [];
    const diffLines = diffContent.split('\n');
    let currentFile = null;
    let inHunk = false;

    for (let i = 0; i < diffLines.length; i++) {
        const line = diffLines[i];

        // New file header (diff --git a/... b/...)
        if (line.startsWith('diff --git')) {
            if (currentFile) {
                files.push(currentFile);
            }
            const match = line.match(/diff --git a\/(.+) b\/(.+)/);
            currentFile = {
                oldPath: match ? match[1] : null,
                newPath: match ? match[2] : null,
                status: 'modified',
                linesAdded: 0,
                linesRemoved: 0,
                hunks: []
            };
            inHunk = false;
            continue;
        }

        if (!currentFile) continue;

        // File mode indicators
        if (line.startsWith('new file mode')) {
            currentFile.status = 'added';
        } else if (line.startsWith('deleted file mode')) {
            currentFile.status = 'deleted';
        } else if (line.startsWith('rename from')) {
            currentFile.status = 'renamed';
            currentFile.oldPath = line.substring(12);
        } else if (line.startsWith('rename to')) {
            currentFile.newPath = line.substring(10);
        }

        // Hunk header (@@ -start,count +start,count @@)
        if (line.startsWith('@@')) {
            inHunk = true;
            const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)?/);
            if (hunkMatch) {
                currentFile.hunks.push({
                    oldStart: parseInt(hunkMatch[1]),
                    oldLines: parseInt(hunkMatch[2] || 1),
                    newStart: parseInt(hunkMatch[3]),
                    newLines: parseInt(hunkMatch[4] || 1),
                    header: hunkMatch[5] || '',
                    lines: []
                });
            }
            continue;
        }

        // Diff content lines
        if (inHunk && currentFile.hunks.length > 0) {
            const currentHunk = currentFile.hunks[currentFile.hunks.length - 1];

            if (line.startsWith('+') && !line.startsWith('+++')) {
                currentFile.linesAdded++;
                currentHunk.lines.push({ type: 'add', content: line.substring(1) });
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                currentFile.linesRemoved++;
                currentHunk.lines.push({ type: 'remove', content: line.substring(1) });
            } else if (line.startsWith(' ') || line === '') {
                currentHunk.lines.push({ type: 'context', content: line.substring(1) || '' });
            }
        }
    }

    // Don't forget the last file
    if (currentFile) {
        files.push(currentFile);
    }

    return files;
}

/**
 * Check if diff contains only comment changes
 * @param {string} diffContent - The raw diff content
 * @returns {boolean} - True if only comments changed
 */
function isCommentOnlyChange(diffContent) {
    const files = parseDiff(diffContent);

    const commentPatterns = [
        /^\s*\/\//,      // C-style single line
        /^\s*#/,         // Python/Shell/Ruby
        /^\s*'/,         // VB.NET
        /^\s*\/\*/,      // C-style block start
        /^\s*\*\//,      // C-style block end
        /^\s*\*/,        // C-style block middle
        /^\s*<!--/,      // HTML start
        /^\s*-->/,       // HTML end
        /^\s*--/,        // SQL
        /^\s*;/,         // Assembly/INI
        /^\s*%/          // LaTeX
    ];

    for (const file of files) {
        for (const hunk of file.hunks) {
            for (const line of hunk.lines) {
                if (line.type === 'add' || line.type === 'remove') {
                    const content = line.content.trim();
                    if (content && !commentPatterns.some(p => p.test(content))) {
                        return false;
                    }
                }
            }
        }
    }

    return files.length > 0;
}

/**
 * Extract code chunks for copy-paste detection
 * @param {string} diffContent - The raw diff content
 * @param {number} minLines - Minimum consecutive lines to consider (default 5)
 * @returns {Array} - Array of code chunks with hashes
 */
function extractCodeChunks(diffContent, minLines = 5) {
    const files = parseDiff(diffContent);
    const chunks = [];

    for (const file of files) {
        for (const hunk of file.hunks) {
            const addedLines = hunk.lines
                .filter(l => l.type === 'add')
                .map(l => l.content.trim())
                .filter(l => l.length > 0);

            // Extract consecutive chunks of minLines or more
            if (addedLines.length >= minLines) {
                for (let i = 0; i <= addedLines.length - minLines; i++) {
                    const chunk = addedLines.slice(i, i + minLines).join('\n');
                    const hash = simpleHash(chunk);
                    chunks.push({
                        file: file.newPath || file.oldPath,
                        startLine: i,
                        content: chunk,
                        hash
                    });
                }
            }
        }
    }

    return chunks;
}

/**
 * Simple string hash function
 * @param {string} str - String to hash
 * @returns {string} - Hash string
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

/**
 * Detect possible copy-paste by finding duplicate chunks
 * @param {string} diffContent - The raw diff content
 * @returns {Array} - Array of duplicate chunk groups
 */
function detectCopyPaste(diffContent) {
    const chunks = extractCodeChunks(diffContent);
    const hashMap = new Map();

    for (const chunk of chunks) {
        if (!hashMap.has(chunk.hash)) {
            hashMap.set(chunk.hash, []);
        }
        hashMap.get(chunk.hash).push(chunk);
    }

    // Return groups with duplicates
    const duplicates = [];
    for (const [hash, group] of hashMap) {
        if (group.length > 1) {
            duplicates.push({
                hash,
                occurrences: group.length,
                files: [...new Set(group.map(c => c.file))],
                sample: group[0].content
            });
        }
    }

    return duplicates;
}

module.exports = {
    parseDiff,
    isCommentOnlyChange,
    extractCodeChunks,
    detectCopyPaste,
    simpleHash
};
