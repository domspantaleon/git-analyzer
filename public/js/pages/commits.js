/**
 * Commits Page
 * View and filter commits with detail modal
 */

const CommitsPage = {
    currentPage: 1,
    limit: 50,
    filters: {},

    async render(container, dateRange) {
        this.filters = {
            from: dateRange.from,
            to: dateRange.to
        };

        container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div class="flex gap-2 flex-wrap">
                    <select id="developer-filter" style="width: 180px;">
                        <option value="">All Developers</option>
                    </select>
                    <select id="repo-filter" style="width: 200px;">
                        <option value="">All Repositories</option>
                    </select>
                    <select id="flag-filter" style="width: 150px;">
                        <option value="">All Flags</option>
                        <option value="small_vague_commit">Vague</option>
                        <option value="config_only">Config Only</option>
                        <option value="comment_only">Comment Only</option>
                        <option value="large_commit">Large</option>
                        <option value="possible_copy_paste">Copy-Paste</option>
                        <option value="possible_ai_generated">AI Generated?</option>
                    </select>
                </div>
            </div>
            
            <div class="card">
                <div id="commits-table">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>Loading commits...</p>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        await this.loadFilters();
        await this.loadCommits();
    },

    setupEventListeners() {
        ['developer-filter', 'repo-filter', 'flag-filter'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.currentPage = 1;
                this.loadCommits();
            });
        });
    },

    async loadFilters() {
        try {
            const [developers, repos] = await Promise.all([
                API.developers.list({ active_only: true }),
                API.repositories.list({ is_selected: true })
            ]);

            const devSelect = document.getElementById('developer-filter');
            developers.forEach(d => {
                const option = document.createElement('option');
                option.value = d.id;
                option.textContent = d.canonical_name;
                devSelect.appendChild(option);
            });

            const repoSelect = document.getElementById('repo-filter');
            repos.forEach(r => {
                const option = document.createElement('option');
                option.value = r.id;
                option.textContent = r.full_name;
                repoSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Failed to load filters:', error);
        }
    },

    async loadCommits() {
        const tableContainer = document.getElementById('commits-table');

        const params = {
            from: this.filters.from,
            to: this.filters.to,
            page: this.currentPage,
            limit: this.limit
        };

        const developerId = document.getElementById('developer-filter').value;
        const repoId = document.getElementById('repo-filter').value;
        const flagType = document.getElementById('flag-filter').value;

        if (developerId) params.developer_id = developerId;
        if (repoId) params.repository_id = repoId;
        if (flagType) params.has_flag = flagType;

        try {
            const result = await API.commits.list(params);

            if (!result.data || result.data.length === 0) {
                tableContainer.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="4"></circle>
                            <line x1="1.05" y1="12" x2="7" y2="12"></line>
                            <line x1="17.01" y1="12" x2="22.96" y2="12"></line>
                        </svg>
                        <h3>No commits found</h3>
                        <p>Try adjusting your filters or sync more commits.</p>
                    </div>
                `;
                return;
            }

            const table = Table.create({
                columns: [
                    {
                        key: 'committed_at',
                        label: 'Date',
                        width: '140px',
                        render: (val) => Table.formatDateTime(val)
                    },
                    {
                        key: 'developer_name',
                        label: 'Developer',
                        render: (val) => val || 'Unknown'
                    },
                    {
                        key: 'repo_full_name',
                        label: 'Repository',
                        render: (val) => `<span class="text-muted">${val}</span>`
                    },
                    {
                        key: 'message',
                        label: 'Message',
                        render: (val) => {
                            const firstLine = (val || '').split('\n')[0];
                            return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
                        }
                    },
                    {
                        key: 'lines_added',
                        label: '+',
                        align: 'right',
                        width: '60px',
                        render: (val) => `<span class="text-success">+${val || 0}</span>`
                    },
                    {
                        key: 'lines_removed',
                        label: '-',
                        align: 'right',
                        width: '60px',
                        render: (val) => `<span class="text-danger">-${val || 0}</span>`
                    },
                    {
                        key: 'files_changed',
                        label: 'Files',
                        align: 'right',
                        width: '50px'
                    },
                    {
                        key: 'flags',
                        label: 'Flags',
                        render: (val) => Table.renderFlags(val)
                    }
                ],
                data: result.data,
                onRowClick: (row) => this.showCommitDetail(row.id),
                pagination: {
                    page: result.pagination.page,
                    pages: result.pagination.pages,
                    total: result.pagination.total,
                    onPageChange: (newPage) => {
                        this.currentPage = newPage;
                        this.loadCommits();
                    }
                }
            });

            tableContainer.innerHTML = '';
            tableContainer.appendChild(table);

        } catch (error) {
            tableContainer.innerHTML = `
                <div class="empty-state">
                    <h3>Error loading commits</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    },

    async showCommitDetail(commitId) {
        try {
            const commit = await API.commits.get(commitId);

            const flagLabels = {
                'small_vague_commit': { label: 'Vague Commit', desc: 'Small commit with vague message' },
                'config_only': { label: 'Config Only', desc: 'Only configuration files changed' },
                'comment_only': { label: 'Comment Only', desc: 'Only comments changed' },
                'large_commit': { label: 'Large Commit', desc: 'Many files or lines changed' },
                'possible_copy_paste': { label: 'Possible Copy-Paste', desc: 'Duplicate code detected' },
                'possible_ai_generated': { label: 'Possible AI', desc: 'Patterns suggest AI-generated code' }
            };

            const content = `
                <div class="commit-detail">
                    <div class="mb-4">
                        <div class="flex items-center gap-2 mb-2">
                            <code>${commit.sha?.substring(0, 8)}</code>
                            <span class="text-muted">by</span>
                            <strong>${commit.developer_name || commit.author_name || 'Unknown'}</strong>
                        </div>
                        <div class="text-muted mb-2">
                            ${commit.repo_full_name} / ${commit.branch_name || 'unknown'} • 
                            ${Table.formatDateTime(commit.committed_at)}
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <h4>Message</h4>
                        <pre style="white-space: pre-wrap; background: var(--bg-tertiary); padding: 12px; border-radius: 6px; margin-top: 8px;">${commit.message || 'No message'}</pre>
                    </div>
                    
                    <div class="stats-grid mb-4" style="grid-template-columns: repeat(4, 1fr);">
                        <div class="stat-card">
                            <div class="stat-label">Lines Added</div>
                            <div class="stat-value success">+${commit.lines_added || 0}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Lines Removed</div>
                            <div class="stat-value danger">-${commit.lines_removed || 0}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Net Lines</div>
                            <div class="stat-value">${commit.lines_net || 0}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Files Changed</div>
                            <div class="stat-value">${commit.files_changed || 0}</div>
                        </div>
                    </div>
                    
                    ${commit.flags && commit.flags.length > 0 ? `
                        <div class="mb-4">
                            <h4>Flags</h4>
                            <div class="mt-2">
                                ${commit.flags.map(f => `
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="flag-badge ${f.flag_type}">${flagLabels[f.flag_type]?.label || f.flag_type}</span>
                                        <span class="text-muted">${flagLabels[f.flag_type]?.desc || ''}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="tabs">
                        <button class="tab active" data-tab="files">Files (${commit.files?.length || 0})</button>
                        <button class="tab" data-tab="diff">Diff</button>
                        <button class="tab" data-tab="ai">AI Summary</button>
                    </div>
                    
                    <div class="tab-content active" id="tab-files">
                        ${commit.files && commit.files.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>File</th>
                                        <th style="text-align: right;">+</th>
                                        <th style="text-align: right;">-</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${commit.files.map(f => `
                                        <tr class="${f.is_excluded ? 'text-muted' : ''}">
                                            <td>${f.filename}${f.is_excluded ? ' (excluded)' : ''}</td>
                                            <td style="text-align: right;" class="text-success">+${f.lines_added || 0}</td>
                                            <td style="text-align: right;" class="text-danger">-${f.lines_removed || 0}</td>
                                            <td>${f.status || 'modified'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<p class="text-muted">No file details available</p>'}
                    </div>
                    
                    <div class="tab-content" id="tab-diff">
                        <button class="btn btn-secondary mb-3" id="load-diff-btn">Load Diff</button>
                        <div id="diff-container"></div>
                    </div>
                    
                    <div class="tab-content" id="tab-ai">
                        <button class="btn btn-secondary mb-3" id="load-ai-btn">Generate AI Summary</button>
                        <div id="ai-container"></div>
                    </div>
                </div>
            `;

            Modal.open('Commit Details', content, { maxWidth: '1000px' });

            // Tab switching
            document.querySelectorAll('.commit-detail .tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.commit-detail .tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.commit-detail .tab-content').forEach(c => c.classList.remove('active'));
                    tab.classList.add('active');
                    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
                });
            });

            // Load diff button
            document.getElementById('load-diff-btn').addEventListener('click', async () => {
                const container = document.getElementById('diff-container');
                const btn = document.getElementById('load-diff-btn');
                btn.disabled = true;
                btn.textContent = 'Loading...';

                try {
                    const result = await API.commits.getDiff(commitId);
                    DiffViewer.createWithTabs(result.diff, container);
                    btn.style.display = 'none';
                } catch (error) {
                    container.innerHTML = `<p class="text-danger">Failed to load diff: ${error.message}</p>`;
                    btn.disabled = false;
                    btn.textContent = 'Retry';
                }
            });

            // Load AI summary button
            document.getElementById('load-ai-btn').addEventListener('click', async () => {
                const container = document.getElementById('ai-container');
                const btn = document.getElementById('load-ai-btn');
                btn.disabled = true;
                btn.textContent = 'Generating...';

                try {
                    const result = await API.commits.getAISummary(commitId);
                    if (result.success) {
                        container.innerHTML = `
                            <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; white-space: pre-wrap;">
                                ${result.summary}
                            </div>
                        `;
                    } else {
                        container.innerHTML = `<p class="text-danger">Failed: ${result.error}</p>`;
                    }
                    btn.style.display = 'none';
                } catch (error) {
                    container.innerHTML = `<p class="text-danger">Failed: ${error.message}</p>`;
                    btn.disabled = false;
                    btn.textContent = 'Retry';
                }
            });

        } catch (error) {
            Toast.show(`Failed to load commit: ${error.message}`, 'error');
        }
    }
};

// Make CommitsPage globally available
window.CommitsPage = CommitsPage;
