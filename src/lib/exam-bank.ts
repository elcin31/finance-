/** Build-time/private seed tooling. Never import this module into client components. */
import { getExercises, getLesson } from '../content/curriculum';
import { generateProblem } from './problem-generator';
import type { CompetencyId, ExamQuestion, PublicExamQuestion } from './learning-types';
import type { Answer, Exercise, OrderingExercise } from './types';

export const EXAM_BANK_VERSION = 3;
export const EXAM_VARIANTS = 16;
export type ExamBankVariant = {
  moduleId: 'm1' | 'm2' | 'm3';
  bankVersion: number;
  variant: number;
  questions: ExamQuestion[];
  publicQuestions: PublicExamQuestion[];
};

function shuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let state = seed >>> 0;
  for (let index = result.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const other = state % (index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
function qualitative(
  lessonId: string,
  exerciseId: string,
  competencyIds: CompetencyId[],
  difficulty: 1 | 2 | 3 = 1,
): ExamQuestion {
  const lesson = getLesson(lessonId);
  const exercise = lesson && getExercises(lesson).find((item) => item.id === exerciseId);
  if (!exercise || exercise.kind === 'matching' || exercise.kind === 'calculation')
    throw new Error(`Missing exam source ${exerciseId}`);
  return { id: exercise.id, exercise: { ...exercise }, competencyIds, difficulty };
}
function ordering(
  prompt: string,
  steps: string[],
  explanation: string,
  competencyIds: CompetencyId[],
  seed: number,
): ExamQuestion {
  const identifiers = shuffle(['u7', 'r2', 'c9', 'v4'], seed);
  const exercise: OrderingExercise = {
    id: 'ordering',
    kind: 'ordering',
    prompt,
    skills: ['mathematics'],
    items: shuffle(
      steps.map((label, index) => ({ id: identifiers[index], label })),
      seed + 71,
    ),
    correctOrder: steps.map((_, index) => identifiers[index]),
    hint: 'Сначала определите исходные данные и базу сравнения, затем выполняйте расчёт.',
    explanation,
  };
  return { id: exercise.id, exercise, competencyIds, difficulty: 2 };
}
function generated(template: string, seed: number, difficulty: 1 | 2 | 3): ExamQuestion {
  const entry = generateProblem(template, seed, difficulty);
  return {
    id: entry.exercise.id,
    exercise: entry.exercise,
    competencyIds: entry.competencyIds,
    difficulty: entry.difficulty,
  };
}
function customBoolean(
  prompt: string,
  correct: boolean,
  explanation: string,
  competencyIds: CompetencyId[],
): ExamQuestion {
  return {
    id: 'boolean',
    competencyIds,
    difficulty: 2,
    exercise: {
      id: 'boolean',
      kind: 'boolean',
      prompt,
      correct,
      explanation,
      hint: 'Согласуйте экономический смысл и дату денежного потока.',
      skills: ['literacy'],
    },
  };
}
function moduleQuestions(moduleId: 'm1' | 'm2' | 'm3', variant: number): ExamQuestion[] {
  const seed = 92020 + variant * 7919 + Number(moduleId.slice(1)) * 100003;
  const level = ((variant % 3) + 1) as 1 | 2 | 3;
  if (moduleId === 'm1') {
    const income = 60000 + variant * 5000,
      expense = 36000 + variant * 2000;
    return [
      generated('simple-compound', seed, level),
      generated('real-return', seed + 101, 2),
      {
        id: 'budget',
        competencyIds: ['financial-literacy'],
        difficulty: 1,
        exercise: {
          id: 'budget',
          kind: 'numeric',
          prompt: `Учебный месячный бюджет: денежный доход ${income} ₽, все расходы ${expense} ₽. Какова норма сбережений в процентах дохода?`,
          expected: ((income - expense) / income) * 100,
          unit: 'percent',
          absoluteTolerance: 0.005,
          skills: ['literacy', 'mathematics'],
          hint: 'Вычтите расходы из дохода и разделите остаток на доход.',
          explanation: `1. Сбережения = ${income} − ${expense} = ${income - expense} ₽. 2. Норма сбережений = (${income - expense} / ${income}) × 100% = ${(((income - expense) / income) * 100).toFixed(2)}%. База — весь денежный доход.`,
        },
      },
      qualitative('m1-assets', 'm1-assets-classify', ['financial-literacy']),
      qualitative('m1-exam', 'm1-exam-loan', ['financial-literacy']),
      customBoolean(
        'Если номинальная доходность равна инфляции за тот же период, реальная доходность до расходов равна нулю.',
        true,
        'По точной формуле Фишера (1+r)/(1+π)−1 при r=π отношение равно 1, поэтому реальный прирост равен 0. Периоды и база расчёта должны совпадать.',
        ['inflation', 'returns'],
      ),
      ordering(
        'Расположите шаги составления личного финансового баланса.',
        [
          'Выбрать единую дату оценки',
          'Оценить принадлежащие активы на эту дату',
          'Посчитать остаток обязательств на эту дату',
          'Вычесть обязательства из активов',
        ],
        '1. Баланс — снимок на одну дату. 2. На ней оценивают активы. 3. На той же дате фиксируют долги. 4. Чистый капитал равен активам минус обязательства. Оценки разных дат смешивать нельзя.',
        ['financial-literacy'],
        seed,
      ),
      {
        id: 'inflation-decision',
        competencyIds: ['inflation', 'returns'],
        difficulty: 2,
        exercise: {
          id: 'inflation-decision',
          kind: 'scenario',
          prompt:
            'Вклад за год дал 6% до расходов, цены за тот же год выросли на 9%. Как изменится покупательная способность капитала при отсутствии взносов?',
          options: [
            { id: 'k8', label: 'Снизится' },
            { id: 'k3', label: 'Увеличится на 6%' },
            { id: 'k6', label: 'Останется прежней' },
          ],
          correct: ['k8'],
          skills: ['literacy'],
          hint: 'Сравните факторы роста денег и цен.',
          explanation:
            '1. Фактор роста вклада 1,06. 2. Фактор роста цен 1,09. 3. Реальная доходность = 1,06/1,09−1 ≈ −2,75%. Денег стало больше, но на них можно купить меньше.',
        },
      },
    ];
  }
  if (moduleId === 'm2')
    return [
      generated('present-value', seed, level),
      generated('future-value', seed + 101, level),
      generated('discount-two-flows', seed + 203, 2),
      generated('npv', seed + 307, 2),
      generated('irr', seed + 401, 3),
      {
        id: 'npv-decision',
        competencyIds: ['npv', 'discounting'],
        difficulty: 2,
        exercise: {
          id: 'npv-decision',
          kind: 'scenario',
          prompt:
            'У независимого учебного проекта NPV при корректной требуемой доходности равна +12 000 ₽. Какой вывод соответствует критерию NPV при прочих равных?',
          options: [
            { id: 'h8', label: 'Проект создаёт стоимость сверх требуемой доходности' },
            { id: 'h2', label: 'Проект гарантирует отсутствие любых рисков' },
            { id: 'h5', label: 'IRR обязана равняться ровно нулю' },
          ],
          correct: ['h8'],
          skills: ['mathematics'],
          hint: 'NPV сравнивает дисконтированные поступления с вложением.',
          explanation:
            '1. NPV учитывает начальный отток и приведённые будущие потоки. 2. Положительная NPV означает превышение поступлений над вложением в текущей стоимости. 3. Это критерий создания стоимости при заданных предположениях, а не гарантия результата.',
        },
      },
      customBoolean(
        'У любого набора денежных потоков обязательно существует ровно одна IRR.',
        false,
        '1. IRR — ставка, при которой NPV=0. 2. При отсутствии смены знака решения может не быть. 3. При нескольких сменах знака возможны несколько решений. Поэтому перед интерпретацией IRR анализируют структуру потоков.',
        ['irr', 'npv'],
      ),
      ordering(
        'Расположите шаги корректного расчёта NPV.',
        [
          'Разместить все денежные потоки по датам, включая вложение в момент 0',
          'Выбрать ставку за тот же период и согласовать предположения',
          'Дисконтировать каждый будущий поток к моменту 0',
          'Сложить приведённые потоки с начальным отрицательным вложением',
        ],
        '1. Начните с временной шкалы. 2. Согласуйте период ставки и потоков. 3. Каждый поток CFₜ приводится как CFₜ/(1+r)ᵗ. 4. Добавьте поток t=0 без дисконтирования: получится NPV.',
        ['discounting', 'npv'],
        seed,
      ),
    ];
  return [
    generated('total-return', seed, level),
    generated('net-return', seed + 101, 2),
    generated('portfolio-return', seed + 203, 2),
    generated('coupon-yield', seed + 307, 2),
    {
      id: 'shareholder-rights',
      competencyIds: ['stocks'],
      difficulty: 2,
      exercise: {
        id: 'shareholder-rights',
        kind: 'scenario',
        prompt:
          'Вы приобрели обыкновенную акцию учебной компании. Компания не объявила дивиденд, а рыночная цена снизилась. Какое утверждение верно?',
        options: [
          {
            id: 's7',
            label:
              'Акция остаётся долей собственности; фиксированные выплаты и возврат вложенной суммы не гарантированы',
          },
          {
            id: 's2',
            label: 'Компания обязана вернуть цену покупки акции в заранее установленную дату',
          },
          { id: 's9', label: 'Отсутствие дивиденда автоматически превращает акцию в облигацию' },
        ],
        correct: ['s7'],
        skills: ['investments'],
        hint: 'Различайте долевое участие и договорные обязательства должника.',
        explanation:
          '1. Обыкновенная акция — доля собственности в капитале. 2. Дивиденд зависит от решения уполномоченного органа, прибыли и правил выплаты. 3. В отличие от облигации, у обычной акции нет договорного фиксированного купона и срока возврата номинала. Рыночная цена может снизиться, вплоть до полной потери вложения.',
      },
    },
    qualitative('m3-exam', 'm3-exam-concentration', ['diversification', 'risk-return'], 2),
    qualitative('m3-exam', 'm3-exam-guarantee', ['diversification', 'risk-return'], 2),
    ordering(
      'Расположите шаги расчёта чистой полной доходности за один период.',
      [
        'Зафиксировать первоначально вложенный капитал',
        'Определить изменение стоимости и денежные выплаты за период',
        'Вычесть ещё не учтённые комиссии и налоги',
        'Разделить чистый денежный результат на первоначальный капитал',
      ],
      '1. База — первоначальный капитал. 2. Полный результат включает изменение цены и выплаты. 3. Расходы вычитают один раз. 4. Чистый результат делят на базу и переводят в проценты; периоды и состав расходов должны совпадать.',
      ['returns', 'dividends'],
      seed,
    ),
  ];
}
export function sanitizeExamQuestion(question: ExamQuestion): PublicExamQuestion {
  const exercise = question.exercise;
  if (exercise.kind === 'matching' || exercise.kind === 'calculation')
    throw new Error('Exam bank supports only independently graded fixed questions.');
  const publicExercise = Object.fromEntries(
    Object.entries(exercise).filter(
      ([key]) => !['correct', 'expected', 'correctOrder', 'explanation', 'hint'].includes(key),
    ),
  );
  return {
    id: question.id,
    competencyIds: [...question.competencyIds],
    difficulty: question.difficulty,
    exercise: publicExercise as unknown as PublicExamQuestion['exercise'],
  };
}
export function buildExamBank(): ExamBankVariant[] {
  return (['m1', 'm2', 'm3'] as const).flatMap((moduleId) =>
    Array.from({ length: EXAM_VARIANTS }, (_, variant) => {
      const questions = moduleQuestions(moduleId, variant).map((question, index) => {
        const id = `${moduleId}-b${EXAM_BANK_VERSION}-v${variant}-q${index + 1}`;
        const exercise = { ...question.exercise, id };
        if (exercise.kind === 'choice' || exercise.kind === 'scenario')
          exercise.options = shuffle(exercise.options, variant * 101 + index * 17 + 3);
        return { ...question, id, exercise };
      });
      return {
        moduleId,
        bankVersion: EXAM_BANK_VERSION,
        variant,
        questions,
        publicQuestions: questions.map(sanitizeExamQuestion),
      };
    }),
  );
}
export function examExpectedAnswer(exercise: Exercise): Answer {
  switch (exercise.kind) {
    case 'numeric':
      return String(exercise.expected);
    case 'boolean':
      return String(exercise.correct);
    case 'choice':
    case 'scenario':
      return [...exercise.correct];
    case 'ordering':
      return [...exercise.correctOrder];
    default:
      throw new Error('Unsupported server exam question kind');
  }
}
export function examBankInsertSQL(bank = buildExamBank()): string {
  const literal = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  return (
    bank
      .map(
        (item) =>
          `insert into finlab.exam_bank(module_id,bank_version,variant,public_questions,private_questions) values ('${item.moduleId}',${item.bankVersion},${item.variant},${literal(item.publicQuestions)},${literal(item.questions)}) on conflict(module_id,bank_version,variant) do nothing;`,
      )
      .join('\n') + '\n'
  );
}
