import { GetServerSideProps, NextPage } from 'next'
import { authHandlerParams, endpointPrefix } from '@src/auth'
import React, { useEffect, useState } from 'react'
import {
  AppSession,
  isAppSessionQuery,
  sessionCookieStore,
} from '@storyblok/app-extension-auth'

import { lightTheme } from '@storyblok/mui'
import { CssBaseline, Link, ThemeProvider, Typography } from '@mui/material'
import FeaturesLayout from '@src/components/FeaturesLayout'
import { initSDK } from '@focus-reactive/storyblok-ai-sdk'
import { initSDK as initContentSDK } from '@focus-reactive/content-ai-sdk'
import StoryblokClient from 'storyblok-js-client'
import { AppDataContext, language } from '@src/context/AppDataContext'

type PageProps = {
  spaceId: number
  userId: number
  appSession: AppSession
  languages: language[]
}

const Home: NextPage<PageProps> = (props) => {
  const [currentHeight, setCurrentHeight] = useState<number>(0)

  useEffect(() => {
    const handleResize = () => {
      const height = document.body.clientHeight

      if (height === currentHeight) {
        return
      }

      window.parent.postMessage(
        {
          action: 'tool-changed',
          tool: 'focusreactive-ai-toolkit',
          event: 'heightChange',
          height: height,
          width: '100%',
        },
        '*',
      )

      setCurrentHeight(height)
    }

    const observer = new ResizeObserver(handleResize)
    observer.observe(document.body)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    initSDK({
      managementToken: props.appSession.accessToken,
      pluginName: 'focusreactive-ai-toolkit',
      openAiToken: process.env.NEXT_PUBLIC_OPENAI_TOKEN,
      spaceId: String(props.spaceId),
    })
    initContentSDK({
      openAiToken: process.env.NEXT_PUBLIC_OPENAI_TOKEN,
    })
  }, [])

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <AppDataContext.Provider value={{ languages: props.languages }}>
        <div>
          <FeaturesLayout />
          <Typography
            variant="body2"
            style={{ marginTop: '24px' }}
          >
            How it works:{' '}
            <Link
              href="https://focusreactive.com/storyblok-ai-toolkit/"
              target="_blank"
            >
              Documentation
            </Link>
          </Typography>
          <Typography variant="body2">
            Created by:{' '}
            <Link
              href="https://focusreactive.com/"
              target="_blank"
            >
              FocusReactive
            </Link>
          </Typography>
        </div>
      </AppDataContext.Provider>
    </ThemeProvider>
  )
}
export default Home

export const initAuthFlow = {
  redirect: {
    permanent: false,
    destination: `${endpointPrefix}/storyblok`,
  },
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context,
) => {
  const { query } = context

  if (!isAppSessionQuery(query)) {
    return initAuthFlow
  }

  const sessionStore = sessionCookieStore(authHandlerParams)(context)
  const appSession = await sessionStore.get(query)

  const SBManagementClient = new StoryblokClient({
    oauthToken: `Bearer ${appSession.accessToken}`,
    region: appSession.region,
  })

  const languages = await (
    await SBManagementClient.get(`oauth/space_info`)
  ).data.space.languages

  if (!appSession) {
    return initAuthFlow
  }

  return {
    props: {
      appSession,
      spaceId: appSession.spaceId,
      userId: appSession.userId,
      languages,
    },
  }
}
