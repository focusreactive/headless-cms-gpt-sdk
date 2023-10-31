import { definePlugin } from 'sanity';
const n = (t, r) => t - r;
const myPlugin = definePlugin(function () {
  let config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  console.log("hello from sanity-plugin-focusreactive-ai-test-plugin", n(10, 2));
  return {
    name: "sanity-plugin-focusreactive-ai"
  };
});
export { myPlugin };
//# sourceMappingURL=index.esm.js.map
