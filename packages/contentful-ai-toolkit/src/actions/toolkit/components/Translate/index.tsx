import { SidebarAppSDK } from '@contentful/app-sdk'
import {
  Box,
  Button,
  Form,
  FormControl,
  Note,
  Paragraph,
  Select,
  Subheading,
} from '@contentful/f36-components'
import { useSDK } from '@contentful/react-apps-toolkit'
import { useEffect } from 'react'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { resolveEntries } from '@focus-reactive/contentful-ai-sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { localize } from '@focus-reactive/contentful-ai-sdk'

enum TranslationLevels {
  Field = 'field',
  Entry = 'entry',
}

export default function Translate() {
  const sdk = useSDK<SidebarAppSDK>()
  const formMethods = useForm({
    defaultValues: { translationLevel: 'field', targetLanguage: '' },
  })
  const { register, handleSubmit, watch } = formMethods

  const watchedTranslationLevel = watch('translationLevel')

  const { mutate, isSuccess, isPending } = useMutation({ mutationFn: localize })

  const onSubmit = (data) => {
    mutate({
      targetLanguage: data.targetLanguage,
      translationLevel: data.translationLevel,
      entryId: sdk.entry.getSys().id,
      localEntryId: data.local,
      globalEntryId: data.global,
    })
    // sdk.cma.entry.get({ entryId: data.global }).then((entry) => {
    //   console.log('entry', entry)
    // })
  }

  const { locales } = sdk
  return (
    <>
      <Subheading>Localization</Subheading>
      <Paragraph>
        Please select your target language and click the button. We will update
        the page with translations once it's ready.
      </Paragraph>

      <FormProvider {...formMethods}>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <FormControl isRequired>
            <FormControl.Label>Translation level</FormControl.Label>
            <Select {...register('translationLevel')}>
              <Select.Option value={TranslationLevels.Field}>
                Field
              </Select.Option>
              <Select.Option value={TranslationLevels.Entry}>
                Entry
              </Select.Option>
            </Select>
          </FormControl>

          <FormControl isRequired>
            <FormControl.Label>Target language</FormControl.Label>
            <Select {...register('targetLanguage', { required: true })}>
              <Select.Option value="" />
              {locales.available
                .filter((item) => item !== locales.default)
                .map((item) => (
                  <Select.Option
                    key={item}
                    value={item}
                  >
                    {locales.names[item]}
                  </Select.Option>
                ))}
            </Select>
          </FormControl>

          {watchedTranslationLevel === TranslationLevels.Entry && (
            <EntryLevelSection />
          )}

          <Button
            variant="primary"
            type="submit"
            isFullWidth
            isLoading={isPending}
          >
            Localize
          </Button>
          {isSuccess && (
            <Box marginTop="spacingL">
              <Note>Translation completed!</Note>
            </Box>
          )}
        </Form>
      </FormProvider>
    </>
  )
}

const EntryLevelSection = () => {
  const { register, setValue, resetField } = useFormContext()
  const sdk = useSDK<SidebarAppSDK>()

  const { data, isLoading } = useQuery({
    queryKey: ['resolveEntries'],
    queryFn: () => resolveEntries(sdk.entry.getSys().id),
  })

  useEffect(() => {
    if (data) {
      setValue('global', data.global.id)
      setValue('local', data.local.id)
    }
  }, [data])

  useEffect(() => {
    return () => {
      resetField('global')
      resetField('local')
    }
  }, [])

  return (
    <>
      <FormControl isDisabled={isLoading}>
        <FormControl.Label>Source local entry</FormControl.Label>
        <Select {...register('local')}>
          {isLoading ? (
            <Select.Option>...Loading</Select.Option>
          ) : (
            <EntrySelectOption entry={data!.local} />
          )}
        </Select>
        <FormControl.HelpText>
          Local entry was identified automatically
        </FormControl.HelpText>
      </FormControl>

      <FormControl isDisabled={isLoading}>
        <FormControl.Label>Global entry</FormControl.Label>
        <Select {...register('global')}>
          {isLoading ? (
            <Select.Option>...Loading</Select.Option>
          ) : (
            <EntrySelectOption entry={data!.global} />
          )}
        </Select>
        <FormControl.HelpText>
          Global entry was identified automatically
        </FormControl.HelpText>
      </FormControl>
    </>
  )
}

const EntrySelectOption = ({
  entry,
}: {
  entry: { id: string; name: string; contentType: { id: string; name: string } }
}) => {
  return (
    <Select.Option value={entry.id}>
      {`${entry.name} (${entry.contentType.name})`}
    </Select.Option>
  )
}
