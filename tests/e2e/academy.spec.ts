import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { lessons } from '../../src/content/curriculum';
import type { Exercise } from '../../src/lib/types';

const firstLesson = lessons.find((lesson) => lesson.id === 'm1-money')!;

async function answerCorrectly(page: Page, exercise: Exercise) {
  if (exercise.kind === 'numeric') {
    await page
      .getByLabel(/Рубли|Проценты|Базисные пункты|Число без единиц/)
      .fill(String(exercise.expected));
  } else if (exercise.kind === 'matching') {
    for (const pair of exercise.pairs)
      await page.getByLabel(pair.left, { exact: true }).selectOption(pair.id);
  } else if (exercise.kind === 'boolean') {
    await page
      .getByRole('button', { name: exercise.correct ? 'Верно' : 'Неверно', exact: true })
      .click();
  } else {
    const selected = page.locator('.exercise-option[aria-pressed="true"]');
    while (await selected.count()) await selected.first().click();
    for (const id of exercise.correct) {
      const option = exercise.options.find((item) => item.id === id)!;
      await page.locator('.exercise-option').filter({ hasText: option.label }).click();
    }
  }
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.correct')).toBeVisible();
}

async function answerWrongly(page: Page, exercise: Exercise) {
  if (exercise.kind === 'numeric') {
    await page
      .getByLabel(/Рубли|Проценты|Базисные пункты|Число без единиц/)
      .fill(String(exercise.expected + Math.max(1, Math.abs(exercise.expected) * 0.1)));
  } else if (exercise.kind === 'boolean') {
    await page
      .getByRole('button', { name: exercise.correct ? 'Неверно' : 'Верно', exact: true })
      .click();
  } else if (exercise.kind === 'matching') {
    for (let index = 0; index < exercise.pairs.length; index++) {
      await page
        .getByLabel(exercise.pairs[index].left, { exact: true })
        .selectOption(exercise.pairs[(index + 1) % exercise.pairs.length].id);
    }
  } else {
    const wrong =
      exercise.options.find((option) => !exercise.correct.includes(option.id)) ??
      exercise.options.find((option) => exercise.correct.includes(option.id))!;
    await page.locator('.exercise-option').filter({ hasText: wrong.label }).click();
  }
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.incorrect')).toContainText(exercise.hint);
  await expect(page.getByRole('button', { name: 'Продолжить', exact: true })).toBeDisabled();
}

test('all 18 lessons and 3 exams complete through real practice, including failed exam and retake', async ({
  page,
}) => {
  test.setTimeout(300_000);
  for (const lesson of lessons) {
    await page.goto(`/lesson/${lesson.id}`);
    const passes = lesson.id === 'm1-exam' ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      let exerciseIndex = 0;
      for (const block of lesson.blocks) {
        if (block.type === 'exercise') {
          await expect(
            page.getByRole('heading', { name: block.exercise.prompt, exact: true }),
          ).toBeVisible();
          if (lesson.id === 'm1-exam' && pass === 0 && exerciseIndex < 3)
            await answerWrongly(page, block.exercise);
          await answerCorrectly(page, block.exercise);
          exerciseIndex++;
        } else {
          await expect(page.getByRole('heading', { name: block.title, exact: true })).toBeVisible();
        }
        await page
          .getByRole('button', {
            name: block === lesson.blocks.at(-1) ? 'Завершить урок' : 'Продолжить',
            exact: true,
          })
          .click();
      }
      if (lesson.id === 'm1-exam' && pass === 0) {
        await expect(page.getByRole('heading', { name: 'Знания стоит закрепить' })).toBeVisible();
        expect(
          Number((await page.locator('.completion-score').innerText()).replace('%', '')),
        ).toBeLessThan(70);
        await expect(page.getByRole('link', { name: /Следующий урок/ })).toHaveCount(0);
        await page.getByRole('button', { name: 'Повторить экзамен', exact: true }).click();
      } else {
        await expect(
          page.getByRole('heading', {
            name: lesson.exam ? 'Экзамен пройден!' : 'Ещё один шаг вперёд.',
          }),
        ).toBeVisible();
        await expect(page.locator('.completion-score')).toHaveText('100%');
      }
    }
  }
  const snapshot = await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('finlab.guest.v1')!);
    return {
      completions: progress.completions.length,
      attempts: progress.attempts.length,
      uniqueCompleted: [
        ...new Set(
          progress.completions
            .filter((c: { score: number }) => c.score >= 70)
            .map((c: { lessonId: string }) => c.lessonId),
        ),
      ].length,
    };
  });
  expect(snapshot.completions).toBe(22);
  expect(snapshot.uniqueCompleted).toBe(21);
  expect(snapshot.attempts).toBeGreaterThanOrEqual(112);
  await page.goto('/path');
  await expect(page.getByText('Пройдено 21 из 21 этапов', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Пройдено 21 из 21 этапов', { exact: true })).toBeVisible();
});

test('guest onboarding → mandatory practice → completion → reload → continue', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Хороший день, чтобы расти.' })).toBeVisible();
  await page.getByRole('link', { name: /Настроить обучение/ }).click();
  await page.getByRole('button', { name: 'Освоить финансовую грамотность', exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('button', { name: 'С нуля', exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('button', { name: /15 минут в день/ }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const questions = page.locator('.diagnostic-card');
  await questions.nth(0).getByRole('button').nth(0).click();
  await questions.nth(1).getByRole('button').nth(1).click();
  await questions.nth(2).getByRole('button').nth(1).click();
  await page.getByRole('button', { name: /Настроить мой путь/ }).click();
  await expect(page.getByRole('heading', { name: 'Начнём с подходящего шага.' })).toBeVisible();
  await page.getByRole('link', { name: /К рекомендованному уроку/ }).click();
  await expect(page).toHaveURL(/\/lesson\/m1-money/);

  let checkedDraft = false;
  for (const block of firstLesson.blocks) {
    if (block.type === 'exercise') {
      await expect(
        page.getByRole('heading', { name: block.exercise.prompt, exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Продолжить', exact: true })).toBeDisabled();
      if (!checkedDraft && block.exercise.kind === 'numeric') {
        const input = page.getByLabel(/Рубли/);
        await input.fill('NaN');
        await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
        await expect(page.locator('.feedback')).toContainText('конечное число');
        expect(
          await page.evaluate(
            () =>
              JSON.parse(localStorage.getItem('finlab.guest.v1')!).attempts.filter(
                (a: { exerciseId: string }) => a.exerciseId === 'm1-money-practice',
              ).length,
          ),
        ).toBe(0);
        await input.fill('1234');
        await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
        await expect(page.locator('.feedback.incorrect')).toContainText(block.exercise.hint);
        await expect(page.getByRole('button', { name: 'Продолжить', exact: true })).toBeDisabled();
        await input.fill(String(block.exercise.expected));
        await page.goto('/library');
        await expect(page.getByRole('heading', { name: 'Библиотека финансов' })).toBeVisible();
        await page.goto('/lesson/m1-money');
        await expect(page.getByLabel(/Рубли/)).toHaveValue(String(block.exercise.expected));
        await page.reload();
        await expect(page.getByLabel(/Рубли/)).toHaveValue(String(block.exercise.expected));
        checkedDraft = true;
      }
      await answerCorrectly(page, block.exercise);
    } else {
      await expect(page.getByRole('heading', { name: block.title, exact: true })).toBeVisible();
    }
    await page
      .getByRole('button', {
        name: block === firstLesson.blocks.at(-1) ? 'Завершить урок' : 'Продолжить',
        exact: true,
      })
      .click();
  }
  await expect(page.getByRole('heading', { name: 'Ещё один шаг вперёд.' })).toBeVisible();
  await expect(page.locator('.completion-score')).toHaveText('80%');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ещё один шаг вперёд.' })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('finlab.guest.v1')!).completions.length,
    ),
  ).toBe(1);
  await page.getByRole('link', { name: /Следующий урок/ }).click();
  await expect(page).toHaveURL(/\/lesson\/m1-assets/);
  await expect(page.getByRole('heading', { name: 'Финансовый снимок на одну дату' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('locked lesson cannot bypass prerequisites; public module entries remain available', async ({
  page,
}) => {
  await page.goto('/lesson/m1-exam');
  await expect(page.getByRole('heading', { name: 'Сначала — предыдущая практика' })).toBeVisible();
  await page.goto('/lesson/m2-percent');
  await expect(page.locator('.lesson-content h1')).toBeVisible();
  await page.goto('/lesson/m3-securities');
  await expect(page.locator('.lesson-content h1')).toBeVisible();
});

test('keyboard can check a numeric exercise and advance after success', async ({ page }) => {
  await page.goto('/lesson/m1-money');
  await expect(page.getByRole('heading', { name: 'Деньги — инструмент обмена' })).toBeVisible();
  for (let index = 0; index < 3; index++) {
    const next = page.getByRole('button', { name: 'Продолжить', exact: true });
    await next.focus();
    await page.keyboard.press('Enter');
  }
  const input = page.getByLabel(/Рубли/);
  await input.focus();
  await page.keyboard.type('10800');
  await page.keyboard.press('Enter');
  await expect(page.locator('.feedback.correct')).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Какие из перечисленных пунктов/ })).toBeVisible();
});

test('financial lab calculates compound, PV/FV and portfolio with invalid-input feedback', async ({
  page,
}) => {
  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: 'Финансовая лаборатория' })).toBeVisible();
  await page.getByLabel('Начальная сумма', { exact: true }).fill('100000');
  await page.getByLabel('Ежемесячный взнос', { exact: true }).fill('1000');
  await page.getByLabel('Годовая ставка', { exact: true }).fill('0');
  await page.getByLabel('Срок инвестирования', { exact: true }).fill('1');
  await expect(page.getByText('Будущая стоимость', { exact: true }).locator('..')).toContainText(
    /112\s*000/,
  );
  await page.getByLabel('Годовая ставка', { exact: true }).fill('Infinity');
  await expect(page.locator('main').getByRole('alert')).toContainText('конечное число');
  await page.getByRole('button', { name: 'Стоимость денег', exact: true }).click();
  await expect(page.getByText('Стоимость сегодня', { exact: true }).locator('..')).toContainText(
    /100\s*000/,
  );
  await page.getByRole('button', { name: 'Будущая стоимость · FV', exact: true }).click();
  await page.getByLabel('Сумма сегодня', { exact: true }).fill('100000');
  await expect(page.getByText('Стоимость в будущем', { exact: true }).locator('..')).toContainText(
    /121\s*000/,
  );
  await page.getByRole('button', { name: 'Доходность портфеля', exact: true }).click();
  await expect(
    page.getByText('Взвешенная доходность', { exact: true }).locator('..'),
  ).toContainText(/8\s*%/);
  await page.getByLabel('Вес актива 1, %', { exact: true }).fill('50');
  await expect(page.locator('main').getByRole('alert')).toContainText('100%');
  await page.getByRole('button', { name: /Привести веса к 100%/ }).click();
  await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
  await page.getByLabel('Вес актива 1, %', { exact: true }).fill('60');
  await page.getByLabel('Вес актива 2, %', { exact: true }).fill('40');
  await page.getByLabel('Доходность актива 2, %', { exact: true }).fill('-5');
  await expect(
    page.getByText('Взвешенная доходность', { exact: true }).locator('..'),
  ).toContainText(/4\s*%/);
  await page.getByRole('button', { name: 'Добавить актив', exact: true }).click();
  await expect(page.getByLabel('Название актива 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Удалить Учебный актив 3/ }).click();
  await expect(page.getByLabel('Название актива 3', { exact: true })).toHaveCount(0);
});

test('library searches Russian/English terms and formulas; theme survives reload', async ({
  page,
}) => {
  await page.goto('/library');
  const search = page.getByLabel('Поиск в библиотеке');
  await search.fill('Asset');
  await expect(page.locator('.term-card h2').filter({ hasText: /^Asset$/ })).toBeVisible();
  await search.fill('обязательство');
  await expect(page.locator('.term-card h2').filter({ hasText: /^Liability$/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Справочник формул' }).click();
  await search.fill('NPV');
  await expect(page.locator('.term-card')).not.toHaveCount(0);
  await search.fill('no-such-term-67890');
  await expect(
    page.getByRole('heading', { name: 'По вашему запросу ничего не найдено' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить поиск' }).click();
  await expect(page.locator('.term-card')).not.toHaveCount(0);
  await page.goto('/profile');
  const before = await page.locator('html').getAttribute('data-theme');
  await page
    .getByRole('button', { name: before === 'dark' ? 'Светлая' : 'Тёмная', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    before === 'dark' ? 'light' : 'dark',
  );
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    before === 'dark' ? 'light' : 'dark',
  );
});

for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  test(`responsive: no horizontal overflow at ${width}px across core screens`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      '/',
      '/path',
      '/lab',
      '/library',
      '/profile',
      '/onboarding',
      '/lesson/m1-money',
    ]) {
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        content: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll('main *')]
          .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
          .slice(0, 6)
          .map((el) => `${el.tagName}.${el.className}`),
      }));
      expect(layout.content, `${path}: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(
        layout.viewport + 1,
      );
      if (path === '/lab') {
        for (const tool of ['Стоимость денег', 'Доходность портфеля']) {
          await page.getByRole('button', { name: tool, exact: true }).click();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
            `${tool} at ${width}px`,
          ).toBeLessThanOrEqual(width + 1);
        }
      }
    }
  });
}

test('PWA manifest and visited public lesson work after losing connectivity', async ({
  page,
  context,
}) => {
  await page.goto('/lesson/m1-money');
  await expect(page.getByRole('heading', { name: 'Деньги — инструмент обмена' })).toBeVisible();
  const manifest = await page.evaluate(async () => {
    const response = await fetch('/manifest.webmanifest');
    return { status: response.status, body: await response.json() };
  });
  expect(manifest.status).toBe(200);
  expect(manifest.body.display).toBe('standalone');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await caches.keys();
        for (const key of keys.filter((k) => k.startsWith('finlab-public-'))) {
          if (await (await caches.open(key)).match('/lesson/m1-money')) return true;
        }
        return false;
      }),
    )
    .toBeTruthy();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Деньги — инструмент обмена' })).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Один период роста' })).toBeVisible();
  await context.setOffline(false);
});

test('capture desktop, mobile and dark visual review artifacts', async ({ page }) => {
  await mkdir('screenshots', { recursive: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Хороший день, чтобы расти.' })).toBeVisible();
  await page.screenshot({ path: 'screenshots/home-1440-light.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'screenshots/home-390-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Переключить тему', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'screenshots/home-390-dark.png', fullPage: true });
});
