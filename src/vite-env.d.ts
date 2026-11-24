/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sätt till "false" för att köra npm run dev mot det riktiga projektet i stället för emulatorn. */
  readonly VITE_FIREBASE_EMULATOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
