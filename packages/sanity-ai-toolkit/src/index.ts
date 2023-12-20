import {definePlugin} from 'sanity'

import ToolkitAction from './actions/toolkit'
import schemaTypes from './schemas'
interface CommonFeatureConfig {
  enabled: boolean
}
interface Features {
  translate: CommonFeatureConfig
  summary: CommonFeatureConfig
  tags: CommonFeatureConfig
}

interface Config {
  openAiToken: string
  featuresConfig: Features
}

export const myPlugin = definePlugin<Config>(({openAiToken}) => {
  return {
    name: '@focus-reactive/sanity-ai-toolkit',
    document: {
      actions: (prev, context) => {
        // Only add the action for documents of type "movie"
        return [
          ...prev,
          (props) =>
            ToolkitAction({
              ...props,
              context,
              openAiToken: openAiToken,
            }),
        ]
      },
    },
    schema: {
      types: schemaTypes,
    },
  }
})
