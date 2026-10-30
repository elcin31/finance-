import { expect, test, type Browser, type Page } from '@playwright/test';
import { restoreExercise } from '../../src/lib/practice-registry';
import { buildExamBank } from '../../src/lib/exam-bank';
import { lessons } from '../../src/content/curriculum';
import type { LearningEvent, ExamSession } from '../../src/lib/learning-types';
import { fillCorrectAnswer, numericAnswerLabel } from '../e2e/exercise-helpers';

const requireFixture = () =>
  test.skip(
    !process.env.FINLAB_TEST_EMAIL || !process.env.FINLAB_TEST_PASSWORD,
    'Requires a dedicated confirmed FINLAB test user; no Auth or progress API is mocked.',
  );
async function login(page: Page) {
  await page.goto('/profile');
  await page.getByLabel('Email', { exact: true }).fill(process.env.FINLAB_TEST_EMAIL!);
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.FINLAB_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выйти из аккаунта', exact: true })).toBeVisible({
    timeout: 30_000,
  });
}
async function anotherDevice(browser: Browser) {
  return browser.newContext({
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    proxy: process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' }
      : undefined,
  });
}
async function accountLearning(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) =>
      item.startsWith('finlab.learning.account.v2.'),
    );
    return key ? JSON.parse(localStorage.getItem(key)!) : { events: [], examResults: [] };
  }) as Promise<{
    events: LearningEvent[];
    examResults: { id: string; score: number; passed: boolean }[];
  }>;
}
async function answerCurrentPractice(page: Page) {
  const host = page.getByTestId('practice-session');
  await expect(host).toBeVisible();
  if (await page.locator('.feedback.correct').count())
    await page.getByRole('button', { name: /Следующая задача|Новый вариант/i }).click();
  const meta = await host.evaluate((element) => ({
    template: element.getAttribute('data-template-id')!,
    id: element.getAttribute('data-exercise-id')!,
    seed: Number(element.getAttribute('data-seed')),
    difficulty: Number(element.getAttribute('data-difficulty')) as 1 | 2 | 3,
  }));
  const entry = restoreExercise(meta.template, meta.id, meta.seed, meta.difficulty)!;
  expect(entry).toBeDefined();
  await fillCorrectAnswer(page, entry.exercise);
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.correct')).toBeVisible();
}

async function finishFoundationLessons(page: Page) {
  for (const lesson of lessons.filter((item) => item.moduleId === 'm1' && !item.exam)) {
    await page.goto(`/lesson/${lesson.id}`);
    await expect(page.locator('.lesson-content, .completion-card').first()).toBeVisible();
    if (await page.locator('.completion-card').count()) continue;
    const position = await page.evaluate((id) => {
      const key = Object.keys(localStorage).find((item) => item.startsWith('finlab.account.v1.'));
      return key ? (JSON.parse(localStorage.getItem(key)!).states[id]?.position ?? 0) : 0;
    }, lesson.id);
    for (const block of lesson.blocks.slice(position)) {
      if (block.type === 'exercise') {
        await fillCorrectAnswer(page, block.exercise);
        await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
        await expect(page.locator('.feedback.correct')).toBeVisible();
      }
      await page
        .getByRole('button', {
          name: block === lesson.blocks.at(-1) ? 'Завершить урок' : 'Продолжить',
          exact: true,
        })
        .click();
    }
    await expect(page.getByRole('heading', { name: 'Ещё один шаг вперёд.' })).toBeVisible();
  }
}

test('real adaptive result sync, offline queue/reconnect, second device and signout isolation', async ({
  page,
  context,
  browser,
}) => {
  requireFixture();
  test.setTimeout(180_000);
  const acknowledged = new Set<string>();
  page.on('response', async (response) => {
    if (!response.url().includes('/rpc/finlab_learning_sync') || !response.ok()) return;
    try {
      const data = await response.json();
      for (const event of data.events ?? []) acknowledged.add(event.id);
    } catch {
      /* A cancelled response is not treated as acknowledgement. */
    }
  });
  await login(page);
  await page.goto('/practice?skill=present-value&template=present-value');
  await answerCurrentPractice(page);
  let state = await accountLearning(page);
  const first = [...state.events]
    .reverse()
    .find((event) => event.mode === 'practice' && event.correct)!;
  expect(first).toBeDefined();
  await expect.poll(() => acknowledged.has(first.id), { timeout: 30_000 }).toBeTruthy();

  await page.getByRole('button', { name: /Следующая задача|Новый вариант/i }).click();
  await expect(page.getByTestId('practice-session')).toBeVisible();
  await context.setOffline(true);
  await answerCurrentPractice(page);
  state = await accountLearning(page);
  const queued = [...state.events]
    .reverse()
    .find((event) => event.mode === 'practice' && event.id !== first.id && event.correct)!;
  expect(queued).toBeDefined();
  expect(acknowledged.has(queued.id)).toBeFalsy();
  await context.setOffline(false);
  await expect.poll(() => acknowledged.has(queued.id), { timeout: 30_000 }).toBeTruthy();

  const device = await anotherDevice(browser);
  const second = await device.newPage();
  await login(second);
  await second.goto('/knowledge');
  await expect
    .poll(
      async () => (await accountLearning(second)).events.some((event) => event.id === queued.id),
      { timeout: 30_000 },
    )
    .toBeTruthy();
  const restored = await accountLearning(second);
  expect(restored.events.filter((event) => event.id === first.id)).toHaveLength(1);
  expect(restored.events.filter((event) => event.id === queued.id)).toHaveLength(1);
  await device.close();
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Выйти из аккаунта', exact: true }).click();
  await expect(page.getByText('Гость академии', { exact: true })).toBeVisible();
  await page.goto('/knowledge');
  const guestIds = await page.evaluate(() =>
    (
      JSON.parse(localStorage.getItem('finlab.learning.guest.v2') ?? '{"events":[]}').events as {
        id: string;
      }[]
    ).map((event) => event.id),
  );
  expect(guestIds).not.toContain(first.id);
  expect(guestIds).not.toContain(queued.id);
});

test('real protected exam withholds all answers until submit and restores the server result on another device', async ({
  page,
  browser,
}) => {
  requireFixture();
  test.setTimeout(180_000);
  await login(page);
  await finishFoundationLessons(page);
  await page.goto('/lesson/m1-exam');
  const started = page.waitForResponse(
    (response) => response.url().includes('/rpc/finlab_exam_start') && response.ok(),
  );
  await page.getByRole('button', { name: /Начать экзамен|Новая попытка/i }).click();
  const publicSession: ExamSession = await (await started).json();
  expect(publicSession.result).toBeUndefined();
  expect(publicSession.questions.length).toBeGreaterThanOrEqual(8);
  for (const question of publicSession.questions) {
    for (const forbidden of ['correct', 'expected', 'correctOrder', 'explanation', 'hint']) {
      expect(
        Object.hasOwn(question.exercise, forbidden),
        `${question.id} exposes ${forbidden}`,
      ).toBeFalsy();
    }
  }
  // Private grading fixtures are loaded by Node, never requested by the browser before submission.
  const variant = buildExamBank().find(
    (item) =>
      item.moduleId === publicSession.moduleId &&
      item.bankVersion === publicSession.bankVersion &&
      item.variant === publicSession.variant,
  )!;
  expect(variant).toBeDefined();
  for (let index = 0; index < publicSession.questions.length; index++) {
    const question = publicSession.questions[index];
    const fixture = variant.questions.find((item) => item.id === question.id)!;
    await expect(page.locator(`[data-question-id="${question.id}"]`)).toBeVisible();
    await fillCorrectAnswer(page, fixture.exercise);
    await expect(page.locator('.feedback')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Проверить ответ', exact: true })).toHaveCount(0);
    if (index < publicSession.questions.length - 1)
      await page.getByRole('button', { name: /Следующий вопрос|Далее/i }).click();
  }
  const submitted = page.waitForResponse(
    (response) => response.url().includes('/rpc/finlab_exam_submit') && response.ok(),
  );
  await page.getByRole('button', { name: /Завершить экзамен|Отправить ответы/i }).click();
  const canonical: ExamSession = await (await submitted).json();
  expect(canonical.result?.score).toBe(100);
  expect(canonical.result?.passed).toBeTruthy();
  await expect(page.getByText('100%', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/80%/, { exact: false }).first()).toBeVisible();
  const device = await anotherDevice(browser);
  const second = await device.newPage();
  await login(second);
  await second.goto('/knowledge');
  await expect
    .poll(
      async () =>
        (await accountLearning(second)).examResults.some(
          (result) => result.id === canonical.result!.id && result.score === 100 && result.passed,
        ),
      { timeout: 30_000 },
    )
    .toBeTruthy();
  await device.close();
});

test('an unfinished exam restores its real server draft and position on another device', async ({
  page,
  browser,
}) => {
  requireFixture();
  test.setTimeout(180_000);
  await login(page);
  await finishFoundationLessons(page);
  await page.goto('/lesson/m1-exam');
  const started = page.waitForResponse(
    (response) => response.url().includes('/rpc/finlab_exam_start') && response.ok(),
  );
  await page.getByRole('button', { name: /Начать экзамен|Повторить экзамен/i }).click();
  const session: ExamSession = await (await started).json();
  const fixture = buildExamBank().find(
    (item) =>
      item.moduleId === session.moduleId &&
      item.variant === session.variant &&
      item.bankVersion === session.bankVersion,
  )!;
  const saved = page.waitForResponse(
    async (response) =>
      response.url().includes('/rpc/finlab_exam_draft') &&
      response.ok() &&
      (await response.json()).position === 1,
  );
  await fillCorrectAnswer(page, fixture.questions[0].exercise, { comma: true });
  const entered = await page.getByLabel(numericAnswerLabel).inputValue();
  await page.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();
  await saved;
  const device = await anotherDevice(browser);
  const second = await device.newPage();
  await login(second);
  await second.goto('/lesson/m1-exam');
  await expect(second.getByTestId('exam-session')).toHaveAttribute('data-exam-id', session.id);
  await expect(second.locator(`[data-question-id="${session.questions[1].id}"]`)).toBeVisible();
  await expect(second.locator('.feedback')).toHaveCount(0);
  await second.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(second.getByLabel(numericAnswerLabel)).toHaveValue(entered);
  for (let index = 0; index < fixture.questions.length; index++) {
    await fillCorrectAnswer(second, fixture.questions[index].exercise, { comma: true });
    if (index < fixture.questions.length - 1)
      await second.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();
  }
  await second.getByRole('button', { name: 'Завершить экзамен', exact: true }).click();
  await expect(
    second.getByRole('heading', { name: 'Экзамен пройден!', exact: true }),
  ).toBeVisible();
  await device.close();
});
