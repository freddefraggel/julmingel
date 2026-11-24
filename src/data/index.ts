// Datalagret: det ENDA stället i appen som får importera Firebase.
// Resten av koden pratar med datalagret via funktionerna här, så att Firebase
// kan bytas mot Azure-varianten (se docs/spec.md, Risker) utan att röra vyerna.
export { onUserChanged, signInAdmin, signInGuest, signOut, type SignedInUser } from './auth'
export { eventPath, subscribeConfig, subscribeLive, subscribeServerTimeOffset, type OnError } from './db'
export { getQuizTimes, openQuestion } from './quiz'
