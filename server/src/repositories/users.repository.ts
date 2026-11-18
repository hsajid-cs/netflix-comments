import { pool } from '../db/pool.js'
import { type User, type UserRow, mapUserRow } from '../models/user.js'
import { ConflictError } from '../utils/app-error.js'

export interface CreateUserParams {
  username: string
  passwordHash: string
}

export const usersRepository = {
  async create(params: CreateUserParams): Promise<User> {
    try {
      const result = await pool.query<UserRow>(
        `INSERT INTO users (username, password_hash)
         VALUES ($1, $2)
         RETURNING *`,
        [params.username, params.passwordHash],
      )
      return mapUserRow(result.rows[0])
    } catch (error) {
      // 23505 = unique_violation on users.username
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new ConflictError('That username is already taken')
      }
      throw error
    }
  },

  async findByUsername(username: string): Promise<User | null> {
    const result = await pool.query<UserRow>(`SELECT * FROM users WHERE username = $1`, [username])
    const row = result.rows[0]
    return row ? mapUserRow(row) : null
  },

  async findById(id: string): Promise<User | null> {
    const result = await pool.query<UserRow>(`SELECT * FROM users WHERE id = $1`, [id])
    const row = result.rows[0]
    return row ? mapUserRow(row) : null
  },
}
