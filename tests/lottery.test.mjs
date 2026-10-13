import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MENU, drawMenu, parseMenu } from '../dist/lottery.mjs';

function mockRandom(...values) {
  return { getRandomValues(array) { assert.ok(values.length, 'Unexpected random sample'); array[0] = values.shift(); return array; } };
}

test('each candidate has a reachable draw and excluded candidates cannot return', () => {
  const candidates = DEFAULT_MENU.filter(item => !['牛丼', '寿司'].includes(item.name));
  candidates.forEach((item, index) => assert.equal(drawMenu(candidates, mockRandom(index)), item));
  assert.equal(drawMenu([candidates[0]], mockRandom(4294967295)), candidates[0]);
  assert.throws(() => drawMenu([]), /No lunch candidates/);
});

test('rejection sampling discards the uneven tail of the 32-bit range', () => {
  assert.equal(drawMenu(['a', 'b', 'c'], mockRandom(4294967295, 1)), 'b');
});

test('custom menus are trimmed, deduplicated and validated', () => {
  assert.deepEqual(parseMenu(' 牛丼 \r\n\nカレー\n牛丼').map(item => item.name), ['牛丼', 'カレー']);
  assert.equal(parseMenu('駅前のそば屋')[0].emoji, '🍽️');
  assert.equal(parseMenu('牛丼')[0].remark, DEFAULT_MENU[0].remark);
  assert.throws(() => parseMenu(' \n '), /少なくとも1つ/);
  assert.throws(() => parseMenu(Array.from({ length: 17 }, (_, index) => `店${index}`).join('\n')), /16個まで/);
  assert.throws(() => parseMenu('あ'.repeat(21)), /20文字まで/);
  assert.equal(parseMenu('🍱'.repeat(20))[0].name, '🍱'.repeat(20));
});
