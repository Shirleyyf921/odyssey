import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { SEED_CHARACTERS } from '../content/seed.js'
import { beats, characters, episodes, moments, portraits, scenes } from './schema.js'

/** Upserts the launch roster. Safe to re-run: ids are fixed. */
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = postgres(url, { max: 1 })
const db = drizzle(sql)

for (const seed of SEED_CHARACTERS) {
  const c = seed.character
  await db
    .insert(characters)
    .values({
      id: c.id,
      kind: c.kind,
      name: c.name,
      tagline: c.tagline,
      avatarUrl: c.avatarUrl,
      voiceId: c.voiceId,
      personaNotes: c.personaNotes,
    })
    .onConflictDoUpdate({
      target: characters.id,
      set: { name: c.name, tagline: c.tagline, personaNotes: c.personaNotes },
    })
  for (const p of seed.portraits) {
    await db
      .insert(portraits)
      .values({ id: p.id, characterId: p.characterId, url: p.url, position: p.position, label: p.label, hotspots: p.hotspots ?? [] })
      .onConflictDoUpdate({ target: portraits.id, set: { url: p.url, position: p.position, label: p.label, hotspots: p.hotspots ?? [] } })
  }
  for (const sc of seed.scenes) {
    await db
      .insert(scenes)
      .values({ id: sc.id, characterId: sc.characterId, title: sc.title, setting: sc.setting, opener: sc.opener, backdropUrl: sc.backdropUrl, position: sc.position })
      .onConflictDoUpdate({
        target: scenes.id,
        set: { title: sc.title, setting: sc.setting, opener: sc.opener, backdropUrl: sc.backdropUrl, position: sc.position },
      })
  }
  for (const m of seed.moments) {
    await db
      .insert(moments)
      .values({
        id: m.id,
        characterId: m.characterId,
        title: m.title,
        caption: m.caption,
        imageUrl: m.imageUrl,
        teaserUrl: m.teaserUrl ?? null,
        position: m.position,
        unlockRule: m.unlock,
      })
      .onConflictDoUpdate({
        target: moments.id,
        set: { title: m.title, caption: m.caption, imageUrl: m.imageUrl, teaserUrl: m.teaserUrl ?? null, position: m.position, unlockRule: m.unlock },
      })
  }
  for (const e of seed.episodes) {
    await db
      .insert(episodes)
      .values({
        id: e.id,
        characterId: e.characterId,
        position: e.position,
        title: e.title,
        premise: e.premise,
        setting: e.setting,
        opener: e.opener,
        sceneId: e.sceneId,
        rating: e.rating,
        unlockRule: e.unlock,
        firstBeatId: e.firstBeatId,
        authorId: null,
        origin: 'OFFICIAL',
        status: 'LIVE',
        version: e.version,
      })
      .onConflictDoUpdate({
        target: episodes.id,
        set: {
          position: e.position,
          title: e.title,
          premise: e.premise,
          setting: e.setting,
          opener: e.opener,
          sceneId: e.sceneId,
          rating: e.rating,
          unlockRule: e.unlock,
          firstBeatId: e.firstBeatId,
        },
      })
    for (const b of e.beats) {
      const row = {
        episodeId: b.episodeId,
        position: b.position,
        kind: b.kind,
        brief: b.brief,
        setting: b.setting,
        options: b.options,
        nextBeatId: b.next,
        photoMomentId: b.photoMomentId,
        callUrl: b.callUrl,
        callSeconds: b.callSeconds,
        hotspots: b.hotspots,
      }
      await db.insert(beats).values({ id: b.id, ...row }).onConflictDoUpdate({ target: beats.id, set: row })
    }
  }
}
await sql.end()
console.log(`seeded ${SEED_CHARACTERS.length} characters`)
