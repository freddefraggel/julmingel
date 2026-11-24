import type { FirebaseOptions } from 'firebase/app'

/**
 * Projekt-id för Emulator Suite. Prefixet `demo-` gör att emulatorn körs helt
 * lokalt, utan något riktigt Firebase-projekt.
 */
export const EMULATOR_PROJECT_ID = 'demo-glogg-mingel'

/**
 * Databasinstansen i emulatorn. database.rules.json gäller bara projektets
 * standardinstans, så appen måste använda just den för att reglerna ska gälla.
 */
export const EMULATOR_DATABASE = `${EMULATOR_PROJECT_ID}-default-rtdb`

export const EMULATOR_HOST = '127.0.0.1'
export const EMULATOR_PORTS = { auth: 9099, database: 9000 } as const

/**
 * Webbkonfigurationen för det riktiga projektet `glogg-mingel`. Den är publik;
 * skyddet sitter i database.rules.json. Värdena kommer in som miljövariabler i
 * bygget: i GitHub Actions från repo-variablerna, lokalt från en .env.local-fil.
 * Hämtas från Firebase-konsolen → Project settings → Your apps → Web app.
 */
export const productionConfig: FirebaseOptions | null = readProductionConfig(import.meta.env)

export function readProductionConfig(env: ImportMetaEnv): FirebaseOptions | null {
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  }
  return Object.values(config).every((value) => typeof value === 'string' && value !== '') ? config : null
}

/** Utvecklingsläget går mot emulatorn om inte VITE_FIREBASE_EMULATOR=false. */
export const useEmulator = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATOR !== 'false'

export function firebaseOptions(): FirebaseOptions {
  if (useEmulator) {
    return {
      apiKey: 'demo-api-key',
      projectId: EMULATOR_PROJECT_ID,
      databaseURL: `http://${EMULATOR_HOST}:${EMULATOR_PORTS.database}?ns=${EMULATOR_DATABASE}`,
    }
  }
  if (!productionConfig) {
    throw new Error('Firebase-konfigurationen saknas. Sätt VITE_FIREBASE_* i bygget (se CLAUDE.md).')
  }
  return productionConfig
}
