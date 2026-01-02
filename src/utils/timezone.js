const { format, parseISO } = require('date-fns');
const { toZonedTime, formatInTimeZone } = require('date-fns-tz');

const DEFAULT_TIMEZONE = 'Asia/Manila';

/**
 * Get the configured timezone
 * @returns {string} - Timezone string
 */
function getTimezone() {
    // Could be extended to read from settings
    return DEFAULT_TIMEZONE;
}

/**
 * Format a date/datetime to display in the configured timezone
 * @param {Date|string} date - Date to format
 * @param {string} formatStr - Format string (date-fns format)
 * @returns {string} - Formatted date string
 */
function formatInTz(date, formatStr = 'yyyy-MM-dd HH:mm:ss') {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, getTimezone(), formatStr);
}

/**
 * Convert a date to the configured timezone
 * @param {Date|string} date - Date to convert
 * @returns {Date} - Date in configured timezone
 */
function toLocalTime(date) {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return toZonedTime(dateObj, getTimezone());
}

/**
 * Get start of day in configured timezone
 * @param {Date|string} date - Date 
 * @returns {Date} - Start of day
 */
function startOfDayInTz(date) {
    const local = toLocalTime(date);
    local.setHours(0, 0, 0, 0);
    return local;
}

/**
 * Get end of day in configured timezone
 * @param {Date|string} date - Date
 * @returns {Date} - End of day
 */
function endOfDayInTz(date) {
    const local = toLocalTime(date);
    local.setHours(23, 59, 59, 999);
    return local;
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date
 */
function formatDate(date) {
    return formatInTz(date, 'yyyy-MM-dd');
}

/**
 * Format datetime for display
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted datetime
 */
function formatDateTime(date) {
    return formatInTz(date, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {Date|string} date - Date to format
 * @returns {string} - Relative time string
 */
function formatRelative(date) {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const now = new Date();
    const diffMs = now - dateObj;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return formatDate(date);
}

module.exports = {
    getTimezone,
    formatInTz,
    toLocalTime,
    startOfDayInTz,
    endOfDayInTz,
    formatDate,
    formatDateTime,
    formatRelative,
    DEFAULT_TIMEZONE
};
