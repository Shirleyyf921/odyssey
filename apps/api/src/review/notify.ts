import type { EpisodeRecord } from '../repo/types.js'

export interface SubmissionNotice {
  episode: EpisodeRecord
  characterName: string
  authorName: string | null
  /** Why a person has to read it: MATURE, first three, or the screen was unsure. */
  why: string
}

/**
 * Tells a person that something is waiting in the queue (docs/ugc-pipeline.md,
 * build order step 6), so a submission is not forgotten. A failed notice is
 * logged and the episode stays SUBMITTED; the queue is the source of truth.
 */
export interface ReviewNotifier {
  submitted(notice: SubmissionNotice): Promise<void>
}

interface Logger {
  info(obj: Record<string, unknown>, msg: string): void
  warn(obj: Record<string, unknown>, msg: string): void
}

/** The line in the log is the whole notice. Development, and production until a mail key exists. */
export class LogNotifier implements ReviewNotifier {
  constructor(private readonly log: Logger) {}
  async submitted(n: SubmissionNotice) {
    this.log.info({ episodeId: n.episode.id, title: n.episode.title, character: n.characterName, rating: n.episode.rating, why: n.why }, 'review: submission waiting')
  }
}

/** One plain-text mail per submission through Resend's HTTP API. No SDK: it is one POST. */
export class ResendNotifier implements ReviewNotifier {
  constructor(
    private readonly opts: { apiKey: string; to: string; from: string; reviewUrl: string | null; fetch?: typeof fetch },
    private readonly log: Logger
  ) {}

  async submitted(n: SubmissionNotice) {
    const subject = `[Odyssey review] ${n.episode.rating} · ${n.characterName} · "${n.episode.title}"`
    const text = [
      `${n.authorName ?? 'A reader'} submitted "${n.episode.title}" for ${n.characterName}.`,
      `Rating: ${n.episode.rating}. Why a person reads it: ${n.why}.`,
      n.episode.reviewNote ? `\nThe screen said:\n${n.episode.reviewNote}` : '',
      n.episode.dryRun ? `\nDry-run: ${n.episode.dryRun.passed ? 'passed' : 'FAILED'}, ${n.episode.dryRun.beats.length} beats.` : '',
      this.opts.reviewUrl ? `\n${this.opts.reviewUrl}` : '',
      `\nEpisode id: ${n.episode.id}`,
    ]
      .filter(Boolean)
      .join('\n')
    try {
      const res = await (this.opts.fetch ?? fetch)('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.opts.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: this.opts.from, to: [this.opts.to], subject, text }),
      })
      if (!res.ok) this.log.warn({ status: res.status, episodeId: n.episode.id }, 'review: mail refused; the episode is still in the queue')
      else this.log.info({ episodeId: n.episode.id, to: this.opts.to }, 'review: mail sent')
    } catch (err) {
      this.log.warn({ err: err instanceof Error ? err.message : String(err), episodeId: n.episode.id }, 'review: mail failed; the episode is still in the queue')
    }
  }
}
