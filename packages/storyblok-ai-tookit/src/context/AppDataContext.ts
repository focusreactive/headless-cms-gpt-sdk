import React from 'react'

export type language = {
  code: string
  name: string
}

type AppData = {
  languages: language[]
}

export const AppDataContext = React.createContext<AppData | null>(null)
