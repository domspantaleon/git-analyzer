const db = require('../db');

/**
 * Developer auto-grouping logic
 * Groups developers by email and similar names
 */

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;

    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],
                    dp[i][j - 1],
                    dp[i - 1][j - 1]
                );
            }
        }
    }

    return dp[m][n];
}

/**
 * Normalize a name for comparison
 * - Lowercase
 * - Remove middle initials
 * - Trim whitespace
 */
function normalizeName(name) {
    if (!name) return '';

    return name
        .toLowerCase()
        .replace(/\s+[a-z]\.?\s+/g, ' ')  // Remove middle initials
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extract email domain
 */
function getEmailDomain(email) {
    if (!email) return '';
    const parts = email.split('@');
    return parts[1] || '';
}

/**
 * Extract first name from full name
 */
function getFirstName(name) {
    if (!name) return '';
    return name.split(/\s+/)[0].toLowerCase();
}

/**
 * Check if two identities likely belong to the same person
 */
function areSamePerson(identity1, identity2) {
    // Exact email match
    if (identity1.email.toLowerCase() === identity2.email.toLowerCase()) {
        return true;
    }

    // Same domain and similar first name
    const domain1 = getEmailDomain(identity1.email);
    const domain2 = getEmailDomain(identity2.email);

    if (domain1 && domain1 === domain2) {
        const firstName1 = getFirstName(identity1.name);
        const firstName2 = getFirstName(identity2.name);

        if (firstName1 && firstName2) {
            const distance = levenshteinDistance(firstName1, firstName2);
            if (distance < 3) {
                return true;
            }
        }
    }

    // Exact normalized name match with common domain patterns
    const normalized1 = normalizeName(identity1.name);
    const normalized2 = normalizeName(identity2.name);

    if (normalized1 === normalized2 && normalized1.length > 5) {
        return true;
    }

    return false;
}

/**
 * Process new identities from commits and group developers
 */
function processIdentities() {
    // Get all unique author name/email pairs from commits that aren't yet mapped
    const unmappedCommits = db.all(`
        SELECT DISTINCT author_name, author_email
        FROM commits
        WHERE developer_id IS NULL
        AND author_email IS NOT NULL
        AND author_email != ''
    `);

    for (const commit of unmappedCommits) {
        const email = commit.author_email.toLowerCase();
        const name = commit.author_name || email.split('@')[0];

        // Check if this email already exists
        let existingIdentity = db.get(`
            SELECT developer_id FROM developer_identities
            WHERE LOWER(email) = ?
        `, [email]);

        if (existingIdentity) {
            // Update commits with this developer
            db.run(`
                UPDATE commits SET developer_id = ?
                WHERE LOWER(author_email) = ? AND developer_id IS NULL
            `, [existingIdentity.developer_id, email]);
            continue;
        }

        // Try to find a matching developer
        let matchedDeveloperId = null;

        // Get all existing identities
        const allIdentities = db.all(`
            SELECT di.*, d.canonical_name
            FROM developer_identities di
            JOIN developers d ON di.developer_id = d.id
        `);

        for (const identity of allIdentities) {
            if (areSamePerson({ name, email }, identity)) {
                matchedDeveloperId = identity.developer_id;
                break;
            }
        }

        if (matchedDeveloperId) {
            // Add new identity to existing developer
            db.run(`
                INSERT OR IGNORE INTO developer_identities (developer_id, name, email)
                VALUES (?, ?, ?)
            `, [matchedDeveloperId, name, email]);
        } else {
            // Create new developer
            const result = db.run(`
                INSERT INTO developers (canonical_name) VALUES (?)
            `, [name]);

            matchedDeveloperId = result.lastInsertRowid;

            // Add identity
            db.run(`
                INSERT INTO developer_identities (developer_id, name, email)
                VALUES (?, ?, ?)
            `, [matchedDeveloperId, name, email]);
        }

        // Update commits
        db.run(`
            UPDATE commits SET developer_id = ?
            WHERE LOWER(author_email) = ? AND developer_id IS NULL
        `, [matchedDeveloperId, email]);
    }
}

/**
 * Merge two developers
 */
function mergeDevelopers(sourceId, targetId) {
    // Move all identities from source to target
    db.run(`
        UPDATE developer_identities SET developer_id = ?
        WHERE developer_id = ?
    `, [targetId, sourceId]);

    // Update all commits
    db.run(`
        UPDATE commits SET developer_id = ?
        WHERE developer_id = ?
    `, [targetId, sourceId]);

    // Delete source developer
    db.run(`
        DELETE FROM developers WHERE id = ?
    `, [sourceId]);
}

/**
 * Update canonical name based on most common full name
 */
function updateCanonicalName(developerId) {
    const names = db.all(`
        SELECT name, COUNT(*) as count
        FROM developer_identities
        WHERE developer_id = ?
        GROUP BY name
        ORDER BY count DESC
        LIMIT 1
    `, [developerId]);

    if (names.length > 0) {
        db.run(`
            UPDATE developers SET canonical_name = ?
            WHERE id = ?
        `, [names[0].name, developerId]);
    }
}

/**
 * Get all developers with their identities
 */
function getDevelopersWithIdentities() {
    const developers = db.all(`
        SELECT d.*, 
               (SELECT COUNT(*) FROM commits WHERE developer_id = d.id) as commit_count,
               (SELECT SUM(lines_added) FROM commits WHERE developer_id = d.id) as total_lines_added,
               (SELECT SUM(lines_removed) FROM commits WHERE developer_id = d.id) as total_lines_removed
        FROM developers d
        ORDER BY commit_count DESC
    `);

    for (const dev of developers) {
        dev.identities = db.all(`
            SELECT name, email FROM developer_identities
            WHERE developer_id = ?
        `, [dev.id]);
    }

    return developers;
}

module.exports = {
    levenshteinDistance,
    normalizeName,
    areSamePerson,
    processIdentities,
    mergeDevelopers,
    updateCanonicalName,
    getDevelopersWithIdentities
};
