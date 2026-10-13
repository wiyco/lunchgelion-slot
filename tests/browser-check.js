async page => {
  const checks = [];
  const errors = [];
  const failedRequests = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failedRequests.push(request.url()));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  check(await page.locator('.menu-option').count() === 8, 'Eight initial lunch candidates');
  check(await page.locator('#sound-button').getAttribute('aria-pressed') === 'false', 'Sound starts off');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Desktop has no horizontal overflow');

  await page.locator('#about-button').click();
  check(await page.locator('#about-dialog').isVisible(), 'Mission briefing opens');
  await page.keyboard.press('Escape');
  await page.locator('#sound-button').click();
  check(await page.locator('#sound-button').getAttribute('aria-pressed') === 'true', 'Sound can be enabled');
  await page.locator('#sound-button').click();

  await page.locator('#start-button').focus();
  await page.keyboard.press('Enter');
  check(await page.locator('#edit-button').isDisabled(), 'Menu editing locks during a draw');
  check(await page.locator('#start-button').isDisabled(), 'Repeated draw is blocked');
  const phases = [];
  for (const phase of ['alarm', 'farewell', 'preview', 'sync', 'heat', 'miss', 'revival', 'push']) {
    await page.waitForFunction(value => document.getElementById('stage').dataset.phase === value, phase, { timeout: 8000 });
    phases.push(phase);
    if (['farewell', 'heat', 'push'].includes(phase)) await page.locator('.machine').screenshot({ path: `artifacts/${phase}.png` });
  }
  check(phases.length === 8, 'Normal sequence reaches every cinematic phase');
  check(await page.locator('#push-button').evaluate(element => document.activeElement === element), 'Keyboard focus moves to PUSH');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('stage').dataset.phase === 'win');
  await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('result-panel')).opacity) === 1);
  const first = await page.locator('#result-name').textContent();
  const reelNames = await page.locator('.reel-name').allTextContents();
  check(reelNames.every(name => name === first), 'All three reels match the final lunch');
  check(await page.locator('#start-button').isEnabled(), 'Controls unlock after PUSH');
  await page.screenshot({ path: 'artifacts/result.png', fullPage: true });

  await page.locator('#speed-button').click();
  await page.locator('#start-button').click();
  await page.waitForFunction(() => document.getElementById('stage').dataset.phase === 'win', null, { timeout: 18000 });
  check(await page.locator('#result-panel').isVisible(), 'Fast sequence auto-confirms without touching PUSH');

  await page.locator('#start-button').click();
  await page.locator('#skip-button').click();
  const skipped = await page.locator('#result-name').textContent();
  await page.locator('#start-button').click();
  await page.locator('#skip-button').click();
  const rerolled = await page.locator('#result-name').textContent();
  await page.waitForTimeout(6500);
  check(await page.locator('#result-name').textContent() === rerolled, 'Cancelled timelines cannot overwrite a later draw');
  check(await page.locator('#stage').getAttribute('data-phase') === 'win', 'Skip leaves the game in its final state');

  await page.locator('#edit-button').click();
  await page.locator('#menu-input').fill(' \n ');
  await page.locator('#menu-form button[type=submit]').click();
  check((await page.locator('#menu-error').textContent()).includes('少なくとも1つ'), 'Empty custom menu is rejected');
  await page.locator('#menu-input').fill('テストそば\n <b>寿司</b> \nテストそば');
  await page.locator('#menu-form button[type=submit]').click();
  check(await page.locator('.menu-option').count() === 2, 'Custom menu is trimmed and deduplicated');
  check(await page.locator('.menu-name b').count() === 0, 'Custom names render as text, never markup');
  await page.locator('.menu-option').nth(1).click();
  await page.locator('.menu-option').nth(0).click();
  check(await page.locator('#candidate-count').textContent() === '1', 'The last candidate cannot be excluded');
  await page.locator('#start-button').click();
  await page.locator('#skip-button').click();
  check(await page.locator('#result-name').textContent() === 'テストそば', 'Only the remaining candidate can win');
  await page.reload();
  check(await page.locator('#candidate-count').textContent() === '1', 'Custom menu and exclusions persist on reload');
  check((await page.locator('#last-result').textContent()).includes('テストそば'), 'Last lunch persists on reload');

  await page.locator('#edit-button').click();
  await page.locator('#reset-menu-button').click();
  await page.locator('#menu-form button[type=submit]').click();
  check(await page.locator('.menu-option').count() === 8, 'Default candidates can be restored');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '375px mobile has no horizontal overflow');
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  await page.locator('#start-button').click();
  await page.locator('#skip-button').click();
  check(await page.locator('#result-panel').isVisible(), 'Mobile can start and complete a draw');
  await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('result-panel')).opacity) === 1);
  await page.screenshot({ path: 'artifacts/mobile-result.png', fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  check(await page.locator('#speed-button').getAttribute('aria-pressed') === 'true', 'Reduced-motion preference defaults to fast mode');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.reload();
  check(errors.length === 0, `No browser JavaScript errors: ${errors.join(', ')}`);
  check(failedRequests.length === 0, `No failed asset requests: ${failedRequests.join(', ')}`);
  return { passed: checks.length, checks, firstLunch: first, skippedLunch: skipped, errors, failedRequests };
}
