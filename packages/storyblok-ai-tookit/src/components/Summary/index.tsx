import {
  Button,
  FormControl,
  FormLabel,
  TextField,
  Typography,
} from '@mui/material'
import React from 'react'
import { summariseStory } from '@focus-reactive/storyblok-ai-sdk'

const Summary = () => {
  const [contentTitle, setContentTitle] = React.useState<string>('')
  const [summary, setSummary] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  const summarise = async () => {
    setIsLoading(true)

    summariseStory({
      contentTitle,
      promptModifier: 'Provided content is a website page. Summary should be short and concise.',
      cb: (summary) => {
        setSummary(summary)
        setIsLoading(false)
      },
    })
  }

  return (
    <div>
      <Typography variant="h1">Summary</Typography>
      <Typography variant="body1">
        Hey! Please enter the Story title and click the button. We'll generate a
        summary of the content for you.
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

      {summary && (
        <>
          <Typography variant="h2">Result:</Typography>
          <Typography style={{margin: '12px 0 18px'}} variant="body1">{summary}</Typography>
        </>
      )}

      <Button
        fullWidth
        disabled={!contentTitle || isLoading}
        onClick={summarise}
      >
        {isLoading ? 'Loading...' : summary ? 'Regenerate' : 'Summarise'}
      </Button>
    </div>
  )
}

export default Summary
