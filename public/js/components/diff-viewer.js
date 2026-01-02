/**
 * Diff Viewer Component
 * Renders code diffs with syntax highlighting
 */

const DiffViewer = {
    /**
     * Render diff using diff2html
     */
    render(diffString, container, options = {}) {
        if (!diffString || diffString.trim() === '') {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No diff available</h3>
                    <p>This commit may not have any changes or the diff could not be fetched.</p>
                </div>
            `;
            return;
        }

        const viewMode = options.sideBySide ? 'side-by-side' : 'line-by-line';

        try {
            // Use diff2html if available
            if (window.Diff2HtmlUI) {
                const diff2htmlUi = new Diff2HtmlUI(container, diffString, {
                    drawFileList: options.showFileList !== false,
                    matching: 'lines',
                    outputFormat: viewMode,
                    highlight: true,
                    colorScheme: 'dark'
                });

                diff2htmlUi.draw();
                diff2htmlUi.highlightCode();
            } else {
                // Fallback to simple rendering
                this.renderSimple(diffString, container);
            }
        } catch (error) {
            console.error('Error rendering diff:', error);
            this.renderSimple(diffString, container);
        }
    },

    /**
     * Simple diff rendering fallback
     */
    renderSimple(diffString, container) {
        const lines = diffString.split('\n');
        let html = '<div class="diff-viewer">';
        let currentFile = null;
        let lineNum = 0;

        for (const line of lines) {
            // File header
            if (line.startsWith('diff --git')) {
                if (currentFile) {
                    html += '</div></div>';
                }
                const match = line.match(/diff --git a\/(.+) b\//);
                const filename = match ? match[1] : 'Unknown file';
                html += `
                    <div class="diff-file">
                        <div class="diff-file-header">
                            <span>${this.escapeHtml(filename)}</span>
                        </div>
                        <div class="diff-content">
                `;
                currentFile = filename;
                lineNum = 0;
                continue;
            }

            // Skip other headers
            if (line.startsWith('---') || line.startsWith('+++') ||
                line.startsWith('index') || line.startsWith('new file') ||
                line.startsWith('deleted file')) {
                continue;
            }

            // Hunk header
            if (line.startsWith('@@')) {
                html += `<div class="diff-line"><div class="diff-line-num"></div><div class="diff-line-content text-muted">${this.escapeHtml(line)}</div></div>`;
                continue;
            }

            // Diff content
            if (currentFile) {
                lineNum++;
                let lineClass = '';
                let prefix = '';

                if (line.startsWith('+')) {
                    lineClass = 'add';
                    prefix = '+';
                } else if (line.startsWith('-')) {
                    lineClass = 'remove';
                    prefix = '-';
                }

                const content = line.substring(1) || '';
                html += `
                    <div class="diff-line ${lineClass}">
                        <div class="diff-line-num">${lineNum}</div>
                        <div class="diff-line-content">${prefix}${this.escapeHtml(content)}</div>
                    </div>
                `;
            }
        }

        if (currentFile) {
            html += '</div></div>';
        }

        html += '</div>';
        container.innerHTML = html;

        // Apply syntax highlighting
        container.querySelectorAll('.diff-line-content').forEach(el => {
            hljs.highlightElement(el);
        });
    },

    /**
     * Create tab interface for unified vs side-by-side
     */
    createWithTabs(diffString, container) {
        container.innerHTML = `
            <div class="tabs">
                <button class="tab active" data-view="unified">Unified</button>
                <button class="tab" data-view="split">Side by Side</button>
            </div>
            <div class="diff-container" id="diff-output"></div>
        `;

        const diffOutput = container.querySelector('#diff-output');
        const tabs = container.querySelectorAll('.tab');

        // Render initial view
        this.render(diffString, diffOutput, { sideBySide: false });

        // Tab switching
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const sideBySide = tab.dataset.view === 'split';
                this.render(diffString, diffOutput, { sideBySide });
            });
        });
    },

    /**
     * Escape HTML special characters
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Get file extension for syntax highlighting
     */
    getLanguage(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const langMap = {
            'js': 'javascript',
            'ts': 'typescript',
            'py': 'python',
            'rb': 'ruby',
            'cs': 'csharp',
            'vb': 'vbnet',
            'java': 'java',
            'go': 'go',
            'rs': 'rust',
            'php': 'php',
            'sql': 'sql',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'md': 'markdown',
            'sh': 'bash',
            'bash': 'bash'
        };
        return langMap[ext] || 'plaintext';
    }
};

// Make DiffViewer globally available
window.DiffViewer = DiffViewer;
