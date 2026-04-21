/** Prisma P2022 — referenced column/table not present vs applied migrations */
export function isPrismaMissingSchemaError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'P2022'
  )
}
