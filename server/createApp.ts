import cors from 'cors'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import { apiErrorMessage, apiErrorStatus } from './lib/apiErrors.js'
import { runStandupGeneration } from './lib/standupService.js'
import {
  fetchStandupsForUser,
  saveStandupForUser,
} from './lib/standupDb.js'
import { verifyBearerToken } from './lib/verifyAuth.js'

export function createApp(): Express {
  const app = express()

  app.use(cors({ origin: true }))
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/standup/history', async (req, res) => {
    try {
      const { userId } = await verifyBearerToken(req.headers.authorization)
      const limit = Math.min(
        Number.parseInt(String(req.query.limit ?? '50'), 10) || 50,
        100,
      )
      const history = await fetchStandupsForUser(userId, limit)
      res.json({ history })
    } catch (error) {
      const message = apiErrorMessage(error)
      res.status(apiErrorStatus(message)).json({ error: message })
    }
  })

  app.post('/api/standup/save', async (req, res) => {
    try {
      const { userId } = await verifyBearerToken(req.headers.authorization)
      const rawNotes = typeof req.body?.rawNotes === 'string' ? req.body.rawNotes : ''
      const standup = req.body?.standup

      if (
        !standup ||
        typeof standup.summary !== 'string' ||
        typeof standup.yesterday !== 'string' ||
        typeof standup.today !== 'string' ||
        typeof standup.blockers !== 'string'
      ) {
        res.status(400).json({ error: 'Invalid standup payload' })
        return
      }

      const saved = await saveStandupForUser(userId, rawNotes, standup)
      res.json({ saved })
    } catch (error) {
      const message = apiErrorMessage(error)
      res.status(apiErrorStatus(message)).json({ error: message })
    }
  })

  app.post('/api/standup/generate', async (req, res) => {
    try {
      const { userId } = await verifyBearerToken(req.headers.authorization)

      const notes = typeof req.body?.notes === 'string' ? req.body.notes : ''
      const autoFetchGitHub = Boolean(req.body?.autoFetchGitHub)

      const result = await runStandupGeneration({ notes, autoFetchGitHub })

      let saved = null
      let saveError: string | null = null
      try {
        saved = await saveStandupForUser(userId, notes, result.standup)
      } catch (saveErr) {
        saveError = apiErrorMessage(saveErr)
      }

      res.json({ ...result, saved, saveError })
    } catch (error) {
      const message = apiErrorMessage(error)
      res.status(apiErrorStatus(message)).json({ error: message })
    }
  })

  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      if (res.headersSent) {
        next(err)
        return
      }

      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ error: 'Invalid JSON in request body' })
        return
      }

      const message =
        err instanceof Error ? err.message : 'Internal server error'
      res.status(500).json({ error: message })
    },
  )

  return app
}
