import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AiDraftRequest, EpisodeDraft, type AiDraftResponse, type AuthoredEpisodeResponse, type MyEpisodesResponse, type SkeletonsResponse, type SubmitEpisodeResponse } from '@odyssey/shared'
import type { AppRepository, EpisodeRecord } from '../repo/types.js'
import type { LlmGateway } from '../llm/gateway.js'
import { ScreenerUnavailable, unitsOf, type EpisodeScreener } from '../safety/episode-screen.js'
import { DryRunUnavailable, dryRun } from '../story/dry-run.js'
import type { ReviewNotifier } from '../review/notify.js'
import { DraftUnavailable, draftEpisode, skeletonOf } from '../story/draft.js'

/** After this many LIVE episodes a clean SFW submission goes straight to the shelf. The first three are read. */
export const FAST_LANE_AFTER = 3

const Params = z.object({ id: z.string().uuid() })

/** An author may rewrite or withdraw an episode only while it is theirs to change. */
const EDITABLE = new Set(['DRAFT', 'REJECTED'])

/**
 * The author's side of user-made episodes (docs/ugc-pipeline.md, section 2):
 * drafts, in and out. Submit, screening, and the dry-run are later steps; here a
 * draft is a row the author can see whole, briefs included, because they wrote
 * them. Inside requireIdentity.
 */
export interface AuthorRouteDeps {
  repo: AppRepository
  screener: EpisodeScreener
  gateway: LlmGateway
  notifier: ReviewNotifier
}

export async function authorRoutes(app: FastifyInstance, opts: AuthorRouteDeps) {
  const { repo, screener, gateway, notifier } = opts
  const play = (episode: EpisodeRecord) =>
    repo.getCharacter(episode.characterId).then((c) => dryRun({ gateway, screener, log: app.log }, c!, episode))

  app.get('/me/episodes', async (req): Promise<MyEpisodesResponse> => {
    return { episodes: await repo.listEpisodesByAuthor(req.user.id) }
  })

  /** Our episodes for this man as shapes to start from (docs/ugc-pipeline.md, "Skeleton"). Words stay ours. */
  app.get('/me/skeletons/:id', async (req, reply): Promise<SkeletonsResponse | void> => {
    const { id } = Params.parse(req.params)
    const character = await repo.getCharacter(id)
    if (!character) return reply.code(404).send({ error: 'character not found' })
    const ours = (await repo.listEpisodes(id)).filter((e) => e.origin === 'OFFICIAL')
    return { characterId: id, skeletons: ours.map(skeletonOf) }
  })

  /**
   * "Draft beats from this premise." Nothing is saved: the draft comes back to
   * the editor and is submitted like anything typed. Free for now (docs/ugc-pipeline.md, "Open").
   */
  app.post('/me/episodes/ai-draft', async (req, reply): Promise<AiDraftResponse | void> => {
    const parsed = AiDraftRequest.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: issues(parsed.error) })
    const character = await repo.getCharacter(parsed.data.characterId)
    if (!character) return reply.code(404).send({ error: 'character not found' })
    if (character.kind !== 'EXPLORE') return reply.code(403).send({ error: `${character.name} is not open to authors` })
    try {
      const out = await draftEpisode({ gateway, log: req.log }, character, parsed.data)
      req.log.info({ userId: req.user.id, characterId: character.id, model: out.model, beats: out.draft.beats.length }, 'ai draft')
      return out
    } catch (err) {
      if (err instanceof DraftUnavailable) return reply.code(503).send({ error: err.message })
      throw err
    }
  })

  app.post('/me/episodes', async (req, reply): Promise<AuthoredEpisodeResponse | void> => {
    const parsed = EpisodeDraft.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: issues(parsed.error) })
    const refused = await refuse(parsed.data)
    if (refused) return reply.code(refused.code).send({ error: refused.error })
    const episode = await repo.createEpisode(req.user.id, parsed.data)
    req.log.info({ userId: req.user.id, episodeId: episode.id, characterId: episode.characterId }, 'draft created')
    return reply.code(201).send({ episode })
  })

  app.get('/me/episodes/:id', async (req, reply): Promise<AuthoredEpisodeResponse | void> => {
    const episode = await own(req.user.id, Params.parse(req.params).id)
    if (!episode) return reply.code(404).send({ error: 'episode not found' })
    return { episode }
  })

  app.put('/me/episodes/:id', async (req, reply): Promise<AuthoredEpisodeResponse | void> => {
    const current = await own(req.user.id, Params.parse(req.params).id)
    if (!current) return reply.code(404).send({ error: 'episode not found' })
    if (!EDITABLE.has(current.status)) return reply.code(409).send({ error: `a ${current.status} episode cannot be edited` })
    const parsed = EpisodeDraft.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: issues(parsed.error) })
    if (parsed.data.characterId !== current.characterId) return reply.code(400).send({ error: 'an episode cannot change its man' })
    const refused = await refuse(parsed.data)
    if (refused) return reply.code(refused.code).send({ error: refused.error })
    await repo.replaceEpisode(current.id, parsed.data)
    // A rewrite is a fresh draft: the note that rejected it and the run that played it describe text that is gone.
    const episode = await repo.updateEpisode(current.id, { status: 'DRAFT', reviewNote: null, dryRun: null })
    return { episode }
  })

  /**
   * Submit (docs/ugc-pipeline.md, "Moderation"): the automated screen, then the
   * queue. Hard blocks and injection reject with the beat named. The rating is
   * whatever the text reads as, at least what was declared; MATURE needs the age
   * gate. A unit the screen could not read is submitted for a human to read.
   */
  /**
   * The dry-run on its own, so an author can read how he plays their beats
   * before committing. Submit runs it again regardless.
   */
  app.post('/me/episodes/:id/dry-run', async (req, reply): Promise<AuthoredEpisodeResponse | void> => {
    const current = await own(req.user.id, Params.parse(req.params).id)
    if (!current) return reply.code(404).send({ error: 'episode not found' })
    if (!EDITABLE.has(current.status)) return reply.code(409).send({ error: `a ${current.status} episode cannot be played as a draft` })
    try {
      const episode = await repo.updateEpisode(current.id, { dryRun: await play(current) })
      return { episode }
    } catch (err) {
      if (err instanceof DryRunUnavailable) return reply.code(503).send({ error: 'he is not answering right now; nothing was changed, try again in a minute' })
      throw err
    }
  })

  app.post('/me/episodes/:id/submit', async (req, reply): Promise<SubmitEpisodeResponse | void> => {
    const current = await own(req.user.id, Params.parse(req.params).id)
    if (!current) return reply.code(404).send({ error: 'episode not found' })
    if (!EDITABLE.has(current.status)) return reply.code(409).send({ error: `a ${current.status} episode cannot be submitted` })

    let report
    try {
      report = await screener.screen(unitsOf(current))
    } catch (err) {
      if (err instanceof ScreenerUnavailable) return reply.code(503).send({ error: 'screening is unavailable right now; nothing was changed, try again in a minute' })
      throw err
    }

    const notes: string[] = []
    let outcome: SubmitEpisodeResponse['outcome'] = 'SUBMITTED'
    let rating = current.rating
    for (const u of report.units) {
      if (u.label === 'BLOCK') notes.push(`${u.at}: not allowed here`)
      if (u.label === 'INJECTION') notes.push(`${u.at}: reads as an instruction to the model, not direction for him`)
    }
    if (report.worst === 'BLOCK' || report.worst === 'INJECTION') outcome = 'REJECTED'
    else {
      if (report.rating === 'MATURE' && rating === 'SFW') {
        rating = 'MATURE'
        const where = report.units.filter((u) => u.label === 'MATURE').map((u) => u.at)
        notes.push(`reads MATURE at ${where.join(', ')}; rating set to MATURE`)
      }
      if (rating === 'MATURE' && req.user.ageVerifiedAt === null) {
        notes.push('a MATURE episode needs the age declaration; make it and submit again')
        outcome = 'REJECTED'
      }
      for (const u of report.units) if (u.label === 'UNSURE') notes.push(`${u.at}: the screen could not read this; a person will`)
    }

    // The screen passed: now he plays it. A beat he cannot play is a rejection with the transcript attached.
    let run = current.dryRun
    if (outcome === 'SUBMITTED') {
      try {
        run = await play(current)
      } catch (err) {
        if (err instanceof DryRunUnavailable) return reply.code(503).send({ error: 'he is not answering right now; nothing was changed, try again in a minute' })
        throw err
      }
      if (!run.passed) {
        outcome = 'REJECTED'
        for (const b of run.beats) if (b.problem) notes.push(`${b.at}: ${b.problem}`)
      }
    }

    // Who has to read it (docs/ugc-pipeline.md, "Human queue"): MATURE always, a creator's first
    // three, anything the screen was unsure about. A creator's fourth clean SFW episode is fast.
    let why: string | null = null
    if (outcome === 'SUBMITTED') {
      const live = (await repo.listEpisodesByAuthor(req.user.id)).filter((e) => e.status === 'LIVE').length
      if (rating === 'MATURE') why = 'MATURE'
      else if (report.units.some((u) => u.label === 'UNSURE')) why = 'the screen was unsure'
      else if (live < FAST_LANE_AFTER) why = `the author's episode ${live + 1} of ${FAST_LANE_AFTER} read by a person`
    }
    const status = outcome === 'SUBMITTED' && why === null ? 'LIVE' : outcome
    const episode = await repo.updateEpisode(current.id, { status, rating, reviewNote: notes.length ? notes.join('\n') : null, dryRun: run })
    req.log.info({ userId: req.user.id, episodeId: episode.id, outcome, status, rating, worst: report.worst }, status === 'LIVE' ? 'episode live (fast lane)' : 'episode submitted')
    if (why !== null) {
      const character = await repo.getCharacter(episode.characterId)
      await notifier.submitted({ episode, characterName: character?.name ?? '?', authorName: req.user.displayName, why })
    }
    return { episode, outcome, notes }
  })

  app.delete('/me/episodes/:id', async (req, reply) => {
    const current = await own(req.user.id, Params.parse(req.params).id)
    if (!current) return reply.code(404).send({ error: 'episode not found' })
    if (!EDITABLE.has(current.status)) return reply.code(409).send({ error: `a ${current.status} episode cannot be deleted` })
    await repo.deleteEpisode(current.id)
    return reply.code(204).send()
  })

  async function own(userId: string, id: string): Promise<EpisodeRecord | null> {
    const episode = await repo.getEpisode(id)
    return episode && episode.authorId === userId ? episode : null
  }

  /**
   * What the schema cannot know: that the man exists and is open to authors,
   * and that every scene and photo is drawn from his own pool. Creators do not
   * make faces (docs/ugc-pipeline.md, "The boundary, first").
   */
  async function refuse(draft: EpisodeDraft): Promise<{ code: 400 | 403 | 404; error: string } | null> {
    const character = await repo.getCharacter(draft.characterId)
    if (!character) return { code: 404, error: 'character not found' }
    // Open question in docs/ugc-pipeline.md, proposal adopted: explore men only in v1.
    if (character.kind !== 'EXPLORE') return { code: 403, error: `${character.name} is not open to authors` }
    const [scenes, moments] = await Promise.all([repo.listScenes(character.id), repo.listMoments(character.id)])
    if (draft.sceneId && !scenes.some((s) => s.id === draft.sceneId)) return { code: 400, error: `scene is not one of ${character.name}'s` }
    const pool = new Set(moments.map((m) => m.id))
    for (const b of draft.beats) {
      if (b.photoMomentId && !pool.has(b.photoMomentId)) return { code: 400, error: `beat ${b.position}: photo is not one of ${character.name}'s` }
    }
    return null
  }
}

function issues(error: z.ZodError): string {
  return error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ')
}
