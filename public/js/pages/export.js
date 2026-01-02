/**
 * Export Page
 * Export data as CSV or PDF
 */

const ExportPage = {
    async render(container, dateRange) {
        container.innerHTML = `
            <div class="card" style="max-width: 600px;">
                <h3 class="card-title mb-4">Export Summary Report</h3>
                
                <div class="form-group">
                    <label>Date Range</label>
                    <div class="flex gap-2">
                        <input type="date" id="export-from" value="${dateRange.from}">
                        <span style="align-self: center;">to</span>
                        <input type="date" id="export-to" value="${dateRange.to}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Report Type</label>
                    <select id="export-type">
                        <option value="developer">By Developer</option>
                        <option value="repository">By Repository</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Format</label>
                    <div class="flex gap-2">
                        <label class="checkbox-label">
                            <input type="radio" name="format" value="csv" checked>
                            CSV
                        </label>
                        <label class="checkbox-label">
                            <input type="radio" name="format" value="pdf">
                            PDF
                        </label>
                    </div>
                </div>
                
                <div class="flex gap-2 mt-4">
                    <button class="btn btn-secondary" id="preview-btn">Preview</button>
                    <button class="btn btn-primary" id="download-btn">Download</button>
                </div>
            </div>
            
            <div class="card mt-4" id="preview-container" style="display: none;">
                <h3 class="card-title mb-3">Preview</h3>
                <div id="preview-content"></div>
            </div>
        `;

        document.getElementById('preview-btn').addEventListener('click', () => this.preview());
        document.getElementById('download-btn').addEventListener('click', () => this.download());
    },

    async preview() {
        const from = document.getElementById('export-from').value;
        const to = document.getElementById('export-to').value;
        const type = document.getElementById('export-type').value;

        const container = document.getElementById('preview-container');
        const content = document.getElementById('preview-content');

        container.style.display = 'block';
        content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

        try {
            let data;
            if (type === 'developer') {
                data = await API.analytics.byDeveloper(from, to);
            } else {
                data = await API.analytics.byRepository(from, to);
            }

            if (data.length === 0) {
                content.innerHTML = '<p class="text-muted">No data available for the selected range.</p>';
                return;
            }

            // Build preview table
            const columns = type === 'developer'
                ? ['canonical_name', 'commit_count', 'lines_added', 'lines_removed', 'lines_net']
                : ['full_name', 'commit_count', 'lines_added', 'lines_removed', 'contributors'];

            const headers = type === 'developer'
                ? ['Developer', 'Commits', 'Lines+', 'Lines-', 'Net']
                : ['Repository', 'Commits', 'Lines+', 'Lines-', 'Contributors'];

            let html = '<table><thead><tr>';
            headers.forEach(h => html += `<th>${h}</th>`);
            html += '</tr></thead><tbody>';

            data.slice(0, 10).forEach(row => {
                html += '<tr>';
                columns.forEach(col => {
                    html += `<td>${row[col] ?? '-'}</td>`;
                });
                html += '</tr>';
            });

            html += '</tbody></table>';

            if (data.length > 10) {
                html += `<p class="text-muted mt-2">Showing 10 of ${data.length} rows</p>`;
            }

            content.innerHTML = html;

        } catch (error) {
            content.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
        }
    },

    async download() {
        const from = document.getElementById('export-from').value;
        const to = document.getElementById('export-to').value;
        const type = document.getElementById('export-type').value;
        const format = document.querySelector('input[name="format"]:checked').value;

        try {
            const params = new URLSearchParams({
                from,
                to,
                type
            });

            const url = `/api/export/summary/${format}?${params.toString()}`;

            // Create a link and trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = `git-analyzer-${type}-${from}-${to}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            Toast.show('Download started', 'success');

        } catch (error) {
            Toast.show(`Download failed: ${error.message}`, 'error');
        }
    }
};

// Make ExportPage globally available
window.ExportPage = ExportPage;
