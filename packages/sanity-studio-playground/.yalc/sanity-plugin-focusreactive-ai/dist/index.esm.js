import { definePlugin } from 'sanity';
import { subtract } from 'focusreactive-ai-sdk';
const myPlugin = definePlugin(function () {
  let config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  console.log("hello from sanity-plugin-focusreactive-ai-test-plugin", subtract(10, 2));
  return {
    name: "sanity-plugin-focusreactive-ai"
  };
});
export { myPlugin };
//# sourceMappingURL=index.esm.js.map
