export const DEFAULT_MENU = [
  { name: '牛丼', emoji: '🍚', number: '01', remark: '世界を救った。並盛で。' },
  { name: 'ラーメン', emoji: '🍜', number: '02', remark: '人類の希望は、替え玉できる。' },
  { name: 'カレー', emoji: '🍛', number: '03', remark: 'すべての伏線は、ルーに溶けた。' },
  { name: '寿司', emoji: '🍣', number: '04', remark: '財布へのダメージは、想定外。' },
  { name: 'ハンバーガー', emoji: '🍔', number: '05', remark: 'この作戦、ポテトも付く。' },
  { name: 'うどん', emoji: '🥢', number: '06', remark: '壮大な運命。やさしいおだし。' },
  { name: '唐揚げ定食', emoji: '🍗', number: '07', remark: '勝利の代償は、午後の眠気。' },
  { name: 'コンビニ弁当', emoji: '🍱', number: '08', remark: '3兆円の作戦。その結末、徒歩2分。' },
];

export function parseMenu(text) {
  const names = [...new Set(text.split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
  if (names.length < 1) throw new Error('少なくとも1つ、昼飯を残してください。人類が困ります。');
  if (names.length > 16) throw new Error('候補は16個まで。司令部もそんなに覚えられません。');
  if (names.some(name => [...name].length > 20)) throw new Error('候補名は20文字まで。長すぎると予告に収まりません。');
  return names.map((name, i) => ({
    name,
    emoji: DEFAULT_MENU.find(item => item.name === name)?.emoji || '🍽️',
    number: String(i + 1).padStart(2, '0'),
    remark: DEFAULT_MENU.find(item => item.name === name)?.remark || 'これだけの演出で、決まったのは昼飯。',
  }));
}

// Rejection sampling avoids modulo bias. Visual drama never affects the draw.
export function drawMenu(candidates, cryptoSource = globalThis.crypto) {
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error('No lunch candidates');
  const range = 2 ** 32;
  const limit = range - range % candidates.length;
  const sample = new Uint32Array(1);
  do { cryptoSource.getRandomValues(sample); } while (sample[0] >= limit);
  return candidates[sample[0] % candidates.length];
}
