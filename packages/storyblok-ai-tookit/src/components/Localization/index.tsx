import {
  Button,
  FormControl,
  FormLabel,
  TextField,
  Typography,
} from '@mui/material'
import React from 'react'
import { localizeStory } from '@focus-reactive/storyblok-ai-sdk'

const Localization = () => {
  const [targetLanguage, setTargetLanguage] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [successMessage, setSuccessMessage] = React.useState<string>('')

  const summarise = async () => {
    setIsLoading(true)
    setSuccessMessage('')

    localizeStory({
      targetLanguage,
      hasToCreateNewStory: true,
      cb: () => {
        setIsLoading(false)
        setTargetLanguage('')
        setSuccessMessage(
          'Success! Please find your story on a same folder lvl',
        )
      },
    })
  }

  return (
    <div>
      <Typography variant="h1">Localization</Typography>
      <Typography variant="body1">
        Hey! Please enter a target language and click the button. We'll create a
        new page for you on the same level as the current one.
      </Typography>

      <div style={{ margin: '12px 0 20px', padding: '0 4px   ' }}>
        <FormControl fullWidth>
          <FormLabel>Target language</FormLabel>
          <TextField
            placeholder="German"
            value={targetLanguage}
            onChange={(e) => {
              setTargetLanguage(e.target.value)
            }}
            fullWidth
          />
        </FormControl>
      </div>

      <Button
        fullWidth
        disabled={!targetLanguage || isLoading}
        onClick={summarise}
      >
        {isLoading ? 'Localizing...' : 'Localize'}
      </Button>
      {isLoading && (
        <Typography
          variant="body2"
          textAlign="center"
        >
          Usually it takes 1min max to localize a story.
        </Typography>
      )}

      {successMessage && (
        <Typography
          variant="body1"
          fontWeight={700}
          margin="20px 0 0"
          textAlign="center"
        >
          {successMessage}
        </Typography>
      )}
    </div>
  )
}

export default Localization
