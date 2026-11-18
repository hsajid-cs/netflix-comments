import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { type AuthedUser, type PublicUser, toPublicUser } from '../models/user.js'
import { usersRepository } from '../repositories/users.repository.js'
import { UnauthorizedError } from '../utils/app-error.js'

const BCRYPT_ROUNDS = 12

export interface AuthResult {
  user: PublicUser
  token: string
}

function signToken(user: AuthedUser): string {
  return jwt.sign({ username: user.username }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions)
}

export const authService = {
  async signup(username: string, password: string): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    // usersRepository.create maps a unique-violation to ConflictError (409).
    const user = await usersRepository.create({ username, passwordHash })
    return { user: toPublicUser(user), token: signToken(user) }
  },

  async login(username: string, password: string): Promise<AuthResult> {
    const user = await usersRepository.findByUsername(username)
    // Same generic error whether the user is missing or the password is wrong,
    // so the endpoint doesn't reveal which usernames exist.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid username or password')
    }
    return { user: toPublicUser(user), token: signToken(user) }
  },

  /** Verifies a bearer token and returns the identity encoded in it. */
  verifyAccessToken(token: string): AuthedUser {
    let payload: string | jwt.JwtPayload
    try {
      payload = jwt.verify(token, env.jwtSecret)
    } catch {
      throw new UnauthorizedError('Invalid or expired session')
    }
    if (typeof payload === 'string' || !payload.sub || typeof payload.username !== 'string') {
      throw new UnauthorizedError('Invalid or expired session')
    }
    return { id: payload.sub, username: payload.username }
  },
}
