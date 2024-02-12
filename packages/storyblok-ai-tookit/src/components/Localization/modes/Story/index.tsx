import {
  Button,
  FormControl,
  FormLabel,
  TextField,
  Typography,
} from '@mui/material'
import React from 'react'

interface ILocalizeStoryModeProps {
  targetLanguage: string
  setTargetLanguage: (value: string) => void
  isLoading: boolean
  localize: () => void
  successMessage: string
}

const LocalizeStoryMode: React.FC<ILocalizeStoryModeProps> = ({
  targetLanguage,
  isLoading,
  setTargetLanguage,
  localize,
  successMessage,
}) => {
  return (
    <>
      <Typography variant="body1">
        Hey! Please enter a target language and click the button. We'll create a
        new page for you on the same level as the current one.
      </Typography>
      <div style={{ margin: '12px 0 20px', padding: '0 4px' }}>
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
        onClick={localize}
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
    </>
  )
}

export default LocalizeStoryMode
