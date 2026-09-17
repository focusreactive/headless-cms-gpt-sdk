import { Dispatch } from 'react'
import { LocalizationAction } from '.'
import { TextareaAutosize, FormLabel } from '@mui/material'

export default function CustomPromptInput({
  value,
  dispatch,
}: ICustomPromptInput) {
  return (
    <div>
      <FormLabel
        style={{
          marginTop: '12px',
          marginBottom: '10px',
          display: 'block',
        }}
      >
        Custom prompt
      </FormLabel>
      <TextareaAutosize
        value={value}
        onChange={(e) =>
          dispatch({
            type: 'setCustomPrompt',
            payload: e.target.value,
          })
        }
        placeholder="Make all text sounds professional and formal"
        style={{
          width: '100%',
          padding: '10px 18px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '14px',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
        minRows={2}
      />
    </div>
  )
}

interface ICustomPromptInput {
  value: string
  dispatch: Dispatch<LocalizationAction>
}
