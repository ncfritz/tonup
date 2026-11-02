module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Drizzle migrations are bundled as .sql strings.
      ['inline-import', { extensions: ['.sql'] }],
      // Unistyles 3 processes everything under src/ (ADR 0010).
      ['react-native-unistyles/plugin', { root: 'src' }],
    ],
  };
};
