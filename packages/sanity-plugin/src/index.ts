import {definePlugin} from 'sanity'
import ConfirmDialogAction from './actions/openEditorModal'

interface MyPluginConfig {
  openAiToken: string
}

export const myPlugin = definePlugin<MyPluginConfig>(({openAiToken}) => {
  return {
    name: 'sanity-plugin-focusreactive-ai',
    document: {
      actions: (prev, context) => {
        // Only add the action for documents of type "movie"
        return context.schemaType === 'movie'
          ? [...prev, (props) => ConfirmDialogAction({...props, context, openAiToken})]
          : prev
      },
    },
  }
})
