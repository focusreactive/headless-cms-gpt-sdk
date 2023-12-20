import {defineConfig} from 'sanity'
import {deskTool} from 'sanity/desk'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemas'
import {myPlugin} from '@focus-reactive/sanity-ai-toolkit'

export default defineConfig({
  name: 'default',
  title: 'sanity-ai-plugin',

  projectId: '0xiy76wv',
  dataset: 'production',

  plugins: [
    deskTool(),
    myPlugin({
      openAiToken: process.env.SANITY_STUDIO_OPENAI_TOKEN as string,
      featuresConfig: {
        translate: {enabled: true},
        summary: {enabled: false},
        tags: {enabled: true},
      },
    }),
    visionTool(),
    // myPlugin({openAiToken: process.env.SANITY_STUDIO_OPENAI_TOKEN as string}),
  ],

  schema: {
    types: schemaTypes,
  },
})
