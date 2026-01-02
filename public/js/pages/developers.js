/**
 * Developers Page
 * View and manage discovered developers
 */

const DevelopersPage = {
    developers: [],
    currentDateRange: {
        type: 'thisMonth', // today, last7, last14, last30, thisMonth, lastMonth
        offset: 0 // for navigating months
    },

    async render(container) {
        container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div class="flex gap-2">
                    <label class="checkbox-label flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" id="active-only" checked class="form-checkbox bg-gray-800 border-gray-700 rounded text-blue-500">
                        <span>Active only</span>
                    </label>
                </div>
            </div>
            
            <div class="card">
                <div id="developers-table">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>Loading developers...</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('active-only').addEventListener('change', () => this.loadDevelopers());
        await this.loadDevelopers();
    },

    getDateRange() {
        const { type, offset } = this.currentDateRange;
        const now = new Date();
        let start = new Date();
        let end = new Date();

        // Helper to shift months
        const addMonths = (date, months) => {
            const d = new Date(date);
            d.setMonth(d.getMonth() + months);
            return d;
        };

        switch (type) {
            case 'today':
                start.setDate(now.getDate() + offset);
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
                start.setHours(0, 0, 0, 0);
                break;
            case 'last7':
                end = new Date();
                end.setDate(now.getDate() + (offset * 7));
                start = new Date(end);
                start.setDate(end.getDate() - 6);
                break;
            case 'last14':
                end.setDate(now.getDate() + (offset * 14));
                start = new Date(end);
                start.setDate(end.getDate() - 13);
                break;
            case 'last30':
                end.setDate(now.getDate() + (offset * 30));
                start = new Date(end);
                start.setDate(end.getDate() - 29);
                break;
            case 'thisMonth':
            case 'lastMonth':
                let baseOffset = type === 'lastMonth' ? -1 : 0;
                let targetDate = addMonths(now, baseOffset + offset);
                start = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
                end = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
                end.setHours(23, 59, 59, 999);
                break;
        }

        const fmt = d => d.toISOString().split('T')[0];
        return { start: fmt(start), end: fmt(end), startObj: start, endObj: end };
    },

    async loadDevelopers() {
        const tableContainer = document.getElementById('developers-table');
        const activeOnly = document.getElementById('active-only')?.checked ?? true;

        try {
            this.developers = await API.developers.list({ active_only: activeOnly });

            if (this.developers.length === 0) {
                tableContainer.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                        </svg>
                        <h3>No developers found</h3>
                        <p>Developers are discovered when you sync commits.</p>
                    </div>
                `;
                return;
            }

            const table = Table.create({
                columns: [
                    {
                        key: 'canonical_name',
                        label: 'Developer',
                        render: (val) => `<strong>${val || 'Unknown'}</strong>`
                    },
                    {
                        key: 'emails',
                        label: 'Email(s)',
                        render: (val) => {
                            if (!val) return '-';
                            const emails = val.split(',').slice(0, 2);
                            const more = val.split(',').length > 2 ? ` +${val.split(',').length - 2}` : '';
                            return `<span class="text-muted">${emails.join(', ')}${more}</span>`;
                        }
                    },
                    {
                        key: 'commit_count',
                        label: 'Commits',
                        align: 'right',
                        render: (val) => Table.formatNumber(val)
                    },
                    {
                        key: 'total_lines_added',
                        label: 'Lines Added',
                        align: 'right',
                        render: (val) => `<span class="text-success">+${Table.formatNumber(val || 0)}</span>`
                    },
                    {
                        key: 'total_lines_removed',
                        label: 'Lines Removed',
                        align: 'right',
                        render: (val) => `<span class="text-danger">-${Table.formatNumber(val || 0)}</span>`
                    },
                    {
                        key: 'is_active',
                        label: 'Active',
                        align: 'center',
                        render: (val, row) => `
                            <input type="checkbox" ${val ? 'checked' : ''} 
                                   data-dev-id="${row.id}" class="active-toggle">
                        `
                    },
                    {
                        key: 'id',
                        label: 'Actions',
                        align: 'right',
                        render: (val, row) => `
                            <button class="btn btn-sm btn-secondary" onclick="DevelopersPage.showDetails(${val})">
                                Details
                            </button>
                           
                        `
                    }
                ],
                data: this.developers
            });

            tableContainer.innerHTML = '';
            tableContainer.appendChild(table);

            // Add toggle event listeners
            tableContainer.querySelectorAll('.active-toggle').forEach(toggle => {
                toggle.addEventListener('change', async (e) => {
                    const devId = e.target.dataset.devId;
                    const isActive = e.target.checked;

                    try {
                        await API.developers.update(devId, { is_active: isActive });
                    } catch (error) {
                        Toast.show(`Failed: ${error.message}`, 'error');
                        e.target.checked = !isActive;
                    }
                });
            });

        } catch (error) {
            tableContainer.innerHTML = `
                <div class="empty-state">
                    <h3>Error loading developers</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    },

    async showDetails(developerId) {
        // Store current developer ID for reference during date changes
        this.currentDeveloperId = developerId;

        try {
            const identities = await API.developers.getIdentities(developerId);
            const dev = this.developers.find(d => d.id === developerId);
            const { start, end } = this.getDateRange();

            const content = `
                <div class="developer-details" data-developer-id="${developerId}">
                    <!-- Date Range Controls -->
                    <div class="flex items-center gap-4 mb-4 p-3 bg-gray-800 rounded border border-gray-700">
                        <select id="modal-date-range-select" class="form-select bg-gray-900 text-white border border-gray-600 rounded p-2" onchange="DevelopersPage.handleModalRangeChange(this.value)">
                            <option value="today" ${this.currentDateRange.type === 'today' ? 'selected' : ''}>Today</option>
                            <option value="last7" ${this.currentDateRange.type === 'last7' ? 'selected' : ''}>Last 7 Days</option>
                            <option value="last14" ${this.currentDateRange.type === 'last14' ? 'selected' : ''}>Last 14 Days</option>
                            <option value="last30" ${this.currentDateRange.type === 'last30' ? 'selected' : ''}>Last 30 Days</option>
                            <option value="thisMonth" ${this.currentDateRange.type === 'thisMonth' ? 'selected' : ''}>This Month</option>
                            <option value="lastMonth" ${this.currentDateRange.type === 'lastMonth' ? 'selected' : ''}>Last Month</option>
                        </select>
                        
                        <div class="flex items-center gap-2">
                            <button class="btn btn-sm btn-secondary" onclick="DevelopersPage.navigateModalDate(-1)">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                            </button>
                            <span id="modal-date-label" class="text-sm font-mono min-w-[200px] text-center"></span>
                            <button class="btn btn-sm btn-secondary" onclick="DevelopersPage.navigateModalDate(1)">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        </div>
                    </div>

                    <div class="tabs mb-4">
                        <button class="tab active" onclick="DevelopersPage.switchTab('breakdown')">Daily Breakdown</button>
                        <button class="tab" onclick="DevelopersPage.switchTab('activity')">Activity</button>
                        <button class="tab" onclick="DevelopersPage.switchTab('profile')">Profile</button>
                    </div>

                    <div id="tab-breakdown" class="tab-content active">
                        <div id="daily-breakdown">
                            <div class="loading-spinner">
                                <div class="spinner"></div>
                                <p>Loading breakdown...</p>
                            </div>
                        </div>
                    </div>

                    <div id="tab-activity" class="tab-content">
                        <div class="flex justify-between items-center mb-4">
                            <h3>Activity Timeline</h3>
                            <div class="flex gap-2">
                                <select id="activity-limit" onchange="DevelopersPage.loadDeveloperActivity(${developerId})">
                                    <option value="50">Last 50 commits</option>
                                    <option value="100">Last 100 commits</option>
                                    <option value="0" selected>All in range</option>
                                </select>
                            </div>
                        </div>
                        <div id="activity-timeline" class="activity-timeline">
                            <div class="loading-spinner">
                                <div class="spinner"></div>
                                <p>Loading activity...</p>
                            </div>
                        </div>
                    </div>

                    <div id="tab-profile" class="tab-content">
                        <div class="mb-4">
                            <h4>Canonical Name</h4>
                            <div class="flex gap-2 mt-2">
                                <input type="text" id="edit-name" value="${dev?.canonical_name || ''}" style="flex: 1;">
                                <button class="btn btn-primary" onclick="DevelopersPage.updateName(${developerId})">Save</button>
                            </div>
                        </div>
                        
                        <h4>Associated Identities</h4>
                        <table class="mt-2 text-sm w-full">
                            <thead>
                                <tr>
                                    <th class="text-left p-2">Name</th>
                                    <th class="text-left p-2">Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${identities.map(i => `
                                    <tr class="border-b border-gray-700">
                                        <td class="p-2">${i.name}</td>
                                        <td class="p-2">${i.email}</td>
                                    </tr>
                                `).join('') || '<tr><td colspan="2" class="p-2">No identities found</td></tr>'}
                            </tbody>
                        </table>
                        
                        <div class="mt-4">
                            <h4>All-Time Stats</h4>
                            <div class="grid grid-cols-3 gap-4 mt-2">
                                <div class="stat-card p-3 bg-tertiary rounded">
                                    <div class="text-xs text-muted uppercase">Commits</div>
                                    <div class="text-xl font-bold">${Table.formatNumber(dev?.commit_count || 0)}</div>
                                </div>
                                <div class="stat-card p-3 bg-tertiary rounded">
                                    <div class="text-xs text-muted uppercase">Added</div>
                                    <div class="text-xl font-bold text-success">+${Table.formatNumber(dev?.total_lines_added || 0)}</div>
                                </div>
                                <div class="stat-card p-3 bg-tertiary rounded">
                                    <div class="text-xs text-muted uppercase">Removed</div>
                                    <div class="text-xl font-bold text-danger">-${Table.formatNumber(dev?.total_lines_removed || 0)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            Modal.open(dev?.canonical_name || 'Developer Details', content, {
                fullScreen: false,
                allowExpand: true,
                maxWidth: '1200px'
            });

            // Update date label and load activity
            this.updateModalDateLabel();
            this.loadDeveloperActivity(developerId);

        } catch (error) {
            Toast.show(`Failed to load details: ${error.message}`, 'error');
        }
    },

    handleModalRangeChange(type) {
        this.currentDateRange.type = type;
        this.currentDateRange.offset = 0;
        this.updateModalDateLabel();
        if (this.currentDeveloperId) {
            this.loadDeveloperActivity(this.currentDeveloperId);
        }
    },

    navigateModalDate(direction) {
        this.currentDateRange.offset += direction;
        this.updateModalDateLabel();
        if (this.currentDeveloperId) {
            this.loadDeveloperActivity(this.currentDeveloperId);
        }
    },

    updateModalDateLabel() {
        const { startObj, endObj } = this.getDateRange();
        const fmt = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        const label = document.getElementById('modal-date-label');
        if (label) {
            if (this.currentDateRange.type === 'today') {
                label.textContent = fmt(startObj);
            } else if (startObj.getMonth() === endObj.getMonth() && startObj.getFullYear() === endObj.getFullYear()) {
                if (startObj.getDate() === 1 && endObj.getDate() === new Date(endObj.getFullYear(), endObj.getMonth() + 1, 0).getDate()) {
                    label.textContent = startObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                } else {
                    label.textContent = `${fmt(startObj)} - ${fmt(endObj)}`;
                }
            } else {
                label.textContent = `${fmt(startObj)} - ${fmt(endObj)}`;
            }
        }
    },

    switchTab(tabName) {
        document.querySelectorAll('.developer-details .tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.developer-details .tab-content').forEach(c => c.classList.remove('active'));

        const buttons = document.querySelectorAll('.developer-details .tab');
        const targetBtn = Array.from(buttons).find(b => b.onclick.toString().includes(tabName));
        if (targetBtn) targetBtn.classList.add('active');

        document.getElementById(`tab-${tabName}`).classList.add('active');
    },

    async loadDeveloperActivity(developerId) {
        const container = document.getElementById('activity-timeline');
        const breakdownContainer = document.getElementById('daily-breakdown');
        const limit = document.getElementById('activity-limit').value;
        const { start, end } = this.getDateRange();

        if (container) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Loading activity...</p>
                </div>
            `;
        }

        try {
            const params = {
                developer_id: developerId,
                limit: limit === '0' ? 1000 : parseInt(limit),
                page: 1,
                from: start,
                to: end
            };

            const result = await API.commits.list(params);

            if (container) this.renderActivityTimeline(result.data, container);
            if (breakdownContainer) this.renderDailyBreakdown(result.data, breakdownContainer);

        } catch (error) {
            const msg = `<p class="text-danger">Failed to load activity: ${error.message}</p>`;
            if (container) container.innerHTML = msg;
            if (breakdownContainer) breakdownContainer.innerHTML = msg;
        }
    },

    renderDailyBreakdown(commits, container) {
        if (!commits || commits.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-muted italic">No activity found for this period</div>`;
            return;
        }

        const stats = {};
        commits.forEach(c => {
            const date = c.committed_at.split('T')[0];
            if (!stats[date]) {
                stats[date] = { commits: 0, added: 0, removed: 0 };
            }
            stats[date].commits++;
            stats[date].added += (c.lines_added || 0);
            stats[date].removed += (c.lines_removed || 0);
        });

        // Sort dates
        const sortedDates = Object.keys(stats).sort().reverse();

        let html = `
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="text-xs text-muted uppercase border-b border-gray-700 bg-gray-900">
                        <th class="p-3">Date</th>
                        <th class="p-3 text-right">Commits</th>
                        <th class="p-3 text-right">Lines Added</th>
                        <th class="p-3 text-right">Lines Removed</th>
                        <th class="p-3 text-right">Net Change</th>
                    </tr>
                </thead>
                <tbody class="text-sm">
        `;

        sortedDates.forEach(date => {
            const s = stats[date];
            const net = s.added - s.removed;
            const netClass = net > 0 ? 'text-success' : (net < 0 ? 'text-danger' : 'text-muted');

            const dateObj = new Date(date);
            const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

            html += `
                <tr class="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td class="p-3 font-mono">${dateStr}</td>
                    <td class="p-3 text-right font-bold">${s.commits}</td>
                    <td class="p-3 text-right text-success">+${Table.formatNumber(s.added)}</td>
                    <td class="p-3 text-right text-danger">-${Table.formatNumber(s.removed)}</td>
                    <td class="p-3 text-right ${netClass}">${net > 0 ? '+' : ''}${Table.formatNumber(net)}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    },

    renderActivityTimeline(commits, container) {
        if (!commits || commits.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-muted italic">No activity found for this period</div>`;
            return;
        }

        // Group by date
        const grouped = {};
        commits.forEach(commit => {
            const date = new Date(commit.committed_at).toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(commit);
        });

        let html = `
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-xs text-muted uppercase border-b border-gray-700 bg-gray-900">
                            <th class="p-3 w-24">Time</th>
                            <th class="p-3" style="width: 500px; min-width: 500px;">Message</th>
                            <th class="p-3 w-48">Repo/Branch</th>
                            <th class="p-3 w-24 text-right">Added</th>
                            <th class="p-3 w-24 text-right">Removed</th>
                            <th class="p-3 w-24 text-right">Files</th>
                            <th class="p-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody class="text-sm">
        `;

        for (const [date, dayCommits] of Object.entries(grouped)) {
            // Day Header
            html += `
                <tr class="bg-gray-800 border-b border-gray-700 text-white font-bold">
                    <td colspan="7" class="p-3">
                        ${date} <span class="text-xs font-normal text-muted ml-2">(${dayCommits.length} commits)</span>
                    </td>
                </tr>
            `;

            // Commits
            dayCommits.forEach(commit => {
                const time = new Date(commit.committed_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                const firstLine = commit.message.split('\n')[0];

                html += `
                    <!-- Parent Row -->
                    <tr class="commit-row border-b border-gray-800 hover:bg-gray-800 transition-colors cursor-pointer group" 
                        onclick="DevelopersPage.toggleCommitFiles(${commit.id}, this)">
                        <td class="p-3 text-muted font-mono text-xs whitespace-nowrap">${time}</td>
                        <td class="p-3">
                            <div class="font-medium text-blue-400" style="white-space: normal;" title="${commit.message}">
                                ${firstLine}
                                <span class="px-2 py-0.5 ml-2 text-xs rounded-full bg-gray-700 text-gray-300 font-mono inline-block border border-gray-600">${commit.sha.substring(0, 7)}</span>
                            </div>
                        </td>
                        <td class="p-3 text-xs text-muted">
                            <div class="truncate max-w-[180px]" title="${commit.repo_name}">${commit.repo_name}</div>
                            <div class="truncate max-w-[180px] opacity-75">${commit.branch_name || 'default'}</div>
                        </td>
                        <td class="p-3 text-right text-success font-mono">+${commit.lines_added}</td>
                        <td class="p-3 text-right text-danger font-mono">-${commit.lines_removed}</td>
                        <td class="p-3 text-right text-muted">${commit.files_changed}</td>
                        <td class="p-3 text-center align-middle whitespace-nowrap">
                            <div class="flex items-center justify-center gap-2">
                                <a href="${this.generateFileLink(commit.platform_type, commit.platform_url, commit.repo_name, commit.sha, null)}" 
                                   target="_blank" 
                                   class="text-muted hover:text-white p-1" 
                                   title="Open Commit" 
                                   onclick="event.stopPropagation()">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                </a>
                                <svg class="w-4 h-4 text-muted transition-transform duration-200" id="chevron-${commit.id}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </div>
                        </td>
                    </tr>
                    <!-- Child Row -->
                    <tr id="commit-files-row-${commit.id}" class="hidden bg-gray-900">
                        <td colspan="7" class="p-0 border-b border-gray-800">
                            <div id="commit-files-${commit.id}" 
                                 class="p-4 pl-12"
                                 data-loaded="false"
                                 data-repo="${commit.repo_full_name}"
                                 data-platform-type="${commit.platform_type}"
                                 data-platform-url="${commit.platform_url}"
                                 data-sha="${commit.sha}">
                                <div class="loading-spinner small"><div class="spinner"></div></div>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
    },

    // renderCommitRow is no longer used directly, integrated above loop for simplicity in table structure
    // But specific logic might be needed for toggle

    async toggleCommitFiles(commitId, rowEl) {
        // rowEl is the TR
        const fileRow = document.getElementById(`commit-files-row-${commitId}`);
        const filesContainer = document.getElementById(`commit-files-${commitId}`);
        const chevron = document.getElementById(`chevron-${commitId}`);

        if (!fileRow) return;

        const isHidden = fileRow.classList.contains('hidden');

        if (isHidden) {
            fileRow.classList.remove('hidden');
            chevron.classList.add('rotate-180');
            rowEl.classList.add('bg-gray-800'); // Highlight parent

            if (filesContainer.dataset.loaded === 'false') {
                try {
                    const commit = await API.commits.get(commitId);
                    this.renderCommitFiles(commit, filesContainer);
                    filesContainer.dataset.loaded = 'true';
                } catch (error) {
                    filesContainer.innerHTML = `<p class="text-danger p-2">Failed to load files: ${error.message}</p>`;
                }
            }
        } else {
            fileRow.classList.add('hidden');
            chevron.classList.remove('rotate-180');
            rowEl.classList.remove('bg-gray-800');
        }
    },

    renderCommitFiles(commit, container) {
        const { platform_type, platform_url, repo_full_name, sha } = commit; // Inherited data attributes better
        const repoName = container.dataset.repo;
        const pType = container.dataset.platformType;
        const pUrl = container.dataset.platformUrl;
        const commitSha = container.dataset.sha;

        if (!commit.files || commit.files.length === 0) {
            container.innerHTML = '<div class="p-4 text-muted text-sm italic text-center">No file changes recorded for this commit</div>';
            return;
        }

        const html = `
            <div class="mb-3 flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700">
                <div class="text-sm font-medium text-white flex items-center gap-2">
                    <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    AI Assistant
                </div>
                <button class="btn btn-xs btn-secondary flex items-center gap-1" onclick="DevelopersPage.generateAISummary(${commit.id})">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                    Generate Summary
                </button>
            </div>
            <div id="ai-summary-${commit.id}" class="hidden mb-3 p-3 bg-gray-800 rounded border border-gray-700 text-sm"></div>

            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="text-xs text-muted uppercase bg-gray-800">
                        <tr>
                            <th class="px-4 py-2 font-medium">File</th>
                            <th class="px-4 py-2 text-right font-medium w-24">Added</th>
                            <th class="px-4 py-2 text-right font-medium w-24">Removed</th>
                            <th class="px-4 py-2 text-right font-medium w-24">Diff</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-800">
                        ${commit.files.map(file => {
            const link = this.generateFileLink(pType, pUrl, repoName, commitSha, file.filename);
            // Detect file type for icon (simple logic)
            const isCode = /\.(js|ts|jsx|tsx|cs|py|rb|java|go|c|cpp|h|html|css|json)$/i.test(file.filename);
            const icon = isCode ?
                '<svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>' :
                '<svg class="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>';

            return `
                                <tr class="hover:bg-gray-800 transition-colors group/row">
                                    <td class="px-4 py-2" style="max-width: 400px;">
                                        <div class="flex items-center gap-2">
                                            ${icon}
                                            <span class="font-mono text-xs break-all text-gray-300 group-hover/row:text-white" style="white-space: normal;">${file.filename}</span>
                                        </div>
                                    </td>
                                    <td class="px-4 py-2 text-right text-success text-xs font-mono">+${file.lines_added}</td>
                                    <td class="px-4 py-2 text-right text-danger text-xs font-mono">-${file.lines_removed}</td>
                                    <td class="px-4 py-2 text-right">
                                        <a href="${link}" target="_blank" class="inline-flex items-center px-2 py-1 rounded border border-gray-700 hover:bg-gray-700 hover:text-white text-xs text-muted transition-colors">
                                            <span>View</span>
                                            <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                        </a>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    },

    async generateAISummary(commitId) {
        const container = document.getElementById(`ai-summary-${commitId}`);
        if (!container) return;

        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex items-center gap-2 text-muted">
                <div class="spinner w-4 h-4 border-2"></div>
                Analyzing commit changes...
            </div>
        `;

        try {
            const summary = await API.commits.getAISummary(commitId);
            container.innerHTML = `
                <div class="prose prose-invert prose-sm max-w-none">
                    <h4 class="text-xs uppercase text-muted mb-2 font-bold tracking-wider">AI Summary</h4>
                    <div class="markdown-body text-gray-300 leading-relaxed">${this.formatMarkdown(summary.summary || 'No summary generated')}</div>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `
                <div class="text-danger flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    Failed to generate summary: ${error.message}
                </div>
            `;
        }
    },

    formatMarkdown(text) {
        // Simple formatter for now, or use marked if available
        if (!text) return '';
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code class="bg-gray-700 px-1 rounded font-mono text-xs">$1</code>');
    },

    generateFileLink(platformType, platformUrl, repoFullName, sha, filename) {
        if (!platformUrl || platformUrl === 'null') return '#';

        // Clean URL (remove trailing slash)
        let baseUrl = platformUrl.replace(/\/$/, '');

        // Remove credentials/username from URL (e.g. https://user@dev.azure.com -> https://dev.azure.com)
        baseUrl = baseUrl.replace(/:\/\/[^@\/]+@/, '://');

        // Handle Azure DevOps
        if (platformType === 'azure_devops') {
            // Fix: Strip existing /_git/ from config URL to prevent doubling
            if (baseUrl.toLowerCase().includes('/_git/')) {
                baseUrl = baseUrl.split(/\/_git\//i)[0];
            }
            baseUrl = baseUrl.replace(/\/$/, '');

            const parts = repoFullName.split('/'); // "Project/Repo"
            let project, repo;

            if (parts.length >= 2) {
                project = parts[0];
                repo = parts.slice(1).join('/');
            } else {
                project = repoFullName;
                repo = repoFullName;
            }

            // If baseUrl already includes the project name, strip it to avoid duplication
            // We want base to be https://dev.azure.com/Org
            if (baseUrl.toLowerCase().endsWith(`/${project.toLowerCase()}`)) {
                baseUrl = baseUrl.substring(0, baseUrl.length - project.length - 1);
            }

            // Encode components to be safe
            const encProject = encodeURIComponent(project);
            const encRepo = encodeURIComponent(repo);

            let url = `${baseUrl}/${encProject}/_git/${encRepo}/commit/${sha}`;

            if (filename) {
                const path = filename.startsWith('/') ? filename : '/' + filename;
                // Use encodeURI for path to preserve slashes but encode spaces/etc
                const encodedPath = encodeURI(path);
                url += `?path=${encodedPath}`;
            }

            return url;
        }

        // Handle GitHub
        if (platformType === 'github') {
            // https://github.com/Owner/Repo/blob/SHA/filename
            return `https://github.com/${repoFullName}/blob/${sha}/${filename}`;
        }

        return '#';
    },

    async updateName(developerId) {
        const newName = document.getElementById('edit-name').value;

        try {
            await API.developers.update(developerId, { canonical_name: newName });
            Toast.show('Name updated', 'success');
            Modal.close();
            await this.loadDevelopers();
        } catch (error) {
            Toast.show(`Failed: ${error.message}`, 'error');
        }
    },

    showMergeModal(sourceId) {
        const source = this.developers.find(d => d.id === sourceId);
        const others = this.developers.filter(d => d.id !== sourceId);

        const content = `
            <p>Merge <strong>${source?.canonical_name}</strong> into another developer:</p>
            
            <div class="form-group mt-3">
                <label>Target Developer</label>
                <select id="merge-target">
                    <option value="">Select developer...</option>
                    ${others.map(d => `
                        <option value="${d.id}">${d.canonical_name} (${d.commit_count} commits)</option>
                    `).join('')}
                </select>
            </div>
            
            <div class="mt-3 text-muted">
                <p>This will:</p>
                <ul>
                    <li>Move all identities to the target developer</li>
                    <li>Reassign all commits to the target developer</li>
                    <li>Delete the source developer</li>
                </ul>
            </div>
            
            <div class="flex justify-between mt-4">
                <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-danger" onclick="DevelopersPage.merge(${sourceId})">Merge</button>
            </div>
        `;

        Modal.open('Merge Developer', content, { maxWidth: '450px' });
    },

    async merge(sourceId) {
        const targetId = document.getElementById('merge-target').value;

        if (!targetId) {
            Toast.show('Please select a target developer', 'warning');
            return;
        }

        try {
            await API.developers.merge(sourceId, parseInt(targetId));
            Toast.show('Developers merged successfully', 'success');
            Modal.close();
            await this.loadDevelopers();
        } catch (error) {
            Toast.show(`Merge failed: ${error.message}`, 'error');
        }
    }
};

// Make DevelopersPage globally available
window.DevelopersPage = DevelopersPage;
