import { describe, expect, it } from 'vitest'
import { readProductionConfig } from './config'

const full = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'glogg-mingel.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://glogg-mingel-default-rtdb.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'glogg-mingel',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
} as ImportMetaEnv

describe('readProductionConfig', () => {
  it('läser webbkonfigurationen från miljövariablerna', () => {
    expect(readProductionConfig(full)).toEqual({
      apiKey: 'key',
      authDomain: 'glogg-mingel.firebaseapp.com',
      databaseURL: 'https://glogg-mingel-default-rtdb.firebaseio.com',
      projectId: 'glogg-mingel',
      appId: '1:123:web:abc',
    })
  })

  it('ger null om något värde saknas eller är tomt', () => {
    expect(readProductionConfig({ ...full, VITE_FIREBASE_APP_ID: undefined })).toBeNull()
    expect(readProductionConfig({ ...full, VITE_FIREBASE_API_KEY: '' })).toBeNull()
  })
})
