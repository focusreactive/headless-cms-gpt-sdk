import React, {useContext, useEffect, useState} from 'react'
import {ActionContext} from '../../context'
import {Button, Card, Flex, Grid, Heading, Stack, Text, TextInput} from '@sanity/ui'
import {useClient} from 'sanity'
import {findRelevantTags} from '@focus-reactive/sanity-ai-sdk'

interface Tag {
  id: string
  title: string
}

interface FindTagsProps {
  documentId: string
}

const FindTags: React.FC<FindTagsProps> = ({documentId}) => {
  const sanityClient = useClient()
  const actionsContext = useContext(ActionContext)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [relevantTags, setRelevantTags] = useState<Tag[]>([])
  const [contentTitle, setContentTitle] = useState<string>('')

  useEffect(() => {
    const fetchTags = async () => {
      const data = await sanityClient.fetch('*[_type == "tag"]{_id, title, description}')
      setTags(
        data.map((tag: {_id: string; title: string; description: string}) => ({
          id: tag._id,
          title: tag.title,
          description: tag.description,
        })),
      )
    }

    if (sanityClient) {
      fetchTags()
    }
  }, [sanityClient])

  if (!actionsContext) {
    return null
  }

  const findTags = async () => {
    setIsLoading(true)
    const result = await findRelevantTags({
      documentId: actionsContext.documentId,
      contentTitle,
      tags: tags,
    })

    setRelevantTags(result)
    setIsLoading(false)
  }

  return (
    <Card marginY={2}>
      <Heading as="h1" size={2}>
        Tags
      </Heading>
      <Stack marginY={4}>
        <Text size={2}>
          Hey! Please enter a content title and click the button to find the most relevant tags
          for this document
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

      <Grid columns={2} gap={[4]} padding={0} marginTop={5}>
        {relevantTags.map((field) => {
          return (
            <Card key={field.id} padding={[3, 3, 4]} radius={2} shadow={1} tone="primary">
              <Flex marginY={1} align="center" justify="center">
                <Text>{field.title}</Text>
              </Flex>
            </Card>
          )
        })}
      </Grid>
      {!relevantTags?.length && (
        <Card marginTop={5} style={{textAlign: 'center'}}>
          <Flex justify="center" align="center">
            <Button
              onClick={findTags}
              fontSize={[2, 2, 3]}
              mode="default"
              tone="primary"
              padding={[3, 3, 4]}
              text="Find tags"
              disabled={!sanityClient || !tags.length || !contentTitle}
              loading={isLoading}
            />
          </Flex>
        </Card>
      )}
    </Card>
  )
}

export default FindTags
