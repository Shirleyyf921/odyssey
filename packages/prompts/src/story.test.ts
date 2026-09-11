import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderStoryTurn, type StoryTurnVariables } from './story.js'

const base: StoryTurnVariables = {
  rating: 'SFW',
  characterName: 'Elliot',
  userName: 'Shirley',
  personaNotes: 'Sound engineer, works nights.',
  stage: 'ACQUAINTED',
  justAdvanced: false,
  conversationSummary: '(nothing before this)',
  retrievedMemories: ['likes her coffee black'],
  episode: { title: 'The second staircase', premise: 'You found his studio at two in the morning.', setting: 'His studio, past two.' },
  beat: {
    kind: 'STORY',
    brief: 'She has just walked in. He does not get up yet.',
    setting: null,
    optionIntents: ['Cross the room and sit close', 'Stay by the door'],
    hotspots: ['hand'],
  },
  userAction: 'walks in',
  opening: true,
}

test('a STORY beat asks for two options in the authored order and names the hotspots', () => {
  const p = renderStoryTurn(base)
  assert.ok(p.indexOf('A. Cross the room and sit close') < p.indexOf('B. Stay by the door'))
  assert.ok(p.includes('[narration]') && p.includes('[line]') && p.includes('[options]'))
  assert.ok(p.includes('touches you (hand)'))
  assert.ok(p.includes('You speak first'))
  assert.ok(p.includes('likes her coffee black'))
  assert.ok(!p.includes('undefined'))
})

test('an END beat forbids the options section and a beat setting overrides the episode setting', () => {
  const p = renderStoryTurn({
    ...base,
    opening: false,
    userAction: 'chose: Stay until the rain stops',
    beat: { kind: 'END', brief: 'One line at the door.', setting: 'The second staircase.', optionIntents: [], hotspots: [] },
  })
  assert.ok(p.includes('No [options] section at all'))
  assert.ok(p.includes('Where you are: The second staircase.'))
  assert.ok(p.includes('What Shirley just did: chose: Stay until the rain stops'))
  assert.ok(!p.includes('touches you'))
})

test('the beat after an answered call is written as a voice on a phone, with no room in it', () => {
  const p = renderStoryTurn({
    ...base,
    opening: false,
    userAction: 'chose: Answer',
    beat: { kind: 'END', brief: 'He says the thing.', setting: 'On the phone.', optionIntents: [], hotspots: [] },
    onPhone: true,
  })
  assert.ok(p.includes('You are on the phone'))
  assert.ok(p.includes('nothing he turns toward'))
  assert.ok(!renderStoryTurn(base).includes('You are on the phone'), 'only after a ring')
})

test('the episode sets how far tonight goes; the stage only says how well they know each other', async () => {
  const sfw = renderStoryTurn(base)
  assert.ok(sfw.includes('How far tonight goes'))
  assert.ok(sfw.includes('above the waist'), 'the store line')
  assert.ok(!sfw.includes('door can close'))
  const mature = renderStoryTurn({ ...base, rating: 'MATURE' })
  assert.ok(mature.includes('door can close'))
  assert.ok(mature.includes('fades before sex itself'), 'the cut')
  assert.ok(!sfw.includes('hold back'), 'STRANGER no longer holds back')
})
