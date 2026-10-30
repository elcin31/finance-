import { expect, type Page } from '@playwright/test';
import type { Exercise } from '../../src/lib/types';

export const numericAnswerLabel = /Рубли|Доллары|Проценты|Базисные пункты|Число без единиц/;

/** Browser interactions only. Test fixtures stay in the Node test process. */
export async function fillCorrectAnswer(
  page: Page,
  exercise: Exercise,
  options: { comma?: boolean; keyboardOrdering?: boolean } = {},
) {
  if (exercise.kind === 'numeric') {
    const value = String(exercise.expected);
    await page.getByLabel(numericAnswerLabel).fill(options.comma ? value.replace('.', ',') : value);
  } else if (exercise.kind === 'matching') {
    for (const pair of exercise.pairs) {
      await page.getByLabel(pair.left, { exact: true }).selectOption(pair.id);
    }
  } else if (exercise.kind === 'boolean') {
    await page
      .getByRole('button', { name: exercise.correct ? 'Верно' : 'Неверно', exact: true })
      .click();
  } else if (exercise.kind === 'ordering') {
    const list = page.getByTestId('ordering-list');
    for (let target = 0; target < exercise.correctOrder.length; target++) {
      for (let count = 0; count < exercise.correctOrder.length; count++) {
        const ids = await list
          .locator('[data-item-id]')
          .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-item-id')));
        if (ids[target] === exercise.correctOrder[target]) break;
        const row = list.locator(`[data-item-id="${exercise.correctOrder[target]}"]`);
        const up = row.getByRole('button', { name: /выше/i });
        if (options.keyboardOrdering) {
          await up.focus();
          await page.keyboard.press('Enter');
        } else {
          await up.click();
        }
      }
    }
    await expect(list.locator('[data-item-id]')).toHaveCount(exercise.correctOrder.length);
    expect(
      await list
        .locator('[data-item-id]')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-item-id'))),
    ).toEqual(exercise.correctOrder);
  } else if (exercise.kind === 'calculation') {
    const values: Record<string, number> = {};
    for (const parameter of exercise.parameters) {
      const input = page.getByLabel(parameter.label, { exact: true });
      await input.fill(String(parameter.value));
      values[parameter.id] = parameter.value;
    }
    // Independent arithmetic for browser input; formula unit tests cover the domain engine.
    const expected =
      exercise.model === 'future-value'
        ? values.initial * (1 + values.rate / 100) ** values.years
        : exercise.model === 'present-value'
          ? values.amount / (1 + values.rate / 100) ** values.years
          : exercise.model === 'real-return'
            ? ((1 + values.nominal / 100) / (1 + values.inflation / 100) - 1) * 100
            : (values.weightA / 100) * values.returnA + (1 - values.weightA / 100) * values.returnB;
    const value = expected.toFixed(2);
    await page
      .getByLabel('Результат расчёта', { exact: true })
      .fill(options.comma ? value.replace('.', ',') : value);
  } else {
    const selected = page.locator('.exercise-option[aria-pressed="true"]');
    while (await selected.count()) await selected.first().click();
    for (const id of exercise.correct) {
      const option = exercise.options.find((item) => item.id === id)!;
      await page.locator('.exercise-option').filter({ hasText: option.label }).click();
    }
  }
}

export async function fillWrongAnswer(page: Page, exercise: Exercise) {
  if (exercise.kind === 'numeric') {
    await page
      .getByLabel(numericAnswerLabel)
      .fill(String(exercise.expected + Math.max(1, Math.abs(exercise.expected) * 0.1)));
  } else if (exercise.kind === 'matching') {
    for (let index = 0; index < exercise.pairs.length; index++) {
      await page
        .getByLabel(exercise.pairs[index].left, { exact: true })
        .selectOption(exercise.pairs[(index + 1) % exercise.pairs.length].id);
    }
  } else if (exercise.kind === 'boolean') {
    await page
      .getByRole('button', { name: exercise.correct ? 'Неверно' : 'Верно', exact: true })
      .click();
  } else if (exercise.kind === 'ordering') {
    await fillCorrectAnswer(page, exercise);
    await page
      .getByTestId('ordering-list')
      .locator('[data-item-id]')
      .nth(1)
      .getByRole('button', { name: /выше/i })
      .click();
  } else if (exercise.kind === 'calculation') {
    await fillCorrectAnswer(page, exercise);
    const input = page.getByLabel('Результат расчёта', { exact: true });
    await input.fill(String(Number(await input.inputValue()) + 1000));
  } else {
    const selected = page.locator('.exercise-option[aria-pressed="true"]');
    while (await selected.count()) await selected.first().click();
    const wrong =
      exercise.options.find((option) => !exercise.correct.includes(option.id)) ??
      exercise.options.find((option) => exercise.correct.includes(option.id))!;
    await page.locator('.exercise-option').filter({ hasText: wrong.label }).click();
  }
}
