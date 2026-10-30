import { expect, type Page } from '@playwright/test';
import { buildExamBank } from '../../src/lib/exam-bank';
import type { ExamResult, ExamSession } from '../../src/lib/learning-types';
import { fillCorrectAnswer, fillWrongAnswer } from './exercise-helpers';

const privateFixtures = buildExamBank();

export function assertNoPublicGradingKeys(session: ExamSession) {
  expect(session.result).toBeUndefined();
  for (const question of session.questions) {
    for (const key of ['correct', 'expected', 'correctOrder', 'explanation', 'hint']) {
      expect(
        Object.hasOwn(question.exercise, key),
        `${question.id} exposes ${key} before submission`,
      ).toBeFalsy();
    }
  }
}

/** Requests hit the real FINLAB RPC. Private answer fixtures exist only in Node. */
export async function runServerExam(
  page: Page,
  moduleId: string,
  options: { wrongCount?: number; verifyReload?: boolean } = {},
): Promise<ExamResult> {
  const startResponse = page.waitForResponse(
    (response) => response.url().includes('/rpc/finlab_exam_start') && response.ok(),
  );
  await page
    .getByRole('button', { name: /Начать экзамен|Новая попытка|Повторить экзамен|Другой вариант/i })
    .click();
  const session: ExamSession = await (await startResponse).json();
  expect(session.moduleId).toBe(moduleId);
  expect(session.questions).toHaveLength(8);
  assertNoPublicGradingKeys(session);
  const fixture = privateFixtures.find(
    (item) =>
      item.moduleId === session.moduleId &&
      item.bankVersion === session.bankVersion &&
      item.variant === session.variant,
  );
  expect(fixture).toBeDefined();
  for (let index = 0; index < session.questions.length; index++) {
    const question = session.questions[index];
    const expected = fixture!.questions.find((item) => item.id === question.id)!;
    await expect(page.locator(`[data-question-id="${question.id}"]`)).toBeVisible();
    if (index < (options.wrongCount ?? 0)) await fillWrongAnswer(page, expected.exercise);
    else await fillCorrectAnswer(page, expected.exercise, { comma: true });
    await expect(page.locator('.feedback')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Проверить ответ', exact: true })).toHaveCount(0);
    if (index < session.questions.length - 1) {
      await page.getByRole('button', { name: /Следующий вопрос|Далее/i }).click();
      if (options.verifyReload && index === 0) {
        const nextId = session.questions[1].id;
        await expect(page.locator(`[data-question-id="${nextId}"]`)).toBeVisible();
        await page.reload();
        await expect(page.locator(`[data-question-id="${nextId}"]`)).toBeVisible();
        await expect(page.getByTestId('exam-session')).toHaveAttribute('data-exam-id', session.id);
        await expect(page.locator('.feedback')).toHaveCount(0);
      }
    }
  }
  const submitted = page.waitForResponse(
    (response) => response.url().includes('/rpc/finlab_exam_submit') && response.ok(),
  );
  await page.getByRole('button', { name: /Завершить экзамен|Отправить ответы/i }).click();
  const canonical: ExamSession = await (await submitted).json();
  expect(canonical.id).toBe(session.id);
  const result = canonical.result!;
  expect(result).toBeDefined();
  expect(result.answers).toHaveLength(8);
  expect(result.score).toBe(((8 - (options.wrongCount ?? 0)) / 8) * 100);
  expect(result.passed).toBe(result.score >= 80);
  return result;
}
