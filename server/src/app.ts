import cors from 'cors'
import express, { type Express } from 'express'
import { errorHandler } from './middleware/error-handler.js'
import { notFoundHandler } from './middleware/not-found.js'
import { router } from './routes/index.js'

export function createApp(): Express {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }))

  app.use(router)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
