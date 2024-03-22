import {
  Button,
  FormControl,
  FormLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { AppDataContext } from '@src/context/AppDataContext'
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
  const spaceLanguages = React.useContext(AppDataContext)?.languages || []
  React.useEffect(() => {
    if (spaceLanguages.length > 0) {
      setTargetLanguage(spaceLanguages[0].code)
    }
  }, [])

  return (
    <>
      <Typography variant="body1">
        Hey! Please select your target language and click the button. We will
        update the page with translations for it.
      </Typography>
      <div style={{ margin: '12px 0 20px', padding: '0 4px' }}>
        <FormControl fullWidth>
          <FormLabel>Target language</FormLabel>

          <Select
            labelId="demo-simple-select-label"
            id="demo-simple-select"
            value={targetLanguage}
            label="Age"
            onChange={(e) => {
              setTargetLanguage(e.target.value)
            }}
          >
            {spaceLanguages.map((language) => (
              <MenuItem
                key={language.code}
                value={language.code}
              >
                {language.name}
              </MenuItem>
            ))}
          </Select>
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
