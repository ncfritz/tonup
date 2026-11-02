// Jest: load .sql migration files as strings, as babel-plugin-inline-import does for Metro.
module.exports = {
  process(source) {
    return { code: `module.exports = ${JSON.stringify(source)};` };
  },
};
