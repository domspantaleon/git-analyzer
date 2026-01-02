/**
 * API Client Module
 * Handles all communication with the backend API
 */

const API = {
    baseUrl: '/api',

    /**
     * Make an API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const method = options.method || 'GET';
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        // Log request to console panel
        if (window.Console) {
            Console.info(`→ ${method} ${endpoint}`);
        }

        try {
            const response = await fetch(url, config);

            // Handle non-JSON responses (like CSV/PDF)
            const contentType = response.headers.get('content-type');
            if (contentType && !contentType.includes('application/json')) {
                if (!response.ok) {
                    if (window.Console) {
                        Console.error(`← ${method} ${endpoint} → HTTP ${response.status}`);
                    }
                    throw new Error(`HTTP ${response.status}`);
                }
                if (window.Console) {
                    Console.success(`← ${method} ${endpoint} → ${response.status} (binary)`);
                }
                return response;
            }

            const data = await response.json();

            if (!response.ok) {
                if (window.Console) {
                    Console.error(`← ${method} ${endpoint} → ${response.status}`, data);
                }
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            // Log success
            if (window.Console) {
                const summary = this.summarizeResponse(data);
                Console.success(`← ${method} ${endpoint} → ${response.status}${summary}`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            if (window.Console) {
                Console.error(`✗ ${method} ${endpoint} → ${error.message}`);
            }
            throw error;
        }
    },

    /**
     * Create a short summary of response data for logging
     */
    summarizeResponse(data) {
        if (!data) return '';
        if (Array.isArray(data)) return ` (${data.length} items)`;
        if (data.data && Array.isArray(data.data)) return ` (${data.data.length} items)`;
        if (data.success !== undefined) return data.success ? ' ✓' : ' ✗';
        if (data.total !== undefined) return ` (total: ${data.total})`;
        if (data.id) return ` (id: ${data.id})`;
        return '';
    },

    // Settings
    settings: {
        get: () => API.request('/settings'),
        update: (settings) => API.request('/settings', { method: 'PUT', body: settings })
    },

    // Platforms
    platforms: {
        list: () => API.request('/platforms'),
        create: (data) => API.request('/platforms', { method: 'POST', body: data }),
        update: (id, data) => API.request(`/platforms/${id}`, { method: 'PUT', body: data }),
        delete: (id) => API.request(`/platforms/${id}`, { method: 'DELETE' }),
        test: (id) => API.request(`/platforms/${id}/test`, { method: 'POST' })
    },

    // Repositories
    repositories: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/repositories${query ? '?' + query : ''}`);
        },
        sync: () => API.request('/repositories/sync', { method: 'POST' }),
        select: (id, selected) => API.request(`/repositories/${id}/select`, {
            method: 'PUT',
            body: { selected }
        }),
        selectAll: (selected, platformId = null) => API.request('/repositories/select-all', {
            method: 'PUT',
            body: { selected, platform_id: platformId }
        })
    },

    // Branches
    branches: {
        list: (repoId) => API.request(`/branches/${repoId}`),
        sync: () => API.request('/branches/sync', { method: 'POST' })
    },

    // Commits
    commits: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/commits${query ? '?' + query : ''}`);
        },
        sync: async (from, to, force = false, onProgress = null) => {
            const endpoint = '/commits/sync';
            if (window.Console) {
                Console.info(`→ POST ${endpoint} (stream)`);
            }

            try {
                const response = await fetch('/api/commits/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ from, to, force })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || `HTTP ${response.status}`);
                }

                // Read stream
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let finalResult = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop(); // Keep incomplete chunk

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'complete') {
                                finalResult = data.result;
                            } else if (data.type === 'error') {
                                throw new Error(data.error);
                            } else if (onProgress) {
                                onProgress(data);
                            }
                        }
                    }
                }

                if (window.Console) {
                    // Summarize result for logs
                    const summary = finalResult ? ` (${finalResult.success || 0} synced)` : '';
                    Console.success(`← POST ${endpoint} → 200${summary}`);
                }

                return finalResult;
            } catch (error) {
                console.error('Sync Error:', error);
                if (window.Console) {
                    Console.error(`✗ POST ${endpoint} → ${error.message}`);
                }
                throw error;
            }
        },
        get: (id) => API.request(`/commits/${id}`),
        getDiff: (id) => API.request(`/commits/${id}/diff`),
        getAISummary: (id) => API.request(`/commits/${id}/ai-summary`)
    },

    // Developers
    developers: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/developers${query ? '?' + query : ''}`);
        },
        update: (id, data) => API.request(`/developers/${id}`, { method: 'PUT', body: data }),
        merge: (sourceId, targetId) => API.request('/developers/merge', {
            method: 'POST',
            body: { source_id: sourceId, target_id: targetId }
        }),
        getIdentities: (id) => API.request(`/developers/${id}/identities`)
    },

    // Analytics
    analytics: {
        summary: (from, to) => {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            return API.request(`/analytics/summary?${params.toString()}`);
        },
        byDeveloper: (from, to) => {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            return API.request(`/analytics/by-developer?${params.toString()}`);
        },
        byRepository: (from, to) => {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            return API.request(`/analytics/by-repository?${params.toString()}`);
        },
        timeline: (from, to, granularity = 'day') => {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            params.set('granularity', granularity);
            return API.request(`/analytics/timeline?${params.toString()}`);
        },
        flags: (from, to) => {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            return API.request(`/analytics/flags?${params.toString()}`);
        }
    },

    // Export
    export: {
        csv: (from, to, type = 'developer') => {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            params.set('type', type);
            return API.request(`/export/summary/csv?${params.toString()}`);
        },
        pdf: (from, to, type = 'developer') => {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            params.set('type', type);
            return API.request(`/export/summary/pdf?${params.toString()}`);
        }
    },

    // Ollama
    ollama: {
        test: () => API.request('/settings').then(settings => {
            // Test via settings update trigger
            return fetch(`${settings.ollama_endpoint || 'http://localhost:11434'}/api/tags`)
                .then(r => r.ok ? { success: true } : { success: false })
                .catch(() => ({ success: false }));
        })
    }
};

// Make API globally available
window.API = API;
