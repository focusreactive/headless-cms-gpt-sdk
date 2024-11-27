import { useState } from 'react'

type DebugMeta = {
  function?: string
  input: Record<string, any> | null
  output: Record<string, any> | string | number | null
  error: Error | null
}

const useDebug = () => {
  const [meta, setMeta] = useState<DebugMeta>({ error: null, input: null, output: null })

  const getStringified = () => {
    const stringElements: string[] = []
    if (meta.function) {
      stringElements.push(`Function: ${meta.function}`)
    }
    if (meta.input) {
      stringElements.push(`Input: ${JSON.stringify(meta.input)}`)
    }
    if (meta.output) {
      stringElements.push(`Output: ${JSON.stringify(meta.output)}`)
    }
    if (meta.error) {
      let element = `Error: ${meta.error.message}`
      if (meta.error.cause instanceof Error) {
        element += `, Cause: ${meta.error.cause.message}`
      }
      if ('_debug' in meta.error) {
        element += `, Debug: ${JSON.stringify(meta.error._debug)}`
      }
      stringElements.push(element)
    }

    return stringElements.join('; ')
  }

  return {
    $setDebugMeta: (data: Partial<DebugMeta>) => {
      setMeta({ ...meta, ...data })
    },

    $debugContext: getStringified(),
  }
}

export default useDebug
