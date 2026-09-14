import { composePhotoPrompt, parsePhotoScene, renderPhotoScenePrompt } from '@odyssey/prompts'
import { toMomentCard, type ContentRating, type Message, type MomentCard, type PhotoKind } from '@odyssey/shared'
import type { ChatDeps } from '../chat/handler.js'
import { utcDayStart } from '../billing/rules.js'
import { levelFor } from '../levels.js'
import { publicUrl } from '../public-url.js'
import type { AppRepository, ConversationContext } from '../repo/types.js'
import { activeStory } from '../story/runtime.js'
import type { ImageProvider } from './provider.js'

/**
 * "Ask him for a picture" (docs/story-pipeline.md, 2026-09-14). She asks; he
 * decides what to send from where the night is and what he remembers; the
 * image model draws it with his hero as the reference; it lands as a private
 * moment, hers alone, with his caption as the message. The user never writes
 * a prompt and never sees one.
 *
 * Who may: a bought credit first; else Plus's daily allowance; else no. What
 * it may reach follows the open story's rating, SFW when none is open.
 */
export class PhotoRefused extends Error {
  constructor(
    readonly code: 'NEEDS_PLUS' | 'USED_TODAY' | 'LEVEL' | 'UNAVAILABLE',
    message: string
  ) {
    super(message)
  }
}

export interface PhotoServiceOptions {
  perDayPlus: number
  timeoutMs?: number
}

/** The three kinds on the menu: what she asked for, in words the scene model acts on, and how far it may reach. */
export const PHOTO_KINDS: Record<PhotoKind, { ask: string; rating: ContentRating; title: string }> = {
  NOW: { ask: 'a picture of you right now, where you are, doing what you are doing', rating: 'SFW', title: 'For you' },
  MORNING: { ask: 'a picture of you the morning after, just up, shirt open, before you have put yourself together', rating: 'MATURE', title: 'The morning' },
  ONLY_YOU: { ask: 'the picture you would not send anyone else: private, close, taken for her alone', rating: 'MATURE', title: 'Only you' },
}

/** The private card's position: after the catalogue, in the order asked. */
const ASKED_POSITION_BASE = 1000

export class PhotoService {
  constructor(
    private readonly provider: ImageProvider | null,
    private readonly opts: PhotoServiceOptions
  ) {}

  get enabled(): boolean {
    return this.provider !== null
  }

  /** The unauthenticated URL a private picture is served at; unguessable, and only ever sent to its owner. */
  static urlFor(momentId: string): string {
    return `${publicUrl()}/photos/${momentId}.jpg`
  }

  async ask(deps: ChatDeps, ctx: ConversationContext, kind: PhotoKind = 'NOW', now = new Date()): Promise<{ moment: MomentCard; message: Message }> {
    const { repo, log } = deps
    if (!this.provider) throw new PhotoRefused('UNAVAILABLE', 'He cannot send pictures yet.')
    const character = await repo.getCharacter(ctx.character.id)
    if (!character || !character.look) throw new PhotoRefused('UNAVAILABLE', 'He cannot send pictures yet.')
    // The hotter kinds only at the MATURE level: the build, her age, her plan, and how close he is.
    const wanted = PHOTO_KINDS[kind]
    if (wanted.rating === 'MATURE') {
      const tier = await deps.billing.tierOf(ctx.user.id)
      const level = levelFor({ channel: deps.channel, ageVerified: ctx.user.ageVerifiedAt !== null, tier, stage: ctx.relationship.stage })
      if (level !== 'MATURE') throw new PhotoRefused('LEVEL', 'Not that one yet. He will, when you are closer.')
    }

    // Who may. The credit is spent before the picture exists; a failed generation gives it back.
    const paidWithCredit = await repo.spendPhotoCredit(ctx.user.id)
    if (!paidWithCredit) {
      const tier = await deps.billing.tierOf(ctx.user.id)
      if (tier === 'FREE') throw new PhotoRefused('NEEDS_PLUS', 'Pictures are Plus.')
      const today = await repo.countAskedSince(ctx.user.id, utcDayStart(now))
      if (today >= this.opts.perDayPlus) throw new PhotoRefused('USED_TODAY', 'He already sent one today.')
    }

    try {
      const story = await activeStory(deps, ctx)
      const rating: ContentRating = wanted.rating
      const recent = (await repo.listRecentMessages(ctx.conversation.id, 8))
        .filter((m) => m.role !== 'SYSTEM')
        .map((m) => `${m.role === 'USER' ? 'you' : 'him'}: ${m.content.slice(0, 200)}`)
      const memories = await this.remember(deps, ctx, recent.at(-1) ?? 'a picture of you')
      const written = await this.scene(deps, {
        characterName: ctx.character.name,
        personaNotes: ctx.character.personaNotes,
        rating,
        userName: ctx.user.displayName,
        beatBrief: story?.beat.brief ?? null,
        episodeTitle: story?.episode.title ?? null,
        recent,
        memories,
        ask: wanted.ask,
      })
      const [hero] = await repo.listPortraits(ctx.character.id)
      const prompt = composePhotoPrompt({ look: character.look, scene: written.scene, rating })
      const { image, contentType } = await this.provider.generate({ prompt, references: hero ? [hero.url] : [] })

      const asked = await repo.countAskedSince(ctx.user.id, new Date(0))
      const moment = await repo.insertMoment({
        characterId: ctx.character.id,
        title: wanted.title,
        caption: written.caption,
        imageUrl: 'https://placeholder.invalid/pending',
        teaserUrl: null,
        position: ASKED_POSITION_BASE + asked,
        unlock: { kind: 'FREE' },
        ownerUserId: ctx.user.id,
      })
      // The URL is keyed by the moment, so it exists only once the row does.
      const url = PhotoService.urlFor(moment.id)
      const stored = await repo.updateMomentImage(moment.id, url)
      await repo.insertPhotoBlob({ momentId: moment.id, userId: ctx.user.id, scene: written.scene, prompt, contentType, image })
      const unlock = await repo.insertUnlock({ relationshipId: ctx.relationship.id, momentId: moment.id, source: 'ASKED' })
      const message = await repo.insertMessage({
        conversationId: ctx.conversation.id,
        role: 'CHARACTER',
        content: written.caption,
        clientMsgId: null,
        inReplyTo: null,
        momentId: moment.id,
      })
      log.info({ conversationId: ctx.conversation.id, momentId: moment.id, kind, rating, credit: paidWithCredit, provider: this.provider.name, bytes: image.length }, 'picture asked for')
      return { moment: toMomentCard(stored, unlock), message }
    } catch (err) {
      if (paidWithCredit) await repo.addPhotoCredits(ctx.user.id, 1)
      if (err instanceof PhotoRefused) throw err
      log.error({ err: err instanceof Error ? err.message : String(err), conversationId: ctx.conversation.id }, 'picture failed')
      throw new PhotoRefused('UNAVAILABLE', 'He could not take one just now.')
    }
  }

  /** The retrieved few, or nothing when memory is off or down; a picture must never fail on it. */
  private async remember(deps: ChatDeps, ctx: ConversationContext, query: string): Promise<string[]> {
    try {
      const assembled = await deps.memory.assemble(ctx, query, { longTerm: true, retrieveK: 4 })
      return assembled.memories.slice(0, 4)
    } catch (err) {
      deps.log.warn({ err: err instanceof Error ? err.message : String(err) }, 'picture: memory unavailable')
      return []
    }
  }

  /** The scene and caption from the story model; a plain fallback from the beat when it does not answer in kind. */
  private async scene(deps: ChatDeps, v: Parameters<typeof renderPhotoScenePrompt>[0]): Promise<{ scene: string; caption: string }> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 30_000)
    let text = ''
    try {
      for await (const chunk of deps.gateway.stream('STORY', { system: renderPhotoScenePrompt(v), messages: [{ role: 'user', content: 'Send it.' }], maxTokens: 300, temperature: 0.8 }, controller.signal)) {
        if (chunk.type === 'delta') text += chunk.text
      }
    } catch (err) {
      deps.log.warn({ err: err instanceof Error ? err.message : String(err) }, 'picture: scene model failed')
    } finally {
      clearTimeout(timer)
    }
    return parsePhotoScene(text) ?? this.fallback(v)
  }

  private fallback(v: Parameters<typeof renderPhotoScenePrompt>[0]): { scene: string; caption: string } {
    const where = v.beatBrief ? v.beatBrief.split(/(?<=\.)\s/)[0]!.slice(0, 200) : 'where he is tonight, looking at the camera, not smiling'
    return { scene: `${v.characterName}, ${where}`, caption: 'Here.' }
  }
}

/** For routes and tests: the repo methods this service relies on beyond the chat deps. */
export type PhotoRepo = Pick<AppRepository, 'insertMoment' | 'updateMomentImage' | 'insertPhotoBlob' | 'getPhotoBlob' | 'countAskedSince' | 'photoCredits' | 'addPhotoCredits' | 'spendPhotoCredit'>
