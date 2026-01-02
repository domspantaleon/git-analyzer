/**
 * Date Picker Component
 * Extends the basic date range functionality
 */

const DatePicker = {
    /**
     * Get date presets
     */
    getPresets() {
        return [
            { key: 'today', label: 'Today' },
            { key: '7days', label: 'Last 7 days' },
            { key: '14days', label: 'Last 14 days' },
            { key: '30days', label: 'Last 30 days' },
            { key: 'thisMonth', label: 'This month' },
            { key: 'lastMonth', label: 'Last month' },
            { key: 'thisYear', label: 'This year' }
        ];
    },

    /**
     * Calculate dates from preset
     */
    getPresetDates(preset) {
        const today = new Date();
        let from = new Date();
        let to = new Date(today);

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
                to = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'thisYear':
                from = new Date(today.getFullYear(), 0, 1);
                break;
        }

        return {
            from: this.formatDate(from),
            to: this.formatDate(to)
        };
    },

    /**
     * Format date as YYYY-MM-DD
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    },

    /**
     * Format date for display
     */
    formatDisplay(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    /**
     * Create inline date picker
     */
    createInline(options = {}) {
        const { from, to, onChange } = options;

        const container = document.createElement('div');
        container.className = 'date-picker-inline';
        container.innerHTML = `
            <div class="flex gap-2 items-center">
                <input type="date" class="date-input-from" value="${from || ''}">
                <span>to</span>
                <input type="date" class="date-input-to" value="${to || ''}">
                <button class="btn btn-sm btn-primary apply-btn">Apply</button>
            </div>
        `;

        const fromInput = container.querySelector('.date-input-from');
        const toInput = container.querySelector('.date-input-to');
        const applyBtn = container.querySelector('.apply-btn');

        applyBtn.addEventListener('click', () => {
            if (onChange) {
                onChange(fromInput.value, toInput.value);
            }
        });

        return container;
    },

    /**
     * Calculate the number of days between two dates
     */
    daysBetween(from, to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        const diff = toDate - fromDate;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
};

// Make DatePicker globally available
window.DatePicker = DatePicker;
