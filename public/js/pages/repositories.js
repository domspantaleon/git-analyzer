/**
 * Repositories Page
 * List and manage repositories for analysis
 */

const RepositoriesPage = {
    async render(container, dateRange) {
        container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div class="flex gap-2">
                    <select id="platform-filter" class="form-control" style="width: 200px;">
                        <option value="">All Platforms</option>
                    </select>
                    <input type="text" id="repo-search" placeholder="Search repositories..." 
                           style="width: 250px;">
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-secondary" id="select-all-btn">Select All</button>
                    <button class="btn btn-secondary" id="deselect-all-btn">Deselect All</button>
                    <button class="btn btn-primary" id="sync-repos-btn">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        Sync Repositories
                    </button>
                </div>
            </div>
            
            <div class="card">
                <div id="repos-table">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>Loading repositories...</p>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        await this.loadPlatforms();
        await this.loadRepositories();
    },

    setupEventListeners() {
        document.getElementById('platform-filter').addEventListener('change', () => this.loadRepositories());

        document.getElementById('repo-search').addEventListener('input',
            this.debounce(() => this.loadRepositories(), 300)
        );

        document.getElementById('select-all-btn').addEventListener('click', () => this.selectAll(true));
        document.getElementById('deselect-all-btn').addEventListener('click', () => this.selectAll(false));

        document.getElementById('sync-repos-btn').addEventListener('click', async () => {
            const btn = document.getElementById('sync-repos-btn');
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px;"></div> Syncing...';

            try {
                const result = await API.repositories.sync();
                Toast.show(`Synced ${result.success} repositories`, 'success');
                await this.loadRepositories();
            } catch (error) {
                Toast.show(`Sync failed: ${error.message}`, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                    Sync Repositories
                `;
            }
        });
    },

    async loadPlatforms() {
        try {
            const platforms = await API.platforms.list();
            const select = document.getElementById('platform-filter');

            platforms.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id;
                option.textContent = `${p.name} (${p.type})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load platforms:', error);
        }
    },

    async loadRepositories() {
        const tableContainer = document.getElementById('repos-table');
        const platformId = document.getElementById('platform-filter').value;
        const search = document.getElementById('repo-search').value;

        try {
            const params = {};
            if (platformId) params.platform_id = platformId;
            if (search) params.search = search;

            const repos = await API.repositories.list(params);

            if (repos.length === 0) {
                tableContainer.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <h3>No repositories found</h3>
                        <p>Click "Sync Repositories" to fetch repositories from your platforms.</p>
                    </div>
                `;
                return;
            }

            const table = Table.create({
                columns: [
                    {
                        key: 'is_selected',
                        label: '',
                        width: '40px',
                        render: (val, row) => `
                            <input type="checkbox" ${val ? 'checked' : ''} 
                                   data-repo-id="${row.id}" class="repo-checkbox">
                        `
                    },
                    {
                        key: 'platform_type',
                        label: '',
                        width: '40px',
                        render: (val) => Table.renderPlatformIcon(val)
                    },
                    {
                        key: 'full_name',
                        label: 'Repository',
                        render: (val) => `<strong>${val}</strong>`
                    },
                    {
                        key: 'default_branch',
                        label: 'Default Branch',
                        render: (val) => `<code>${val || 'main'}</code>`
                    },
                    {
                        key: 'branch_count',
                        label: 'Branches',
                        align: 'right'
                    },
                    {
                        key: 'commit_count',
                        label: 'Commits',
                        align: 'right',
                        render: (val) => Table.formatNumber(val)
                    },
                    {
                        key: 'last_synced_at',
                        label: 'Last Synced',
                        render: (val) => val ? Table.formatRelative(val) : 'Never'
                    }
                ],
                data: repos
            });

            tableContainer.innerHTML = '';
            tableContainer.appendChild(table);

            // Add checkbox event listeners
            tableContainer.querySelectorAll('.repo-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', async (e) => {
                    const repoId = e.target.dataset.repoId;
                    const selected = e.target.checked;

                    try {
                        await API.repositories.select(repoId, selected);
                    } catch (error) {
                        Toast.show(`Failed to update: ${error.message}`, 'error');
                        e.target.checked = !selected; // Revert
                    }
                });
            });

        } catch (error) {
            tableContainer.innerHTML = `
                <div class="empty-state">
                    <h3>Error loading repositories</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    },

    async selectAll(selected) {
        const platformId = document.getElementById('platform-filter').value || null;

        try {
            await API.repositories.selectAll(selected, platformId);
            Toast.show(selected ? 'All repositories selected' : 'All repositories deselected', 'success');
            await this.loadRepositories();
        } catch (error) {
            Toast.show(`Failed: ${error.message}`, 'error');
        }
    },

    debounce(fn, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }
};

// Make RepositoriesPage globally available
window.RepositoriesPage = RepositoriesPage;
