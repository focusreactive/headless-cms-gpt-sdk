'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var sanity = require('sanity');
var focusreactiveAiSdk = require('focusreactive-ai-sdk');
const myPlugin = sanity.definePlugin(function () {
  let config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  console.log("hello from sanity-plugin-focusreactive-ai-test-plugin", focusreactiveAiSdk.subtract(10, 2));
  return {
    name: "sanity-plugin-focusreactive-ai"
  };
});
exports.myPlugin = myPlugin;
//# sourceMappingURL=index.js.map
