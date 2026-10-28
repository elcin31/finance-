'use client';
import { Check, CircleHelp } from 'lucide-react';
import type { Answer, Exercise } from '@/lib/types';
export function ExerciseView({
  exercise,
  answer,
  onChange,
  onCheck,
  solved,
  feedback,
}: {
  exercise: Exercise;
  answer: Answer;
  onChange: (a: Answer) => void;
  onCheck: () => void;
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
        if (!solved) onCheck();
      }}
    >
      <h1>{exercise.prompt}</h1>
      {(exercise.kind === 'choice' || exercise.kind === 'scenario') && (
        <>
          <p className="muted" style={{ fontSize: 11 }}>
            {exercise.multiple ? 'Выберите все подходящие варианты.' : 'Выберите один вариант.'}
          </p>
          <div className="exercise-options" role="group" aria-label="Варианты ответа">
            {exercise.options.map((o, index) => (
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
          <label htmlFor={`answer-${exercise.id}`}>{units[exercise.unit]}</label>
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
                  ? 'Ваш ответ, ₽'
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
            {exercise.pairs.map((pair) => {
              const answers = typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
              const options = [...exercise.pairs.slice(1), exercise.pairs[0]];
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
      {!solved && (
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
