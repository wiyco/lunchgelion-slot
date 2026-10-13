import { DEFAULT_MENU, drawMenu, parseMenu } from './lottery.mjs';

const $ = id => document.getElementById(id);
const storageKey = 'lunch-instrumentality-v1';
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let menu = DEFAULT_MENU.map(item => ({ ...item }));
let excluded = new Set();
let previous = '';
let sound = false;
let fast = motionPreference.matches;
let active = null;
let reelInterval;
let audioContext;
let audioMaster;
let toastTimer;
let particleFrame;
let runNumber = 0;
let lastStarter;

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object') {
    if (Array.isArray(saved.names) && saved.names.every(name => typeof name === 'string')) menu = parseMenu(saved.names.join('\n'));
    if (Array.isArray(saved.excluded)) excluded = new Set(saved.excluded.filter(name => menu.some(item => item.name === name)));
    if (excluded.size >= menu.length) excluded.clear();
    if (typeof saved.previous === 'string') previous = saved.previous.slice(0, 100);
  }
} catch { /* Storage may be unavailable or an older saved state may be invalid. */ }

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({ names: menu.map(item => item.name), excluded: [...excluded], previous })); }
  catch { /* The game also works without persistent storage. */ }
}

function announce(message) { $('announcement').textContent = message; }
function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200);
}

function renderMenu() {
  const nodes = menu.map(item => {
    const button = document.createElement('button');
    button.className = 'menu-option';
    button.type = 'button';
    button.setAttribute('aria-pressed', String(!excluded.has(item.name)));
    button.setAttribute('aria-label', `${item.name}を抽選候補に含める`);
    button.disabled = Boolean(active);
    const emoji = document.createElement('span');
    emoji.className = 'menu-emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = item.emoji;
    const name = document.createElement('span');
    name.className = 'menu-name';
    name.textContent = item.name;
    const dot = document.createElement('i');
    dot.className = 'menu-dot';
    dot.setAttribute('aria-hidden', 'true');
    button.append(emoji, name, dot);
    button.addEventListener('click', () => {
      if (active) return;
      if (excluded.has(item.name)) excluded.delete(item.name);
      else if (menu.length - excluded.size > 1) excluded.add(item.name);
      else { toast('最後の1候補です。人類の食事を奪わないでください。'); return; }
      save();
      renderMenu();
      announce(`${menu.length - excluded.size}候補が参加中`);
    });
    return button;
  });
  $('menu-grid').replaceChildren(...nodes);
  $('candidate-count').textContent = menu.length - excluded.size;
}

function log(speaker, message) {
  const row = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = speaker;
  const content = document.createElement('span');
  content.textContent = message;
  row.append(time, content);
  $('log-list').append(row);
  while ($('log-list').children.length > 4) $('log-list').firstElementChild.remove();
}

function setReel(index, item) {
  const reel = $('reels').children[index];
  reel.querySelector('.reel-number').textContent = item.number;
  reel.querySelector('.reel-emoji').textContent = item.emoji;
  reel.querySelector('.reel-name').textContent = item.name;
}

function stopReels() {
  clearInterval(reelInterval);
  reelInterval = undefined;
  $('reels').classList.remove('spinning');
}

function spinReels() {
  stopReels();
  $('reels').classList.remove('winning');
  $('reels').classList.add('spinning');
  const candidates = menu.filter(item => !excluded.has(item.name));
  let frame = 0;
  reelInterval = setInterval(() => {
    for (let index = 0; index < 3; index++) setReel(index, candidates[(frame + index) % candidates.length]);
    frame++;
  }, motionPreference.matches ? 320 : 85);
}

function setControls(running) {
  $('start-button').disabled = running;
  $('edit-button').disabled = running;
  $('speed-button').disabled = running;
  $('skip-button').disabled = !running;
  renderMenu();
}

const images = { idle: 'command-room', alarm: 'command-room', farewell: 'farewell', sync: 'command-room', miss: 'pilot-reaction', revival: 'awakening', push: 'awakening', win: 'awakening' };
const codes = { idle: 'STANDBY / 待機中', alarm: 'ALERT / 緊急招集', farewell: 'SORTIE / 昼飯へ出撃', preview: 'NEXT / 次回予告', sync: 'SYNC / 運命回転中', heat: 'SUPER HOT / 激アツ', miss: 'FAILED / 絶望', revival: 'REVIVAL / 復活', push: 'PUSH / 最終決断', win: 'COMPLETE / 昼食確定' };

function scene(phase, kicker = '', title = '', subtitle = '') {
  $('stage').dataset.phase = phase;
  $('phase-code').textContent = codes[phase];
  for (const id of ['idle-caption', 'cinematic-caption', 'preview-card', 'heat-card', 'push-panel', 'result-panel']) $(id).hidden = true;
  $('stage-footer').hidden = ['preview', 'heat', 'push', 'win'].includes(phase);
  if (images[phase]) $('scene-image').style.backgroundImage = `url("assets/${images[phase]}.png")`;
  if (phase === 'idle') $('idle-caption').hidden = false;
  else if (phase === 'preview') $('preview-card').hidden = false;
  else if (phase === 'heat') $('heat-card').hidden = false;
  else if (phase === 'push') $('push-panel').hidden = false;
  else if (phase === 'win') $('result-panel').hidden = false;
  else {
    $('cinematic-caption').hidden = false;
    $('cinematic-kicker').textContent = kicker;
    $('cinematic-title').textContent = title;
    $('cinematic-subtitle').textContent = subtitle;
  }
  $('scene-tag').textContent = phase === 'farewell' ? 'DEPARTURE / 別れの時' : phase === 'miss' ? 'LUNCH LOST / 希望消失' : ['revival', 'push', 'win'].includes(phase) ? 'AWAKENING / 胃袋、覚醒' : 'CENTRAL DOGMA / 昼食司令室';
  if (title) announce(title);
}

function delay(duration, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, duration);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

function audioReady() {
  if (!sound) return false;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('No audio context');
    if (!audioContext) {
      audioContext = new Context();
      audioMaster = audioContext.createGain();
      audioMaster.connect(audioContext.destination);
    }
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
    return true;
  } catch {
    sound = false;
    renderSound();
    toast('このブラウザでは音響が使えません。静かに世界を救います。');
    return false;
  }
}

function tone(frequency, duration = .12, offset = 0, type = 'sine', volume = .05, endFrequency) {
  if (!audioReady()) return;
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  const masterTime = audioContext.currentTime + offset;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, masterTime);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, masterTime + duration);
  envelope.gain.setValueAtTime(0, masterTime);
  envelope.gain.linearRampToValueAtTime(volume, masterTime + .015);
  envelope.gain.exponentialRampToValueAtTime(.0001, masterTime + duration);
  oscillator.connect(envelope).connect(audioMaster);
  oscillator.start(masterTime);
  oscillator.stop(masterTime + duration + .02);
}

function sfx(kind) {
  if (kind === 'alarm') {
    for (let index = 0; index < 3; index++) { tone(440, .25, index * .5, 'triangle', .05, 780); tone(780, .25, index * .5 + .25, 'triangle', .05, 440); }
  } else if (kind === 'miss') { tone(340, .65, 0, 'sawtooth', .025, 80); }
  else if (kind === 'revive') { tone(90, .7, 0, 'sawtooth', .03, 700); tone(1046, .3, .5); }
  else if (kind === 'win') { [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => tone(frequency, .65, index * .14, 'triangle', .035)); }
  else if (kind === 'tick') tone(740, .055, 0, 'triangle', .03);
  else if (kind === 'heat') { tone(130, .3, 0, 'sawtooth', .04, 1046); tone(1046, .25, .3, 'triangle', .05); }
}

function renderSound() {
  $('sound-button').setAttribute('aria-pressed', String(sound));
  $('sound-button').querySelector('b').textContent = sound ? 'ON' : 'OFF';
  if (audioMaster) audioMaster.gain.setTargetAtTime(sound ? 1 : 0, audioContext.currentTime, .015);
}

function renderSpeed() {
  $('speed-button').setAttribute('aria-pressed', String(fast));
  $('speed-button').querySelector('b').textContent = fast ? '爆速' : '壮大';
}

function waitForPush(signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    let left = fast ? 3 : 6;
    const update = () => { $('push-countdown').textContent = `あと ${left} 秒で司令部が勝手に押します`; };
    const cleanup = () => { clearInterval(interval); $('push-button').removeEventListener('click', accept); signal.removeEventListener('abort', cancel); };
    const accept = () => { cleanup(); sfx('tick'); resolve(); };
    const cancel = () => { cleanup(); reject(signal.reason); };
    const interval = setInterval(() => { left--; if (left <= 0) accept(); else { update(); sfx('tick'); } }, 1000);
    update();
    $('push-button').addEventListener('click', accept);
    signal.addEventListener('abort', cancel, { once: true });
    if (lastStarter === $('start-button') && [document.body, $('start-button')].includes(document.activeElement)) $('push-button').focus({ preventScroll: true });
  });
}

function confetti() {
  cancelAnimationFrame(particleFrame);
  const canvas = $('particles');
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = $('stage').getBoundingClientRect();
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  context.scale(devicePixelRatio, devicePixelRatio);
  if (motionPreference.matches) { context.clearRect(0, 0, width, height); return; }
  const particles = Array.from({ length: 65 }, () => ({ x: width / 2, y: height * .35, vx: (Math.random() - .5) * 9, vy: -Math.random() * 6 - 2, color: ['#ff7646', '#efc86f', '#fff0c4', '#c2d595'][Math.floor(Math.random() * 4)], size: 2 + Math.random() * 4 }));
  const began = performance.now();
  let last = began;
  function paint(now) {
    const factor = Math.min((now - last) / 16.67, 2);
    last = now;
    context.clearRect(0, 0, width, height);
    context.globalAlpha = Math.max(0, 1 - (now - began) / 2400);
    for (const particle of particles) {
      particle.x += particle.vx * factor;
      particle.y += particle.vy * factor;
      particle.vy += .07 * factor;
      context.fillStyle = particle.color;
      context.fillRect(particle.x, particle.y, particle.size, particle.size / 2);
    }
    if (now - began < 2400) particleFrame = requestAnimationFrame(paint);
    else context.clearRect(0, 0, width, height);
  }
  particleFrame = requestAnimationFrame(paint);
}

function complete(run, skipped = false) {
  if (active !== run) return;
  run.controller.abort();
  stopReels();
  active = null;
  const item = run.result;
  for (let index = 0; index < 3; index++) setReel(index, item);
  $('reels').classList.add('winning');
  $('reel-status').textContent = 'LUNCH BONUS';
  $('reel-hint').textContent = '獲得：昼飯を決める権利';
  $('result-name').textContent = item.name;
  $('result-remark').textContent = item.remark;
  $('start-label').textContent = '運命をやり直す';
  $('start-footnote').textContent = '再抽選をすると、家族との別れからやり直します。';
  previous = item.name;
  $('last-result').textContent = `${previous} — 人類、無事帰還。`;
  save();
  scene('win');
  setControls(false);
  log('司令', `本日の昼飯、${item.name}。解散。`);
  if (skipped) log('経理', '演出予算を削減しました。結果は同じです。');
  announce(`昼飯確定。${item.name}。${item.remark}`);
  sfx('win');
  confetti();
  if (document.activeElement === $('push-button') || document.activeElement === $('skip-button') || document.activeElement === document.body) $('start-button').focus({ preventScroll: true });
}

async function start() {
  if (active) return;
  const candidates = menu.filter(item => !excluded.has(item.name));
  const run = { controller: new AbortController(), result: drawMenu(candidates), id: ++runNumber };
  active = run;
  lastStarter = document.activeElement;
  const signal = run.controller.signal;
  const duration = ms => Math.round(ms * (fast ? .26 : 1));
  const pause = ms => delay(duration(ms), signal);
  cancelAnimationFrame(particleFrame);
  $('particles').getContext('2d')?.clearRect(0, 0, $('particles').width, $('particles').height);
  $('reels').classList.remove('winning');
  $('reel-status').textContent = 'DESTINY REELS';
  $('reel-hint').textContent = '世界の命運が、いま回り始める。';
  $('start-label').textContent = '司令部、協議中';
  $('start-footnote').textContent = 'この会議、昼飯のためにやっています。';
  setControls(true);
  if (innerWidth < 851) $('stage').scrollIntoView({ behavior: motionPreference.matches ? 'instant' : 'smooth', block: 'start' });
  spinReels();
  audioReady();
  try {
    scene('alarm', 'EMERGENCY / 第一種空腹警報', '空腹警報、発令。', '総員、昼飯に備えよ。\nこれは訓練ではない。普通の昼休みだ。');
    log('警報', '胃袋の活動限界を検知。総員、昼飯に備えよ。');
    sfx('alarm');
    await pause(2500);

    scene('farewell', 'SORTIE / 最後かもしれない出撃', '「必ず、帰ってくる。」', '「……13時には。」\n彼は箸を握り、家族に別れを告げた。');
    log('家族', '昼飯に行くだけなのに、泣いています。');
    await pause(3600);

    $('preview-title').textContent = ['せめて、昼飯らしく', '見知らぬ、天丼', '最後の注文', '鳴らない、呼び出しベル'][run.id % 4];
    scene('preview');
    log('予告', '次回、昼飯が決まる。たぶん。');
    sfx('tick');
    await pause(2500);

    scene('sync', 'SYNCHRONIZATION / 胃袋接続', '炭水化物率、400%。', '「司令！ 食欲が制御できません！」\n「大盛りにしろ。」');
    await pause(2400);

    scene('heat');
    log('広報', '金文字です。昼飯しか当たりません。');
    sfx('heat');
    await pause(1600);

    stopReels();
    for (let index = 0; index < 3; index++) setReel(index, candidates[index % candidates.length]);
    scene('miss', 'HOPE LOST / まさかの事態', ['本日、定休日。', 'まさかの、売り切れ。', '待ち時間、90分。'][run.id % 3], '人類は、昼飯を失った。\n※ 演出です。お店の営業状況とは関係ありません。');
    log('現場', '絶望していますが、まだ何も調べていません。');
    sfx('miss');
    await pause(3100);

    scene('revival', 'REVIVAL / 胃袋、覚醒', 'まだだ。\nフードコートがある。', '「あなたは飢えないわ。\n近所にコンビニがあるもの。」');
    log('司令', '昼食補完計画、再始動。');
    sfx('revive');
    spinReels();
    await pause(3000);

    scene('push');
    log('司令', '押せ。食べろ。午後の会議に戻れ。');
    await waitForPush(signal);
    complete(run);
  } catch (error) {
    if (signal.aborted) return;
    // A visual or audio failure must not lose the lunch already selected.
    console.error('Lunch presentation failed:', error);
    complete(run, true);
    toast('司令部の演出が停止したので、昼飯だけ確定しました。');
  }
}

$('start-button').addEventListener('click', start);
$('skip-button').addEventListener('click', () => { if (active) complete(active, true); });
$('sound-button').addEventListener('click', () => { sound = !sound; renderSound(); if (sound) sfx('tick'); });
$('speed-button').addEventListener('click', () => { fast = !fast; renderSpeed(); toast(fast ? '司令部の長話を、約3分の1に短縮します。' : '昼飯に、約30秒の演出をかけます。'); });
$('about-button').addEventListener('click', () => $('about-dialog').showModal());
$('edit-button').addEventListener('click', () => {
  $('menu-input').value = menu.map(item => item.name).join('\n');
  $('menu-error').textContent = '';
  $('menu-dialog').showModal();
});
$('reset-menu-button').addEventListener('click', () => { $('menu-input').value = DEFAULT_MENU.map(item => item.name).join('\n'); $('menu-error').textContent = ''; });
$('menu-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const updated = parseMenu($('menu-input').value);
    menu = updated;
    excluded = new Set();
    save();
    renderMenu();
    if ($('stage').dataset.phase === 'idle') for (let index = 0; index < 3; index++) setReel(index, menu[index % menu.length]);
    $('menu-dialog').close();
    log('編成', `${menu.length}候補を再配備。全員、昼飯です。`);
    toast('出撃候補を更新しました。');
  } catch (error) { $('menu-error').textContent = error.message; }
});
document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));

renderMenu();
renderSpeed();
renderSound();
if (previous) $('last-result').textContent = `${previous} — 人類、無事帰還。`;
for (let index = 0; index < 3; index++) setReel(index, menu[index % menu.length]);
for (const name of new Set(Object.values(images))) {
  const image = new Image();
  image.src = `assets/${name}.png`;
}
