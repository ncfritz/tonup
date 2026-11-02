module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Unistyles 3 processes everything under src/ (ADR 0010).
    plugins: [['react-native-unistyles/plugin', { root: 'src' }]],
  };
};
