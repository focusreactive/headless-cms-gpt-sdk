import { GetServerSideProps, NextPage } from 'next'
import { authHandlerParams, endpointPrefix } from '@src/auth'
import React, { useEffect, useRef, useState } from 'react'
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
import StoryblokClient, { ISbStoryData } from 'storyblok-js-client'
import { AppDataContext, Folder, language } from '@src/context/AppDataContext'
import { createHttpRepository } from '@src/preset/httpRepository'
import { PresetsProvider } from '@src/preset/PresetsProvider'

type PageProps = {
  spaceId: number
  userId: number
  appSession: AppSession
  languages: language[]
  folders: Folder[]
}

// Storyblok matches App Bridge messages against the installed extension's slug,
// so a dev extension with a different slug needs its own value here.
const PLUGIN_SLUG =
  process.env.NEXT_PUBLIC_PLUGIN_SLUG || 'focusreactive-ai-toolkit'

const Home: NextPage<PageProps> = (props) => {
  // Built once: the provider loads on the repository it was first handed, and a fresh one
  // each render would restart that load on every render.
  const [presetRepository] = useState(() => createHttpRepository(props.spaceId))
  const reportedHeight = useRef(0)
  const content = useRef<HTMLDivElement>(null)
  const [currentStory, setCurrentStory] = useState<ISbStoryData>(null)

  useEffect(() => {
    // This one element, never the document and never the root above it.
    //
    // The document counts MUI's tooltips and dropdowns, which are portals appended to the
    // body — one of those lengthened the document, the frame grew to match, and when the
    // portal went nothing had changed size, so nothing fired and the frame stayed tall.
    //
    // The root cannot shrink: `global.css` pins it to the frame's own height, so once the
    // frame had grown it reported that height back for ever. This element takes its height
    // from its content alone, which is the number the frame actually wants.
    const measured = content.current

    if (measured === null) {
      return
    }

    const handleResize = () => {
      const height = measured.scrollHeight

      if (height === reportedHeight.current) {
        return
      }

      window.parent.postMessage(
        {
          action: 'tool-changed',
          tool: PLUGIN_SLUG,
          event: 'heightChange',
          height: height,
          width: '100%',
        },
        '*',
      )

      reportedHeight.current = height
    }

    const observer = new ResizeObserver(handleResize)

    observer.observe(measured)
    handleResize()

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {

    // hardcoded tokens for specific spaces
    const spaceIdStr = `${props.spaceId}`
    const correctToken =
      spaceIdStr === '320520'
        ? process.env.NEXT_PUBLIC_FIRSTY_OPENAI_TOKEN
        : spaceIdStr === '287853025223359'
          ? process.env.NEXT_PUBLIC_XWEATHER_OPENAI_TOKEN
          : process.env.NEXT_PUBLIC_OPENAI_TOKEN

    initSDK({
      managementToken: props.appSession.accessToken,
      pluginName: PLUGIN_SLUG,
      openAiToken: correctToken,
      spaceId: String(props.spaceId),
    })
    initContentSDK({
      openAiToken: correctToken,
    })
  }, [])

  useEffect(() => {
    const handleMessage = (e: { data: { story: ISbStoryData } }) => {
      setCurrentStory(e.data.story)
    }

    window.addEventListener('message', handleMessage, { once: true })

    window.parent.postMessage(
      {
        action: 'tool-changed',
        tool: PLUGIN_SLUG,
        event: 'getContext',
      },
      '*',
    )
  }, [])

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <AppDataContext.Provider
        value={{
          languages: props.languages,
          folders: props.folders.filter(
            (folder) => !currentStory?.full_slug.startsWith(folder.slug + '/'),
          ),
          currentStory,
          spaceId: props.spaceId,
          userId: props.userId,
        }}
      >
        <PresetsProvider repository={presetRepository}>
          {/* `flex-start`: the root above is a flex container of the frame's full height,
              and a stretched child could never report a height smaller than the frame. */}
          <div ref={content} style={{ alignSelf: 'flex-start' }}>
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
        </PresetsProvider>
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

  const foldersResponse = await SBManagementClient.get(
    `spaces/${appSession.spaceId}/stories?folder_only=1&with_parent=0&per_page=100`,
  )

  if (!appSession) {
    return initAuthFlow
  }

  return {
    props: {
      appSession,
      spaceId: appSession.spaceId,
      userId: appSession.userId,
      languages,
      folders: foldersResponse.data.stories.map((folder) => ({
        name: folder.name,
        id: folder.id,
        slug: folder.slug,
      })),
    },
  }
}
