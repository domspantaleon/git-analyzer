const db = require('../db');
const AzureDevOpsClient = require('./azure-devops');
const GitHubClient = require('./github');
const GitLabClient = require('./gitlab');
const { isFileExcluded } = require('../utils/file-exclusions');
const { processIdentities } = require('./developer-grouping');
const { analyzeCommit, saveCommitFlags } = require('./analysis');

/**
 * Sync orchestration service
 * Handles syncing repositories, branches, and commits from all platforms
 * Uses parallel processing for faster syncs
 */

// Concurrency settings
const REPO_CONCURRENCY = 3;    // Max repos processed in parallel
const COMMIT_CONCURRENCY = 5;  // Max commits processed in parallel per repo

/**
 * Simple concurrency limiter
 */
async function runWithConcurrency(items, concurrency, asyncFn) {
    const results = [];
    const executing = new Set();

    for (const item of items) {
        const promise = asyncFn(item).then(result => {
            executing.delete(promise);
            return result;
        });

        executing.add(promise);
        results.push(promise);

        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }

    return Promise.all(results);
}

/**
 * Get client for a platform
 */
function getClientForPlatform(platform) {
    switch (platform.type) {
        case 'azure_devops':
            return new AzureDevOpsClient(platform.url, platform.token, platform.username);
        case 'github':
            return new GitHubClient(platform.url, platform.token);
        case 'gitlab':
            return new GitLabClient(platform.url, platform.token);
        default:
            throw new Error(`Unknown platform type: ${platform.type}`);
    }
}

/**
 * Sync repositories from all platforms (parallel)
 */
async function syncRepositories(progressCallback = null) {
    const platforms = db.all('SELECT * FROM platforms');
    const results = { success: 0, failed: 0, total: 0, errors: [] };

    let completed = 0;

    await runWithConcurrency(platforms, REPO_CONCURRENCY, async (platform) => {
        if (progressCallback) {
            progressCallback({
                type: 'platform',
                current: ++completed,
                total: platforms.length,
                name: platform.name
            });
        }

        try {
            const client = getClientForPlatform(platform);
            const repos = await client.listRepositories();

            for (const repo of repos) {
                try {
                    db.run(`
                        INSERT INTO repositories (platform_id, external_id, name, full_name, default_branch)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(platform_id, external_id) DO UPDATE SET
                            name = excluded.name,
                            full_name = excluded.full_name,
                            default_branch = excluded.default_branch
                    `, [platform.id, repo.id, repo.name, repo.fullName, repo.defaultBranch]);

                    results.success++;
                } catch (error) {
                    results.failed++;
                    results.errors.push(`Repo ${repo.name}: ${error.message}`);
                }
                results.total++;
            }
        } catch (error) {
            results.errors.push(`Platform ${platform.name}: ${error.message}`);
        }
    });

    return results;
}

/**
 * Sync branches for selected repositories (parallel)
 */
async function syncBranches(progressCallback = null) {
    const repos = db.all(`
        SELECT r.*, p.type, p.url, p.token, p.username
        FROM repositories r
        JOIN platforms p ON r.platform_id = p.id
        WHERE r.is_selected = 1
    `);

    const results = { success: 0, failed: 0, total: 0, errors: [] };
    let completed = 0;

    await runWithConcurrency(repos, REPO_CONCURRENCY, async (repo) => {
        if (progressCallback) {
            progressCallback({
                type: 'repository',
                current: ++completed,
                total: repos.length,
                name: repo.full_name
            });
        }

        try {
            const client = getClientForPlatform(repo);
            const branches = await client.listBranches(repo.full_name);

            for (const branch of branches) {
                try {
                    db.run(`
                        INSERT INTO branches (repository_id, name)
                        VALUES (?, ?)
                        ON CONFLICT(repository_id, name) DO UPDATE SET name = excluded.name
                    `, [repo.id, branch.name]);

                    results.success++;
                } catch (error) {
                    results.failed++;
                    results.errors.push(`Branch ${branch.name}: ${error.message}`);
                }
                results.total++;
            }

            // Update repo last synced
            db.run(`
                UPDATE repositories SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?
            `, [repo.id]);

        } catch (error) {
            results.failed++;
            results.errors.push(`Repo ${repo.full_name}: ${error.message}`);
        }
    });

    return results;
}

/**
 * Process a single commit
 */
async function processCommit(client, repo, branchId, commit, force, results) {
    try {
        // Check if commit already exists
        const existing = db.get(`
            SELECT id, lines_added FROM commits WHERE repository_id = ? AND sha = ?
        `, [repo.id, commit.sha]);

        if (existing && !force) {
            // Check if we need to repair incomplete data (e.g. lines added in total but not in files)
            const fileStats = db.get('SELECT SUM(lines_added) as total FROM commit_files WHERE commit_id = ?', [existing.id]);
            const needsRepair = (existing.lines_added > 0 && (!fileStats || !fileStats.total || fileStats.total === 0));

            if (!needsRepair) {
                results.skipped++;
                return;
            }
        }

        // Get commit details
        let details = { filesChanged: 0, linesAdded: 0, linesRemoved: 0, files: [] };
        try {
            details = await client.getCommitDetails(repo.full_name, commit.sha);
        } catch (e) {
            console.warn(`Failed to get details for ${commit.sha}: ${e.message}`);
        }

        // Insert or update commit
        const result = db.run(`
            INSERT INTO commits (
                repository_id, branch_id, sha, message, author_name, author_email,
                committed_at, lines_added, lines_removed, lines_net, files_changed, is_merge_commit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(repository_id, sha) DO UPDATE SET
                message = excluded.message,
                lines_added = excluded.lines_added,
                lines_removed = excluded.lines_removed,
                lines_net = excluded.lines_net,
                files_changed = excluded.files_changed
        `, [
            repo.id, branchId, commit.sha, commit.message,
            commit.authorName, commit.authorEmail, commit.committedAt,
            details.linesAdded, details.linesRemoved,
            details.linesAdded - details.linesRemoved,
            details.filesChanged, commit.isMergeCommit ? 1 : 0
        ]);

        const commitId = result.lastInsertRowid ||
            db.get('SELECT id FROM commits WHERE repository_id = ? AND sha = ?', [repo.id, commit.sha]).id;

        // Insert file details
        for (const file of details.files) {
            const excluded = isFileExcluded(file.filename) ? 1 : 0;
            db.run(`
                INSERT OR REPLACE INTO commit_files (
                    commit_id, filename, status, lines_added, lines_removed, is_excluded
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [commitId, file.filename, file.status, file.linesAdded, file.linesRemoved, excluded]);
        }

        // Analyze commit and create flags
        const commitData = {
            ...commit,
            ...details,
            linesAdded: details.linesAdded,
            linesRemoved: details.linesRemoved
        };
        const flags = analyzeCommit(commitData);
        if (flags.length > 0) {
            saveCommitFlags(commitId, flags);
        }

        results.success++;
    } catch (error) {
        results.failed++;
        results.errors.push(`Commit ${commit.sha.substring(0, 7)}: ${error.message}`);
    }
    results.total++;
}

/**
 * Sync commits for selected repositories (parallel)
 */
async function syncCommits(fromDate, toDate, force = false, progressCallback = null) {
    const repos = db.all(`
        SELECT r.*, p.type, p.url, p.token, p.username
        FROM repositories r
        JOIN platforms p ON r.platform_id = p.id
        WHERE r.is_selected = 1
    `);

    const results = {
        success: 0,
        failed: 0,
        total: 0,
        skipped: 0,
        errors: []
    };

    let repoCompleted = 0;
    const totalRepos = repos.length;

    // Process repos in parallel
    await runWithConcurrency(repos, REPO_CONCURRENCY, async (repo) => {
        // Get branches for this repo
        let branches = db.all(`
            SELECT * FROM branches WHERE repository_id = ?
        `, [repo.id]);

        if (branches.length === 0) {
            // Try default branch only
            branches = [{ name: repo.default_branch, id: null }];
        }

        for (const branch of branches) {
            if (progressCallback) {
                progressCallback({
                    type: 'branch',
                    current: repoCompleted + 1,
                    total: totalRepos,
                    repoName: repo.full_name,
                    branchName: branch.name
                });
            }

            try {
                const client = getClientForPlatform(repo);

                // Get or create branch record
                let branchId = branch.id;
                if (!branchId) {
                    db.run(`
                        INSERT INTO branches (repository_id, name)
                        VALUES (?, ?)
                        ON CONFLICT(repository_id, name) DO UPDATE SET name = name
                    `, [repo.id, branch.name]);

                    const branchRecord = db.get(`
                        SELECT id FROM branches WHERE repository_id = ? AND name = ?
                    `, [repo.id, branch.name]);
                    branchId = branchRecord.id;
                }

                // Check last sync if not forcing
                let effectiveFromDate = fromDate;
                if (!force) {
                    const lastSync = db.get(`
                        SELECT to_date FROM sync_log
                        WHERE repository_id = ? AND branch_id = ? AND sync_type = 'commits' AND status = 'success'
                        ORDER BY created_at DESC LIMIT 1
                    `, [repo.id, branchId]);

                    if (lastSync && lastSync.to_date) {
                        const lastDate = new Date(lastSync.to_date);
                        const fromDateObj = new Date(fromDate);
                        if (lastDate >= fromDateObj) {
                            effectiveFromDate = lastSync.to_date;
                        }
                    }
                }

                const commits = await client.listCommits(repo.full_name, branch.name, effectiveFromDate, toDate);

                // Process commits in parallel with concurrency limit
                let commitsDone = 0;
                await runWithConcurrency(commits, COMMIT_CONCURRENCY, async (commit) => {
                    await processCommit(client, repo, branchId, commit, force, results);
                    commitsDone++;

                    if (progressCallback) {
                        progressCallback({
                            type: 'commits_progress',
                            repoName: repo.full_name,
                            branchName: branch.name,
                            processed: commitsDone,
                            total: commits.length,
                            message: `Syncing ${repo.full_name} [${branch.name}]: ${commitsDone}/${commits.length}`
                        });
                    }
                });

                // Log sync
                db.run(`
                    INSERT INTO sync_log (repository_id, branch_id, sync_type, from_date, to_date, status)
                    VALUES (?, ?, 'commits', ?, ?, 'success')
                `, [repo.id, branchId, effectiveFromDate, toDate]);

                // Update branch last synced
                db.run(`
                    UPDATE branches SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?
                `, [branchId]);

            } catch (error) {
                results.errors.push(`${repo.full_name}/${branch.name}: ${error.message}`);

                // Log failed sync
                db.run(`
                    INSERT INTO sync_log (repository_id, branch_id, sync_type, from_date, to_date, status, error_message)
                    VALUES (?, ?, 'commits', ?, ?, 'failed', ?)
                `, [repo.id, branch.id, fromDate, toDate, error.message]);
            }
        }

        repoCompleted++;
    });

    // Process developer identities after sync
    try {
        processIdentities();
    } catch (error) {
        console.error('Failed to process identities:', error.message);
    }

    return results;
}

module.exports = {
    getClientForPlatform,
    syncRepositories,
    syncBranches,
    syncCommits
};
