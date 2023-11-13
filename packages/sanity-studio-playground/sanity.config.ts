import {defineConfig} from 'sanity'
import {deskTool} from 'sanity/desk'
import {visionTool} from '@sanity/vision'
//import {googleMapsInput} from '@sanity/google-maps-input'
import {schemaTypes} from './schemas'
import TranslateAction from './actions/translations'
// import {myPlugin} from 'sanity-plugin-focusreactive-ai'

export default defineConfig({
  name: 'default',
  title: 'sanity-ai-plugin',

  projectId: '0xiy76wv',
  dataset: 'production',

  plugins: [
    deskTool(),
    visionTool(),
    // myPlugin({openAiToken: process.env.SANITY_STUDIO_OPENAI_TOKEN as string}),
    //googleMapsInput(),
  ],

  document: {
    actions: (prev, context) => {
      // Only add the action for documents of type "movie"
      return context.schemaType === 'movie'
        ? [...prev, (props) => TranslateAction({...props, context, openAiToken: process.env.SANITY_STUDIO_OPENAI_TOKEN as string})]
        : prev
    },
  },

  schema: {
    types: schemaTypes,
  },
})
