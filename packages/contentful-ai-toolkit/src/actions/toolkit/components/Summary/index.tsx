import { SidebarAppSDK } from '@contentful/app-sdk'
import {
  Form,
  FormControl,
  Subheading,
  Paragraph,
  TextInput,
  Button,
  Card,
  Text,
  Box,
} from '@contentful/f36-components'
import { useSDK } from '@contentful/react-apps-toolkit'
import { summariseEntry } from '@focus-reactive/contentful-ai-sdk'
import { useMutation } from '@tanstack/react-query'
import { SyntheticEvent } from 'react'
import ContactSupport from '../../../../components/ContactSupport'
import useDebug from '../../../../hooks/useDebug'

const Summary = () => {
  const sdk = useSDK<SidebarAppSDK>()

  const { $debugContext, $setDebugMeta } = useDebug()

  const {
    mutate,
    isPending,
    error,
    isSuccess,
    data: contentSummary,
  } = useMutation({
    mutationFn: summariseEntry,
    onError: (error, variables) => {
      $setDebugMeta({ function: 'summariseEntry', input: variables, error })
    },
  })

  const onSubmit = async ({ currentTarget: { elements } }: SyntheticEvent<HTMLFormElement>) => {
    const entryId = sdk.entry.getSys().id
    const formElements = elements as typeof elements & {
      entryTitle: { value: string }
    }

    mutate({ entryId, entryTitle: formElements.entryTitle.value })
  }

  return (
    <>
      <Subheading>Summary</Subheading>
      <Paragraph>
        Please enter the Entry title and click the button to generate a content summary.
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
          isLoading={isPending}
        >
          Generate summary
        </Button>
      </Form>
      {isSuccess && !!contentSummary && (
        <Box marginTop="spacingL">
          <Card>
            <Subheading>Result:</Subheading>
            <Text fontSize="fontSizeM">{contentSummary}</Text>
          </Card>
        </Box>
      )}
      {error && (
        <Box marginTop="spacingL">
          <ContactSupport message={$debugContext} />
        </Box>
      )}
    </>
  )
}

export default Summary
