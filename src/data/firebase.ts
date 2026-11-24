import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database'
import { EMULATOR_HOST, EMULATOR_PORTS, firebaseOptions, useEmulator } from './config'

type Firebase = { app: FirebaseApp; auth: Auth; db: Database }

let instance: Firebase | null = null

/** Startar Firebase första gången något i datalagret behöver det. */
export function firebase(): Firebase {
  if (instance) return instance
  const app = initializeApp(firebaseOptions())
  const auth = getAuth(app)
  const db = getDatabase(app)
  if (useEmulator) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, { disableWarnings: true })
    connectDatabaseEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.database)
  }
  instance = { app, auth, db }
  return instance
}
