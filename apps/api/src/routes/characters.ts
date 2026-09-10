import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  DevSetStageRequest,
  type CharacterDetail,
  type CharactersResponse,
  type EpisodesResponse,
  type Tier,
  type TonightResponse,
  type MomentsResponse,
  type StartRelationshipResponse,
} from '@odyssey/shared'
import { RULES } from '../relationship/rules.js'
import { evaluateUnlocks } from '../moments/unlocks.js'
import { toEpisodeCard, tonight } from '../episodes/availability.js'
import type { AppRepository } from '../repo/types.js'

const Params = z.object({ id: z.string().uuid() })

export async function characterRoutes(
  app: FastifyInstance,
  opts: { repo: AppRepository; devTools?: boolean; billing?: { tierOf(userId: string): Promise<Tier> } }
) {
  const { repo } = opts
  const tierOf = (userId: string) => opts.billing?.tierOf(userId) ?? Promise.resolve<Tier>('FREE')

  app.get('/characters', async (req): Promise<CharactersResponse> => {
    const [chars, rels] = await Promise.all([repo.listCharacters(), repo.listRelationships(req.user.id)])
    const byCharacter = new Map(rels.map((r) => [r.characterId, r]))
    const characters = await Promise.all(
      chars.map(async ({ personaNotes: _notes, ...c }) => {
        const [first] = await repo.listPortraits(c.id)
        return { ...c, portraitUrl: first?.url ?? null, relationship: byCharacter.get(c.id) ?? null }
      })
    )
    return { characters }
  })

  /**
   * The home screen: every character with the one episode to show for him
   * tonight. Cards only, same rules as /characters/:id/episodes.
   */
  app.get('/tonight', async (req): Promise<TonightResponse> => {
    const [chars, rels, tier] = await Promise.all([repo.listCharacters(), repo.listRelationships(req.user.id), tierOf(req.user.id)])
    const byCharacter = new Map(rels.map((r) => [r.characterId, r]))
    const items = await Promise.all(
      chars.map(async ({ personaNotes: _notes, ...c }) => {
        const relationship = byCharacter.get(c.id) ?? null
        const [portraits, all] = await Promise.all([repo.listPortraits(c.id), repo.listEpisodes(c.id)])
        const runs = relationship ? await repo.listRuns(relationship.id) : []
        const cards = all.filter((e) => e.rating === 'SFW').map((e) => toEpisodeCard(e, relationship, tier, runs, all))
        return { character: { ...c, portraitUrl: portraits[0]?.url ?? null, relationship }, episode: tonight(cards) }
      })
    )
    return { items }
  })

  app.get('/characters/:id', async (req, reply): Promise<CharacterDetail | void> => {
    const { id } = Params.parse(req.params)
    const character = await repo.getCharacter(id)
    if (!character) return reply.code(404).send({ error: 'character not found' })
    const [portraits, relationship, moments, scenes] = await Promise.all([
      repo.listPortraits(id),
      repo.findRelationship(req.user.id, id),
      repo.listMoments(id),
      repo.listScenes(id),
    ])
    const { personaNotes: _notes, ...pub } = character
    return { ...pub, portraits, relationship, momentCount: moments.length, scenes }
  })

  /**
   * Idempotent. PRIMARY characters get the full memory stack; EXPLORE ones stay
   * LIGHT (ARCHITECTURE.md section 1, capability tiering).
   */
  app.post('/characters/:id/start', async (req, reply): Promise<StartRelationshipResponse | void> => {
    const { id } = Params.parse(req.params)
    const character = await repo.getCharacter(id)
    if (!character) return reply.code(404).send({ error: 'character not found' })
    const existing = await repo.findRelationship(req.user.id, id)
    if (existing) return { relationship: existing }

    // The conversation opens in the character's first scene, and he speaks first.
    // His opener is the strongest style sample the model will see, so it is a real
    // message in the history, not a client-side decoration.
    const [scene] = await repo.listScenes(id)
    const relationship = await repo.createRelationship(
      req.user.id,
      id,
      character.kind === 'PRIMARY' ? 'DEEP' : 'LIGHT',
      scene?.id ?? null
    )
    if (scene) {
      await repo.insertMessage({
        conversationId: relationship.conversationId,
        role: 'CHARACTER',
        content: scene.opener,
        clientMsgId: null,
        inReplyTo: null,
      })
    }
    return { relationship }
  })

  /**
   * Development only. Sets stage and the minimum affinity and active days that
   * stage requires, so the persona and the moments gallery can be reviewed at
   * CLOSE or INTIMATE today instead of in three weeks. Not registered in production.
   */
  if (opts.devTools) {
    app.post('/characters/:id/dev/stage', async (req, reply): Promise<StartRelationshipResponse | void> => {
      const { id } = Params.parse(req.params)
      const parsed = DevSetStageRequest.safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: 'stage required' })
      const relationship = await repo.findRelationship(req.user.id, id)
      if (!relationship) return reply.code(404).send({ error: 'start the relationship first' })
      const { stage } = parsed.data
      const gate = stage === 'STRANGER' ? { affinity: 0, activeDays: 0 } : RULES.stages[stage]
      const updated = await repo.updateRelationship(relationship.id, {
        stage,
        affinity: Math.max(relationship.affinity, gate.affinity),
        activeDays: Math.max(relationship.activeDays, gate.activeDays),
        stageChangedAt: new Date(),
      })
      req.log.warn({ relationshipId: relationship.id, stage }, 'dev: stage forced')
      return { relationship: updated }
    })
  }

  /**
   * The "tonight" list for one character. Cards only: briefs and beats stay on
   * the server. MATURE episodes are not served yet (story pipeline, step 6).
   */
  app.get('/characters/:id/episodes', async (req, reply): Promise<EpisodesResponse | void> => {
    const { id } = Params.parse(req.params)
    const character = await repo.getCharacter(id)
    if (!character) return reply.code(404).send({ error: 'character not found' })
    const [all, relationship, tier] = await Promise.all([repo.listEpisodes(id), repo.findRelationship(req.user.id, id), tierOf(req.user.id)])
    const runs = relationship ? await repo.listRuns(relationship.id) : []
    const episodes = all.filter((e) => e.rating === 'SFW').map((e) => toEpisodeCard(e, relationship, tier, runs, all))
    return { characterId: id, relationship, episodes }
  })

  app.get('/characters/:id/moments', async (req, reply): Promise<MomentsResponse | void> => {
    const { id } = Params.parse(req.params)
    const character = await repo.getCharacter(id)
    if (!character) return reply.code(404).send({ error: 'character not found' })
    const [moments, relationship, purchases] = await Promise.all([
      repo.listMoments(id),
      repo.findRelationship(req.user.id, id),
      repo.listPurchases(req.user.id),
    ])
    const skus = new Set(purchases.filter((p) => !p.refundedAt).map((p) => p.productId))
    const { cards } = await evaluateUnlocks(repo, moments, relationship, skus)
    return { characterId: id, relationship, moments: cards }
  })
}
