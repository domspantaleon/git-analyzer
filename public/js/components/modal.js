/**
 * Modal Component
 * Provides reusable modal dialog functionality
 */

const Modal = {
    overlay: null,
    modal: null,
    titleEl: null,
    contentEl: null,

    init() {
        this.overlay = document.getElementById('modal-overlay');
        this.modal = document.getElementById('modal');
        this.titleEl = document.getElementById('modal-title');
        this.contentEl = document.getElementById('modal-content');

        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Close on button click
        document.getElementById('modal-close').addEventListener('click', () => this.close());

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    },

    /**
     * Open modal with content
     */
    open(title, content, options = {}) {
        this.titleEl.textContent = title;

        if (typeof content === 'string') {
            this.contentEl.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            this.contentEl.innerHTML = '';
            this.contentEl.appendChild(content);
        }

        // Apply size option
        this.modal.style.maxWidth = options.maxWidth || '900px';

        this.overlay.classList.add('open');
        document.body.style.overflow = 'hidden';

        // Focus first input if exists
        const firstInput = this.contentEl.querySelector('input, button, select, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    },

    /**
     * Close modal
     */
    close() {
        this.overlay.classList.remove('open');
        document.body.style.overflow = '';
        this.contentEl.innerHTML = '';
    },

    /**
     * Check if modal is open
     */
    isOpen() {
        return this.overlay.classList.contains('open');
    },

    /**
     * Show a confirmation dialog
     */
    confirm(title, message, options = {}) {
        return new Promise((resolve) => {
            const content = `
                <p>${message}</p>
                <div class="modal-footer" style="border-top: none; padding-top: 16px;">
                    <button class="btn btn-secondary" id="modal-cancel">${options.cancelText || 'Cancel'}</button>
                    <button class="btn ${options.danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">
                        ${options.confirmText || 'Confirm'}
                    </button>
                </div>
            `;

            this.open(title, content, { maxWidth: '400px' });

            document.getElementById('modal-cancel').addEventListener('click', () => {
                this.close();
                resolve(false);
            });

            document.getElementById('modal-confirm').addEventListener('click', () => {
                this.close();
                resolve(true);
            });
        });
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => Modal.init());

// Make Modal globally available
window.Modal = Modal;
