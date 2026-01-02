const axios = require('axios');

/**
 * Azure DevOps API client
 * Supports both dev.azure.com/{org} and {org}.visualstudio.com URL formats
 * Supports PAT-only auth or username:password auth
 */
class AzureDevOpsClient {
    constructor(url, token, username = null) {
        this.originalUrl = url;
        this.token = token;
        this.username = username;
        this.baseUrl = this.normalizeUrl(url);

        // Build authorization header
        // If username is provided, use username:password format
        // Otherwise, use :token format (PAT-only)
        let credentials;
        if (username) {
            credentials = `${username}:${token}`;
        } else {
            credentials = `:${token}`;
        }

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Basic ${Buffer.from(credentials).toString('base64')}`,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Normalize URL to API format
     */
    normalizeUrl(url) {
        url = url.trim().replace(/\/+$/, '');

        // Handle https://{org}@dev.azure.com/{org}/... format (from Clone dialog)
        // e.g., https://sharewealthsystems@dev.azure.com/sharewealthsystems/Project
        const atDevMatch = url.match(/https?:\/\/([^@]+)@dev\.azure\.com\/([^/]+)/i);
        if (atDevMatch) {
            // Use the org after @ in the URL path
            return `https://dev.azure.com/${atDevMatch[2]}`;
        }

        // Handle {org}.visualstudio.com format
        const vsMatch = url.match(/https?:\/\/([^.]+)\.visualstudio\.com/i);
        if (vsMatch) {
            return `https://dev.azure.com/${vsMatch[1]}`;
        }

        // Handle dev.azure.com/{org} format - strip any username prefix
        if (url.includes('dev.azure.com')) {
            // Clean the URL to standard format
            const devMatch = url.match(/dev\.azure\.com\/([^/]+)/i);
            if (devMatch) {
                return `https://dev.azure.com/${devMatch[1]}`;
            }
            return url;
        }

        // Assume it's just the org name
        return `https://dev.azure.com/${url}`;
    }

    /**
     * Extract organization name from URL
     */
    getOrganization() {
        const match = this.baseUrl.match(/dev\.azure\.com\/([^/]+)/i);
        return match ? match[1] : null;
    }

    /**
     * Test connection to Azure DevOps
     */
    async testConnection() {
        try {
            const response = await this.client.get('/_apis/projects?api-version=6.0');
            return {
                success: true,
                message: `Connected successfully. Found ${response.data.count} projects.`
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * List all repositories across all projects
     */
    async listRepositories() {
        const repos = [];

        // First get all projects
        const projectsResponse = await this.client.get('/_apis/projects?api-version=6.0');
        const projects = projectsResponse.data.value || [];

        // Then get repos for each project
        for (const project of projects) {
            try {
                const reposResponse = await this.client.get(
                    `/${project.name}/_apis/git/repositories?api-version=6.0`
                );

                for (const repo of reposResponse.data.value || []) {
                    repos.push({
                        id: repo.id,
                        name: repo.name,
                        fullName: `${project.name}/${repo.name}`,
                        defaultBranch: repo.defaultBranch?.replace('refs/heads/', '') || 'main',
                        project: project.name,
                        url: repo.webUrl
                    });
                }
            } catch (error) {
                console.warn(`Failed to fetch repos for project ${project.name}:`, error.message);
            }
        }

        return repos;
    }

    /**
     * List all branches for a repository
     */
    async listBranches(repoFullName) {
        const [project, repoName] = repoFullName.split('/');

        const response = await this.client.get(
            `/${project}/_apis/git/repositories/${repoName}/refs?filter=heads/&api-version=6.0`
        );

        return (response.data.value || []).map(ref => ({
            name: ref.name.replace('refs/heads/', ''),
            sha: ref.objectId
        }));
    }

    /**
     * List commits for a branch with date range filter
     */
    async listCommits(repoFullName, branch, fromDate, toDate, top = 1000) {
        const [project, repoName] = repoFullName.split('/');

        const params = new URLSearchParams({
            'searchCriteria.itemVersion.version': branch,
            'searchCriteria.itemVersion.versionType': 'branch',
            '$top': top.toString(),
            'api-version': '6.0'
        });

        if (fromDate) {
            params.append('searchCriteria.fromDate', fromDate);
        }
        if (toDate) {
            params.append('searchCriteria.toDate', toDate);
        }

        const response = await this.client.get(
            `/${project}/_apis/git/repositories/${repoName}/commits?${params.toString()}`
        );

        return (response.data.value || []).map(commit => ({
            sha: commit.commitId,
            message: commit.comment,
            authorName: commit.author?.name,
            authorEmail: commit.author?.email,
            committedAt: commit.author?.date,
            isMergeCommit: (commit.parents?.length || 0) > 1
        }));
    }

    /**
     * Get commit details including file changes with line counts
     */
    async getCommitDetails(repoFullName, sha) {
        const [project, repoName] = repoFullName.split('/');

        // Get the commit itself to find parent
        const commitResponse = await this.client.get(
            `/${project}/_apis/git/repositories/${repoName}/commits/${sha}?api-version=6.0`
        );
        const commit = commitResponse.data;
        const parentSha = commit.parents?.[0];

        // Get changes list
        const response = await this.client.get(
            `/${project}/_apis/git/repositories/${repoName}/commits/${sha}/changes?api-version=6.0`
        );

        const changes = response.data.changes || [];
        let totalAdded = 0;
        let totalRemoved = 0;

        const files = [];

        // Process up to 20 files to get actual line counts (to avoid rate limits)
        const filesToProcess = changes.slice(0, 20);

        for (const change of changes) {
            const filename = change.item?.path?.replace(/^\//, '') || '';
            const status = this.mapChangeType(change.changeType);
            let linesAdded = 0;
            let linesRemoved = 0;

            const type = typeof change.changeType === 'string' ? change.changeType.toLowerCase() : change.changeType;

            // Only try to get line counts for first 20 non-binary files
            if (filesToProcess.includes(change) && !this.isBinaryFile(filename)) {
                try {
                    const stats = await this.getFileChangeStats(
                        project,
                        repoName,
                        filename,
                        sha,
                        parentSha,
                        change.changeType
                    );
                    linesAdded = stats.added;
                    linesRemoved = stats.removed;
                } catch (e) {
                    // Silently continue - some files can't be diffed
                }
            } else if (type === 'add' || type === 1) {
                // Estimate for new files we didn't process
                linesAdded = 20;
            } else if (type === 'delete' || type === 2) {
                linesRemoved = 20;
            } else {
                // Estimate for edits we didn't process
                linesAdded = 5;
                linesRemoved = 3;
            }

            totalAdded += linesAdded;
            totalRemoved += linesRemoved;

            files.push({
                filename,
                status,
                linesAdded,
                linesRemoved
            });
        }

        return {
            sha,
            filesChanged: files.length,
            linesAdded: totalAdded,
            linesRemoved: totalRemoved,
            files
        };
    }

    /**
     * Get line change stats for a single file
     */
    async getFileChangeStats(project, repoName, filePath, sha, parentSha, changeType) {
        const type = typeof changeType === 'string' ? changeType.toLowerCase() : changeType;

        // For new files, count all lines as added
        if (type === 'add' || type === 1) {
            try {
                const response = await this.client.get(
                    `/${project}/_apis/git/repositories/${repoName}/items?path=/${filePath}&versionDescriptor.version=${sha}&versionDescriptor.versionType=commit&api-version=6.0`,
                    { responseType: 'text' }
                );
                const content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                const lines = content.split('\n').length;
                return { added: lines, removed: 0 };
            } catch (e) {
                return { added: 50, removed: 0 }; // Estimate
            }
        }

        // For deleted files, count all lines as removed  
        if (type === 'delete' || type === 2) {
            if (!parentSha) return { added: 0, removed: 50 };
            try {
                const response = await this.client.get(
                    `/${project}/_apis/git/repositories/${repoName}/items?path=/${filePath}&versionDescriptor.version=${parentSha}&versionDescriptor.versionType=commit&api-version=6.0`,
                    { responseType: 'text' }
                );
                const content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                const lines = content.split('\n').length;
                return { added: 0, removed: lines };
            } catch (e) {
                return { added: 0, removed: 50 }; // Estimate
            }
        }

        // For edits, we try to fetch both versions to compare line counts
        if (type === 'edit' || type === 16) {
            if (!parentSha) return { added: 10, removed: 5 };
            try {
                // Fetch new content
                const newResponse = await this.client.get(
                    `/${project}/_apis/git/repositories/${repoName}/items?path=/${filePath}&versionDescriptor.version=${sha}&versionDescriptor.versionType=commit&api-version=6.0`,
                    { responseType: 'text' }
                );
                const newContent = typeof newResponse.data === 'string' ? newResponse.data : JSON.stringify(newResponse.data);
                const newLines = newContent.split('\n');

                // Fetch old content
                const oldResponse = await this.client.get(
                    `/${project}/_apis/git/repositories/${repoName}/items?path=/${filePath}&versionDescriptor.version=${parentSha}&versionDescriptor.versionType=commit&api-version=6.0`,
                    { responseType: 'text' }
                );
                const oldContent = typeof oldResponse.data === 'string' ? oldResponse.data : JSON.stringify(oldResponse.data);
                const oldLines = oldContent.split('\n');

                // Simple diff approximation: usage difference in lengths
                // Proper diffing is too expensive for many files, but this gives the net change accurately
                // and estimates added/removed based on the difference
                const diff = newLines.length - oldLines.length;

                if (diff > 0) {
                    return { added: diff + 5, removed: 5 }; // Net positive + small churn
                } else if (diff < 0) {
                    return { added: 5, removed: Math.abs(diff) + 5 }; // Net negative + small churn
                } else {
                    return { added: 5, removed: 5 }; // Changed lines but same count
                }
            } catch (e) {
                return { added: 15, removed: 10 }; // Fallback estimate
            }
        }

        return { added: 0, removed: 0 };
    }

    /**
     * Check if file is likely binary
     */
    isBinaryFile(filename) {
        const binaryExtensions = [
            '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp',
            '.zip', '.tar', '.gz', '.rar', '.7z',
            '.exe', '.dll', '.so', '.dylib',
            '.pdf', '.doc', '.docx', '.xls', '.xlsx',
            '.ttf', '.otf', '.woff', '.woff2', '.eot',
            '.mp3', '.mp4', '.avi', '.mov', '.wav',
            '.psd', '.ai', '.sketch'
        ];
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return binaryExtensions.includes(ext);
    }

    /**
     * Get commit diff
     */
    /**
     * Get commit diff
     */
    async getCommitDiff(repoFullName, sha) {
        const [project, repoName] = repoFullName.split('/');

        try {
            // Get the commit to find parent
            const commitResponse = await this.client.get(
                `/${project}/_apis/git/repositories/${repoName}/commits/${sha}?api-version=6.0`
            );

            const commit = commitResponse.data;
            const parentSha = commit.parents?.[0];

            if (!parentSha) {
                // Initial commit - no diff available
                return '';
            }

            // Get diff between parent and this commit
            const response = await this.client.get(
                `/${project}/_apis/git/repositories/${repoName}/diffs/commits?baseVersion=${parentSha}&targetVersion=${sha}&api-version=6.0`
            );

            // Azure DevOps doesn't return unified diff format directly
            // We need to construct it from the changes
            const changes = response.data.changes || [];
            let diffContent = '';

            for (const change of changes) {
                if (change.item?.path) {
                    diffContent += `diff --git a${change.item.path} b${change.item.path}\n`;
                    diffContent += `--- a${change.item.path}\n`;
                    diffContent += `+++ b${change.item.path}\n`;
                    // Note: Full diff content would require fetching each file's content
                    // which is too slow for real-time analysis
                }
            }

            if (!diffContent) {
                return 'No changes found in diff (Azure DevOps diff API limitation).';
            }

            return diffContent;

        } catch (error) {
            console.error(`Azure DevOps Diff Error (${repoFullName}/${sha}):`, error.message);
            if (error.response?.status === 404) {
                throw new Error(`Commit or repository not found on Azure DevOps (${repoFullName})`);
            }
            throw new Error(`Failed to fetch diff from Azure DevOps: ${error.message}`);
        }
    }

    /**
     * Map Azure DevOps change type to standard status
     */
    mapChangeType(changeType) {
        const typeMap = {
            'add': 'added',
            'edit': 'modified',
            'delete': 'deleted',
            'rename': 'renamed'
        };
        return typeMap[changeType?.toLowerCase()] || 'modified';
    }
}

module.exports = AzureDevOpsClient;
