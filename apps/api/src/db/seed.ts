import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { SEED_CHARACTERS } from '../content/seed.js'
import { characters, moments, portraits, scenes } from './schema.js'

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
      .values({ id: p.id, characterId: p.characterId, url: p.url, position: p.position, label: p.label })
      .onConflictDoUpdate({ target: portraits.id, set: { url: p.url, position: p.position, label: p.label } })
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
        position: m.position,
        unlockRule: m.unlock,
      })
      .onConflictDoUpdate({
        target: moments.id,
        set: { title: m.title, caption: m.caption, imageUrl: m.imageUrl, position: m.position, unlockRule: m.unlock },
      })
  }
}
await sql.end()
console.log(`seeded ${SEED_CHARACTERS.length} characters`)
