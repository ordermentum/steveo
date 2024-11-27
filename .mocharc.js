module.exports = {
  bail: false,
  colors: true,
  exit: true,
  extension: ["ts", "js"],
  'fail-zero': false,
  file: ['test/*_test.ts', 'test/**/*_test.ts'],
  maxHttpHeaderSize: 16384,
  recursive: true,
  require: [
    "ts-node/register",
    "source-map-support/register"
  ],
  retries: 0,
  timeout: 160000,
};
