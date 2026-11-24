import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = join(import.meta.dirname)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

const importsFirebase = /(?:from\s+|import\s*\(\s*|import\s+)['"](?:firebase|@firebase\/)[^'"]*['"]/

describe('kodstruktur', () => {
  it('bara src/data/ importerar Firebase', () => {
    const offenders = sourceFiles(srcDir)
      .map((file) => relative(srcDir, file).split(sep).join('/'))
      .filter((file) => !file.startsWith('data/'))
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
      .filter((file) => importsFirebase.test(readFileSync(join(srcDir, file), 'utf8')))
    expect(offenders).toEqual([])
  })
})
