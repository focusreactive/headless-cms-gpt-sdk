import {Plugin as Plugin_2} from 'sanity'

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
export declare const myPlugin: Plugin_2<void | MyPluginConfig>

declare interface MyPluginConfig {}

export {}
