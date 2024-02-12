import {
  Button,
  Card,
  FormControl,
  FormLabel,
  TextField,
  Typography,
} from '@mui/material'
import React from 'react'

interface ILocalizeTextModeProps {
  targetLanguage: string
  setTargetLanguage: (value: string) => void
  isLoading: boolean
  setStringToTranslate: (v: string) => void
  successMessage: string
  stringToTranslate: string
  setSuccessMessage: (v: string) => void
  translateString: () => void
  translatedString: string
}

const LocalizeTextMode: React.FC<ILocalizeTextModeProps> = ({
  targetLanguage,
  isLoading,
  setTargetLanguage,
  setStringToTranslate,
  successMessage,
  stringToTranslate,
  setSuccessMessage,
  translateString,
  translatedString,
}) => {
  return (
    <>
      <div style={{ margin: '12px 0 20px', padding: '0 4px' }}>
        <FormControl fullWidth>
          <FormLabel>Text to translate</FormLabel>

          <TextField
            placeholder="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
            value={stringToTranslate}
            onChange={(e) => {
              setStringToTranslate(e.target.value)
              setSuccessMessage('')
            }}
            fullWidth
          />
        </FormControl>
        <FormControl
          fullWidth
          style={{ marginTop: '12px' }}
        >
          <FormLabel>Target language</FormLabel>

          <TextField
            placeholder="German"
            value={targetLanguage}
            onChange={(e) => {
              setTargetLanguage(e.target.value)
              setSuccessMessage('')
            }}
            fullWidth
          />
        </FormControl>
      </div>
      <Button
        fullWidth
        disabled={!targetLanguage || isLoading}
        onClick={translateString}
      >
        {isLoading ? 'Loading...' : 'Translate'}
      </Button>
      {isLoading && (
        <Typography
          variant="body2"
          textAlign="center"
        >
          Usually it takes 10-20s max to translate a text.
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

      {translatedString && (
        <Card
          variant="outlined"
          style={{ padding: '12px', marginTop: '16px' }}
        >
          <Typography variant="body1">{translatedString}</Typography>
        </Card>
      )}
    </>
  )
}

export default LocalizeTextMode
