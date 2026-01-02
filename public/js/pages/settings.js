/**
 * Settings Page
 * Configure platforms, Ollama, and app settings
 */

const SettingsPage = {
    async render(container, dateRange) {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <!-- Platforms -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Platforms</h3>
                        <button class="btn btn-sm btn-primary" id="add-platform-btn">+ Add Platform</button>
                    </div>
                    <div id="platforms-list">
                        <div class="loading-spinner">
                            <div class="spinner"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Ollama -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Ollama (AI)</h3>
                    </div>
                    <div class="form-group">
                        <label>Endpoint URL</label>
                        <input type="url" id="ollama-endpoint" placeholder="http://localhost:11434">
                    </div>
                    <div class="form-group">
                        <label>Model</label>
                        <input type="text" id="ollama-model" placeholder="llama3">
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-secondary" id="test-ollama-btn">Test Connection</button>
                        <button class="btn btn-primary" id="save-ollama-btn">Save</button>
                    </div>
                    <div id="ollama-status" class="mt-2"></div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mt-4">
                <!-- General Settings -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">General Settings</h3>
                    </div>
                    <div class="form-group">
                        <label>Default Date Range (days)</label>
                        <input type="number" id="default-days" min="1" max="365">
                    </div>
                    <div class="form-group">
                        <label>Timezone</label>
                        <select id="timezone">
                            <option value="Asia/Manila">Asia/Manila</option>
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">America/New_York</option>
                            <option value="Europe/London">Europe/London</option>
                        </select>
                    </div>
                    <button class="btn btn-primary" id="save-general-btn">Save</button>
                </div>
                
                <!-- Data Management -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Data Management</h3>
                    </div>
                    <p class="text-muted mb-3">Manage your local database and data.</p>
                    <div class="flex gap-2 flex-col">
                        <button class="btn btn-danger" id="clear-data-btn">
                            Clear All Data
                        </button>
                    </div>
                </div>
            </div>
            </div>

            <div class="mt-8 text-center border-t border-gray-700 pt-6">
                <p class="text-lg font-semibold text-gray-400">Azure Git Analyzer</p>
                <p class="text-muted mb-3">&copy; ${new Date().getFullYear()} Dom Pantaleon</p>
                
                <a href="https://buymeacoffee.com/titodomph" target="_blank" class="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-300 transition-colors font-medium">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M20.216 6.415l-.132-.666c-.119-.596-.387-1.143-.79-1.597-.981-1.103-2.618-1.503-4.223-1.077l-9.03 2.392c-1.637.433-2.614 2.109-2.181 3.746l.132.666c.119.596.387 1.143.79 1.597.981 1.103 2.618 1.503 4.223 1.077l9.03-2.392c1.637-.433 2.614-2.109 2.181-3.746zM7.41 8.527c-.433-1.637.544-3.313 2.181-3.746l7.85-2.079c1.637-.433 3.313.544 3.746 2.181l.132.666c.433 1.637-.544 3.313-2.181 3.746l-7.85 2.079c-1.637.433-3.313-.544-3.746-2.181l-.132-.666zM19.5 14c-1.105 0-2-.895-2-2 0-.223.037-.436.104-.635l-2.07-5.068-1.52.404 1.74 4.264c.147.36.035.776-.263 1.026-.298.25-.724.28-1.053.076l-8.38-5.185-.758 1.35 9.07 5.614c.454.28.948.455 1.5.52.274.981 1.171 1.667 2.222 1.667 1.282 0 2.308-1.026 2.308-2.308 0-1.137-.81-2.083-1.89-2.275zm-1.5-1.5c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5-1.5-.672-1.5-1.5.672-1.5 1.5-1.5z"/>
                    </svg>
                    Buy me a coffee
                </a>
            </div>
        `;

        this.setupEventListeners();
        await this.loadSettings();
        await this.loadPlatforms();
    },

    setupEventListeners() {
        document.getElementById('add-platform-btn').addEventListener('click', () => this.showPlatformModal());
        document.getElementById('test-ollama-btn').addEventListener('click', () => this.testOllama());
        document.getElementById('save-ollama-btn').addEventListener('click', () => this.saveOllama());
        document.getElementById('save-general-btn').addEventListener('click', () => this.saveGeneral());
        document.getElementById('clear-data-btn').addEventListener('click', () => this.clearData());
    },

    async loadSettings() {
        try {
            const settings = await API.settings.get();

            document.getElementById('ollama-endpoint').value = settings.ollama_endpoint || 'http://localhost:11434';
            document.getElementById('ollama-model').value = settings.ollama_model || 'llama3';
            document.getElementById('default-days').value = settings.default_date_range_days || 7;
            document.getElementById('timezone').value = settings.timezone || 'Asia/Manila';

        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    },

    async loadPlatforms() {
        const container = document.getElementById('platforms-list');

        try {
            const platforms = await API.platforms.list();

            if (platforms.length === 0) {
                container.innerHTML = `
                    <p class="text-muted">No platforms configured. Add one to get started.</p>
                `;
                return;
            }

            container.innerHTML = platforms.map(p => `
                <div class="flex items-center justify-between mb-3 p-3" style="background: var(--bg-tertiary); border-radius: 6px;">
                    <div class="flex items-center gap-3">
                        ${Table.renderPlatformIcon(p.type)}
                        <div>
                            <strong>${p.name}</strong>
                            <div class="text-muted text-sm">${p.url}</div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-sm btn-secondary" onclick="SettingsPage.testPlatform(${p.id})">Test</button>
                        <button class="btn btn-sm btn-secondary" onclick="SettingsPage.showPlatformModal(${p.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="SettingsPage.deletePlatform(${p.id})">Delete</button>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            container.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
        }
    },

    showPlatformModal(platformId = null) {
        const isEdit = platformId !== null;

        const content = `
            <form id="platform-form">
                <div class="form-group">
                    <label>Platform Type</label>
                    <select id="platform-type" required ${isEdit ? 'disabled' : ''}>
                        <option value="">Select type...</option>
                        <option value="azure_devops">Azure DevOps</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Display Name</label>
                    <input type="text" id="platform-name" required placeholder="My Organization">
                </div>
                
                <div class="form-group">
                    <label>URL / Organization</label>
                    <input type="text" id="platform-url" required placeholder="https://dev.azure.com/myorg">
                    <small class="text-muted">
                        Azure: dev.azure.com/org or org.visualstudio.com<br>

                    </small>
                </div>
                
                <div class="form-group" id="username-group" style="display: none;">
                    <label>Username</label>
                    <input type="text" id="platform-username" placeholder="Your username (for Azure DevOps basic auth)">
                    <small class="text-muted">Required for Azure DevOps when using username/password auth</small>
                </div>
                
                <div class="form-group">
                    <label id="token-label">Personal Access Token (PAT)</label>
                    <input type="password" id="platform-token" required placeholder="Your PAT or password">
                </div>
                
                <div class="flex justify-between mt-4">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Add'} Platform</button>
                </div>
            </form>
        `;

        Modal.open(isEdit ? 'Edit Platform' : 'Add Platform', content, { maxWidth: '500px' });

        // Show/hide username field based on platform type
        const typeSelect = document.getElementById('platform-type');
        const usernameGroup = document.getElementById('username-group');
        const tokenLabel = document.getElementById('token-label');

        const updateUsernameVisibility = () => {
            if (typeSelect.value === 'azure_devops') {
                usernameGroup.style.display = 'block';
                tokenLabel.textContent = 'Password or PAT';
            } else {
                usernameGroup.style.display = 'none';
                tokenLabel.textContent = 'Personal Access Token (PAT)';
            }
        };

        typeSelect.addEventListener('change', updateUsernameVisibility);

        // If editing, load existing data
        if (isEdit) {
            API.platforms.list().then(platforms => {
                const p = platforms.find(x => x.id === platformId);
                if (p) {
                    document.getElementById('platform-type').value = p.type;
                    document.getElementById('platform-name').value = p.name;
                    document.getElementById('platform-url').value = p.url;
                    if (p.username) {
                        document.getElementById('platform-username').value = p.username;
                    }
                    updateUsernameVisibility();
                }
            });
        }

        document.getElementById('platform-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = {
                type: document.getElementById('platform-type').value,
                name: document.getElementById('platform-name').value,
                url: document.getElementById('platform-url').value,
                token: document.getElementById('platform-token').value
            };

            // Add username for Azure DevOps
            if (data.type === 'azure_devops') {
                data.username = document.getElementById('platform-username').value || null;
            }

            try {
                if (isEdit) {
                    await API.platforms.update(platformId, data);
                    Toast.show('Platform updated', 'success');
                } else {
                    await API.platforms.create(data);
                    Toast.show('Platform added', 'success');
                }
                Modal.close();
                await this.loadPlatforms();
            } catch (error) {
                Toast.show(`Failed: ${error.message}`, 'error');
            }
        });
    },

    async testPlatform(platformId) {
        if (window.Console) {
            Console.info(`Testing connection for platform #${platformId}...`);
        }

        try {
            const result = await API.platforms.test(platformId);

            if (result.success) {
                if (window.Console) {
                    Console.success(`Connection test passed: ${result.message}`);
                }
                Toast.show(result.message, 'success');
            } else {
                if (window.Console) {
                    Console.error(`Connection test failed: ${result.message}`);
                }
                Toast.show(result.message || 'Connection test failed', 'error');
            }
        } catch (error) {
            if (window.Console) {
                Console.error(`Connection test error: ${error.message}`);
            }
            Toast.show(`Test failed: ${error.message}`, 'error');
        }
    },

    async deletePlatform(platformId) {
        const confirmed = await Modal.confirm(
            'Delete Platform',
            'Are you sure you want to delete this platform? This will also delete all associated repositories and commits.',
            { danger: true, confirmText: 'Delete' }
        );

        if (confirmed) {
            try {
                await API.platforms.delete(platformId);
                Toast.show('Platform deleted', 'success');
                await this.loadPlatforms();
            } catch (error) {
                Toast.show(`Failed: ${error.message}`, 'error');
            }
        }
    },

    async testOllama() {
        const statusEl = document.getElementById('ollama-status');
        statusEl.innerHTML = '<span class="text-muted">Testing...</span>';

        try {
            // First save the current settings to ensure backend tests with new values
            await this.saveOllama(true); // silent save

            const result = await API.ollama.test();

            if (result.success) {
                statusEl.innerHTML = `<span class="text-success">✓ ${result.message}</span>`;
            } else {
                statusEl.innerHTML = `<span class="text-danger">✗ ${result.message || 'Connection failed'}</span>`;
            }
        } catch (error) {
            statusEl.innerHTML = `<span class="text-danger">✗ ${error.message}</span>`;
        }
    },

    async saveOllama(silent = false) {
        try {
            await API.settings.update({
                ollama_endpoint: document.getElementById('ollama-endpoint').value,
                ollama_model: document.getElementById('ollama-model').value
            });
            if (!silent) Toast.show('Ollama settings saved', 'success');
        } catch (error) {
            if (!silent) Toast.show(`Failed: ${error.message}`, 'error');
            throw error;
        }
    },

    async saveGeneral() {
        try {
            await API.settings.update({
                default_date_range_days: document.getElementById('default-days').value,
                timezone: document.getElementById('timezone').value
            });
            Toast.show('Settings saved', 'success');
        } catch (error) {
            Toast.show(`Failed: ${error.message}`, 'error');
        }
    },

    async clearData() {
        const confirmed = await Modal.confirm(
            'Clear All Data',
            'This will delete ALL data including platforms, repositories, commits, and developers. This cannot be undone!',
            { danger: true, confirmText: 'Clear Everything' }
        );

        if (confirmed) {
            try {
                // Show loading state on button
                const btn = document.getElementById('clear-data-btn');
                const originalText = btn.textContent;
                btn.textContent = 'Clearing...';
                btn.disabled = true;

                await API.settings.clearData();

                Toast.show('All data cleared successfully', 'success');

                // Reset internal state if needed (though reload handles it)
                if (window.App) {
                    window.App.repositories = [];
                    // ... other state resets if App holds big state
                }

                // Reload the page to reset all stores/caches in frontend
                setTimeout(() => {
                    window.location.reload();
                }, 1000);

            } catch (error) {
                Toast.show(`Failed to clear data: ${error.message}`, 'error');
                // Restore button
                const btn = document.getElementById('clear-data-btn');
                if (btn) {
                    btn.textContent = 'Clear All Data';
                    btn.disabled = false;
                }
            }
        }
    }
};

// Make SettingsPage globally available
window.SettingsPage = SettingsPage;
