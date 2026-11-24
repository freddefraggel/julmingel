import { createContext, useContext } from 'react'

/**
 * Kvällens bilder (imageId → data-URL). De hämtas en gång när gästen kommer
 * till Hem, så att quizfrågor med bildsvar och Kvällens glögger visas direkt.
 */
export const GuestAssets = createContext<Record<string, string>>({})

/** Bilden för ett imageId, eller undefined om den inte finns eller inte är hämtad än. */
export function useAsset(imageId: string | undefined): string | undefined {
  const assets = useContext(GuestAssets)
  return imageId ? assets[imageId] : undefined
}
