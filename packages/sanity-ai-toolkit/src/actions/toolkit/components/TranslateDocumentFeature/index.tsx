import React, {useContext, useState, useCallback} from 'react'
import {ActionContext} from '../../context'
import {ParsedDocumentField, parseDocumentFields} from '../../utils/parseDocumentFields'
import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Heading,
  Inline,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@sanity/ui'
import {TypedObject, useClient} from 'sanity'
import {transalateSelectedDocumentFields} from '@focus-reactive/sanity-ai-sdk'
import {PortableText} from '@portabletext/react'

interface TranslateDocumentFeatureProps {
  documentId: string
}

const TranslateDocumentFeature: React.FC<TranslateDocumentFeatureProps> = ({documentId}) => {
  const sanityClient = useClient()
  const [fieldsToTranslate, setFieldsToTranslate] = useState<ParsedDocumentField[]>([])
  const [languageToTranslate, setLanguageToTranslate] = useState<string>('')
  const actionsContext = useContext(ActionContext)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [createNewDocument, setCreateNewDocument] = useState<boolean>(false)
  const [translatedDocumentsFields, setTranslatedDocumentsFields] = useState<{
    [key: string]: unknown
  } | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const onDialogClose = useCallback(() => setIsDialogOpen(false), [])
  const onDialogOpen = useCallback(() => setIsDialogOpen(true), [])

  const updateFieldsToTranslate = (field: ParsedDocumentField) => {
    const isFieldAlreadySelected = fieldsToTranslate.find(
      (selectedField) => selectedField.name === field.name,
    )

    if (isFieldAlreadySelected) {
      setFieldsToTranslate(
        fieldsToTranslate.filter((selectedField) => selectedField.name !== field.name),
      )
    } else {
      setFieldsToTranslate([...fieldsToTranslate, field])
    }
  }

  if (!actionsContext) {
    return null
  }

  const currentSchema = actionsContext.documentSchema.schema.get(
    actionsContext?.documentSchema.schemaType,
  )

  if (!currentSchema) {
    return null
  }

  if (!('fields' in currentSchema)) {
    return null
  }

  const fields = parseDocumentFields(currentSchema).filter(
    (field) => field.type === 'string' || field.type === 'blockContent',
  )

  const onTranslate = async () => {
    setIsLoading(true)

    try {
      const data = await transalateSelectedDocumentFields({
        fieldNames: fieldsToTranslate.map((field) => field.name),
        documentId,
        targetLanguage: languageToTranslate,
        client: sanityClient,
        newDocumentConfig: createNewDocument ? {titleFieldName: 'title'} : undefined,
      })

      setTranslatedDocumentsFields(data)
      if (!createNewDocument) {
        onDialogOpen()
      }
    } catch (error) {
      console.error(error)
    }

    setIsLoading(false)

    if (createNewDocument) {
      actionsContext.onFeatureComplete()
    }
  }

  return (
    <Card marginY={2}>
      {isDialogOpen && translatedDocumentsFields && (
        <Dialog
          header="Translated values"
          id="dialog-example"
          onClose={onDialogClose}
          zOffset={1000}
          width={2}
          marginWidth={8}
        >
          <Box padding={4}>
            {fieldsToTranslate.map((field) => {
              return (
                <div key={field.name}>
                  <Card marginTop={5}>
                    <Heading as="h5" size={2}>
                      {field.title}
                    </Heading>
                  </Card>
                  <div
                    style={{
                      width: '100%',
                      height: '1px',
                      margin: '12px 0',
                      backgroundColor: 'rgb(134, 144, 160)',
                    }}
                  />
                  <Card marginTop={4} marginBottom={4}>
                    {field.type === 'blockContent' ? (
                      <Text>
                        <PortableText
                          value={translatedDocumentsFields[field.name] as TypedObject}
                        />
                      </Text>
                    ) : (
                      <Text size={2}>{translatedDocumentsFields[field.name] as string}</Text>
                    )}
                  </Card>
                </div>
              )
            })}
          </Box>
        </Dialog>
      )}

      <Heading as="h1" size={2}>
        Translations
      </Heading>
      <Stack marginY={4}>
        <Text size={2}>Hey! We found several fields that we can translate for you:</Text>
      </Stack>

      <Card marginTop={5} style={{textAlign: 'center'}}>
        <TextInput
          style={{flexGrow: 1}}
          padding={4}
          onChange={(event) => setLanguageToTranslate(event.currentTarget.value)}
          placeholder="Please enter the target language"
          value={languageToTranslate}
        />
        <Flex
          marginY={2}
          align="center"
          justify="center"
          onClick={() => setCreateNewDocument(!createNewDocument)}
        >
          <Text>Create new document</Text>
          <Inline marginLeft={4}>
            <Switch checked={createNewDocument} />
          </Inline>
        </Flex>
      </Card>

      <Grid columns={2} gap={[4]} padding={0} marginTop={5}>
        {fields.map((field) => {
          const isFieldAlreadySelected = !!fieldsToTranslate.find(
            (fieldToTranslate) => fieldToTranslate.name === field.name,
          )

          return (
            <Card
              key={field.name}
              padding={[3, 3, 4]}
              radius={2}
              shadow={1}
              tone={isFieldAlreadySelected ? 'positive' : 'primary'}
              onClick={() => updateFieldsToTranslate(field)}
            >
              <Flex marginY={1} align="center" justify="center">
                <Text>{field.title}</Text>
                <Inline marginLeft={4}>
                  <Switch checked={isFieldAlreadySelected} />
                </Inline>
              </Flex>
            </Card>
          )
        })}
      </Grid>
      <Card marginTop={5} style={{textAlign: 'center'}}>
        <Flex justify="center" align="center">
          <Button
            onClick={onTranslate}
            fontSize={[2, 2, 3]}
            mode="default"
            tone="primary"
            padding={[3, 3, 4]}
            text={createNewDocument ? 'Create' : 'Translate'}
            disabled={!sanityClient || !fieldsToTranslate.length || !languageToTranslate}
            loading={isLoading}
          />
        </Flex>
      </Card>
    </Card>
  )
}

export default TranslateDocumentFeature
