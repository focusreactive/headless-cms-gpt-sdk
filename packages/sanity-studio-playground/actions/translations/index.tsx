import React, {useEffect} from 'react'
import {ActionComponent, DocumentActionProps, DocumentActionsContext, useClient} from 'sanity'
import ContentLayout from './components/ContentLayout'
import {configurateOpenAi} from 'focusreactive-ai-sdk'
import {initSDK, translateFullDocument} from 'sanity-ai-sdk'

interface Props extends DocumentActionProps {
  context: DocumentActionsContext
  openAiToken: string
}

const ConfirmDialogAction: ActionComponent<Props> = (props) => {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const client = useClient()

  useEffect(() => {
    initSDK({client, openAiKey: props.openAiToken})

    translateFullDocument({
      documentId: props.id,
      currentLanguage: 'english',
      targetLanguage: 'russian',
    })
  }, [client])

  configurateOpenAi(props.openAiToken)

  return {
    label: 'Ai assist',
    onHandle: () => {
      setDialogOpen(true)
    },
    dialog: dialogOpen && {
      type: 'dialog',
      onClose: props.onComplete,
      content: (
        <ContentLayout
          documentSchema={props.context}
          documentId={props.id}
          onFeatureComplete={() => setDialogOpen(false)}
        />
      ),
      header: 'AI assisted editing',
    },
  }
}

export default ConfirmDialogAction
