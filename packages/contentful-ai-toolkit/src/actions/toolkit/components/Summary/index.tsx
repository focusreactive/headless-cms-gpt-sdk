import { SidebarAppSDK } from '@contentful/app-sdk'
import {
  Form,
  FormControl,
  SectionHeading,
  Paragraph,
  TextInput,
  Button,
  Card,
  Text,
  Box,
} from '@contentful/f36-components'
import { useSDK } from '@contentful/react-apps-toolkit'
import { summariseEntry } from '@focus-reactive/contentful-ai-sdk'
import { SyntheticEvent, useState } from 'react'

const Summary = () => {
  const sdk = useSDK<SidebarAppSDK>()

  const [isLoading, setIsLoading] = useState(false)
  const [contentSummary, setContentSummary] = useState('')

  const onSubmit = async ({
    currentTarget: { elements },
  }: SyntheticEvent<HTMLFormElement>) => {
    const entryId = sdk.entry.getSys().id
    const formElements = elements as typeof elements & {
      entryTitle: { value: string }
    }

    setIsLoading(true)
    summariseEntry({ entryId, entryTitle: formElements.entryTitle.value })
      .then((result) => setContentSummary(result))
      .catch((error) => console.error(error))
      .then(() => setIsLoading(false))
  }

  return (
    <>
      <SectionHeading>Summary</SectionHeading>
      <Paragraph>
        Please enter the Entry title and click the button. We&apos;ll generate a
        content summary for you.
      </Paragraph>

      <Form onSubmit={onSubmit}>
        <FormControl isRequired>
          <FormControl.Label>Entry title</FormControl.Label>
          <TextInput
            placeholder="Rock'n'rolla movie review"
            name="entryTitle"
          />
        </FormControl>

        <Button
          variant="primary"
          type="submit"
          isFullWidth
          isLoading={isLoading}
        >
          Generate summary
        </Button>
      </Form>
      {!!contentSummary && (
        <Box marginTop="spacingL">
          <Card>
            <SectionHeading>Result:</SectionHeading>
            <Text fontSize="fontSizeM">{contentSummary}</Text>
          </Card>
        </Box>
      )}
    </>
  )
}

export default Summary
