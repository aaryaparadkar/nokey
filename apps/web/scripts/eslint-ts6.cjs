// typescript-eslint refuses TypeScript 7, which this repo builds with. The Sodium lint only parses
// syntax (no type info), so while eslint runs, hand @typescript-eslint the TS 6 API instead.
const Module = require("node:module");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "typescript" && /@typescript-eslint|ts-api-utils/.test(parent?.filename ?? "")) {
    return resolve.call(this, "typescript6", module, ...rest);
  }
  return resolve.call(this, request, parent, ...rest);
};
