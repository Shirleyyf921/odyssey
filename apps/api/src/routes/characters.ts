import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type {
  CharacterDetail,
  CharactersResponse,
  MomentsResponse,
  StartRelationshipResponse,
} from '@odyssey/shared'
import { evaluateUnlocks } from '../moments/unlocks.js'
import type { AppRepository } from '../repo/types.js'

const Params = z.object({ id: z.string().uuid() })

export async function characterRoutes(app: FastifyInstance, opts: { repo: AppRepository }) {
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
    const [portraits, relationship, moments] = await Promise.all([
      repo.listPortraits(id),
      repo.findRelationship(req.user.id, id),
      repo.listMoments(id),
    ])
    const { personaNotes: _notes, ...pub } = character
    return { ...pub, portraits, relationship, momentCount: moments.length }
  })

  /**
   * Idempotent. PRIMARY characters get the full memory stack; EXPLORE ones stay
   * LIGHT (ARCHITECTURE.md section 1, capability tiering).
   */
  app.post('/characters/:id/start', async (req, reply): Promise<StartRelationshipResponse | void> => {
    const { id } = Params.parse(req.params)
    const character = await repo.getCharacter(id)
    if (!character) return reply.code(404).send({ error: 'character not found' })
    const relationship = await repo.createRelationship(
      req.user.id,
      id,
      character.kind === 'PRIMARY' ? 'DEEP' : 'LIGHT'
    )
    return { relationship }
  })

  app.get('/characters/:id/moments', async (req, reply): Promise<MomentsResponse | void> => {
    const { id } = Params.parse(req.params)
    const character = await repo.getCharacter(id)
    if (!character) return reply.code(404).send({ error: 'character not found' })
    const [moments, relationship] = await Promise.all([repo.listMoments(id), repo.findRelationship(req.user.id, id)])
    const { cards } = await evaluateUnlocks(repo, moments, relationship)
    return { characterId: id, relationship, moments: cards }
  })
}
