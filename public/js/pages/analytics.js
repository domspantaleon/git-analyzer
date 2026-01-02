/**
 * Analytics Page
 * Detailed analytics with tabs for different views
 */

const AnalyticsPage = {
    async render(container, dateRange) {
        container.innerHTML = `
            <div class="tabs" id="analytics-tabs">
                <button class="tab active" data-tab="developer">By Developer</button>
                <button class="tab" data-tab="repository">By Repository</button>
                <button class="tab" data-tab="timeline">Timeline</button>
                <button class="tab" data-tab="flags">Flags Analysis</button>
            </div>
            
            <div class="tab-content active" id="tab-developer">
                <div id="developer-analytics">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
            
            <div class="tab-content" id="tab-repository">
                <div id="repository-analytics">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
            
            <div class="tab-content" id="tab-timeline">
                <div class="flex gap-2 mb-4">
                    <button class="btn btn-sm btn-secondary active" data-granularity="day">Daily</button>
                    <button class="btn btn-sm btn-secondary" data-granularity="week">Weekly</button>
                </div>
                <div class="card">
                    <div class="chart-container" style="height: 400px;">
                        <canvas id="timeline-analytics-chart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="tab-content" id="tab-flags">
                <div class="grid grid-cols-2 gap-4">
                    <div class="card">
                        <h3 class="card-title mb-3">Flag Distribution</h3>
                        <div class="chart-container" style="height: 300px;">
                            <canvas id="flags-analytics-chart"></canvas>
                        </div>
                    </div>
                    <div class="card">
                        <h3 class="card-title mb-3">Most Flagged Commits</h3>
                        <div id="flagged-commits"></div>
                    </div>
                </div>
            </div>
        `;

        this.dateRange = dateRange;
        this.setupTabs();
        await this.loadDeveloperAnalytics();
    },

    setupTabs() {
        document.querySelectorAll('#analytics-tabs .tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                document.querySelectorAll('#analytics-tabs .tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

                switch (tab.dataset.tab) {
                    case 'developer':
                        await this.loadDeveloperAnalytics();
                        break;
                    case 'repository':
                        await this.loadRepositoryAnalytics();
                        break;
                    case 'timeline':
                        await this.loadTimelineAnalytics('day');
                        break;
                    case 'flags':
                        await this.loadFlagsAnalytics();
                        break;
                }
            });
        });

        // Granularity buttons
        document.querySelectorAll('[data-granularity]').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelectorAll('[data-granularity]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await this.loadTimelineAnalytics(btn.dataset.granularity);
            });
        });
    },

    async loadDeveloperAnalytics() {
        const container = document.getElementById('developer-analytics');

        try {
            const stats = await API.analytics.byDeveloper(this.dateRange.from, this.dateRange.to);

            if (stats.length === 0) {
                container.innerHTML = '<div class="empty-state"><h3>No data available</h3></div>';
                return;
            }

            const table = Table.create({
                columns: [
                    { key: 'canonical_name', label: 'Developer', render: (v) => `<strong>${v || 'Unknown'}</strong>` },
                    { key: 'commit_count', label: 'Commits', align: 'right', render: (v) => Table.formatNumber(v) },
                    { key: 'lines_added', label: 'Lines+', align: 'right', render: (v) => `<span class="text-success">+${Table.formatNumber(v || 0)}</span>` },
                    { key: 'lines_removed', label: 'Lines-', align: 'right', render: (v) => `<span class="text-danger">-${Table.formatNumber(v || 0)}</span>` },
                    { key: 'lines_net', label: 'Net', align: 'right', render: (v) => Table.formatNumber(v || 0) },
                    { key: 'files_changed', label: 'Files', align: 'right', render: (v) => Table.formatNumber(v || 0) },
                    { key: 'repos_touched', label: 'Repos', align: 'right' },
                    { key: 'estimated_hours', label: 'Est. Hours', align: 'right', render: (v) => v ? `~${v}h` : '-' },
                    { key: 'flag_count', label: 'Flags', align: 'right' }
                ],
                data: stats
            });

            container.innerHTML = '<div class="card"></div>';
            container.querySelector('.card').appendChild(table);

        } catch (error) {
            container.innerHTML = `<div class="empty-state"><h3>Error: ${error.message}</h3></div>`;
        }
    },

    async loadRepositoryAnalytics() {
        const container = document.getElementById('repository-analytics');

        try {
            const stats = await API.analytics.byRepository(this.dateRange.from, this.dateRange.to);

            if (stats.length === 0) {
                container.innerHTML = '<div class="empty-state"><h3>No data available</h3></div>';
                return;
            }

            const table = Table.create({
                columns: [
                    { key: 'full_name', label: 'Repository', render: (v) => `<strong>${v}</strong>` },
                    { key: 'commit_count', label: 'Commits', align: 'right', render: (v) => Table.formatNumber(v) },
                    { key: 'lines_added', label: 'Lines+', align: 'right', render: (v) => `<span class="text-success">+${Table.formatNumber(v || 0)}</span>` },
                    { key: 'lines_removed', label: 'Lines-', align: 'right', render: (v) => `<span class="text-danger">-${Table.formatNumber(v || 0)}</span>` },
                    { key: 'lines_net', label: 'Net', align: 'right', render: (v) => Table.formatNumber(v || 0) },
                    { key: 'contributors', label: 'Contributors', align: 'right' },
                    { key: 'top_contributor', label: 'Top Contributor' }
                ],
                data: stats
            });

            container.innerHTML = '<div class="card"></div>';
            container.querySelector('.card').appendChild(table);

        } catch (error) {
            container.innerHTML = `<div class="empty-state"><h3>Error: ${error.message}</h3></div>`;
        }
    },

    async loadTimelineAnalytics(granularity) {
        try {
            const timeline = await API.analytics.timeline(this.dateRange.from, this.dateRange.to, granularity);

            Charts.createLineChart('timeline-analytics-chart', {
                labels: timeline.map(t => t.period),
                datasets: [
                    {
                        label: 'Commits',
                        data: timeline.map(t => t.commit_count),
                        borderColor: '#58a6ff',
                        backgroundColor: '#58a6ff20',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Active Developers',
                        data: timeline.map(t => t.active_developers),
                        borderColor: '#a371f7',
                        backgroundColor: '#a371f720',
                        fill: false,
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            }, { showLegend: true });

        } catch (error) {
            console.error('Timeline error:', error);
        }
    },

    async loadFlagsAnalytics() {
        try {
            const flags = await API.analytics.flags(this.dateRange.from, this.dateRange.to);

            // Chart
            if (flags.distribution && flags.distribution.length > 0) {
                const flagLabels = {
                    'small_vague_commit': 'Vague',
                    'config_only': 'Config Only',
                    'comment_only': 'Comment Only',
                    'large_commit': 'Large',
                    'possible_copy_paste': 'Copy-Paste',
                    'possible_ai_generated': 'AI?'
                };

                Charts.createBarChart('flags-analytics-chart', {
                    labels: flags.distribution.map(f => flagLabels[f.flag_type] || f.flag_type),
                    values: flags.distribution.map(f => f.count)
                }, { horizontal: true });
            }

            // Table
            const container = document.getElementById('flagged-commits');
            if (flags.topFlagged && flags.topFlagged.length > 0) {
                container.innerHTML = `
                    <div class="table-container" style="max-height: 300px; overflow-y: auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Commit</th>
                                    <th>Developer</th>
                                    <th>Flags</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${flags.topFlagged.map(c => `
                                    <tr class="clickable" onclick="CommitsPage.showCommitDetail(${c.id})">
                                        <td>
                                            <code>${c.sha?.substring(0, 7)}</code>
                                            <div class="text-muted">${(c.message || '').split('\n')[0].substring(0, 30)}...</div>
                                        </td>
                                        <td>${c.developer_name || 'Unknown'}</td>
                                        <td>${Table.renderFlags(c.flags)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            } else {
                container.innerHTML = '<p class="text-muted">No flagged commits</p>';
            }

        } catch (error) {
            console.error('Flags error:', error);
        }
    }
};

// Make AnalyticsPage globally available
window.AnalyticsPage = AnalyticsPage;
