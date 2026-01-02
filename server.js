const express = require('express');
const path = require('path');
const morgan = require('morgan');
const { initializeDatabase } = require('./database/init');
const logger = require('./src/utils/logger');

// Import routes
const settingsRoutes = require('./src/routes/settings');
const platformsRoutes = require('./src/routes/platforms');
const repositoriesRoutes = require('./src/routes/repositories');
const branchesRoutes = require('./src/routes/branches');
const commitsRoutes = require('./src/routes/commits');
const developersRoutes = require('./src/routes/developers');
const analyticsRoutes = require('./src/routes/analytics');
const exportRoutes = require('./src/routes/export');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP Request Logging
app.use(morgan('dev'));

// Detailed Request Logging (optional, for debugging body/query)
app.use((req, res, next) => {
    if (Object.keys(req.body).length > 0) {
        logger.debug(`${req.method} ${req.url} Body:`, req.body);
    }
    if (Object.keys(req.query).length > 0) {
        logger.debug(`${req.method} ${req.url} Query:`, req.query);
    }
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/settings', settingsRoutes);
app.use('/api/platforms', platformsRoutes);
app.use('/api/repositories', repositoriesRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/commits', commitsRoutes);
app.use('/api/developers', developersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            logger.info(`Git Analyzer running at http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        logger.error('Failed to initialize database:', err);
        process.exit(1);
    });

module.exports = app;
