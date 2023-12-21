# @focus-reactive/sanity-ai-toolkit

> This is a **Sanity Studio v3** plugin.

## Installation

```sh
npm install @focus-reactive/sanity-ai-toolkit
```

## Usage

Add it as a plugin in `sanity.config.ts` (or .js):

```ts
import {defineConfig} from 'sanity'
import {aiToolkit} from '@focus-reactive/sanity-ai-toolkit'

export default defineConfig({
  //...
  plugins: [
    aiToolkit({
      openAiToken: process.env.SANITY_STUDIO_OPENAI_TOKEN as string,
      featuresConfig: {
        translate: {enabled: true},
        summary: {enabled: false},
        tags: {enabled: true},
      },
    }),
  ],
})
```

## License

[MIT](LICENSE) © Alex Hramovich

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugin-kit)
with default configuration for build & watch scripts.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugin-kit#testing-a-plugin-in-sanity-studio)
on how to run this plugin with hotreload in the studio.
