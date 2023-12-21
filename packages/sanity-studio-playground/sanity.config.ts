import {defineConfig} from 'sanity'
import {deskTool} from 'sanity/desk'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemas'
import {aiToolkit} from '@focus-reactive/sanity-ai-toolkit'

export default defineConfig({
  name: 'default',
  title: 'sanity-ai-plugin',

  projectId: '0xiy76wv',
  dataset: 'production',

  plugins: [
    deskTool(),
    aiToolkit({
      openAiToken: process.env.SANITY_STUDIO_OPENAI_TOKEN as string,
      featuresConfig: {
        translate: {enabled: true},
        summary: {enabled: false},
        tags: {enabled: true},
      },
    }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },
})
