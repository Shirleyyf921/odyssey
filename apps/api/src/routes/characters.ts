import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  DevSetStageRequest,
  type CharacterDetail,
  type CharactersResponse,
  type MomentsResponse,
  type StartRelationshipResponse,
} from '@odyssey/shared'
import { RULES } from '../relationship/rules.js'
import { evaluateUnlocks } from '../moments/unlocks.js'
import type { AppRepository } from '../repo/types.js'

const Params = z.object({ id: z.string().uuid() })

export async function characterRoutes(
  app: FastifyInstance,
  opts: { repo: AppRepository; devTools?: boolean }
) {
  const { repo } = opts

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

  app.get('/characters/:id/moments', async (req, reply): Promise<MomentsResponse | void> => {
    const { id } = Params.parse(req.params)
    const character = await repo.getCharacter(id)
    if (!character) return reply.code(404).send({ error: 'character not found' })
    const [moments, relationship] = await Promise.all([repo.listMoments(id), repo.findRelationship(req.user.id, id)])
    const { cards } = await evaluateUnlocks(repo, moments, relationship)
    return { characterId: id, relationship, moments: cards }
  })
}
