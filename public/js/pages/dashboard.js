/**
 * Dashboard Page
 * Shows summary stats, charts, and recent commits
 */

const DashboardPage = {
    async render(container, dateRange) {
        container.innerHTML = `
            <div class="stats-grid" id="stats-grid">
                <div class="stat-card skeleton" style="height: 80px;"></div>
                <div class="stat-card skeleton" style="height: 80px;"></div>
                <div class="stat-card skeleton" style="height: 80px;"></div>
                <div class="stat-card skeleton" style="height: 80px;"></div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Commits Over Time</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="timeline-chart"></canvas>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Commits by Developer</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="developer-chart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Flag Distribution</h3>
                    </div>
                    <div class="chart-container" style="height: 250px;">
                        <canvas id="flags-chart"></canvas>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Lines Changed</h3>
                    </div>
                    <div class="chart-container" style="height: 250px;">
                        <canvas id="lines-chart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Recent Commits</h3>
                </div>
                <div id="recent-commits">
                    <div class="skeleton" style="height: 300px;"></div>
                </div>
            </div>
        `;

        try {
            // Fetch data
            const [summary, timeline, developers, flags, commits] = await Promise.all([
                API.analytics.summary(dateRange.from, dateRange.to),
                API.analytics.timeline(dateRange.from, dateRange.to),
                API.analytics.byDeveloper(dateRange.from, dateRange.to),
                API.analytics.flags(dateRange.from, dateRange.to),
                API.commits.list({ from: dateRange.from, to: dateRange.to, limit: 20 })
            ]);

            // Render stats cards
            this.renderStats(summary);

            // Render timeline chart
            this.renderTimelineChart(timeline);

            // Render developer chart
            this.renderDeveloperChart(developers.slice(0, 10));

            // Render flags chart
            this.renderFlagsChart(flags.distribution);

            // Render lines chart
            this.renderLinesChart(timeline);

            // Render recent commits
            this.renderRecentCommits(commits.data);

        } catch (error) {
            console.error('Dashboard error:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Error loading dashboard</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-primary mt-3" onclick="App.refreshCurrentPage()">Retry</button>
                </div>
            `;
        }
    },

    renderStats(summary) {
        const statsGrid = document.getElementById('stats-grid');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Total Commits</div>
                <div class="stat-value accent">${Table.formatNumber(summary.total_commits || 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Developers</div>
                <div class="stat-value">${Table.formatNumber(summary.total_developers || 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Lines Added</div>
                <div class="stat-value success">+${Table.formatNumber(summary.total_lines_added || 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Lines Removed</div>
                <div class="stat-value danger">-${Table.formatNumber(summary.total_lines_removed || 0)}</div>
            </div>
        `;
    },

    renderTimelineChart(timeline) {
        Charts.createLineChart('timeline-chart', {
            labels: timeline.map(t => t.period),
            values: timeline.map(t => t.commit_count)
        }, { color: '#58a6ff' });
    },

    renderDeveloperChart(developers) {
        Charts.createBarChart('developer-chart', {
            labels: developers.map(d => d.canonical_name?.substring(0, 15) || 'Unknown'),
            values: developers.map(d => d.commit_count)
        }, { horizontal: true });
    },

    renderFlagsChart(distribution) {
        if (!distribution || distribution.length === 0) {
            document.getElementById('flags-chart').parentElement.innerHTML = `
                <div class="empty-state" style="height: 200px;">
                    <p class="text-muted">No flagged commits</p>
                </div>
            `;
            return;
        }

        const flagLabels = {
            'small_vague_commit': 'Vague',
            'config_only': 'Config Only',
            'comment_only': 'Comment Only',
            'large_commit': 'Large',
            'possible_copy_paste': 'Copy-Paste',
            'possible_ai_generated': 'AI Generated?'
        };

        Charts.createPieChart('flags-chart', {
            labels: distribution.map(f => flagLabels[f.flag_type] || f.flag_type),
            values: distribution.map(f => f.count)
        }, { doughnut: true, legendPosition: 'bottom' });
    },

    renderLinesChart(timeline) {
        Charts.createLineChart('lines-chart', {
            labels: timeline.map(t => t.period),
            datasets: [
                {
                    label: 'Added',
                    data: timeline.map(t => t.lines_added || 0),
                    borderColor: '#3fb950',
                    backgroundColor: '#3fb95020',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Removed',
                    data: timeline.map(t => t.lines_removed || 0),
                    borderColor: '#f85149',
                    backgroundColor: '#f8514920',
                    fill: true,
                    tension: 0.4
                }
            ]
        }, { showLegend: true });
    },

    renderRecentCommits(commits) {
        const container = document.getElementById('recent-commits');

        if (!commits || commits.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No commits found</h3>
                    <p>Sync commits by clicking the Sync button above.</p>
                </div>
            `;
            return;
        }

        const table = Table.create({
            columns: [
                {
                    key: 'committed_at',
                    label: 'Date',
                    width: '150px',
                    render: (val) => Table.formatRelative(val)
                },
                {
                    key: 'developer_name',
                    label: 'Developer',
                    render: (val) => val || 'Unknown'
                },
                {
                    key: 'repo_name',
                    label: 'Repository',
                    render: (val, row) => `<span class="text-muted">${row.repo_full_name || val}</span>`
                },
                {
                    key: 'message',
                    label: 'Message',
                    render: (val) => {
                        const firstLine = (val || '').split('\n')[0];
                        return firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine;
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
                    key: 'flags',
                    label: 'Flags',
                    render: (val) => Table.renderFlags(val)
                }
            ],
            data: commits,
            onRowClick: (row) => CommitsPage.showCommitDetail(row.id)
        });

        container.innerHTML = '';
        container.appendChild(table);
    }
};

// Make DashboardPage globally available
window.DashboardPage = DashboardPage;
