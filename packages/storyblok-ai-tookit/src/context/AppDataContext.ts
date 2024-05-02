import React from 'react'

export type language = {
  code: string
  name: string
}

type AppData = {
  languages: language[]
  userId: number
  spaceId: number
}

export const AppDataContext = React.createContext<AppData | null>(null)
