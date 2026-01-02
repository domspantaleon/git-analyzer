const axios = require('axios');
const db = require('../db');

/**
 * Ollama integration for AI-powered code summaries
 */

/**
 * Get Ollama configuration from settings
 */
function getOllamaConfig() {
    return {
        endpoint: db.getSetting('ollama_endpoint') || 'http://localhost:11434',
        model: db.getSetting('ollama_model') || 'llama3'
    };
}

/**
 * Test connection to Ollama
 */
async function testConnection() {
    const config = getOllamaConfig();

    try {
        const response = await axios.get(`${config.endpoint}/api/tags`, {
            timeout: 5000
        });

        const models = response.data.models || [];
        const hasModel = models.some(m => m.name.startsWith(config.model));

        if (hasModel) {
            return {
                success: true,
                message: `Connected successfully. Model '${config.model}' is available.`
            };
        } else {
            return {
                success: true,
                message: `Connected successfully, but model '${config.model}' not found. Available models: ${models.map(m => m.name).join(', ')}`
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.message || 'Failed to connect to Ollama'
        };
    }
}

/**
 * Generate AI summary for a commit diff
 */
async function generateCommitSummary(commitMessage, diffContent, options = {}) {
    const config = getOllamaConfig();

    // Truncate diff if too long
    const maxDiffLength = options.maxDiffLength || 8000;
    let truncatedDiff = diffContent;
    if (diffContent.length > maxDiffLength) {
        truncatedDiff = diffContent.substring(0, maxDiffLength) + '\n... (truncated)';
    }

    const prompt = `You are a code reviewer. Analyze this git commit and provide a brief, professional summary.

Commit Message: ${commitMessage}

Code Changes (diff):
\`\`\`
${truncatedDiff}
\`\`\`

Please provide:
1. A one-sentence summary of what this commit does
2. Key changes made (bullet points, max 5)
3. Any potential concerns or suggestions (if any)

Keep your response concise and focused on the technical changes.`;

    try {
        const response = await axios.post(`${config.endpoint}/api/generate`, {
            model: config.model,
            prompt,
            stream: false,
            options: {
                temperature: 0.3,
                top_p: 0.9
            }
        }, {
            timeout: 60000  // 60 second timeout
        });

        return {
            success: true,
            summary: response.data.response
        };
    } catch (error) {
        return {
            success: false,
            error: error.message || 'Failed to generate summary'
        };
    }
}

/**
 * Generate summary for code patterns analysis
 */
async function analyzeCodePatterns(diffContent, context = '') {
    const config = getOllamaConfig();

    const prompt = `Analyze the following code changes for common patterns and potential issues:

${context ? `Context: ${context}\n\n` : ''}
Code Changes:
\`\`\`
${diffContent.substring(0, 6000)}
\`\`\`

Look for:
1. Code quality issues
2. Potential bugs
3. Best practice violations
4. Any signs of copy-pasted or generated code

Provide brief, actionable feedback.`;

    try {
        const response = await axios.post(`${config.endpoint}/api/generate`, {
            model: config.model,
            prompt,
            stream: false,
            options: {
                temperature: 0.3
            }
        }, {
            timeout: 60000
        });

        return {
            success: true,
            analysis: response.data.response
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    getOllamaConfig,
    testConnection,
    generateCommitSummary,
    analyzeCodePatterns
};
