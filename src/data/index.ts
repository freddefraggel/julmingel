// Datalagret: det ENDA stället i appen som får importera Firebase.
// Resten av koden pratar med datalagret via funktionerna här, så att Firebase
// kan bytas mot Azure-varianten (se docs/spec.md, Risker) utan att röra vyerna.
export { isWrongCredentials, onUserChanged, signInAdmin, signInGuest, signOut, type SignedInUser } from './auth'
export { eventPath, subscribeConfig, subscribeLive, subscribeServerTimeOffset, type OnError } from './db'
export { getQuizTimes, openQuestion } from './quiz'
export { getOwnGuest, isJoinOpen, joinEvent, type JoinRequest, type JoinResult } from './guests'
export {
  changeGuestClass,
  openAdminEvent,
  removeGuest,
  setJoinOpen,
  setNowText,
  setPhase,
  subscribeGuests,
  type AdminEventResult,
} from './admin'
export { getAssets, removeAsset, saveAsset, subscribeAssets } from './assets'
export { subscribeOwnGuest } from './guests'
export { saveRatings, subscribeOwnRatings } from './ratings'
export { loadPreparation, newConfigId, savePreparation, setAnswerImage, setGloggImage, type Preparation } from './prepare'
export { setTasting, subscribeAllRatings, subscribeNumbers } from './tasting'
