/**
 * Deep-clone values for RSC → client props. Prisma rows can carry shapes that
 * break React Flight serialization in production; JSON round-trip yields plain
 * objects and ISO date strings that client code already handles via `new Date()`.
 */
const bigintReplacer = (_key: string, v: unknown) =>
  typeof v === 'bigint' ? v.toString() : v

export function serializeForClient<T>(value: T): T {
  if (value === undefined) return value
  return JSON.parse(JSON.stringify(value, bigintReplacer)) as T
}

/**
 * Deep-clone a JSON subtree for safe use with serializeForClient / Flight.
 * Returns null if the value is not JSON-serializable (e.g. circular refs).
 */
export function sanitizeJsonClone<T>(value: T | null | undefined): T | null {
  if (value === undefined || value === null) return null
  try {
    return JSON.parse(JSON.stringify(value, bigintReplacer)) as T
  } catch {
    return null
  }
}
