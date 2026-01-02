/**
 * Console Panel Component
 * Collapsible debug console for connection logs
 */

const Console = {
    panel: null,
    header: null,
    body: null,
    content: null,
    badge: null,
    chevron: null,
    isOpen: false,
    logCount: 0,
    maxLogs: 500,

    init() {
        this.panel = document.getElementById('console-panel');
        this.header = document.getElementById('console-header');
        this.body = document.getElementById('console-body');
        this.content = document.getElementById('console-content');
        this.badge = document.getElementById('console-badge');
        this.chevron = document.getElementById('console-chevron');

        if (!this.panel) return;

        // Toggle on header click
        this.header.addEventListener('click', (e) => {
            if (!e.target.closest('.console-btn')) {
                this.toggle();
            }
        });

        // Clear button
        document.getElementById('console-clear').addEventListener('click', () => {
            this.clear();
        });

        // Toggle button
        document.getElementById('console-toggle').addEventListener('click', () => {
            this.toggle();
        });

        // Start collapsed
        this.body.style.display = 'none';
        this.chevron.style.transform = 'rotate(180deg)';

        this.log('Console initialized', 'info');
    },

    toggle() {
        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            this.body.style.display = 'block';
            this.chevron.style.transform = 'rotate(0deg)';
            this.panel.classList.add('expanded');
            // Reset badge when opened
            this.badge.textContent = '0';
            this.badge.classList.remove('has-new');
        } else {
            this.body.style.display = 'none';
            this.chevron.style.transform = 'rotate(180deg)';
            this.panel.classList.remove('expanded');
        }
    },

    clear() {
        this.content.innerHTML = '';
        this.logCount = 0;
        this.badge.textContent = '0';
        this.badge.classList.remove('has-new');
        this.log('Console cleared', 'info');
    },

    /**
     * Log a message to the console
     * @param {string} message - The message to log
     * @param {string} type - Type: info, success, warning, error
     * @param {object} data - Optional data to include
     */
    log(message, type = 'info', data = null) {
        if (!this.content) return;

        const now = new Date();
        const time = now.toTimeString().split(' ')[0];

        const entry = document.createElement('div');
        entry.className = `console-entry ${type}`;

        let html = `
            <span class="console-time">[${time}]</span>
            <span class="console-type">${type.toUpperCase()}</span>
            <span class="console-msg">${this.escapeHtml(message)}</span>
        `;

        if (data) {
            html += `<pre class="console-data">${this.escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
        }

        entry.innerHTML = html;
        this.content.appendChild(entry);

        // Auto-scroll to bottom
        this.content.scrollTop = this.content.scrollHeight;

        // Limit number of logs
        this.logCount++;
        if (this.logCount > this.maxLogs) {
            const first = this.content.firstChild;
            if (first) first.remove();
        }

        // Update badge if closed
        if (!this.isOpen) {
            const currentCount = parseInt(this.badge.textContent) || 0;
            this.badge.textContent = currentCount + 1;
            this.badge.classList.add('has-new');
        }
    },

    info(message, data = null) {
        this.log(message, 'info', data);
    },

    success(message, data = null) {
        this.log(message, 'success', data);
    },

    warn(message, data = null) {
        this.log(message, 'warning', data);
    },

    error(message, data = null) {
        this.log(message, 'error', data);
    },

    /**
     * Log an API request
     */
    logRequest(method, url, data = null) {
        this.log(`${method} ${url}`, 'info', data);
    },

    /**
     * Log an API response
     */
    logResponse(method, url, status, data = null) {
        const type = status >= 200 && status < 300 ? 'success' : 'error';
        this.log(`${method} ${url} → ${status}`, type, data);
    },

    escapeHtml(str) {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => Console.init());

// Make Console globally available
window.Console = Console;
