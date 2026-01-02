/**
 * Developers Page
 * View and manage discovered developers
 */

const DevelopersPage = {
    developers: [],

    async render(container, dateRange) {
        container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div class="flex gap-2">
                    <label class="checkbox-label">
                        <input type="checkbox" id="active-only" checked>
                        Active only
                    </label>
                </div>
            </div>
            
            <div class="card">
                <div id="developers-table">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>Loading developers...</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('active-only').addEventListener('change', () => this.loadDevelopers());

        await this.loadDevelopers();
    },

    async loadDevelopers() {
        const tableContainer = document.getElementById('developers-table');
        const activeOnly = document.getElementById('active-only').checked;

        try {
            this.developers = await API.developers.list({ active_only: activeOnly });

            if (this.developers.length === 0) {
                tableContainer.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                        </svg>
                        <h3>No developers found</h3>
                        <p>Developers are discovered when you sync commits.</p>
                    </div>
                `;
                return;
            }

            const table = Table.create({
                columns: [
                    {
                        key: 'canonical_name',
                        label: 'Developer',
                        render: (val) => `<strong>${val || 'Unknown'}</strong>`
                    },
                    {
                        key: 'emails',
                        label: 'Email(s)',
                        render: (val) => {
                            if (!val) return '-';
                            const emails = val.split(',').slice(0, 2);
                            const more = val.split(',').length > 2 ? ` +${val.split(',').length - 2}` : '';
                            return `<span class="text-muted">${emails.join(', ')}${more}</span>`;
                        }
                    },
                    {
                        key: 'commit_count',
                        label: 'Commits',
                        align: 'right',
                        render: (val) => Table.formatNumber(val)
                    },
                    {
                        key: 'total_lines_added',
                        label: 'Lines Added',
                        align: 'right',
                        render: (val) => `<span class="text-success">+${Table.formatNumber(val || 0)}</span>`
                    },
                    {
                        key: 'total_lines_removed',
                        label: 'Lines Removed',
                        align: 'right',
                        render: (val) => `<span class="text-danger">-${Table.formatNumber(val || 0)}</span>`
                    },
                    {
                        key: 'is_active',
                        label: 'Active',
                        align: 'center',
                        render: (val, row) => `
                            <input type="checkbox" ${val ? 'checked' : ''} 
                                   data-dev-id="${row.id}" class="active-toggle">
                        `
                    },
                    {
                        key: 'id',
                        label: 'Actions',
                        align: 'right',
                        render: (val, row) => `
                            <button class="btn btn-sm btn-secondary" onclick="DevelopersPage.showDetails(${val})">
                                Details
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="DevelopersPage.showMergeModal(${val})">
                                Merge
                            </button>
                        `
                    }
                ],
                data: this.developers
            });

            tableContainer.innerHTML = '';
            tableContainer.appendChild(table);

            // Add toggle event listeners
            tableContainer.querySelectorAll('.active-toggle').forEach(toggle => {
                toggle.addEventListener('change', async (e) => {
                    const devId = e.target.dataset.devId;
                    const isActive = e.target.checked;

                    try {
                        await API.developers.update(devId, { is_active: isActive });
                    } catch (error) {
                        Toast.show(`Failed: ${error.message}`, 'error');
                        e.target.checked = !isActive;
                    }
                });
            });

        } catch (error) {
            tableContainer.innerHTML = `
                <div class="empty-state">
                    <h3>Error loading developers</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    },

    async showDetails(developerId) {
        try {
            const identities = await API.developers.getIdentities(developerId);
            const dev = this.developers.find(d => d.id === developerId);

            const content = `
                <div class="mb-4">
                    <h4>Canonical Name</h4>
                    <div class="flex gap-2 mt-2">
                        <input type="text" id="edit-name" value="${dev?.canonical_name || ''}" style="flex: 1;">
                        <button class="btn btn-primary" onclick="DevelopersPage.updateName(${developerId})">Save</button>
                    </div>
                </div>
                
                <h4>Associated Identities</h4>
                <table class="mt-2">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${identities.map(i => `
                            <tr>
                                <td>${i.name}</td>
                                <td>${i.email}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="2">No identities found</td></tr>'}
                    </tbody>
                </table>
                
                <div class="mt-4">
                    <h4>Stats</h4>
                    <p>Total Commits: <strong>${Table.formatNumber(dev?.commit_count || 0)}</strong></p>
                    <p>Lines Added: <span class="text-success">+${Table.formatNumber(dev?.total_lines_added || 0)}</span></p>
                    <p>Lines Removed: <span class="text-danger">-${Table.formatNumber(dev?.total_lines_removed || 0)}</span></p>
                </div>
            `;

            Modal.open('Developer Details', content, { maxWidth: '500px' });

        } catch (error) {
            Toast.show(`Failed to load details: ${error.message}`, 'error');
        }
    },

    async updateName(developerId) {
        const newName = document.getElementById('edit-name').value;

        try {
            await API.developers.update(developerId, { canonical_name: newName });
            Toast.show('Name updated', 'success');
            Modal.close();
            await this.loadDevelopers();
        } catch (error) {
            Toast.show(`Failed: ${error.message}`, 'error');
        }
    },

    showMergeModal(sourceId) {
        const source = this.developers.find(d => d.id === sourceId);
        const others = this.developers.filter(d => d.id !== sourceId);

        const content = `
            <p>Merge <strong>${source?.canonical_name}</strong> into another developer:</p>
            
            <div class="form-group mt-3">
                <label>Target Developer</label>
                <select id="merge-target">
                    <option value="">Select developer...</option>
                    ${others.map(d => `
                        <option value="${d.id}">${d.canonical_name} (${d.commit_count} commits)</option>
                    `).join('')}
                </select>
            </div>
            
            <div class="mt-3 text-muted">
                <p>This will:</p>
                <ul>
                    <li>Move all identities to the target developer</li>
                    <li>Reassign all commits to the target developer</li>
                    <li>Delete the source developer</li>
                </ul>
            </div>
            
            <div class="flex justify-between mt-4">
                <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
                <button class="btn btn-danger" onclick="DevelopersPage.merge(${sourceId})">Merge</button>
            </div>
        `;

        Modal.open('Merge Developer', content, { maxWidth: '450px' });
    },

    async merge(sourceId) {
        const targetId = document.getElementById('merge-target').value;

        if (!targetId) {
            Toast.show('Please select a target developer', 'warning');
            return;
        }

        try {
            await API.developers.merge(sourceId, parseInt(targetId));
            Toast.show('Developers merged successfully', 'success');
            Modal.close();
            await this.loadDevelopers();
        } catch (error) {
            Toast.show(`Merge failed: ${error.message}`, 'error');
        }
    }
};

// Make DevelopersPage globally available
window.DevelopersPage = DevelopersPage;
