import { expect, test, type Page } from '@playwright/test';
import { englishPractice, englishTracks } from '../../src/content/english-practice';
import { financePractice } from '../../src/content/finance-practice';
import { restoreExercise } from '../../src/lib/practice-registry';
import type { ExerciseEntry } from '../../src/lib/learning-types';
import { fillCorrectAnswer, fillWrongAnswer } from './exercise-helpers';

async function currentExercise(page: Page): Promise<ExerciseEntry> {
  const host = page.getByTestId('practice-session');
  await expect(host).toBeVisible();
  const meta = await host.evaluate((element) => ({
    id: element.getAttribute('data-exercise-id')!,
    template: element.getAttribute('data-template-id')!,
    seed: Number(element.getAttribute('data-seed')),
    difficulty: Number(element.getAttribute('data-difficulty')) as 1 | 2 | 3,
  }));
  const entry = restoreExercise(meta.template, meta.id, meta.seed, meta.difficulty);
  expect(entry, `Known exercise fixture ${JSON.stringify(meta)}`).toBeDefined();
  return entry!;
}

async function checkedEvents(page: Page) {
  return page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('finlab.learning.guest.v2') ?? '{"events":[]}');
    return data.events as {
      id: string;
      mode: string;
      templateId: string;
      variantId: string;
      competencyIds: string[];
      valid: boolean;
      correct: boolean;
      at: string;
    }[];
  });
}

test('practice mistake, corrected attempt, new seeded variant and real review survive reload', async ({
  page,
}) => {
  await page.goto('/practice?skill=present-value&template=present-value');
  const original = await currentExercise(page);
  expect(original.exercise.templateId).toBe('present-value');
  await fillWrongAnswer(page, original.exercise);
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.incorrect')).toBeVisible();
  expect((await checkedEvents(page)).filter((event) => event.valid && !event.correct)).toHaveLength(
    1,
  );

  await fillCorrectAnswer(page, original.exercise, { comma: true });
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.correct')).toBeVisible();
  const beforeVariant = original.exercise.variantId;
  await page.getByRole('button', { name: /Следующая задача|Новый вариант/i }).click();
  const fresh = await currentExercise(page);
  expect(fresh.exercise.templateId).toBe('present-value');
  expect(fresh.exercise.variantId).not.toBe(beforeVariant);
  expect(fresh.exercise.seed).not.toBe(original.exercise.seed);
  await fillCorrectAnswer(page, fresh.exercise, { comma: true });
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.correct')).toBeVisible();
  const savedIds = (await checkedEvents(page)).map((event) => event.id);
  await page.reload();
  expect((await checkedEvents(page)).map((event) => event.id)).toEqual(savedIds);

  await page.goto('/knowledge');
  const skill = page.locator('[data-competency-id="present-value"]');
  await expect(skill).toBeVisible();
  await expect(skill).not.toContainText('Пока нет результатов');
  await page.goto('/review');
  const repeat = page.locator('a[href="/review?skill=present-value"]');
  await expect(repeat).toBeVisible();
  await repeat.click();
  const review = await currentExercise(page);
  expect(review.competencyIds).toContain('present-value');
  await fillCorrectAnswer(page, review.exercise);
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.correct')).toBeVisible();
  expect(
    (await checkedEvents(page)).some(
      (event) => event.mode === 'review' && event.valid && event.correct,
    ),
  ).toBeTruthy();
});

test('ordering works with keyboard and parameterized calculation accepts decimal comma', async ({
  page,
}) => {
  const ordering = financePractice.find((entry) => entry.exercise.id === 'fin02-budget-process')!;
  expect(ordering.exercise.kind).toBe('ordering');
  await page.goto('/practice?skill=financial-literacy&exercise=fin02-budget-process');
  await expect(
    page.getByRole('heading', { name: ordering.exercise.prompt, exact: true }),
  ).toBeVisible();
  await fillCorrectAnswer(page, ordering.exercise, { keyboardOrdering: true });
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.feedback.correct')).toBeVisible();

  const calculation = financePractice.find((entry) => entry.exercise.id === 'fin02-real-slider')!;
  expect(calculation.exercise.kind).toBe('calculation');
  await page.goto('/practice?skill=inflation&exercise=fin02-real-slider');
  await expect(
    page.getByRole('heading', { name: calculation.exercise.prompt, exact: true }),
  ).toBeVisible();
  await fillCorrectAnswer(page, calculation.exercise, { comma: true });
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.correct')).toContainText('Расчёт');
  expect((await checkedEvents(page)).filter((event) => event.valid && event.correct)).toHaveLength(
    2,
  );
});

test('a directly selected financial skill adapts difficulty from independent variants and reacts to an error', async ({
  page,
}) => {
  await page.goto('/practice?skill=present-value&template=present-value');
  for (let index = 0; index < 6; index++) {
    const entry = await currentExercise(page);
    expect(entry.difficulty).toBe(index < 3 ? 1 : 2);
    await fillCorrectAnswer(page, entry.exercise, { comma: true });
    await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
    await expect(page.locator('.feedback.correct')).toBeVisible();
    await page.getByRole('button', { name: 'Следующая задача', exact: true }).click();
  }
  const advanced = await currentExercise(page);
  expect(advanced.difficulty).toBe(3);
  await fillWrongAnswer(page, advanced.exercise);
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.incorrect')).toBeVisible();
  await page.getByRole('button', { name: 'Попробовать новое условие', exact: true }).click();
  expect((await currentExercise(page)).difficulty).toBe(1);
  const events = await checkedEvents(page);
  expect(new Set(events.map((event) => event.variantId)).size).toBe(7);
});

test('Financial English exposes four real ten-question categories and saves a contextual calculation', async ({
  page,
}) => {
  expect(englishPractice.length).toBeGreaterThanOrEqual(40);
  await page.goto('/english');
  const observed = new Set<string>();
  for (const track of englishTracks) {
    expect(
      englishPractice.filter((entry) => entry.category === track.id).length,
    ).toBeGreaterThanOrEqual(10);
    const tab = page.getByRole('tab', { name: track.title, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const links = page
      .getByRole('tabpanel', { name: track.title, exact: true })
      .locator('a[href*="exercise=en02-"]');
    await expect(links).toHaveCount(10);
    for (const href of await links.evaluateAll((items) =>
      items.map((item) => (item as HTMLAnchorElement).href),
    ))
      observed.add(href);
  }
  expect(observed.size).toBeGreaterThanOrEqual(40);
  const entry = englishPractice.find((item) => item.exercise.id === 'en02-c-weighted-average')!;
  await page
    .getByRole('tab', {
      name: englishTracks.find((track) => track.id === 'calculations')!.title,
      exact: true,
    })
    .click();
  const calculations = englishTracks.find((track) => track.id === 'calculations')!;
  await expect(page.getByRole('tab', { name: calculations.title, exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page
    .getByRole('tabpanel', { name: calculations.title, exact: true })
    .locator('a[href*="en02-c-weighted-average"]')
    .click();
  await expect(
    page.getByRole('heading', { name: entry.exercise.prompt, exact: true }),
  ).toBeVisible();
  await fillCorrectAnswer(page, entry.exercise, { comma: true });
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.correct')).toBeVisible();
  const events = await checkedEvents(page);
  expect(
    events.some(
      (event) =>
        event.mode === 'english' &&
        event.correct &&
        event.competencyIds.includes('english-calculations'),
    ),
  ).toBeTruthy();
  await page.reload();
  expect((await checkedEvents(page)).map((event) => event.id)).toEqual(
    events.map((event) => event.id),
  );
});

test('concept laboratory shows mathematically changing models with accessible tables', async ({
  page,
}) => {
  await page.goto('/lab/concepts');
  await expect(
    page.getByRole('heading', { name: 'Два способа начисления процентов' }),
  ).toBeVisible();
  await page.getByLabel('Начальный капитал', { exact: true }).fill('100000');
  await page.getByLabel('Процентная ставка', { exact: true }).fill('10');
  await page.getByLabel('Горизонт сравнения', { exact: true }).fill('2');
  await expect(page.getByText('С капитализацией', { exact: true }).locator('..')).toContainText(
    /121\s*000/,
  );
  await expect(page.getByText('Разница моделей', { exact: true }).locator('..')).toContainText(
    /1\s*000/,
  );
  await page.getByRole('button', { name: 'Дисконтирование', exact: true }).click();
  await expect(
    page.getByText('Его текущая стоимость', { exact: true }).locator('..'),
  ).toContainText(/100\s*000/);
  await page.getByLabel('Ставка дисконтирования', { exact: true }).fill('0');
  await expect(
    page.getByText('Его текущая стоимость', { exact: true }).locator('..'),
  ).toContainText(/121\s*000/);
  await page.getByRole('button', { name: 'Инфляция', exact: true }).click();
  await page.getByLabel('Предполагаемая инфляция', { exact: true }).fill('0');
  await expect(
    page.getByText('Покупательная способность', { exact: true }).locator('..'),
  ).toContainText(/100\s*000/);
  await page.getByRole('button', { name: 'Риск и доходность', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Средняя доходность не описывает весь путь' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Диверсификация', exact: true }).click();
  await page.getByLabel('Доля актива A', { exact: true }).fill('50');
  await page.getByLabel('Корреляция ρ', { exact: true }).fill('1');
  await expect(
    page.getByText('Риск выбранного состава', { exact: true }).locator('..'),
  ).toContainText(/15\s*%/);
  await page.getByLabel('Корреляция ρ', { exact: true }).fill('-1');
  await expect(
    page.getByText('Риск выбранного состава', { exact: true }).locator('..'),
  ).toContainText(/5\s*%/);
  await page.getByText('Открыть таблицу учебного расчёта', { exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
});

test('competency tree explains prerequisites and retains the existing curriculum tab', async ({
  page,
}) => {
  await page.goto('/path');
  const skill = page.locator('[data-competency-id="present-value"]');
  await expect(skill).toBeVisible();
  await expect(skill).toContainText(/Текущая стоимость|Present value/);
  await expect(skill).toContainText(/Не изучен|Не начат|Начать|Учиться/);
  await skill.click();
  await expect(page.getByText(/Проценты и ставки/, { exact: false }).first()).toBeVisible();
  await page.getByRole('tab', { name: /Уроки|Программа/ }).click();
  await expect(page.getByText('Пройдено 0 из 21 этапов', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Основы финансов', exact: true })).toBeVisible();
});

test('mobile learning handles a mistake, new calculation, review, restored mastery and theme', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lesson/m1-money');
  const lesson = (await import('../../src/content/curriculum')).lessons.find(
    (item) => item.id === 'm1-money',
  )!;
  let mistaken = false;
  for (const block of lesson.blocks) {
    if (block.type === 'exercise') {
      if (!mistaken && block.exercise.kind === 'numeric') {
        await fillWrongAnswer(page, block.exercise);
        await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
        await expect(page.locator('.feedback.incorrect')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Продолжить', exact: true })).toBeDisabled();
        mistaken = true;
      }
      await fillCorrectAnswer(page, block.exercise, { comma: true });
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
  expect(mistaken).toBe(true);
  await expect(page.getByRole('heading', { name: 'Ещё один шаг вперёд.' })).toBeVisible();
  await page.goto('/practice?skill=present-value&template=present-value');
  const first = await currentExercise(page);
  await fillWrongAnswer(page, first.exercise);
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.incorrect')).toBeVisible();
  await page.getByRole('button', { name: 'Попробовать новое условие', exact: true }).click();
  const fresh = await currentExercise(page);
  expect(fresh.exercise.variantId).not.toBe(first.exercise.variantId);
  await fillCorrectAnswer(page, fresh.exercise, { comma: true });
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.correct')).toBeVisible();
  await page.goto('/review?skill=present-value');
  const review = await currentExercise(page);
  await fillCorrectAnswer(page, review.exercise, { comma: true });
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.locator('.feedback.correct')).toBeVisible();
  const ids = (await checkedEvents(page)).map((event) => event.id);
  await page.goto('/knowledge');
  const skill = page.locator('[data-competency-id="present-value"]');
  await expect(skill).toContainText(/Практика:/);
  const before = await skill.textContent();
  await page.reload();
  await expect(skill).toHaveText(before!);
  expect((await checkedEvents(page)).map((event) => event.id)).toEqual(ids);
  await page.getByRole('button', { name: 'Переключить тему', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});

for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  test(`adaptive screens fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      '/practice?skill=present-value',
      '/review',
      '/english',
      '/knowledge',
      '/path',
      '/lab/concepts',
    ]) {
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        width: document.documentElement.scrollWidth,
      }));
      expect(layout.width, `${path} at ${width}px`).toBeLessThanOrEqual(layout.viewport + 1);
    }
  });
}
