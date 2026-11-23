import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchAreaPatterns } from '../extension/bas-selection.js';

const areas = ['Brygga A', 'brygga B', 'Varvsplatser 1', 'Varvsområde 2', 'Vinter', 'A (1)', 'A x1'];
test('wildcard presets and combined patterns select complete area names ignoring case', () => {
  assert.deepEqual(matchAreaPatterns(areas, 'Brygga*'), areas.slice(0, 2));
  assert.deepEqual(matchAreaPatterns(areas, 'Brygga*; Varvsplats*\nVarvsområde*'), areas.slice(0, 4));
  assert.deepEqual(matchAreaPatterns(areas, '*'), areas);
  assert.deepEqual(matchAreaPatterns(areas, ''), []);
  assert.deepEqual(matchAreaPatterns(areas, 'Missing*'), []);
});
test('only star is special; regex punctuation is literal and overlaps do not duplicate', () => {
  assert.deepEqual(matchAreaPatterns(areas, 'A (1)'), ['A (1)']);
  assert.deepEqual(matchAreaPatterns(areas, 'Brygga*, *A, Brygga**'), areas.slice(0, 2));
  assert.deepEqual(matchAreaPatterns(areas, '.*'), []);
});
