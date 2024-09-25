import { SidebarAppSDK } from '@contentful/app-sdk'
import {
  Box,
  Button,
  Checkbox,
  Form,
  FormControl,
  Paragraph,
  Subheading,
  TextInput,
} from '@contentful/f36-components'
import { useSDK } from '@contentful/react-apps-toolkit'
import {
  applyTags as _applyTags,
  findTags,
} from '@focus-reactive/contentful-ai-sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

type Tag = {
  id: string
  title: string
  checked: boolean
}

const Tags = () => {
  const sdk = useSDK<SidebarAppSDK>()
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()
  const queryClient = useQueryClient()

  const [tags, setTags] = useState<Tag[]>()

  const { mutateAsync: applyTags } = useMutation({
    mutationFn: _applyTags,
  })

  const onFindTags = async (values) => {
    const { contentTitle } = values

    const data = await queryClient.fetchQuery({
      queryKey: ['findTags', contentTitle],
      queryFn: () => findTags({ entryId: sdk.entry.getSys().id, contentTitle }),
    })

    const assignedTags = sdk.entry.getMetadata()!.tags.map((tag) => tag.sys.id)
    setTags(
      data.map((tag) => ({ ...tag, checked: assignedTags.includes(tag.id) })),
    )
  }

  const onApplyTags = async (values) => {
    await applyTags({
      entryId: sdk.entry.getSys().id,
      tags: values.tags.map((id: string) => ({ id })),
    })

    setTags(undefined)
  }

  return (
    <>
      <Subheading>Tags</Subheading>
      <Paragraph>
        Please enter a content title and click the button to find the most
        relevant tags for this document.
      </Paragraph>

      <Form onSubmit={handleSubmit(onFindTags)}>
        <FormControl>
          <FormControl.Label>Content title</FormControl.Label>
          <TextInput
            placeholder="Rock'n'rolla movie review"
            {...register('contentTitle')}
          />
          <FormControl.HelpText>
            Entry title will be used if not provided
          </FormControl.HelpText>
        </FormControl>

        <Button
          variant="secondary"
          type="submit"
          isFullWidth
          isLoading={isSubmitting}
        >
          Find tags
        </Button>
      </Form>
      {tags && (
        <ApplyTagsForm
          tags={tags}
          onSubmit={onApplyTags}
        />
      )}
    </>
  )
}

const ApplyTagsForm = ({
  tags,
  onSubmit,
}: {
  tags: Tag[]
  onSubmit: (values) => Promise<void>
}) => {
  const {
    register,
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = useForm({
    defaultValues: {
      tags: tags.filter((tag) => tag.checked).map((tag) => tag.id),
    },
  })

  return (
    <Box marginTop="spacingL">
      <Form onSubmit={handleSubmit(onSubmit)}>
        <FormControl as="fieldset">
          <Checkbox.Group spacing="spacingM">
            {tags.map((tag) => (
              <Checkbox
                key={tag.id}
                value={tag.id}
                {...register('tags')}
              >
                {tag.title}
              </Checkbox>
            ))}
          </Checkbox.Group>
        </FormControl>
        <Button
          variant="primary"
          type="submit"
          isFullWidth
          isLoading={isSubmitting}
          isDisabled={!isValid}
        >
          Apply
        </Button>
      </Form>
    </Box>
  )
}

export default Tags
