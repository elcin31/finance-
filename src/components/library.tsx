'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search } from 'lucide-react';
import { terms, lessons } from '@/content/curriculum';
const formulas = lessons.flatMap((l) =>
  l.blocks.flatMap((b) =>
    b.type === 'formula' ? [{ ...b, lessonId: l.id, lessonTitle: l.title }] : [],
  ),
);
export default function KnowledgeLibrary({ initialSearch = '' }: { initialSearch?: string }) {
  const [query, setQuery] = useState(initialSearch);
  const [tab, setTab] = useState<'terms' | 'formulas'>('terms');
  const q = query.toLocaleLowerCase('ru').trim();
  const filteredTerms = terms.filter((t) =>
    [t.en, t.ru, t.definition, t.context].join(' ').toLocaleLowerCase('ru').includes(q),
  );
  const filteredFormulas = formulas.filter((f) =>
    [f.title, f.expression, f.lessonTitle, ...f.variables.map((v) => v.meaning)]
      .join(' ')
      .toLocaleLowerCase('ru')
      .includes(q),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ЗНАНИЯ ВСЕГДА ПОД РУКОЙ</span>
          <h1>Библиотека финансов</h1>
          <p>Термины, формулы и контекст. Возвращайтесь к главному.</p>
        </div>
        <span className="pill">
          {terms.length} терминов · {formulas.length} формул
        </span>
      </div>
      <div className="library-search">
        <Search size={19} />
        <input
          className="input"
          aria-label="Поиск в библиотеке"
          placeholder="Например: доходность, Asset или NPV"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div
        className="segmented"
        role="tablist"
        aria-label="Раздел библиотеки"
        style={{ maxWidth: 420 }}
      >
        <button role="tab" aria-selected={tab === 'terms'} onClick={() => setTab('terms')}>
          Финансовый словарь
        </button>
        <button role="tab" aria-selected={tab === 'formulas'} onClick={() => setTab('formulas')}>
          Справочник формул
        </button>
      </div>
      <div className="library-grid">
        {tab === 'terms'
          ? filteredTerms.map((t) => (
              <article className="panel term-card" key={t.en}>
                <h2 lang="en">{t.en}</h2>
                <p className="term-ru">{t.ru}</p>
                <p>{t.definition}</p>
                <p className="term-context" lang="en">
                  {t.context}
                </p>
                <Link className="text-link" href={`/lesson/${t.lessonId}`}>
                  Изучить в уроке <ArrowUpRight size={13} />
                </Link>
              </article>
            ))
          : filteredFormulas.map((f) => (
              <article className="panel term-card" key={`${f.lessonId}-${f.id}`}>
                <span className="eyebrow">{f.lessonTitle}</span>
                <h2 style={{ fontSize: 17 }}>{f.title}</h2>
                <div className="formula-expression">{f.expression}</div>
                <div className="formula-variables">
                  {f.variables.map((v) => (
                    <div className="formula-variable" key={v.symbol}>
                      <strong>{v.symbol}</strong>
                      <span>{v.meaning}</span>
                    </div>
                  ))}
                </div>
                {f.note && <p style={{ marginTop: 15 }}>{f.note}</p>}
                <Link
                  className="text-link"
                  style={{ marginTop: 16 }}
                  href={`/lesson/${f.lessonId}`}
                >
                  Разобрать на практике <ArrowUpRight size={13} />
                </Link>
              </article>
            ))}
      </div>
      {(tab === 'terms' ? filteredTerms.length : filteredFormulas.length) === 0 && (
        <div className="empty-state">
          <h2>По вашему запросу ничего не найдено</h2>
          <p>Попробуйте русское или английское название термина.</p>
          <button className="button" onClick={() => setQuery('')}>
            Сбросить поиск
          </button>
        </div>
      )}
      <div
        className="panel"
        style={{
          marginTop: 24,
          display: 'flex',
          gap: 20,
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ marginBottom: 5 }}>Английский в контексте финансов</h3>
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
            Закрепляйте термины через задания на сопоставление в каждом уроке.
          </p>
        </div>
        <Link href="/path" className="button">
          Выбрать урок <ArrowUpRight size={14} />
        </Link>
      </div>
    </>
  );
}
