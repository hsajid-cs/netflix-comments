function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  databaseUrl: requireEnv('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3000),
  /** Secret used to sign/verify auth JWTs. App-local only — never a Netflix credential. */
  jwtSecret: requireEnv('JWT_SECRET'),
  /** Access-token lifetime, passed straight to `jwt.sign`'s `expiresIn`. */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
}
