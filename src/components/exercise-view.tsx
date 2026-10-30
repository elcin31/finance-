'use client';
import { ArrowDown, ArrowUp, Check, CircleHelp } from 'lucide-react';
import type { PublicExamQuestion } from '@/lib/learning-types';
import type { Answer, Exercise } from '@/lib/types';
export function ExerciseView({
  exercise,
  answer,
  onChange,
  onCheck,
  solved,
  feedback,
}: {
  exercise: Exercise | PublicExamQuestion['exercise'];
  answer: Answer;
  onChange: (a: Answer) => void;
  onCheck?: () => void;
  solved: boolean;
  feedback?: { correct: boolean; message: string };
}) {
  const selected = Array.isArray(answer)
    ? answer
    : typeof answer === 'string' && answer
      ? [answer]
      : [];
  const units = {
    number: 'Число без единиц',
    percent: 'Проценты · 7,5 означает 7,5%',
    currency: 'Рубли · допускается знак ₽',
    bps: 'Базисные пункты · например 25 bp',
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!solved && onCheck) onCheck();
      }}
    >
      <h1>{exercise.prompt}</h1>
      {exercise.instruction && <p className="exercise-instruction">{exercise.instruction}</p>}
      {(exercise.kind === 'choice' || exercise.kind === 'scenario') && (
        <>
          <p className="muted" style={{ fontSize: 11 }}>
            {exercise.multiple ? 'Выберите все подходящие варианты.' : 'Выберите один вариант.'}
          </p>
          <div className="exercise-options" role="group" aria-label="Варианты ответа">
            {(exercise.options ?? []).map((o, index) => (
              <button
                className={`exercise-option ${selected.includes(o.id) ? 'selected' : ''}`}
                type="button"
                key={o.id}
                aria-pressed={selected.includes(o.id)}
                disabled={solved}
                onClick={() =>
                  onChange(
                    exercise.multiple
                      ? selected.includes(o.id)
                        ? selected.filter((id) => id !== o.id)
                        : [...selected, o.id]
                      : [o.id],
                  )
                }
              >
                <span className="option-marker">
                  {selected.includes(o.id) ? <Check size={12} /> : String.fromCharCode(65 + index)}
                </span>
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {exercise.kind === 'boolean' && (
        <div className="exercise-options" role="group" aria-label="Верно или неверно">
          {[
            { id: 'true', label: 'Верно' },
            { id: 'false', label: 'Неверно' },
          ].map((o) => (
            <button
              type="button"
              className={`exercise-option ${answer === o.id ? 'selected' : ''}`}
              key={o.id}
              aria-pressed={answer === o.id}
              disabled={solved}
              onClick={() => onChange(o.id)}
            >
              <span className="option-marker">{answer === o.id ? <Check size={12} /> : null}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {exercise.kind === 'numeric' && (
        <div className="numeric-answer field">
          <label htmlFor={`answer-${exercise.id}`}>
            {exercise.unit === 'currency' && exercise.currency === 'USD'
              ? 'Доллары США · допускается знак $'
              : units[exercise.unit ?? 'number']}
          </label>
          <input
            id={`answer-${exercise.id}`}
            className="input"
            inputMode="decimal"
            autoComplete="off"
            value={typeof answer === 'string' ? answer : ''}
            disabled={solved}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              exercise.unit === 'percent'
                ? 'Ваш ответ, %'
                : exercise.unit === 'currency'
                  ? exercise.currency === 'USD'
                    ? 'Ваш ответ, $'
                    : 'Ваш ответ, ₽'
                  : exercise.unit === 'bps'
                    ? 'Ваш ответ, bp'
                    : 'Ваш ответ'
            }
          />
          <small>
            Запятая и точка равнозначны. Округляйте до двух знаков, если не указано иначе.
          </small>
        </div>
      )}
      {exercise.kind === 'matching' && (
        <>
          <p className="muted" style={{ fontSize: 11 }}>
            Каждому термину соответствует одно определение.
          </p>
          <div className="matching-rows">
            {(exercise.pairs ?? []).map((pair) => {
              const answers = typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
              const pairs = exercise.pairs ?? [];
              const options = [...pairs.slice(1), ...pairs.slice(0, 1)];
              return (
                <div className="matching-row" key={pair.id}>
                  <label htmlFor={`match-${exercise.id}-${pair.id}`}>{pair.left}</label>
                  <select
                    id={`match-${exercise.id}-${pair.id}`}
                    className="select"
                    value={answers[pair.id] ?? ''}
                    disabled={solved}
                    onChange={(e) => onChange({ ...answers, [pair.id]: e.target.value })}
                  >
                    <option value="">Выберите соответствие</option>
                    {options.map((o) => (
                      <option value={o.id} key={o.id}>
                        {o.right}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </>
      )}
      {exercise.kind === 'ordering' &&
        (() => {
          const items = exercise.items ?? [];
          const order =
            Array.isArray(answer) && answer.length === items.length
              ? answer
              : [...items.slice(1), ...items.slice(0, 1)].map((item) => item.id);
          const move = (index: number, direction: number) => {
            const next = [...order];
            [next[index], next[index + direction]] = [next[index + direction], next[index]];
            onChange(next);
          };
          return (
            <div className="ordering-list" data-testid="ordering-list">
              <p className="muted">
                Расположите шаги сверху вниз. Используйте кнопки или клавиатуру.
              </p>
              <ol>
                {order.map((id, index) => (
                  <li key={id} data-item-id={id}>
                    <span className="order-number">{index + 1}</span>
                    <span>{items.find((item) => item.id === id)?.label}</span>
                    <div className="order-actions">
                      <button
                        type="button"
                        className="icon-button"
                        disabled={solved || index === 0}
                        aria-label={`Переместить выше: ${items.find((item) => item.id === id)?.label}`}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        disabled={solved || index === order.length - 1}
                        aria-label={`Переместить ниже: ${items.find((item) => item.id === id)?.label}`}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          );
        })()}
      {exercise.kind === 'calculation' &&
        (() => {
          const parameters = exercise.parameters ?? [];
          const values: Record<string, string> = Object.fromEntries(
            parameters.map((p) => [p.id, String(p.value)]),
          );
          Object.assign(values, typeof answer === 'object' && !Array.isArray(answer) ? answer : {});
          return (
            <div className="calculation-task">
              <div className="calculation-parameters">
                {parameters.map((parameter) => (
                  <div className="field calculation-parameter" key={parameter.id}>
                    <label htmlFor={`param-${exercise.id}-${parameter.id}`}>
                      {parameter.label} · {parameter.unit}
                    </label>
                    <input
                      className="input"
                      id={`param-${exercise.id}-${parameter.id}`}
                      aria-label={parameter.label}
                      inputMode="decimal"
                      autoComplete="off"
                      disabled={solved}
                      value={values[parameter.id]}
                      onChange={(event) =>
                        onChange({ ...values, [parameter.id]: event.target.value, result: '' })
                      }
                    />
                    <input
                      type="range"
                      min={parameter.min}
                      max={parameter.max}
                      step={parameter.step}
                      disabled={solved}
                      aria-label={`Изменить: ${parameter.label}`}
                      value={
                        Number.isFinite(Number(values[parameter.id].replace(',', '.')))
                          ? Math.min(
                              parameter.max,
                              Math.max(
                                parameter.min,
                                Number(values[parameter.id].replace(',', '.')),
                              ),
                            )
                          : parameter.min
                      }
                      onChange={(event) =>
                        onChange({ ...values, [parameter.id]: event.target.value, result: '' })
                      }
                    />
                    <small>
                      От {parameter.min} до {parameter.max} · шаг {parameter.step}
                    </small>
                  </div>
                ))}
              </div>
              <div className="numeric-answer field">
                <label htmlFor={`result-${exercise.id}`}>
                  {exercise.unit === 'currency' && exercise.currency === 'USD'
                    ? 'Доллары США'
                    : units[exercise.unit ?? 'number']}
                </label>
                <input
                  className="input"
                  id={`result-${exercise.id}`}
                  aria-label="Результат расчёта"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={solved}
                  value={values.result ?? ''}
                  placeholder="Рассчитайте и введите результат"
                  onChange={(event) => onChange({ ...values, result: event.target.value })}
                />
              </div>
              <p className="muted" style={{ fontSize: 11 }}>
                Измените параметры и рассчитайте результат выбранного сценария. Это учебная модель.
              </p>
            </div>
          );
        })()}
      {!solved && onCheck && (
        <button className="button primary exercise-check" type="submit">
          Проверить ответ
        </button>
      )}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`feedback ${feedback.correct ? 'correct' : 'incorrect'}`}
        >
          <strong>
            {feedback.correct ? (
              <>
                <Check size={15} /> Верно. Теперь вы знаете почему.
              </>
            ) : (
              <>
                <CircleHelp size={15} /> Давайте разберёмся
              </>
            )}
          </strong>
          {feedback.message}
        </div>
      )}
    </form>
  );
}
