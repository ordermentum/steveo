module.exports = {
  bail: false,
  colors: true,
  exit: true,
  extension: ["ts", "js"],
  maxHttpHeaderSize: 16384,
  recursive: true,
  require: [
    "ts-node/register",
    "source-map-support/register"
  ],
  retries: 0,
  spec: 'test/**/*_test.ts',
  timeout: 160000,
};
