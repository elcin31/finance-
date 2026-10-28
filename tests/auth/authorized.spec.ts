import { test, expect } from '@playwright/test';
test('real password login, guest import once, second device restore, signout isolation', async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.FINLAB_TEST_EMAIL || !process.env.FINLAB_TEST_PASSWORD,
    'Requires a dedicated confirmed Supabase test user. No email delivery is simulated.',
  );
  await page.goto('/');
  await page.getByRole('heading', { name: 'Хороший день, чтобы расти.' }).waitFor();
  await page.getByLabel('Ответ на задание дня, %').fill('10');
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(
    page.getByText('(11 000 − 10 000) / 10 000 × 100 = 10%.', { exact: false }),
  ).toBeVisible();
  const importedId = await page.evaluate(
    () => JSON.parse(localStorage.getItem('finlab.guest.v1')!).attempts[0].id as string,
  );
  await page.goto('/profile');
  await expect(page.getByText('Гость академии', { exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(process.env.FINLAB_TEST_EMAIL!);
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.FINLAB_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выйти из аккаунта', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText('Прогресс синхронизирован', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  const canonical = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) => key.startsWith('finlab.account.v1.'))!;
    return JSON.parse(localStorage.getItem(key)!).attempts as { id: string }[];
  });
  expect(canonical.some((a) => a.id === importedId)).toBe(true);
  const count = canonical.length;
  await expect(page.locator('.stat-box').nth(1).locator('strong')).toHaveText(String(count));
  await page.reload();
  await expect(page.getByText('Прогресс синхронизирован', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator('.stat-box').nth(1).locator('strong')).toHaveText(String(count));
  const device = await browser.newContext({
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  });
  const second = await device.newPage();
  await second.goto('/profile');
  await second.getByLabel('Email', { exact: true }).fill(process.env.FINLAB_TEST_EMAIL!);
  await second.getByLabel('Пароль', { exact: true }).fill(process.env.FINLAB_TEST_PASSWORD!);
  await second.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(second.getByText('Прогресс синхронизирован', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(second.locator('.stat-box').nth(1).locator('strong')).toHaveText(String(count));
  await device.close();
  await page.getByRole('button', { name: 'Выйти из аккаунта', exact: true }).click();
  await expect(page.getByText('Гость академии', { exact: true })).toBeVisible();
  await expect(page.locator('.stat-box').nth(1).locator('strong')).toHaveText('0');
});
