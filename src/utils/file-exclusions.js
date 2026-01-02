// File exclusion rules for line count calculations

const EXCLUDED_EXTENSIONS = [
    '.lock',
    '.min.js',
    '.min.css',
    '.map',
    '.designer.vb',
    '.designer.cs',
    '.Designer.vb',
    '.Designer.cs',
    '.resx',
    '.g.cs',
    '.g.vb'
];

const EXCLUDED_FILENAMES = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'composer.lock',
    'Gemfile.lock',
    'packages.lock.json'
];

const EXCLUDED_DIRECTORIES = [
    'bin/',
    'obj/',
    'packages/',
    'node_modules/',
    '.vs/',
    '.vscode/',
    '.idea/',
    'TestResults/',
    'Debug/',
    'Release/'
];

const EXCLUDED_PATTERNS = [
    /Migrations\/.*\.(cs|vb)$/i
];

/**
 * Check if a file should be excluded from line count calculations
 * @param {string} filepath - The file path to check
 * @returns {boolean} - True if the file should be excluded
 */
function isFileExcluded(filepath) {
    const normalizedPath = filepath.replace(/\\/g, '/');
    const filename = normalizedPath.split('/').pop();
    const lowerFilename = filename.toLowerCase();

    // Check by exact filename
    if (EXCLUDED_FILENAMES.some(f => f.toLowerCase() === lowerFilename)) {
        return true;
    }

    // Check by extension
    for (const ext of EXCLUDED_EXTENSIONS) {
        if (lowerFilename.endsWith(ext.toLowerCase())) {
            return true;
        }
    }

    // Check by directory
    for (const dir of EXCLUDED_DIRECTORIES) {
        if (normalizedPath.includes('/' + dir) || normalizedPath.startsWith(dir)) {
            return true;
        }
    }

    // Check by pattern
    for (const pattern of EXCLUDED_PATTERNS) {
        if (pattern.test(normalizedPath)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a file is a config file
 * @param {string} filepath - The file path to check
 * @returns {boolean} - True if the file is a config file
 */
function isConfigFile(filepath) {
    const configExtensions = ['.json', '.xml', '.config', '.yml', '.yaml', '.env', '.ini', '.toml'];
    const lowerPath = filepath.toLowerCase();
    return configExtensions.some(ext => lowerPath.endsWith(ext));
}

module.exports = {
    isFileExcluded,
    isConfigFile,
    EXCLUDED_EXTENSIONS,
    EXCLUDED_FILENAMES,
    EXCLUDED_DIRECTORIES,
    EXCLUDED_PATTERNS
};
