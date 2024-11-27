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
import { resolveEntries, localize, RecognizedEntry } from '@focus-reactive/contentful-ai-sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import useDebug from '@/hooks/useDebug'
import ContactSupport from '@/components/ContactSupport'

enum TranslationLevels {
  Field = 'field',
  Entry = 'entry',
}

export default function Translate() {
  const sdk = useSDK<SidebarAppSDK>()
  const { $debugContext, $setDebugMeta } = useDebug()
  const formMethods = useForm({
    defaultValues: {
      translationLevel: TranslationLevels.Field,
      targetLanguage: '',
    },
  })
  const {
    register,
    handleSubmit,
    watch,
    formState: { isValid },
  } = formMethods

  const watchedTranslationLevel = watch('translationLevel')

  const { mutate, isSuccess, isPending, error, reset } = useMutation({
    mutationFn: localize,
    onError: (error, variables) => {
      $setDebugMeta({ function: 'localize', input: variables, error })
    },
  })

  useEffect(() => {
    reset()
  }, [watchedTranslationLevel])

  const onSubmit = (data) => {
    mutate({
      targetLanguage: data.targetLanguage,
      translationLevel: data.translationLevel,
      entryId: sdk.entry.getSys().id,
      localEntryId: data.local,
      globalEntryId: data.global,
    })
  }

  const { locales } = sdk
  return (
    <>
      <Subheading>Localization</Subheading>
      <Paragraph>
        Please select your target language and click the button. We will update the page with
        translations once it's ready.
      </Paragraph>

      <FormProvider {...formMethods}>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <FormControl isRequired>
            <FormControl.Label>Translation level</FormControl.Label>
            <Select {...register('translationLevel')}>
              <Select.Option value={TranslationLevels.Field}>Field</Select.Option>
              <Select.Option value={TranslationLevels.Entry}>Entry</Select.Option>
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

          {watchedTranslationLevel === TranslationLevels.Entry && <EntryLevelSection />}

          <Button
            variant="primary"
            type="submit"
            isFullWidth
            isLoading={isPending}
            isDisabled={!isValid}
          >
            Localize
          </Button>
          {isSuccess && (
            <Box marginTop="spacingL">
              <Note title="Translation completed">
                {watchedTranslationLevel === TranslationLevels.Field
                  ? `If the changes aren't visible, please reload the page.`
                  : `A new local entry was created, and the global entry was updated accordingly.`}
              </Note>
            </Box>
          )}
          {error && (
            <Box marginTop="spacingL">
              <ContactSupport message={$debugContext} />
            </Box>
          )}
        </Form>
      </FormProvider>
    </>
  )
}

const EntryLevelSection = () => {
  const { setValue, resetField } = useFormContext()
  const sdk = useSDK<SidebarAppSDK>()

  const { data: resolved, isLoading } = useQuery({
    queryKey: ['resolveEntries'],
    queryFn: () => resolveEntries(sdk.entry.getSys().id),
  })

  useEffect(() => {
    if (resolved && resolved.global && resolved.local) {
      setValue('global', resolved.global.id)
      setValue('local', resolved.local.id)
    }
  }, [resolved])

  useEffect(() => {
    return () => {
      resetField('global')
      resetField('local')
    }
  }, [])

  return (
    <>
      <EntrySelectControl
        controlName="local"
        label="Source Local Entry"
        helperText="Content in your default locale used for the translation"
        entry={resolved?.local}
        isLoading={isLoading}
      />
      <EntrySelectControl
        controlName="global"
        label="Global Entry"
        helperText="Container for your localized content"
        entry={resolved?.global}
        isLoading={isLoading}
      />
    </>
  )
}

const EntrySelectControl = ({
  controlName,
  label,
  isLoading,
  entry,
  helperText,
}: {
  entry?: RecognizedEntry | null
  controlName: string
  label: string
  isLoading?: boolean
  helperText?: string
}) => {
  const { register, setValue } = useFormContext()

  useEffect(() => {
    if (entry) {
      setValue(controlName, entry.id)
    }
  }, [entry])

  return (
    <FormControl
      isDisabled
      {...register(controlName, { required: true })}
    >
      <FormControl.Label>{label}</FormControl.Label>
      {helperText ? (
        <Paragraph
          marginBottom="spacingS"
          style={{ color: '#67728A' }}
        >
          {helperText}
        </Paragraph>
      ) : null}
      {!isLoading && !entry ? (
        <Note variant="negative">Failed to resolve entries</Note>
      ) : (
        <Select>
          {isLoading ? (
            <Select.Option>...Loading</Select.Option>
          ) : (
            <Select.Option value={entry!.id}>
              {`${entry!.name} (${entry!.contentType.name})`}
            </Select.Option>
          )}
        </Select>
      )}
    </FormControl>
  )
}
