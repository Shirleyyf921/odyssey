import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  DevSetStageRequest,
  ReportEpisodeRequest,
  type ReportEpisodeResponse,
  type CharacterDetail,
  type CharactersResponse,
  type EpisodesResponse,
  type HomeEpisode,
  type HomeResponse,
  type MomentCard,
  type TonightItem,
  type Tier,
  type TonightResponse,
  type MomentsResponse,
  type StartRelationshipResponse,
} from '@odyssey/shared'
import { RULES } from '../relationship/rules.js'
import { evaluateUnlocks } from '../moments/unlocks.js'
import { toEpisodeCard, tonight as tonight_, type CardCredit } from '../episodes/availability.js'
import { rankCommunity, statusAfterReport } from '../episodes/community.js'
import { visibleRatings } from '../episodes/rating.js'
import type { ReachOutService } from '../relationship/reachout.js'
import type { AppRepository, EpisodeRecord, RunCounts } from '../repo/types.js'

const Params = z.object({ id: z.string().uuid() })

/** A creator's name on the card, nothing else (docs/ugc-pipeline.md, "Open"). */
async function authorNames(repo: AppRepository, episodes: EpisodeRecord[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(episodes.map((e) => e.authorId).filter((id): id is string => id !== null))]
  const users = await Promise.all(ids.map((id) => repo.getUser(id)))
  return new Map(ids.map((id, i) => [id, users[i]?.displayName ?? null]))
}

export async function characterRoutes(
  app: FastifyInstance,
  opts: { repo: AppRepository; devTools?: boolean; billing?: { tierOf(userId: string): Promise<Tier> }; reachOut?: ReachOutService }
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
    const ratings = visibleRatings(req.channel, req.user.ageVerifiedAt !== null)
    const byCharacter = new Map(rels.map((r) => [r.characterId, r]))
    const items = await Promise.all(
      chars.map(async ({ personaNotes: _notes, ...c }) => {
        const relationship = byCharacter.get(c.id) ?? null
        const [portraits, all] = await Promise.all([repo.listPortraits(c.id), repo.listEpisodes(c.id)])
        const runs = relationship ? await repo.listRuns(relationship.id) : []
        // The home screen is ours: what readers wrote lives on his page.
        const cards = all
          .filter((e) => e.origin === 'OFFICIAL' && ratings.includes(e.rating))
          .map((e) => toEpisodeCard(e, relationship, tier, runs, all))
        return { character: { ...c, portraitUrl: portraits[0]?.url ?? null, relationship }, episode: tonight_(cards), reachOut: null }
      })
    )
    return { items }
  })

  /**
   * The home screen, whole. Tonight at the head, then every episode across the
   * roster, what readers wrote, and his pictures: the screen should not end
   * when the one card is played.
   */
  app.get('/home', async (req): Promise<HomeResponse> => {
    const [chars, rels, tier, purchases] = await Promise.all([
      repo.listCharacters(),
      repo.listRelationships(req.user.id),
      tierOf(req.user.id),
      repo.listPurchases(req.user.id),
    ])
    const ratings = visibleRatings(req.channel, req.user.ageVerifiedAt !== null)
    const skus = new Set(purchases.filter((p) => !p.refundedAt).map((p) => p.productId))
    const byCharacter = new Map(rels.map((r) => [r.characterId, r]))
    const tonight: TonightItem[] = []
    const episodes: HomeEpisode[] = []
    const theirs: HomeEpisode[] = []
    const unlocked: MomentCard[] = []
    const next: MomentCard[] = []
    let resume: HomeEpisode | null = null
    const counts = new Map<string, RunCounts>()
    const names = new Map<string, string | null>()

    for (const { personaNotes: _notes, ...c } of chars) {
      const relationship = byCharacter.get(c.id) ?? null
      const [portraits, all, moments] = await Promise.all([repo.listPortraits(c.id), repo.listEpisodes(c.id), repo.listMoments(c.id)])
      const runs = relationship ? await repo.listRuns(relationship.id) : []
      const portraitUrl = portraits[0]?.url ?? null
      const visible = all.filter((e) => ratings.includes(e.rating))
      const { cards: momentCards } = await evaluateUnlocks(repo, moments, relationship, skus)
      const cardById = new Map(momentCards.map((m) => [m.id, m]))
      const shownIn = new Map<string, string>()
      for (const e of all) for (const b of e.beats) if (b.photoMomentId && !shownIn.has(b.photoMomentId)) shownIn.set(b.photoMomentId, e.title)

      const home = (e: EpisodeRecord, credit: CardCredit = {}): HomeEpisode => {
        const ending = e.beats.find((b) => b.kind === 'END' && b.photoMomentId)?.photoMomentId ?? null
        const cover = ending ? (cardById.get(ending) ?? null) : null
        return {
          ...toEpisodeCard(e, relationship, tier, runs, all, credit),
          characterName: c.name,
          portraitUrl,
          coverUrl: cover?.status === 'UNLOCKED' ? cover.imageUrl : null,
          hasCall: e.beats.some((b) => b.kind === 'CALL'),
          photoCount: e.beats.filter((b) => b.photoMomentId).length,
        }
      }

      const ours = visible.filter((e) => e.origin === 'OFFICIAL').map((e) => home(e))
      // He may have written while they were gone; if not yet today, he does now.
      let reachOut = null
      if (relationship && opts.reachOut) {
        reachOut = await opts.reachOut.maybeReachOut(relationship)
        if (!reachOut && relationship.reachedOutOn && (!relationship.lastActiveDate || relationship.reachedOutOn > relationship.lastActiveDate)) {
          const recent = await repo.listRecentMessages(relationship.conversationId, 1)
          reachOut = recent.at(-1)?.role === 'CHARACTER' ? (recent.at(-1) ?? null) : null
        }
      }
      tonight.push({ character: { ...c, portraitUrl, relationship }, episode: tonight_(ours), reachOut })
      episodes.push(...ours)
      const open = ours.find((e) => e.status === 'IN_PROGRESS')
      if (open && !resume) resume = open

      const ugc = visible.filter((e) => e.origin === 'UGC')
      if (ugc.length) {
        const [cts, authors] = await Promise.all([repo.countRuns(ugc.map((e) => e.id)), authorNames(repo, ugc)])
        for (const [k, v] of cts) counts.set(k, v)
        for (const [k, v] of authors) names.set(k, v)
        theirs.push(...ugc.map((e) => home(e, { authorName: e.authorId ? (names.get(e.authorId) ?? null) : null, completions: cts.get(e.id)?.finished ?? 0 })))
      }

      for (const m of momentCards) {
        const card = { ...m, story: shownIn.get(m.id) ?? null }
        if (card.status === 'UNLOCKED') unlocked.push(card)
        else if (card.story && card.unlock.kind !== 'PURCHASE') next.push(card)
      }
    }
    unlocked.sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
    return {
      tonight,
      resume,
      episodes,
      community: rankCommunity(theirs, counts).slice(0, 6) as HomeEpisode[],
      moments: { unlocked: unlocked.slice(0, 6), next: next.slice(0, 3) },
    }
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
   * the server. Ours first in authored order; then what readers wrote for him,
   * best-finished first, under the same rating rail (docs/ugc-pipeline.md,
   * "Serving rules").
   */
  app.get('/characters/:id/episodes', async (req, reply): Promise<EpisodesResponse | void> => {
    const { id } = Params.parse(req.params)
    const character = await repo.getCharacter(id)
    if (!character) return reply.code(404).send({ error: 'character not found' })
    const [all, relationship, tier] = await Promise.all([repo.listEpisodes(id), repo.findRelationship(req.user.id, id), tierOf(req.user.id)])
    const runs = relationship ? await repo.listRuns(relationship.id) : []
    const ratings = visibleRatings(req.channel, req.user.ageVerifiedAt !== null)
    const visible = all.filter((e) => ratings.includes(e.rating))
    const ours = visible.filter((e) => e.origin === 'OFFICIAL')
    const theirs = visible.filter((e) => e.origin === 'UGC')
    const [counts, names] = await Promise.all([repo.countRuns(theirs.map((e) => e.id)), authorNames(repo, theirs)])
    const episodes = ours.map((e) => toEpisodeCard(e, relationship, tier, runs, all))
    const community = rankCommunity(
      theirs.map((e) =>
        toEpisodeCard(e, relationship, tier, runs, all, {
          authorName: e.authorId ? (names.get(e.authorId) ?? null) : null,
          completions: counts.get(e.id)?.finished ?? 0,
        })
      ),
      counts
    )
    return { characterId: id, relationship, episodes, community }
  })

  /**
   * A player flags a user-made episode (docs/ugc-pipeline.md, "Moderation",
   * post-publish). One per player; enough of them take it off the shelf until a
   * person has read it. Our own episodes are not reportable here: they are ours.
   */
  app.post('/episodes/:id/report', async (req, reply): Promise<ReportEpisodeResponse | void> => {
    const { id } = Params.parse(req.params)
    const parsed = ReportEpisodeRequest.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'reason required' })
    const episode = await repo.getEpisode(id)
    if (!episode || episode.origin !== 'UGC' || !['LIVE', 'UNLISTED'].includes(episode.status)) {
      return reply.code(404).send({ error: 'episode not found' })
    }
    if (episode.authorId === req.user.id) return reply.code(400).send({ error: 'you wrote this one' })
    const { counted, reportCount } = await repo.reportEpisode({ episodeId: id, reporterId: req.user.id, reason: parsed.data.reason })
    const status = statusAfterReport(episode.status, reportCount)
    if (status !== episode.status) {
      await repo.updateEpisode(id, { status })
      req.log.warn({ episodeId: id, authorId: episode.authorId, reportCount, reason: parsed.data.reason }, 'episode unlisted on reports')
    } else if (counted) {
      req.log.info({ episodeId: id, reportCount, reason: parsed.data.reason }, 'episode reported')
    }
    return { counted, status }
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
    // A locked everyday card that a beat carries says which episode shows it, so the
    // gallery points at the story rather than at a number.
    const shownIn = new Map<string, string>()
    for (const e of await repo.listEpisodes(id)) {
      if (e.origin !== 'OFFICIAL') continue
      for (const b of e.beats) if (b.photoMomentId && !shownIn.has(b.photoMomentId)) shownIn.set(b.photoMomentId, e.title)
    }
    return { characterId: id, relationship, moments: cards.map((c) => ({ ...c, story: shownIn.get(c.id) ?? null })) }
  })
}
