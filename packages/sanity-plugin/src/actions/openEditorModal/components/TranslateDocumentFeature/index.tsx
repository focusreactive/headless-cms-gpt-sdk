import React, {useContext, useState} from 'react'
import {ActionContext} from '../../context'
import {ParsedDocumentField, parseDocumentFields} from '../../utils/parseDocumentFields'
import {Button, Card, Flex, Grid, Heading, Inline, Stack, Switch, Text, TextInput} from '@sanity/ui'
import {useClient} from 'sanity'
import {translateFields} from './utils/translateFileds'
const TranslateDocumentFeature: React.FC = () => {
  const sanityClient = useClient()
  const [fieldsToTranslate, setFieldsToTranslate] = useState<ParsedDocumentField[]>([])
  const [languageToTranslate, setLanguageToTranslate] = useState<string>('')
  const actionsContext = useContext(ActionContext)
  const [isLoading, setIsLoading] = useState<boolean>(false)

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

  const fields = parseDocumentFields(currentSchema).filter((field) => field.type === 'string')

  const onTranslate = async () => {
    setIsLoading(true)
    await translateFields(
      fieldsToTranslate,
      actionsContext.documentId,
      languageToTranslate,
      sanityClient,
    )
    setIsLoading(false)
    actionsContext.onFeatureComplete()
  }

  return (
    <Card marginY={2}>
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
            text="Translate and Update"
            disabled={!sanityClient || !fieldsToTranslate.length || !languageToTranslate}
            loading={isLoading}
          />
        </Flex>
      </Card>
    </Card>
  )
}

export default TranslateDocumentFeature
