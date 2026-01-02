const axios = require('axios');

/**
 * GitLab API client
 * Uses GitLab REST API v4
 */
class GitLabClient {
    constructor(url, token) {
        this.originalUrl = url;
        this.token = token;
        this.baseUrl = this.normalizeUrl(url);
        this.groupPath = this.extractGroupPath(url);

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'PRIVATE-TOKEN': token,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Normalize URL to API format
     */
    normalizeUrl(url) {
        // Handle gitlab.com or self-hosted
        const match = url.match(/(https?:\/\/[^/]+)/i);
        if (match) {
            return `${match[1]}/api/v4`;
        }
        return 'https://gitlab.com/api/v4';
    }

    /**
     * Extract group/namespace path from URL
     */
    extractGroupPath(url) {
        // Handle full URL with group
        const match = url.match(/gitlab\.com\/([^/]+(?:\/[^/]+)*)/i);
        if (match) return match[1];

        // Handle just group name
        return url.replace(/^https?:\/\//i, '').replace(/\//g, '');
    }

    /**
     * Test connection to GitLab
     */
    async testConnection() {
        try {
            // Try to get the group
            const encodedPath = encodeURIComponent(this.groupPath);
            const response = await this.client.get(`/groups/${encodedPath}`);

            return {
                success: true,
                message: `Connected successfully to ${response.data.name || this.groupPath}.`
            };
        } catch (error) {
            // Maybe it's a user, try that
            try {
                const response = await this.client.get('/user');
                return {
                    success: true,
                    message: `Connected successfully as ${response.data.username}.`
                };
            } catch (e) {
                return {
                    success: false,
                    message: error.response?.data?.message || error.message
                };
            }
        }
    }

    /**
     * List all repositories (projects) in the group
     */
    async listRepositories() {
        const repos = [];
        let page = 1;
        const perPage = 100;

        while (true) {
            try {
                let response;
                const encodedPath = encodeURIComponent(this.groupPath);

                try {
                    // Try as group first
                    response = await this.client.get(`/groups/${encodedPath}/projects`, {
                        params: {
                            page,
                            per_page: perPage,
                            include_subgroups: true,
                            order_by: 'last_activity_at',
                            sort: 'desc'
                        }
                    });
                } catch (e) {
                    if (e.response?.status === 404) {
                        // Try as user's projects
                        response = await this.client.get('/projects', {
                            params: {
                                page,
                                per_page: perPage,
                                owned: true,
                                order_by: 'last_activity_at',
                                sort: 'desc'
                            }
                        });
                    } else {
                        throw e;
                    }
                }

                if (response.data.length === 0) break;

                for (const project of response.data) {
                    repos.push({
                        id: project.id.toString(),
                        name: project.name,
                        fullName: project.path_with_namespace,
                        defaultBranch: project.default_branch || 'main',
                        url: project.web_url
                    });
                }

                if (response.data.length < perPage) break;
                page++;
            } catch (error) {
                console.warn('Failed to fetch repos:', error.message);
                break;
            }
        }

        return repos;
    }

    /**
     * List all branches for a repository
     */
    async listBranches(repoFullName) {
        const branches = [];
        let page = 1;
        const perPage = 100;
        const encodedPath = encodeURIComponent(repoFullName);

        while (true) {
            const response = await this.client.get(`/projects/${encodedPath}/repository/branches`, {
                params: { page, per_page: perPage }
            });

            if (response.data.length === 0) break;

            for (const branch of response.data) {
                branches.push({
                    name: branch.name,
                    sha: branch.commit.id
                });
            }

            if (response.data.length < perPage) break;
            page++;
        }

        return branches;
    }

    /**
     * List commits for a branch with date range filter
     */
    async listCommits(repoFullName, branch, fromDate, toDate, perPage = 100) {
        const commits = [];
        let page = 1;
        const encodedPath = encodeURIComponent(repoFullName);

        while (true) {
            const params = {
                ref_name: branch,
                page,
                per_page: perPage
            };

            if (fromDate) params.since = fromDate;
            if (toDate) params.until = toDate;

            const response = await this.client.get(`/projects/${encodedPath}/repository/commits`, { params });

            if (response.data.length === 0) break;

            for (const commit of response.data) {
                commits.push({
                    sha: commit.id,
                    message: commit.message,
                    authorName: commit.author_name,
                    authorEmail: commit.author_email,
                    committedAt: commit.authored_date,
                    isMergeCommit: (commit.parent_ids?.length || 0) > 1
                });
            }

            if (response.data.length < perPage) break;
            page++;

            // Safety limit
            if (page > 50) break;
        }

        return commits;
    }

    /**
     * Get commit details including file changes
     */
    async getCommitDetails(repoFullName, sha) {
        const encodedPath = encodeURIComponent(repoFullName);

        // Get commit with stats
        const commitResponse = await this.client.get(`/projects/${encodedPath}/repository/commits/${sha}`);
        const commit = commitResponse.data;

        // Get diff for file details
        const diffResponse = await this.client.get(`/projects/${encodedPath}/repository/commits/${sha}/diff`);
        const diffs = diffResponse.data;

        const files = diffs.map(diff => ({
            filename: diff.new_path || diff.old_path,
            status: this.mapDiffStatus(diff),
            linesAdded: (diff.diff?.match(/^\+[^+]/gm) || []).length,
            linesRemoved: (diff.diff?.match(/^-[^-]/gm) || []).length
        }));

        return {
            sha,
            filesChanged: files.length,
            linesAdded: commit.stats?.additions || files.reduce((sum, f) => sum + f.linesAdded, 0),
            linesRemoved: commit.stats?.deletions || files.reduce((sum, f) => sum + f.linesRemoved, 0),
            files
        };
    }

    /**
     * Get commit diff
     */
    async getCommitDiff(repoFullName, sha) {
        const encodedPath = encodeURIComponent(repoFullName);

        const response = await this.client.get(`/projects/${encodedPath}/repository/commits/${sha}/diff`);

        // Convert GitLab diff format to unified diff
        let unifiedDiff = '';
        for (const diff of response.data) {
            unifiedDiff += `diff --git a/${diff.old_path} b/${diff.new_path}\n`;
            if (diff.new_file) unifiedDiff += 'new file mode 100644\n';
            if (diff.deleted_file) unifiedDiff += 'deleted file mode 100644\n';
            if (diff.renamed_file) unifiedDiff += `rename from ${diff.old_path}\nrename to ${diff.new_path}\n`;
            unifiedDiff += `--- a/${diff.old_path}\n`;
            unifiedDiff += `+++ b/${diff.new_path}\n`;
            unifiedDiff += diff.diff || '';
            unifiedDiff += '\n';
        }

        return unifiedDiff;
    }

    /**
     * Map GitLab diff status
     */
    mapDiffStatus(diff) {
        if (diff.new_file) return 'added';
        if (diff.deleted_file) return 'deleted';
        if (diff.renamed_file) return 'renamed';
        return 'modified';
    }
}

module.exports = GitLabClient;
