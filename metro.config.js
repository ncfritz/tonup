const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migration files.
config.resolver.sourceExts.push('sql');

module.exports = config;
