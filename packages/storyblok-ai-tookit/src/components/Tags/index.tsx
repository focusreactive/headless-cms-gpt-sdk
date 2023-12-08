import {
  Button,
  Chip,
  FormControl,
  FormLabel,
  TextField,
  Typography,
} from '@mui/material'
import React from 'react'
import { findRelevantTags } from '@focus-reactive/storyblok-ai-sdk'

interface Tag {
  id: string
  title: string
}

const Tags = () => {
  const [contentTitle, setContentTitle] = React.useState<string>('')
  const [tags, setTags] = React.useState<Tag[]>([])
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  const applyTags = async () => {
    setIsLoading(true)

    findRelevantTags({
      contentTitle,
      cb: (tags) => {
        setTags(tags)
        setIsLoading(false)
      },
    })
  }

  return (
    <div>
      <Typography variant="h1">Tags</Typography>
      <Typography variant="body1">
        Hey! Please enter the Story title and click the button. We'll find
        relevant tags for the content.
      </Typography>

      <div style={{ margin: '12px 0 20px', padding: '0 4px   ' }}>
        <FormControl fullWidth>
          <FormLabel>Story title</FormLabel>
          <TextField
            placeholder="Storyblok overview acrticle"
            value={contentTitle}
            onChange={(e) => {
              setContentTitle(e.target.value)
            }}
            fullWidth
          />
        </FormControl>
      </div>

      {!!tags.length && (
        <>
          <Typography variant="h2">Result:</Typography>
          <Typography
            style={{ margin: '12px 0 18px' }}
            variant="body1"
          >
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.title}
                variant="filled"
                color="secondary"
                style={{ margin: '0 8px 8px 0' }}
                size="medium"
              />
            ))}
          </Typography>
        </>
      )}

      <Button
        fullWidth
        disabled={!contentTitle || isLoading}
        onClick={applyTags}
      >
        {isLoading ? 'Loading...' : 'Find tags'}
      </Button>
    </div>
  )
}

export default Tags
