/**
 * Charts Component
 * Chart.js wrapper for analytics charts
 */

const Charts = {
    instances: {},

    /**
     * Create a line chart
     */
    createLineChart(canvasId, data, options = {}) {
        this.destroyIfExists(canvasId);

        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        const config = {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: data.datasets || [{
                    label: data.label || 'Data',
                    data: data.values || [],
                    borderColor: options.color || '#58a6ff',
                    backgroundColor: (options.color || '#58a6ff') + '20',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: options.showLegend !== false,
                        labels: {
                            color: '#8b949e'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#30363d'
                        },
                        ticks: {
                            color: '#8b949e'
                        }
                    },
                    y: {
                        grid: {
                            color: '#30363d'
                        },
                        ticks: {
                            color: '#8b949e'
                        },
                        beginAtZero: true
                    }
                }
            }
        };

        this.instances[canvasId] = new Chart(ctx, config);
        return this.instances[canvasId];
    },

    /**
     * Create a bar chart
     */
    createBarChart(canvasId, data, options = {}) {
        this.destroyIfExists(canvasId);

        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        const colors = options.colors || [
            '#58a6ff', '#3fb950', '#d29922', '#a371f7', '#f85149',
            '#79c0ff', '#56d364', '#e3b341', '#bc8cff', '#ff7b72'
        ];

        const config = {
            type: options.horizontal ? 'bar' : 'bar',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: data.label || 'Data',
                    data: data.values || [],
                    backgroundColor: data.values?.map((_, i) => colors[i % colors.length]) || colors,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: options.horizontal ? 'y' : 'x',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: options.showLegend === true,
                        labels: {
                            color: '#8b949e'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#30363d'
                        },
                        ticks: {
                            color: '#8b949e'
                        }
                    },
                    y: {
                        grid: {
                            color: '#30363d'
                        },
                        ticks: {
                            color: '#8b949e'
                        },
                        beginAtZero: true
                    }
                }
            }
        };

        this.instances[canvasId] = new Chart(ctx, config);
        return this.instances[canvasId];
    },

    /**
     * Create a pie/doughnut chart
     */
    createPieChart(canvasId, data, options = {}) {
        this.destroyIfExists(canvasId);

        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        const colors = options.colors || [
            '#58a6ff', '#3fb950', '#d29922', '#a371f7', '#f85149',
            '#79c0ff', '#56d364', '#e3b341', '#bc8cff', '#ff7b72'
        ];

        const config = {
            type: options.doughnut ? 'doughnut' : 'pie',
            data: {
                labels: data.labels || [],
                datasets: [{
                    data: data.values || [],
                    backgroundColor: colors,
                    borderColor: '#161b22',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: options.legendPosition || 'right',
                        labels: {
                            color: '#c9d1d9',
                            padding: 16
                        }
                    }
                }
            }
        };

        this.instances[canvasId] = new Chart(ctx, config);
        return this.instances[canvasId];
    },

    /**
     * Destroy existing chart
     */
    destroyIfExists(canvasId) {
        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
            delete this.instances[canvasId];
        }
    },

    /**
     * Destroy all charts
     */
    destroyAll() {
        Object.keys(this.instances).forEach(id => {
            this.instances[id].destroy();
        });
        this.instances = {};
    }
};

// Make Charts globally available
window.Charts = Charts;
