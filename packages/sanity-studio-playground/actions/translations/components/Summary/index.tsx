import React, {useContext, useState} from 'react'
import {ActionContext} from '../../context'
import {Button, Card, Flex, Heading, Stack, Text, TextInput} from '@sanity/ui'
import {useClient} from 'sanity'
import {summariseDocument} from 'sanity-ai-sdk'

interface SumariseDocumentProps {
  documentId: string
}

const SumariseDocument: React.FC<SumariseDocumentProps> = ({documentId}) => {
  const sanityClient = useClient()
  const actionsContext = useContext(ActionContext)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [contentTitle, setContentTitle] = useState<string>('')
  const [contentSummary, setContentSummary] = useState<string>('')

  if (!actionsContext) {
    return null
  }

  const getSummary = async () => {
    setIsLoading(true)
    const result = await summariseDocument({
      documentId: actionsContext.documentId,
      contentTitle,
    })

    setContentSummary(result)
    setIsLoading(false)
  }

  return (
    <Card marginY={2}>
      <Heading as="h3" size={2}>
        Summary
      </Heading>
      <Stack marginY={4}>
        <Text size={2}>
          Hey! Please enter a content title and click the button. We&apos;ll generate a summary of
          the content for you.
        </Text>
      </Stack>

      <Card marginTop={5} style={{textAlign: 'center'}}>
        <TextInput
          style={{flexGrow: 1}}
          padding={4}
          onChange={(event) => setContentTitle(event.currentTarget.value)}
          placeholder="Rock'n'rolla movie review"
          value={contentTitle}
        />
      </Card>
      {!!contentSummary && (
        <>
          <Card marginTop={5}>
            <Heading as="h3" size={2}>
              Result:
            </Heading>
          </Card>
          <Card marginTop={4}>
            <Text size={2}>{contentSummary}</Text>
          </Card>
        </>
      )}
      <Card marginTop={5} style={{textAlign: 'center'}}>
        <Flex justify="center" align="center">
          <Button
            onClick={getSummary}
            fontSize={[2, 2, 3]}
            mode="default"
            tone="primary"
            padding={[3, 3, 4]}
            text={contentSummary ? 'Regenerate summary' : 'Generate summary'}
            disabled={!sanityClient || !contentTitle}
            loading={isLoading}
          />
        </Flex>
      </Card>
    </Card>
  )
}

export default SumariseDocument
