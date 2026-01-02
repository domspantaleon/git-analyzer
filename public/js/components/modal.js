/**
 * Modal Component
 * Provides reusable modal dialog functionality
 */

const Modal = {
    overlay: null,
    modal: null,
    titleEl: null,
    titleEl: null,
    contentEl: null,
    expandBtn: null,
    isFullScreen: false,

    init() {
        this.overlay = document.getElementById('modal-overlay');
        this.modal = document.getElementById('modal');
        this.titleEl = document.getElementById('modal-title');
        this.contentEl = document.getElementById('modal-content');
        this.expandBtn = document.getElementById('modal-expand');

        // Toggle fullscreen
        if (this.expandBtn) {
            this.expandBtn.addEventListener('click', () => this.toggleFullScreen());
        }

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
        if (options.fullScreen) {
            this.modal.style.maxWidth = '100vw';
            this.modal.style.width = '100vw';
            this.modal.style.height = '100vh';
            this.modal.style.maxHeight = '100vh';
            this.modal.style.borderRadius = '0';
            this.modal.style.margin = '0';
            this.modal.style.top = '0';
            this.modal.style.left = '0';
            this.modal.parentElement.style.padding = '0'; // Overlay padding
            this.modal.parentElement.style.padding = '0'; // Overlay padding
            this.isFullScreen = true;
            this.updateExpandIcon();
        } else {
            this.modal.style.maxWidth = options.maxWidth || '900px';
            this.modal.style.width = '';
            this.modal.style.height = '';
            this.modal.style.maxHeight = '';
            this.modal.style.borderRadius = '';
            this.modal.style.margin = '';
            this.modal.style.top = '';
            this.modal.style.left = '';
            this.modal.parentElement.style.padding = '';
            this.isFullScreen = false;
            this.updateExpandIcon();
        }

        // Show/Hide expand button
        if (this.expandBtn) {
            if (options.allowExpand) {
                this.expandBtn.classList.remove('hidden');
            } else {
                this.expandBtn.classList.add('hidden');
            }
        }

        this.overlay.classList.add('open');
        document.body.style.overflow = 'hidden';

        // Focus first input if exists
        const firstInput = this.contentEl.querySelector('input, button, select, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    },

    toggleFullScreen() {
        if (this.isFullScreen) {
            // Restore normal size
            // We need to know what the original maxWidth was. 
            // For simplicity, we can just re-open/re-apply non-fullscreen logic, 
            // but we don't have the original options here easily unless we store them.
            // Let's implement a simpler styles reset mostly.

            this.modal.style.maxWidth = '900px'; // Default fallback, or could store previous
            this.modal.style.width = '';
            this.modal.style.height = '';
            this.modal.style.maxHeight = '';
            this.modal.style.borderRadius = '';
            this.modal.style.margin = '';
            this.modal.style.top = '';
            this.modal.style.left = '';
            this.modal.parentElement.style.padding = '';
            this.isFullScreen = false;
        } else {
            // Go fullscreen
            this.modal.style.maxWidth = '100vw';
            this.modal.style.width = '100vw';
            this.modal.style.height = '100vh';
            this.modal.style.maxHeight = '100vh';
            this.modal.style.borderRadius = '0';
            this.modal.style.margin = '0';
            this.modal.style.top = '0';
            this.modal.style.left = '0';
            this.modal.parentElement.style.padding = '0';
            this.isFullScreen = true;
        }
        this.updateExpandIcon();
    },

    updateExpandIcon() {
        if (!this.expandBtn) return;

        if (this.isFullScreen) {
            // Show contract icon
            this.expandBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"></path>
                </svg>
            `;
            this.expandBtn.title = "Exit Fullscreen";
        } else {
            // Show expand icon
            this.expandBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
                </svg>
            `;
            this.expandBtn.title = "Fullscreen";
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
