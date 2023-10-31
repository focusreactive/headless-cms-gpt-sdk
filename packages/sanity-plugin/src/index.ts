import {definePlugin} from 'sanity'
import {sum} from 'focusreactive-ai-sdk'

interface MyPluginConfig {
  /* nothing here yet */
}

/**
 * Usage in `sanity.config.ts` (or .js)
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {myPlugin} from 'sanity-plugin-focusreactive-ai'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [myPlugin()],
 * })
 * ```
 */
export const myPlugin = definePlugin<MyPluginConfig | void>((config = {}) => {
  // eslint-disable-next-line no-console
  console.log('hello from sanity-plugin-focusreactive-ai-test-plugin', sum(2, 5))
  return {
    name: 'sanity-plugin-focusreactive-ai',
  }
})
