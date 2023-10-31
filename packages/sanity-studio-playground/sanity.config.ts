import {defineConfig} from 'sanity'
import {deskTool} from 'sanity/desk'
import {visionTool} from '@sanity/vision'
//import {googleMapsInput} from '@sanity/google-maps-input'
import {schemaTypes} from './schemas'
import {myPlugin} from 'sanity-plugin-focusreactive-ai'

export default defineConfig({
  name: 'default',
  title: 'sanity-ai-plugin',

  projectId: '0xiy76wv',
  dataset: 'production',

  plugins: [
    deskTool(),
    visionTool(),
    myPlugin(),
    //googleMapsInput(),
  ],

  schema: {
    types: schemaTypes,
  },
})
