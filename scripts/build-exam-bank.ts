import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildExamBank, examBankInsertSQL, EXAM_BANK_VERSION } from '../src/lib/exam-bank';

const output = resolve(process.argv[2] ?? `supabase/generated/exam-bank-v${EXAM_BANK_VERSION}.sql`);
mkdirSync(dirname(output), { recursive: true });
const bank = buildExamBank();
let sql = examBankInsertSQL(bank);
if (process.argv.includes('--from-v2')) {
  if (EXAM_BANK_VERSION !== 3)
    throw new Error('This compact upgrade applies only from bank 2 to bank 3.');
  const literal = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const patches = bank
    .filter((item) => item.moduleId === 'm3')
    .map(
      (item) =>
        `(${item.variant},${literal(item.publicQuestions[4])},${literal(item.questions[4])})`,
    )
    .join(',\n');
  sql = `with patches(variant,public_question,private_question) as (values ${patches})\ninsert into finlab.exam_bank(module_id,bank_version,variant,public_questions,private_questions)\nselect b.module_id,3,b.variant,case when b.module_id='m3' then jsonb_set(replace(b.public_questions::text,'-b2-','-b3-')::jsonb,'{4}',p.public_question) else replace(b.public_questions::text,'-b2-','-b3-')::jsonb end,case when b.module_id='m3' then jsonb_set(replace(b.private_questions::text,'-b2-','-b3-')::jsonb,'{4}',p.private_question) else replace(b.private_questions::text,'-b2-','-b3-')::jsonb end from finlab.exam_bank b join patches p on p.variant=b.variant where b.bank_version=2 on conflict(module_id,bank_version,variant) do nothing;\n`;
}
writeFileSync(
  output,
  `-- Reproducible private exam bank v${EXAM_BANK_VERSION}. Generated; never serve as a public asset.\n` +
    sql,
);
process.stdout.write(
  JSON.stringify({
    output,
    variants: bank.length,
    questions: bank.reduce((sum, item) => sum + item.questions.length, 0),
  }) + '\n',
);
