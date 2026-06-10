import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

let disconnectPrisma: (() => Promise<void>) | null = null

function needsEncryption(
  value: string | null | undefined,
  isEncryptedEmailCredential: (value: string | null | undefined) => boolean,
): boolean {
  return Boolean(value && !isEncryptedEmailCredential(value))
}

async function main() {
  const { prisma } = await import('@/lib/prisma')
  disconnectPrisma = () => prisma.$disconnect()
  const {
    decryptEmailCredential,
    encryptEmailCredential,
    isEncryptedEmailCredential,
  } = await import('@/lib/email-credential-crypto')

  const hasEncryptionKey = Boolean(
    process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
      process.env.EMAIL_OAUTH_STATE_SECRET?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )

  if (!hasEncryptionKey) {
    throw new Error(
      'Missing EMAIL_CREDENTIAL_ENCRYPTION_KEY, EMAIL_OAUTH_STATE_SECRET, or SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  const rows = await prisma.emailIntegration.findMany({
    select: {
      id: true,
      imapPassword: true,
      accessToken: true,
      refreshToken: true,
    },
  })

  let scanned = 0
  let updated = 0
  let encryptedFields = 0
  let verifiedEncryptedFields = 0

  for (const row of rows) {
    scanned += 1
    const data: {
      imapPassword?: string | null
      accessToken?: string | null
      refreshToken?: string | null
    } = {}

    if (needsEncryption(row.imapPassword, isEncryptedEmailCredential)) {
      data.imapPassword = encryptEmailCredential(row.imapPassword)
      encryptedFields += 1
    } else if (isEncryptedEmailCredential(row.imapPassword)) {
      decryptEmailCredential(row.imapPassword)
      verifiedEncryptedFields += 1
    }
    if (needsEncryption(row.accessToken, isEncryptedEmailCredential)) {
      data.accessToken = encryptEmailCredential(row.accessToken)
      encryptedFields += 1
    } else if (isEncryptedEmailCredential(row.accessToken)) {
      decryptEmailCredential(row.accessToken)
      verifiedEncryptedFields += 1
    }
    if (needsEncryption(row.refreshToken, isEncryptedEmailCredential)) {
      data.refreshToken = encryptEmailCredential(row.refreshToken)
      encryptedFields += 1
    } else if (isEncryptedEmailCredential(row.refreshToken)) {
      decryptEmailCredential(row.refreshToken)
      verifiedEncryptedFields += 1
    }

    if (Object.keys(data).length > 0) {
      await prisma.emailIntegration.update({
        where: { id: row.id },
        data,
      })
      updated += 1
    }
  }

  console.log(
    `Email credential encryption complete: scanned=${scanned} updated_rows=${updated} encrypted_fields=${encryptedFields} verified_encrypted_fields=${verifiedEncryptedFields}`,
  )
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Email credential encryption failed')
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectPrisma?.()
  })
