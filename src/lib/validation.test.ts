import { describe, expect, it } from 'vitest';
import { emptyProgress } from './progress';
import { parseProgress } from './validation';

describe('progress boundary validation', () => {
  it('accepts an empty guest document and complete answer shapes', () => {
    const progress = emptyProgress();
    const runId = crypto.randomUUID();
    progress.states['m1-money'] = {
      position: 3,
      runId,
      drafts: { numeric: '7,5%', choice: ['a'], matching: { asset: 'asset' } },
      updatedAt: new Date().toISOString(),
    };
    progress.attempts.push({
      id: crypto.randomUUID(),
      lessonId: 'm1-money',
      exerciseId: 'm1-money-q1',
      runId,
      answer: '7,5%',
      correct: false,
      at: new Date().toISOString(),
    });
    expect(parseProgress(progress)).toEqual(progress);
  });
  it('rejects incompatible versions, unknown ownership fields, and malformed UUIDs', () => {
    const progress = emptyProgress();
    expect(parseProgress({ ...progress, schemaVersion: 2 })).toBeNull();
    expect(parseProgress({ ...progress, user_id: 'another-user' })).toBeNull();
    expect(parseProgress({ ...progress, sourceId: 'not-a-uuid' })).toBeNull();
  });
  it('accepts optional lesson content versions and rejects invalid ones', () => {
    const progress = emptyProgress();
    const state = {
      position: 0,
      runId: crypto.randomUUID(),
      drafts: {},
      updatedAt: new Date().toISOString(),
    };
    expect(parseProgress({ ...progress, states: { 'm1-money': state } })).not.toBeNull();
    expect(
      parseProgress({ ...progress, states: { 'm1-money': { ...state, contentVersion: 2 } } }),
    ).not.toBeNull();
    for (const contentVersion of [0, -1, 1.5, 10001, '2', null]) {
      expect(
        parseProgress({ ...progress, states: { 'm1-money': { ...state, contentVersion } } }),
      ).toBeNull();
    }
  });
  it('rejects invalid numeric values rather than coercing them', () => {
    const progress = emptyProgress();
    for (const diagnosticScore of [NaN, Infinity, -1, 101, '90']) {
      expect(
        parseProgress({ ...progress, preferences: { ...progress.preferences, diagnosticScore } }),
      ).toBeNull();
    }
  });
  it('preserves optional attempt content versions and timezone offsets', () => {
    const progress = emptyProgress();
    const attempt = {
      id: crypto.randomUUID(),
      lessonId: 'm1-money',
      exerciseId: 'q1',
      runId: crypto.randomUUID(),
      answer: ['a'],
      correct: true,
      at: '2026-10-28T03:00:00+03:00',
    };
    expect(parseProgress({ ...progress, attempts: [attempt] })?.attempts[0]).toEqual(attempt);
    expect(
      parseProgress({ ...progress, attempts: [{ ...attempt, contentVersion: 2 }] })?.attempts[0],
    ).toEqual({ ...attempt, contentVersion: 2 });
    for (const contentVersion of [0, -1, 1.5, 10001, '2', null]) {
      expect(parseProgress({ ...progress, attempts: [{ ...attempt, contentVersion }] })).toBeNull();
    }
  });
  it('rejects duplicate immutable attempts and completed runs', () => {
    const progress = emptyProgress();
    const runId = crypto.randomUUID();
    const attempt = {
      id: crypto.randomUUID(),
      lessonId: 'm1-money',
      exerciseId: 'q1',
      runId,
      answer: 'a',
      correct: true,
      at: new Date().toISOString(),
    };
    expect(parseProgress({ ...progress, attempts: [attempt, attempt] })).toBeNull();
    const completion = {
      lessonId: 'm1-money',
      runId,
      version: 1,
      score: 100,
      completedAt: new Date().toISOString(),
    };
    expect(parseProgress({ ...progress, completions: [completion, completion] })).toBeNull();
  });
  it('bounds saved drafts, timestamps and document size', () => {
    const progress = emptyProgress();
    const state = {
      position: 0,
      runId: crypto.randomUUID(),
      drafts: { q1: 'a'.repeat(3001) },
      updatedAt: new Date().toISOString(),
    };
    expect(parseProgress({ ...progress, states: { 'm1-money': state } })).toBeNull();
    expect(parseProgress({ ...progress, preferencesUpdatedAt: 'yesterday' })).toBeNull();
    expect(
      parseProgress({
        ...progress,
        states: { 'm1-money': { ...state, drafts: {}, position: -1 } },
      }),
    ).toBeNull();
    expect(parseProgress({ ...progress, injected: 'x'.repeat(2_000_001) })).toBeNull();
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(parseProgress(cycle)).toBeNull();
  });
});
