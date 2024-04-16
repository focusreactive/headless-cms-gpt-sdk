import React from 'react'

export type language = {
  code: string
  name: string
}

export type Folder = { name: string; id: string }

type AppData = {
  languages: language[]
  folders: Folder[]
}

export const AppDataContext = React.createContext<AppData | null>({
  folders: [],
  languages: [],
})
