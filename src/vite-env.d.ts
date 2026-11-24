/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sätt till "false" för att köra npm run dev mot det riktiga projektet i stället för emulatorn. */
  readonly VITE_FIREBASE_EMULATOR?: string
  // Firebase-webbkonfigurationen för det riktiga projektet. Publik, sätts i bygget.
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_DATABASE_URL?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
