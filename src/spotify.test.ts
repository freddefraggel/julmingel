import { describe, expect, it } from 'vitest'
import { codeChallenge, parseTrackLink } from './spotify'

describe('spotify', () => {
  it('räknar PKCE-challenge enligt RFC 7636', async () => {
    expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('gör om Spotify-länkar till URI:er', () => {
    const uri = 'spotify:track:2FRnf9qhLbvw8fu4IBXx78'
    expect(parseTrackLink('https://open.spotify.com/track/2FRnf9qhLbvw8fu4IBXx78')).toBe(uri)
    expect(parseTrackLink(' https://open.spotify.com/intl-sv/track/2FRnf9qhLbvw8fu4IBXx78?si=abc ')).toBe(uri)
    expect(parseTrackLink(uri)).toBe(uri)
    expect(parseTrackLink('https://open.spotify.com/album/2FRnf9qhLbvw8fu4IBXx78')).toBeNull()
    expect(parseTrackLink('hej')).toBeNull()
  })
})
