const util = require('util');

/**
 * Custom logger for enhanced debugging
 */
const logger = {
    /**
     * Get current timestamp in ISO format
     */
    getTimestamp() {
        return new Date().toISOString();
    },

    /**
     * Format message with timestamp and level
     */
    format(level, message, ...args) {
        const timestamp = this.getTimestamp();
        const formattedArgs = args.map(arg => {
            if (arg instanceof Error) {
                return arg.stack || arg.message;
            }
            if (typeof arg === 'object') {
                return util.inspect(arg, { depth: null, colors: true });
            }
            return arg;
        }).join(' ');

        return `[${timestamp}] [${level}] ${message} ${formattedArgs}`;
    },

    info(message, ...args) {
        console.log(this.format('INFO', message, ...args));
    },

    warn(message, ...args) {
        console.warn(this.format('WARN', message, ...args));
    },

    error(message, ...args) {
        console.error(this.format('ERROR', message, ...args));
    },

    debug(message, ...args) {
        console.log(this.format('DEBUG', message, ...args));
    },

    // Alias for consistency with standard loggers
    log(message, ...args) {
        this.info(message, ...args);
    }
};

module.exports = logger;
