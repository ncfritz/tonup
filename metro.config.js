const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migration files.
config.resolver.sourceExts.push('sql');

// Ton Up Lab (lab/) is a separate Next.js project with its own node_modules (ADR 0012); keep
// Metro from crawling or resolving anything in it.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lab = escape(path.resolve(__dirname, 'lab'));
const blockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []),
  new RegExp(`^${lab}[/\\\\]`),
];

module.exports = config;
