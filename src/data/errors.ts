/** Om Firebase nekade åtgärden på grund av databasreglerna. */
export function isPermissionDenied(error: unknown): boolean {
  return error instanceof Error && /permission[_ ]denied/i.test(`${(error as { code?: string }).code ?? ''} ${error.message}`)
}
