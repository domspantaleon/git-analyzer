const axios = require('axios');

/**
 * GitHub API client
 * Uses GitHub REST API v3
 */
class GitHubClient {
    constructor(url, token) {
        this.originalUrl = url;
        this.token = token;
        this.org = this.extractOrg(url);

        this.client = axios.create({
            baseURL: 'https://api.github.com',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
    }

    /**
     * Extract organization/user from URL
     */
    extractOrg(url) {
        // Handle full URL
        const match = url.match(/github\.com\/([^/]+)/i);
        if (match) return match[1];

        // Handle just org name
        return url.replace(/^https?:\/\//i, '').replace(/\//g, '');
    }

    /**
     * Test connection to GitHub
     */
    async testConnection() {
        try {
            // Check if it's an org or user
            let response;
            try {
                response = await this.client.get(`/orgs/${this.org}`);
            } catch (e) {
                if (e.response?.status === 404) {
                    response = await this.client.get(`/users/${this.org}`);
                } else {
                    throw e;
                }
            }

            return {
                success: true,
                message: `Connected successfully to ${response.data.login || this.org}.`
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * List all repositories in the organization/user
     */
    async listRepositories() {
        const repos = [];
        let page = 1;
        const perPage = 100;

        while (true) {
            try {
                // Try as org first
                let response;
                try {
                    response = await this.client.get(`/orgs/${this.org}/repos`, {
                        params: { page, per_page: perPage, sort: 'updated' }
                    });
                } catch (e) {
                    if (e.response?.status === 404) {
                        response = await this.client.get(`/users/${this.org}/repos`, {
                            params: { page, per_page: perPage, sort: 'updated' }
                        });
                    } else {
                        throw e;
                    }
                }

                if (response.data.length === 0) break;

                for (const repo of response.data) {
                    repos.push({
                        id: repo.id.toString(),
                        name: repo.name,
                        fullName: repo.full_name,
                        defaultBranch: repo.default_branch || 'main',
                        url: repo.html_url
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

        while (true) {
            const response = await this.client.get(`/repos/${repoFullName}/branches`, {
                params: { page, per_page: perPage }
            });

            if (response.data.length === 0) break;

            for (const branch of response.data) {
                branches.push({
                    name: branch.name,
                    sha: branch.commit.sha
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

        while (true) {
            const params = {
                sha: branch,
                page,
                per_page: perPage
            };

            if (fromDate) params.since = fromDate;
            if (toDate) params.until = toDate;

            const response = await this.client.get(`/repos/${repoFullName}/commits`, { params });

            if (response.data.length === 0) break;

            for (const commit of response.data) {
                commits.push({
                    sha: commit.sha,
                    message: commit.commit.message,
                    authorName: commit.commit.author?.name,
                    authorEmail: commit.commit.author?.email,
                    committedAt: commit.commit.author?.date,
                    isMergeCommit: (commit.parents?.length || 0) > 1
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
        const response = await this.client.get(`/repos/${repoFullName}/commits/${sha}`);
        const commit = response.data;

        const files = (commit.files || []).map(file => ({
            filename: file.filename,
            status: file.status,
            linesAdded: file.additions || 0,
            linesRemoved: file.deletions || 0
        }));

        return {
            sha,
            filesChanged: commit.files?.length || 0,
            linesAdded: commit.stats?.additions || 0,
            linesRemoved: commit.stats?.deletions || 0,
            files
        };
    }

    /**
     * Get commit diff
     */
    async getCommitDiff(repoFullName, sha) {
        const response = await this.client.get(`/repos/${repoFullName}/commits/${sha}`, {
            headers: {
                'Accept': 'application/vnd.github.v3.diff'
            }
        });

        return response.data;
    }
}

module.exports = GitHubClient;
