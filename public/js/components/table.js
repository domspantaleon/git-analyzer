/**
 * Table Component
 * Provides sortable, paginated tables
 */

const Table = {
    /**
     * Create a table element
     */
    create(options = {}) {
        const {
            columns = [],
            data = [],
            onRowClick = null,
            emptyMessage = 'No data available',
            pagination = null
        } = options;

        const container = document.createElement('div');
        container.className = 'table-container';

        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>${emptyMessage}</h3>
                </div>
            `;
            return container;
        }

        const table = document.createElement('table');

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label || col.key;
            if (col.width) th.style.width = col.width;
            if (col.align) th.style.textAlign = col.align;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');

        data.forEach(row => {
            const tr = document.createElement('tr');

            if (onRowClick) {
                tr.classList.add('clickable');
                tr.addEventListener('click', () => onRowClick(row));
            }

            columns.forEach(col => {
                const td = document.createElement('td');

                if (col.render) {
                    const content = col.render(row[col.key], row);
                    if (typeof content === 'string') {
                        td.innerHTML = content;
                    } else if (content instanceof HTMLElement) {
                        td.appendChild(content);
                    }
                } else {
                    td.textContent = row[col.key] ?? '';
                }

                if (col.align) td.style.textAlign = col.align;
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        container.appendChild(table);

        // Pagination
        if (pagination) {
            container.appendChild(this.createPagination(pagination));
        }

        return container;
    },

    /**
     * Create pagination controls
     */
    createPagination(options) {
        const { page, pages, total, onPageChange } = options;

        const nav = document.createElement('div');
        nav.className = 'flex items-center justify-between mt-3';
        nav.style.padding = '12px 0';

        nav.innerHTML = `
            <div class="text-muted">
                Showing page ${page} of ${pages} (${total} total)
            </div>
            <div class="flex gap-2">
                <button class="btn btn-sm btn-secondary" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">
                    Previous
                </button>
                <button class="btn btn-sm btn-secondary" ${page >= pages ? 'disabled' : ''} data-page="${page + 1}">
                    Next
                </button>
            </div>
        `;

        nav.querySelectorAll('button[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const newPage = parseInt(btn.dataset.page);
                if (onPageChange && newPage >= 1 && newPage <= pages) {
                    onPageChange(newPage);
                }
            });
        });

        return nav;
    },

    /**
     * Format number with comma separators
     */
    formatNumber(num) {
        if (num == null) return '0';
        return num.toLocaleString();
    },

    /**
     * Format date/time
     */
    formatDateTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Format relative time
     */
    formatRelative(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return this.formatDateTime(dateStr);
    },

    /**
     * Create flag badges
     */
    renderFlags(flagsStr) {
        if (!flagsStr) return '';

        const flags = flagsStr.split(',').filter(f => f);
        if (flags.length === 0) return '';

        const flagLabels = {
            'small_vague_commit': 'Vague',
            'config_only': 'Config',
            'comment_only': 'Comment',
            'large_commit': 'Large',
            'possible_copy_paste': 'Copy-Paste',
            'possible_ai_generated': 'AI?'
        };

        return flags.map(flag =>
            `<span class="flag-badge ${flag}">${flagLabels[flag] || flag}</span>`
        ).join('');
    },

    /**
     * Create platform icon
     */
    renderPlatformIcon(type) {
        const icons = {
            'azure_devops': `<svg viewBox="0 0 24 24" width="18" height="18" fill="#0078d4"><path d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 15.707zm24-4.45v14.651l-5.753 4.9-9.303-3.057v3.056l-5.978-7.416 15.057 1.798V5.415z"/></svg>`,
            'github': `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`,
            'gitlab': `<svg viewBox="0 0 24 24" width="18" height="18" fill="#fc6d26"><path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.918 1.263c-.135-.423-.73-.423-.867 0L1.386 9.45.044 13.587a.912.912 0 00.331 1.021L12 23.054l11.625-8.443a.912.912 0 00.33-1.024"/></svg>`
        };

        return icons[type] || '';
    }
};

// Make Table globally available
window.Table = Table;
