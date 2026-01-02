/**
 * Main Application Module
 * Handles routing, state management, and initialization
 */

const App = {
    currentPage: null,
    dateRange: {
        from: null,
        to: null,
        preset: '7days'
    },

    /**
     * Initialize the application
     */
    init() {
        this.initDateRange();
        this.initNavigation();
        this.initDatePicker();
        this.initSyncButton();
        this.handleInitialRoute();

        // Handle browser back/forward
        window.addEventListener('popstate', () => this.handleRoute());
    },

    /**
     * Initialize default date range (last 7 days)
     */
    initDateRange() {
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        this.dateRange.from = this.formatDate(weekAgo);
        this.dateRange.to = this.formatDate(today);

        document.getElementById('date-from').value = this.dateRange.from;
        document.getElementById('date-to').value = this.dateRange.to;
    },

    /**
     * Initialize navigation links
     */
    initNavigation() {
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                this.navigate(href);
            });
        });
    },

    /**
     * Initialize date picker dropdown
     */
    initDatePicker() {
        const btn = document.getElementById('date-range-btn');
        const dropdown = document.getElementById('date-range-dropdown');

        btn.addEventListener('click', () => {
            dropdown.classList.toggle('open');
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.date-range-picker')) {
                dropdown.classList.remove('open');
            }
        });

        // Preset buttons
        document.querySelectorAll('.date-presets button').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                this.setDatePreset(preset);

                // Update active state
                document.querySelectorAll('.date-presets button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Apply custom date
        document.getElementById('apply-date-range').addEventListener('click', () => {
            const from = document.getElementById('date-from').value;
            const to = document.getElementById('date-to').value;

            if (from && to) {
                this.dateRange.from = from;
                this.dateRange.to = to;
                this.dateRange.preset = 'custom';
                this.updateDateRangeText();
                dropdown.classList.remove('open');
                this.refreshCurrentPage();
            }
        });
    },

    /**
     * Set date range from preset
     */
    setDatePreset(preset) {
        const today = new Date();
        let from = new Date();

        switch (preset) {
            case 'today':
                from = new Date(today);
                break;
            case '7days':
                from.setDate(today.getDate() - 7);
                break;
            case '14days':
                from.setDate(today.getDate() - 14);
                break;
            case '30days':
                from.setDate(today.getDate() - 30);
                break;
            case 'thisMonth':
                from = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'lastMonth':
                from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                today.setDate(0); // Last day of previous month
                break;
        }

        this.dateRange.from = this.formatDate(from);
        this.dateRange.to = this.formatDate(today);
        this.dateRange.preset = preset;

        document.getElementById('date-from').value = this.dateRange.from;
        document.getElementById('date-to').value = this.dateRange.to;

        this.updateDateRangeText();
        document.getElementById('date-range-dropdown').classList.remove('open');
        this.refreshCurrentPage();
    },

    /**
     * Update date range button text
     */
    updateDateRangeText() {
        const presetNames = {
            'today': 'Today',
            '7days': 'Last 7 days',
            '14days': 'Last 14 days',
            '30days': 'Last 30 days',
            'thisMonth': 'This month',
            'lastMonth': 'Last month',
            'custom': `${this.dateRange.from} - ${this.dateRange.to}`
        };

        document.getElementById('date-range-text').textContent =
            presetNames[this.dateRange.preset] || 'Select dates';
    },

    /**
     * Initialize sync button
     */
    initSyncButton() {
        document.getElementById('sync-btn').addEventListener('click', () => {
            this.showSyncModal();
        });
    },

    /**
     * Show sync modal
     */
    async showSyncModal() {
        const content = `
            <div class="sync-options">
                <h3>Sync Options</h3>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="sync-repos" checked>
                        Sync repositories from all platforms
                    </label>
                </div>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="sync-branches">
                        Sync branches for selected repositories
                    </label>
                </div>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="sync-commits" checked>
                        Sync commits for selected repositories
                    </label>
                </div>
                
                <div class="form-group" id="commit-date-range">
                    <label>Date range for commits:</label>
                    <div class="flex gap-2 mt-2">
                        <input type="date" id="sync-from" value="${this.dateRange.from}">
                        <span>to</span>
                        <input type="date" id="sync-to" value="${this.dateRange.to}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="sync-force">
                        Force re-sync (ignore previous sync data)
                    </label>
                </div>
                
                <div class="sync-progress hidden" id="sync-progress">
                    <div class="sync-progress-bar">
                        <div class="sync-progress-fill" id="sync-progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="sync-status" id="sync-status">Preparing...</div>
                </div>
                
                <div class="flex justify-between mt-4">
                    <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
                    <button class="btn btn-primary" id="start-sync-btn">Start Sync</button>
                </div>
            </div>
        `;

        Modal.open('Sync Data', content);

        document.getElementById('start-sync-btn').addEventListener('click', () => this.startSync());
    },

    /**
     * Start sync process
     */
    async startSync() {
        const syncRepos = document.getElementById('sync-repos').checked;
        const syncBranches = document.getElementById('sync-branches').checked;
        const syncCommits = document.getElementById('sync-commits').checked;
        const from = document.getElementById('sync-from').value;
        const to = document.getElementById('sync-to').value;
        const force = document.getElementById('sync-force').checked;

        const progressEl = document.getElementById('sync-progress');
        const fillEl = document.getElementById('sync-progress-fill');
        const statusEl = document.getElementById('sync-status');
        const startBtn = document.getElementById('start-sync-btn');

        progressEl.classList.remove('hidden');
        startBtn.disabled = true;

        try {
            let step = 0;
            const totalSteps = (syncRepos ? 1 : 0) + (syncBranches ? 1 : 0) + (syncCommits ? 1 : 0);

            if (syncRepos) {
                statusEl.textContent = 'Syncing repositories...';
                fillEl.style.width = `${(step / totalSteps) * 100}%`;
                const result = await API.repositories.sync();
                Toast.show(`Synced ${result.success} repositories`, 'success');
                step++;
            }

            if (syncBranches) {
                statusEl.textContent = 'Syncing branches...';
                fillEl.style.width = `${(step / totalSteps) * 100}%`;
                const result = await API.branches.sync();
                Toast.show(`Synced ${result.success} branches`, 'success');
                step++;
            }

            if (syncCommits) {
                statusEl.textContent = 'Starting commit sync...';
                fillEl.style.width = `${(step / totalSteps) * 100}%`;

                const onProgress = (data) => {
                    if (data.message) {
                        statusEl.textContent = data.message;
                    }
                };

                const result = await API.commits.sync(from, to, force, onProgress);
                Toast.show(`Synced ${result.success} commits`, 'success');
                step++;
            }

            fillEl.style.width = '100%';
            statusEl.textContent = 'Sync complete!';

            setTimeout(() => {
                Modal.close();
                this.refreshCurrentPage();
            }, 1000);

        } catch (error) {
            Toast.show(`Sync failed: ${error.message}`, 'error');
            statusEl.textContent = `Error: ${error.message}`;
            startBtn.disabled = false;
        }
    },

    /**
     * Navigate to a page
     */
    navigate(path) {
        history.pushState(null, '', path);
        this.handleRoute();
    },

    /**
     * Handle initial route on page load
     */
    handleInitialRoute() {
        this.handleRoute();
    },

    /**
     * Handle route change
     */
    handleRoute() {
        const path = window.location.pathname;
        const page = this.getPageFromPath(path);

        this.setActivePage(page);
        this.loadPage(page);
    },

    /**
     * Get page name from path
     */
    getPageFromPath(path) {
        const routes = {
            '/': 'dashboard',
            '/repositories': 'repositories',
            '/developers': 'developers',
            '/commits': 'commits',
            '/analytics': 'analytics',
            '/settings': 'settings',
            '/export': 'export'
        };

        return routes[path] || 'dashboard';
    },

    /**
     * Set active navigation item
     */
    setActivePage(page) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update page title
        const titles = {
            'dashboard': 'Dashboard',
            'repositories': 'Repositories',
            'developers': 'Developers',
            'commits': 'Commits',
            'analytics': 'Analytics',
            'settings': 'Settings',
            'export': 'Export'
        };

        document.getElementById('page-title').textContent = titles[page] || 'Git Analyzer';
    },

    /**
     * Load page content
     */
    async loadPage(page) {
        this.currentPage = page;
        const contentEl = document.getElementById('page-content');

        // Show loading
        contentEl.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading...</p>
            </div>
        `;

        try {
            const pageModules = {
                'dashboard': DashboardPage,
                'repositories': RepositoriesPage,
                'developers': DevelopersPage,
                'commits': CommitsPage,
                'analytics': AnalyticsPage,
                'settings': SettingsPage,
                'export': ExportPage
            };

            const pageModule = pageModules[page];
            if (pageModule && pageModule.render) {
                await pageModule.render(contentEl, this.dateRange);
            } else {
                contentEl.innerHTML = `<div class="empty-state"><h3>Page not found</h3></div>`;
            }
        } catch (error) {
            console.error('Error loading page:', error);
            contentEl.innerHTML = `
                <div class="empty-state">
                    <h3>Error loading page</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    },

    /**
     * Refresh current page
     */
    refreshCurrentPage() {
        if (this.currentPage) {
            this.loadPage(this.currentPage);
        }
    },

    /**
     * Format date as YYYY-MM-DD
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }
};

// Toast notification helper
const Toast = {
    show(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Make App globally available
window.App = App;
window.Toast = Toast;
