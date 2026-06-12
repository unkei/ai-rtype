const { test, expect } = require('@playwright/test');

// Helper: read game state from the browser
const getState = (page) => page.evaluate(() => window.__game?.state);
const getScore = (page) => page.evaluate(() => window.__game?.score);

test.describe('Title screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for game to boot (canvas + script load)
    await page.waitForFunction(() => window.__game !== undefined, { timeout: 5000 });
  });

  test('starts in title state', async ({ page }) => {
    const state = await getState(page);
    expect(state).toBe('title');
  });

  test('Space key advances from title to playing', async ({ page }) => {
    await expect.poll(() => getState(page)).toBe('title');

    // Log any console errors to help debug
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('[browser]', msg.text());
    });

    await page.keyboard.press('Space');
    await expect.poll(() => getState(page), { timeout: 2000 }).toBe('playing');
  });

  test('Z key advances from title to playing', async ({ page }) => {
    await expect.poll(() => getState(page)).toBe('title');
    await page.keyboard.press('z');
    await expect.poll(() => getState(page), { timeout: 2000 }).toBe('playing');
  });

  test('Enter key advances from title to playing', async ({ page }) => {
    await expect.poll(() => getState(page)).toBe('title');
    await page.keyboard.press('Enter');
    await expect.poll(() => getState(page), { timeout: 2000 }).toBe('playing');
  });
});

test.describe('Game over', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__game !== undefined, { timeout: 5000 });
    // Force game-over state directly
    await page.evaluate(() => { window.__game.state = 'gameover'; });
  });

  test('Space key returns to title from game over', async ({ page }) => {
    await expect.poll(() => getState(page)).toBe('gameover');
    await page.keyboard.press('Space');
    await expect.poll(() => getState(page), { timeout: 2000 }).toBe('title');
  });
});

test.describe('Playing state', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__game !== undefined, { timeout: 5000 });
    await page.keyboard.press('Space');
    await expect.poll(() => getState(page), { timeout: 2000 }).toBe('playing');
  });

  test('player exists after game start', async ({ page }) => {
    const playerAlive = await page.evaluate(() => window.__game.player.alive);
    expect(playerAlive).toBe(true);
  });

  test('score starts at 0', async ({ page }) => {
    expect(await getScore(page)).toBe(0);
  });

  test('Escape key pauses the game', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect.poll(() => getState(page), { timeout: 1000 }).toBe('paused');
  });

  test('Escape key resumes from pause', async ({ page }) => {
    await page.keyboard.press('Escape');
    await expect.poll(() => getState(page), { timeout: 1000 }).toBe('paused');
    await page.keyboard.press('Escape');
    await expect.poll(() => getState(page), { timeout: 1000 }).toBe('playing');
  });
});
