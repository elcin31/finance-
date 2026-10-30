-- Additive FINLAB 0.2. Legacy progress_documents/functions remain unchanged.
create or replace function finlab.valid_v2_id(value text) returns boolean language sql immutable security invoker set search_path='' as $$
 select value is not null and value ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,179}$';
$$;
create or replace function finlab.valid_v2_answer(value jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare v jsonb; k text;
begin
 if jsonb_typeof(value)='string' then return length(value#>>'{}')<=3000; end if;
 if jsonb_typeof(value)='array' then
  if jsonb_array_length(value)>64 then return false; end if;
  for v in select x from jsonb_array_elements(value) x loop if jsonb_typeof(v)<>'string' or length(v#>>'{}')>3000 then return false; end if; end loop;
  return true;
 end if;
 if jsonb_typeof(value)='object' then
  if (select count(*) from jsonb_object_keys(value))>64 then return false; end if;
  for k,v in select key,val from jsonb_each(value) t(key,val) loop if not finlab.valid_v2_id(k) or jsonb_typeof(v)<>'string' or length(v#>>'{}')>3000 then return false; end if; end loop;
  return true;
 end if;
 return false;
end $$;
create or replace function finlab.valid_v2_competencies(value jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
 select case when jsonb_typeof(value)<>'array' then false else
 jsonb_array_length(value) between 1 and 20 and
 not exists (select 1 from jsonb_array_elements(value) x where jsonb_typeof(x)<>'string' or x#>>'{}' not in
 ('financial-literacy','interest-rates','inflation','returns','compounding','present-value','future-value','discounting','npv','irr','stocks','bonds','dividends','portfolio-returns','diversification','risk-return','english-terminology','english-reading','english-calculations','english-expressions'))
 and (select count(*)=count(distinct x) from jsonb_array_elements(value) x) end;
$$;
create or replace function finlab.valid_v2_time(value text) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare instant timestamptz;
begin
 if value is null or value !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' then return false; end if;
 instant:=value::timestamptz;
 return instant>='2000-01-01'::timestamptz and instant<=now()+interval '5 minutes';
exception when others then return false;
end $$;
create or replace function finlab.valid_learning_event(doc jsonb) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare ignored uuid; k text;
begin
 if jsonb_typeof(doc)<>'object' or octet_length(doc::text)>30000 then return false; end if;
 if (select array_agg(key order by key) from jsonb_object_keys(doc) key) <> array['answer','at','competencyIds','contentVersion','correct','difficulty','errorType','exerciseId','hintsUsed','id','lessonId','mode','seed','sessionId','templateId','valid','variantId'] then return false; end if;
 ignored:=(doc->>'id')::uuid; if ignored is null then return false; end if;
 ignored:=(doc->>'sessionId')::uuid; if ignored is null then return false; end if;
 foreach k in array array['exerciseId','templateId','variantId','lessonId'] loop if jsonb_typeof(doc->k)<>'string' or not finlab.valid_v2_id(doc->>k) then return false; end if; end loop;
 if jsonb_typeof(doc->'seed')<>'number' or (doc->>'seed')::numeric not between -9007199254740991 and 9007199254740991 or (doc->>'seed')::numeric<>trunc((doc->>'seed')::numeric) then return false; end if;
 if jsonb_typeof(doc->'contentVersion')<>'number' or (doc->>'contentVersion')::numeric not between 1 and 10000 or (doc->>'contentVersion')::numeric<>trunc((doc->>'contentVersion')::numeric) then return false; end if;
 if doc->'difficulty' not in ('1'::jsonb,'2'::jsonb,'3'::jsonb) or not finlab.valid_v2_competencies(doc->'competencyIds') then return false; end if;
 if jsonb_typeof(doc->'mode')<>'string' or jsonb_typeof(doc->'errorType')<>'string' or doc->>'mode' not in ('lesson','practice','review','english') or doc->>'errorType' not in ('none','concept','calculation','unit','format','selection','ordering') then return false; end if;
 if jsonb_typeof(doc->'valid')<>'boolean' or jsonb_typeof(doc->'correct')<>'boolean' or jsonb_typeof(doc->'hintsUsed')<>'boolean' then return false; end if;
 if (doc->>'correct')::boolean and not (doc->>'valid')::boolean then return false; end if;
 return finlab.valid_v2_answer(doc->'answer') and finlab.valid_v2_time(doc->>'at');
exception when others then return false;
end $$;
create or replace function finlab.valid_practice_draft(doc jsonb) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare k text;
begin
 if jsonb_typeof(doc)<>'object' or octet_length(doc::text)>30000 then return false; end if;
 if not (doc ?& array['answer','exerciseId','id','mode','seed','templateId','updatedAt']) or exists(select 1 from jsonb_object_keys(doc) as keys(value) where keys.value not in('answer','exerciseId','id','mode','seed','templateId','updatedAt','sessionId','hintsUsed')) then return false; end if;
 if doc ? 'sessionId' then perform (doc->>'sessionId')::uuid; if jsonb_typeof(doc->'sessionId')<>'string' then return false; end if; end if;
 if doc ? 'hintsUsed' and jsonb_typeof(doc->'hintsUsed')<>'boolean' then return false; end if;
 foreach k in array array['id','exerciseId','templateId'] loop if jsonb_typeof(doc->k)<>'string' or not finlab.valid_v2_id(doc->>k) then return false; end if; end loop;
 if jsonb_typeof(doc->'seed')<>'number' or (doc->>'seed')::numeric not between -9007199254740991 and 9007199254740991 or (doc->>'seed')::numeric<>trunc((doc->>'seed')::numeric) then return false; end if;
 if jsonb_typeof(doc->'mode')<>'string' or doc->>'mode' not in ('practice','review','english') then return false; end if;
 return finlab.valid_v2_answer(doc->'answer') and finlab.valid_v2_time(doc->>'updatedAt');
exception when others then return false;
end $$;

create table if not exists finlab.learning_events (
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id uuid not null,
 occurred_at timestamptz not null,
 event jsonb not null check(finlab.valid_learning_event(event)),
 primary key(user_id,event_id),
 check((event->>'id')::uuid=event_id), check((event->>'at')::timestamptz=occurred_at)
);
create index if not exists learning_events_time_idx on finlab.learning_events(user_id,occurred_at,event_id);
alter table finlab.learning_events enable row level security;
alter table finlab.learning_events force row level security;
drop policy if exists learning_events_select on finlab.learning_events;
create policy learning_events_select on finlab.learning_events for select to authenticated using((select auth.uid())=user_id);
drop policy if exists learning_events_insert on finlab.learning_events;
create policy learning_events_insert on finlab.learning_events for insert to authenticated with check((select auth.uid())=user_id);
grant select,insert on finlab.learning_events to authenticated;
create table if not exists finlab.practice_drafts (
 user_id uuid not null references auth.users(id) on delete cascade,
 draft_id text not null check(finlab.valid_v2_id(draft_id)),
 updated_at timestamptz not null,
 draft jsonb not null check(finlab.valid_practice_draft(draft)),
 primary key(user_id,draft_id),
 check(draft->>'id'=draft_id), check((draft->>'updatedAt')::timestamptz=updated_at)
);
alter table finlab.practice_drafts enable row level security;
alter table finlab.practice_drafts force row level security;
drop policy if exists practice_drafts_select on finlab.practice_drafts;
create policy practice_drafts_select on finlab.practice_drafts for select to authenticated using((select auth.uid())=user_id);
drop policy if exists practice_drafts_insert on finlab.practice_drafts;
create policy practice_drafts_insert on finlab.practice_drafts for insert to authenticated with check((select auth.uid())=user_id);
drop policy if exists practice_drafts_update on finlab.practice_drafts;
create policy practice_drafts_update on finlab.practice_drafts for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
grant select,insert,update on finlab.practice_drafts to authenticated;

-- The bank and attempts have no client write privileges. Definer functions below
-- are narrow capabilities: each checks auth.uid() or a 128-bit guest secret hash.
create table if not exists finlab.exam_bank (
 module_id text not null check(module_id in('m1','m2','m3')),
 bank_version integer not null check(bank_version>=2),
 variant integer not null check(variant between 0 and 15),
 public_questions jsonb not null check(jsonb_typeof(public_questions)='array' and jsonb_array_length(public_questions)=8),
 private_questions jsonb not null check(jsonb_typeof(private_questions)='array' and jsonb_array_length(private_questions)=8),
 primary key(module_id,bank_version,variant)
);
alter table finlab.exam_bank enable row level security;
alter table finlab.exam_bank force row level security;
drop policy if exists exam_bank_deny_clients on finlab.exam_bank;
create policy exam_bank_deny_clients on finlab.exam_bank for all to anon,authenticated using(false) with check(false);
create or replace function finlab.reject_exam_bank_mutation() returns trigger language plpgsql security invoker set search_path='' as $$ begin raise exception 'Exam bank versions are immutable; insert a new version' using errcode='55000'; end $$;
drop trigger if exists exam_bank_immutable on finlab.exam_bank;
create trigger exam_bank_immutable before update or delete on finlab.exam_bank for each row execute function finlab.reject_exam_bank_mutation();
revoke all on function finlab.reject_exam_bank_mutation() from public,anon,authenticated;

create table if not exists finlab.exam_rotation (
 owner_key text not null,
 module_id text not null check(module_id in('m1','m2','m3')),
 next_value bigint not null default 0,
 primary key(owner_key,module_id)
);
alter table finlab.exam_rotation enable row level security;
alter table finlab.exam_rotation force row level security;
drop policy if exists exam_rotation_deny_clients on finlab.exam_rotation;
create policy exam_rotation_deny_clients on finlab.exam_rotation for all to anon,authenticated using(false) with check(false);
create table if not exists finlab.exam_attempts (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 owner_id uuid references auth.users(id) on delete cascade,
 guest_token_hash bytea,
 module_id text not null,
 bank_version integer not null,
 variant integer not null,
 started_at timestamptz not null default now(),
 submitted_at timestamptz,
 result jsonb,
 draft jsonb not null default '{}',
 position integer not null default 0 check(position between 0 and 8),
 draft_updated_at timestamptz not null default now(),
 foreign key(module_id,bank_version,variant) references finlab.exam_bank(module_id,bank_version,variant),
 check((owner_id is not null and guest_token_hash is null) or (owner_id is null and guest_token_hash is not null)),
 check((submitted_at is null and result is null) or (submitted_at is not null and result is not null))
);
alter table finlab.exam_attempts add column if not exists draft jsonb not null default '{}';
alter table finlab.exam_attempts add column if not exists position integer not null default 0 check(position between 0 and 8);
alter table finlab.exam_attempts add column if not exists draft_updated_at timestamptz not null default now();
create index if not exists exam_attempts_bank_fk_idx on finlab.exam_attempts(module_id,bank_version,variant);
create index if not exists exam_attempts_owner_idx on finlab.exam_attempts(owner_id,submitted_at desc) where owner_id is not null;
alter table finlab.exam_attempts enable row level security;
alter table finlab.exam_attempts force row level security;
drop policy if exists exam_attempts_deny_clients on finlab.exam_attempts;
create policy exam_attempts_deny_clients on finlab.exam_attempts for all to anon,authenticated using(false) with check(false);
-- No SELECT/INSERT/UPDATE/DELETE grants: only protected RPC responses are public.

create or replace function finlab.exam_token_hash(token text) returns bytea language plpgsql immutable security invoker set search_path='' as $$
declare parsed uuid;
begin
 if token is null then return null; end if;
 parsed:=token::uuid;
 return extensions.digest(parsed::text,'sha256');
exception when others then raise exception 'Invalid guest capability' using errcode='22023';
end $$;
create or replace function finlab.exam_can_access(attempt finlab.exam_attempts,token text) returns boolean language sql stable security invoker set search_path='' as $$
 select (attempt.owner_id is not null and attempt.owner_id=(select auth.uid())) or
 (attempt.owner_id is null and attempt.guest_token_hash is not null and token is not null and attempt.guest_token_hash=finlab.exam_token_hash(token));
$$;
create or replace function finlab.exam_session(attempt finlab.exam_attempts) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',attempt.id,'moduleId',attempt.module_id,'lessonId',attempt.module_id||'-exam','bankVersion',attempt.bank_version,'variant',attempt.variant,'startedAt',attempt.started_at,'questions',bank.public_questions,'draft',attempt.draft,'position',attempt.position,'updatedAt',attempt.draft_updated_at)
 || case when attempt.result is null then '{}'::jsonb else jsonb_build_object('result',attempt.result) end
 from finlab.exam_bank bank where bank.module_id=attempt.module_id and bank.bank_version=attempt.bank_version and bank.variant=attempt.variant;
$$;
create or replace function finlab.exam_get(p_attempt uuid,p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare attempt finlab.exam_attempts;
begin
 select * into attempt from finlab.exam_attempts where id=p_attempt;
 if attempt.id is null or finlab.exam_can_access(attempt,p_token) is not true then raise exception 'Exam unavailable for this user or capability' using errcode='42501'; end if;
 return finlab.exam_session(attempt);
end $$;
create or replace function finlab.exam_start(p_module text,p_request uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare attempt finlab.exam_attempts; uid uuid:=auth.uid(); token_hash bytea; key text; chosen integer; bank integer;
begin
 if p_module not in('m1','m2','m3') or p_module is null or p_request is null then raise exception 'Invalid module or request ID' using errcode='22023'; end if;
 if uid is null and p_token is null then raise exception 'Guest capability required' using errcode='42501'; end if;
 if p_token is not null then token_hash:=finlab.exam_token_hash(p_token); end if;
 perform pg_advisory_xact_lock(hashtextextended('finlab-exam:'||p_request::text,0));
 select * into attempt from finlab.exam_attempts where request_id=p_request;
 if attempt.id is not null then
  if attempt.module_id<>p_module or finlab.exam_can_access(attempt,p_token) is not true then raise exception 'Request already belongs to another session' using errcode='42501'; end if;
  return finlab.exam_session(attempt);
 end if;
 select max(bank_version) into bank from finlab.exam_bank where module_id=p_module;
 if bank is null then raise exception 'Exam bank is not configured' using errcode='55000'; end if;
 key:=case when uid is null then 'guests' else 'user:'||uid::text end;
 insert into finlab.exam_rotation(owner_key,module_id,next_value) values(key,p_module,1)
 on conflict(owner_key,module_id) do update set next_value=finlab.exam_rotation.next_value+1
 returning ((next_value-1)%16)::integer into chosen;
 insert into finlab.exam_attempts(request_id,owner_id,guest_token_hash,module_id,bank_version,variant)
 values(p_request,uid,case when uid is null then token_hash else null end,p_module,bank,chosen) returning * into attempt;
 return finlab.exam_session(attempt);
end $$;
create or replace function finlab.exam_parse_numeric(raw text,unit text,currency text default 'RUB') returns numeric language plpgsql immutable security invoker set search_path='' as $$
declare value text:=btrim(replace(raw,'−','-')); parsed numeric;
begin
 if raw is null or length(raw)>3000 then return null; end if;
 value:=replace(replace(replace(value,chr(160),' '),chr(8239),' '),chr(8201),' ');
 if unit='percent' then value:=btrim(regexp_replace(value,'\s*%$',''));
 elsif unit='currency' then
  if currency='USD' then value:=regexp_replace(value,'^\$\s*',''); value:=btrim(regexp_replace(value,'\s*(\$|usd|долл\.?)$','','i'));
  else value:=regexp_replace(value,'^₽\s*',''); value:=btrim(regexp_replace(value,'\s*(₽|руб\.?|rub)$','','i')); end if;
 elsif unit='bps' then value:=btrim(regexp_replace(value,'\s*(bps?|б\.?\s*п\.?)$','','i'));
 end if;
 if value !~ '^[+-]?(([0-9]{1,3}( +[0-9]{3})+|[0-9]+)([,.][0-9]+)?|[,.][0-9]+)$' then return null; end if;
 parsed:=replace(replace(value,' ',''),',','.')::numeric;
 if abs(parsed)>1e100 then return null; end if;
 return parsed;
exception when others then return null;
end $$;
create or replace function finlab.exam_grade_question(question jsonb,answer jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare exercise jsonb:=question->'exercise'; actual numeric; expected numeric; tolerance numeric; choices jsonb;
begin
 case exercise->>'kind'
 when 'numeric' then
  if jsonb_typeof(answer)<>'string' then return false; end if;
  actual:=finlab.exam_parse_numeric(answer#>>'{}',exercise->>'unit',coalesce(exercise->>'currency','RUB'));
  if actual is null then return false; end if;
  expected:=(exercise->>'expected')::numeric;
  tolerance:=greatest(coalesce((exercise->>'absoluteTolerance')::numeric,0.005),abs(expected)*coalesce((exercise->>'relativeTolerance')::numeric,0));
  return abs(actual-expected)<=tolerance+1e-12*greatest(1,abs(actual),abs(expected));
 when 'boolean' then return jsonb_typeof(answer)='string' and answer#>>'{}'=exercise->>'correct';
 when 'ordering' then return answer=exercise->'correctOrder';
 when 'choice','scenario' then
  choices:=case when jsonb_typeof(answer)='string' then jsonb_build_array(answer) else answer end;
  if jsonb_typeof(choices)<>'array' then return false; end if;
  if jsonb_array_length(choices)<>jsonb_array_length(exercise->'correct') then return false; end if;
  if (select count(*)<>count(distinct x) from jsonb_array_elements(choices) x) then return false; end if;
  return choices @> (exercise->'correct') and (exercise->'correct') @> choices;
 else return false;
 end case;
exception when others then return false;
end $$;
create or replace function finlab.exam_expected_answer(question jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
 select case question->'exercise'->>'kind'
 when 'numeric' then to_jsonb(question->'exercise'->>'expected')
 when 'boolean' then to_jsonb(question->'exercise'->>'correct')
 when 'ordering' then question->'exercise'->'correctOrder'
 else question->'exercise'->'correct' end;
$$;
create or replace function finlab.exam_passes(score numeric) returns boolean language sql immutable security invoker set search_path='' as $$ select score>=80; $$;
create or replace function finlab.exam_valid_draft_answer(question jsonb,answer jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare exercise jsonb:=question->'exercise'; selections jsonb; entry jsonb; allowed jsonb;
begin
 if not finlab.valid_v2_answer(answer) then return false; end if;
 if exercise->>'kind'='numeric' then return jsonb_typeof(answer)='string'; end if;
 if exercise->>'kind'='boolean' then return jsonb_typeof(answer)='string' and answer#>>'{}' in('','true','false'); end if;
 if exercise->>'kind'='ordering' then
  if jsonb_typeof(answer)<>'array' then return false; end if;
  selections:=answer; allowed:=exercise->'items';
 else
  if jsonb_typeof(answer)='string' then selections:=case when answer='""'::jsonb then '[]'::jsonb else jsonb_build_array(answer) end;
  elsif jsonb_typeof(answer)='array' then selections:=answer; else return false; end if;
  allowed:=exercise->'options';
  if coalesce((exercise->>'multiple')::boolean,false)=false and jsonb_array_length(selections)>1 then return false; end if;
 end if;
 if jsonb_array_length(selections)>jsonb_array_length(allowed) or (select count(*)<>count(distinct value) from jsonb_array_elements(selections)) then return false; end if;
 for entry in select value from jsonb_array_elements(selections) loop
  if not exists(select 1 from jsonb_array_elements(allowed) a where a->'id'=entry) then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function finlab.exam_valid_draft_answer(jsonb,jsonb) from public,anon,authenticated;
create or replace function finlab.exam_save_draft(p_attempt uuid,p_answers jsonb,p_position integer,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare attempt finlab.exam_attempts; question jsonb; entry record; allowed jsonb;
begin
 select * into attempt from finlab.exam_attempts where id=p_attempt for update;
 if attempt.id is null or finlab.exam_can_access(attempt,p_token) is not true then raise exception 'Exam unavailable for this user or capability' using errcode='42501'; end if;
 if attempt.result is not null then return finlab.exam_session(attempt); end if;
 if p_position is null or p_position not between 0 and 8 or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>100000 or (select count(*) from jsonb_object_keys(p_answers))>8 then raise exception 'Invalid exam draft' using errcode='22023'; end if;
 select public_questions into allowed from finlab.exam_bank where module_id=attempt.module_id and bank_version=attempt.bank_version and variant=attempt.variant;
 for entry in select key,value from jsonb_each(p_answers) loop
  select value into question from jsonb_array_elements(allowed) where value->>'id'=entry.key;
  if question is null or finlab.exam_valid_draft_answer(question,entry.value) is not true then raise exception 'Unknown question or invalid draft answer' using errcode='22023'; end if;
  if question->'exercise'->>'kind' in('numeric','boolean') and jsonb_typeof(entry.value)<>'string' then raise exception 'Invalid scalar draft answer' using errcode='22023'; end if;
  if question->'exercise'->>'kind' in('choice','scenario','ordering') and jsonb_typeof(entry.value) not in('string','array') then raise exception 'Invalid selection draft answer' using errcode='22023'; end if;
 end loop;
 update finlab.exam_attempts set draft=p_answers,position=p_position,draft_updated_at=clock_timestamp() where id=p_attempt returning * into attempt;
 return finlab.exam_session(attempt);
end $$;
create or replace function finlab.exam_active(p_module text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); attempt finlab.exam_attempts;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_module is null or p_module not in('m1','m2','m3') then raise exception 'Invalid module' using errcode='22023'; end if;
 select * into attempt from finlab.exam_attempts where owner_id=uid and module_id=p_module and submitted_at is null order by draft_updated_at desc,started_at desc,id desc limit 1;
 if attempt.id is null then return null; end if;
 return finlab.exam_session(attempt);
end $$;
create or replace function finlab.exam_submit(p_attempt uuid,p_answers jsonb,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare attempt finlab.exam_attempts; bank finlab.exam_bank; question jsonb; answer jsonb; graded jsonb:='[]'; correct boolean; correct_count integer:=0; score numeric; final_at timestamptz:=clock_timestamp();
begin
 select * into attempt from finlab.exam_attempts where id=p_attempt for update;
 if attempt.id is null or finlab.exam_can_access(attempt,p_token) is not true then raise exception 'Exam unavailable for this user or capability' using errcode='42501'; end if;
 -- The first completed submission is immutable, including retries with changed answers.
 if attempt.result is not null then return finlab.exam_session(attempt); end if;
 select * into bank from finlab.exam_bank where module_id=attempt.module_id and bank_version=attempt.bank_version and variant=attempt.variant;
 if jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>100000 or (select count(*) from jsonb_object_keys(p_answers))<>jsonb_array_length(bank.private_questions) then raise exception 'Answer every exam question before submission' using errcode='22023'; end if;
 for question in select value from jsonb_array_elements(bank.private_questions) loop
  answer:=p_answers->(question->>'id');
  if answer is null or not finlab.valid_v2_answer(answer) or answer='""'::jsonb or answer='[]'::jsonb or answer='{}'::jsonb then raise exception 'Answer every exam question before submission' using errcode='22023'; end if;
  correct:=finlab.exam_grade_question(question,answer);
  if correct then correct_count:=correct_count+1; end if;
  graded:=graded||jsonb_build_array(jsonb_build_object('questionId',question->>'id','competencyIds',question->'competencyIds','difficulty',question->'difficulty','answer',answer,'correct',correct,'explanation',question->'exercise'->>'explanation','expectedAnswer',finlab.exam_expected_answer(question)));
 end loop;
 score:=round(100.0*correct_count/jsonb_array_length(bank.private_questions),2);
 update finlab.exam_attempts set submitted_at=final_at,result=jsonb_build_object('id',attempt.id,'moduleId',attempt.module_id,'lessonId',attempt.module_id||'-exam','bankVersion',attempt.bank_version,'variant',attempt.variant,'score',score,'passed',finlab.exam_passes(score),'submittedAt',final_at,'answers',graded) where id=p_attempt returning * into attempt;
 return finlab.exam_session(attempt);
end $$;
create or replace function finlab.exam_claim(p_attempt uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare attempt finlab.exam_attempts; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sign in before claiming an exam' using errcode='42501'; end if;
 select * into attempt from finlab.exam_attempts where id=p_attempt for update;
 if attempt.id is null then raise exception 'Exam unavailable' using errcode='42501'; end if;
 if attempt.owner_id=uid then return finlab.exam_session(attempt); end if;
 if attempt.owner_id is not null or p_token is null or attempt.guest_token_hash<>finlab.exam_token_hash(p_token) then raise exception 'Invalid exam capability' using errcode='42501'; end if;
 update finlab.exam_attempts set owner_id=uid,guest_token_hash=null where id=p_attempt returning * into attempt;
 return finlab.exam_session(attempt);
end $$;
create or replace function finlab.exam_results_for_user() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); results jsonb;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(result order by submitted_at,id),'[]') into results from finlab.exam_attempts where owner_id=uid and result is not null;
 return results;
end $$;

create or replace function public.finlab_learning_load() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); events jsonb; drafts jsonb;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(event order by occurred_at,event_id),'[]') into events from finlab.learning_events where user_id=uid;
 select coalesce(jsonb_object_agg(draft_id,draft),'{}') into drafts from finlab.practice_drafts where user_id=uid;
 return jsonb_build_object('version',2,'events',events,'drafts',drafts,'examResults',finlab.exam_results_for_user());
end $$;
create or replace function public.finlab_learning_sync(events jsonb,drafts jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); item jsonb; p_draft_key text;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if jsonb_typeof(events)<>'array' or jsonb_array_length(events)>20000 or jsonb_typeof(drafts)<>'object' or (select count(*) from jsonb_object_keys(drafts))>256 or octet_length(events::text)+octet_length(drafts::text)>3500000 then raise exception 'Invalid learning payload' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(events) loop
  if finlab.valid_learning_event(item) is not true then raise exception 'Invalid learning event' using errcode='22023'; end if;
  insert into finlab.learning_events(user_id,event_id,occurred_at,event) values(uid,(item->>'id')::uuid,(item->>'at')::timestamptz,item) on conflict(user_id,event_id) do nothing;
 end loop;
 for p_draft_key,item in select key,value from jsonb_each(drafts) loop
  if finlab.valid_practice_draft(item) is not true or p_draft_key<>item->>'id' then raise exception 'Invalid practice draft' using errcode='22023'; end if;
  insert into finlab.practice_drafts(user_id,draft_id,updated_at,draft) values(uid,p_draft_key,(item->>'updatedAt')::timestamptz,item)
  on conflict(user_id,draft_id) do update set updated_at=excluded.updated_at,draft=excluded.draft where excluded.updated_at>finlab.practice_drafts.updated_at;
 end loop;
 return public.finlab_learning_load();
end $$;
create or replace function public.finlab_exam_start(module_id text,request_id uuid,guest_token text default null) returns jsonb language sql security invoker set search_path='' as $$ select finlab.exam_start($1,$2,$3); $$;
create or replace function public.finlab_exam_get(attempt_id uuid,guest_token text default null) returns jsonb language sql stable security invoker set search_path='' as $$ select finlab.exam_get($1,$2); $$;
create or replace function public.finlab_exam_submit(attempt_id uuid,answers jsonb,guest_token text default null) returns jsonb language sql security invoker set search_path='' as $$ select finlab.exam_submit($1,$2,$3); $$;
create or replace function public.finlab_exam_claim(attempt_id uuid,guest_token text) returns jsonb language sql security invoker set search_path='' as $$ select finlab.exam_claim($1,$2); $$;

revoke all on finlab.learning_events,finlab.practice_drafts from public,anon;
revoke all on finlab.exam_bank,finlab.exam_attempts,finlab.exam_rotation from public,anon,authenticated;
revoke all on function finlab.valid_v2_id(text),finlab.valid_v2_answer(jsonb),finlab.valid_v2_competencies(jsonb),finlab.valid_v2_time(text),finlab.valid_learning_event(jsonb),finlab.valid_practice_draft(jsonb),finlab.exam_token_hash(text),finlab.exam_can_access(finlab.exam_attempts,text),finlab.exam_session(finlab.exam_attempts),finlab.exam_get(uuid,text),finlab.exam_start(text,uuid,text),finlab.exam_parse_numeric(text,text,text),finlab.exam_grade_question(jsonb,jsonb),finlab.exam_expected_answer(jsonb),finlab.exam_submit(uuid,jsonb,text),finlab.exam_claim(uuid,text),finlab.exam_results_for_user() from public,anon,authenticated;
grant usage on schema finlab to anon,authenticated;
grant execute on function finlab.valid_v2_id(text),finlab.valid_v2_answer(jsonb),finlab.valid_v2_competencies(jsonb),finlab.valid_v2_time(text),finlab.valid_learning_event(jsonb),finlab.valid_practice_draft(jsonb) to authenticated;
grant execute on function finlab.exam_get(uuid,text),finlab.exam_start(text,uuid,text),finlab.exam_submit(uuid,jsonb,text) to anon,authenticated;
grant execute on function finlab.exam_claim(uuid,text),finlab.exam_results_for_user() to authenticated;
revoke all on function public.finlab_learning_load(),public.finlab_learning_sync(jsonb,jsonb),public.finlab_exam_start(text,uuid,text),public.finlab_exam_get(uuid,text),public.finlab_exam_submit(uuid,jsonb,text),public.finlab_exam_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.finlab_learning_load(),public.finlab_learning_sync(jsonb,jsonb),public.finlab_exam_claim(uuid,text) to authenticated;
grant execute on function public.finlab_exam_start(text,uuid,text),public.finlab_exam_get(uuid,text),public.finlab_exam_submit(uuid,jsonb,text) to anon,authenticated;
create or replace function public.finlab_exam_draft(attempt_id uuid,answers jsonb,"position" integer,guest_token text default null) returns jsonb language sql security invoker set search_path='' as $$ select finlab.exam_save_draft($1,$2,$3,$4); $$;
create or replace function public.finlab_exam_active(module_id text) returns jsonb language sql stable security invoker set search_path='' as $$ select finlab.exam_active($1); $$;
revoke all on function finlab.exam_passes(numeric),finlab.exam_save_draft(uuid,jsonb,integer,text),finlab.exam_active(text) from public,anon,authenticated;
grant execute on function finlab.exam_save_draft(uuid,jsonb,integer,text) to anon,authenticated;
grant execute on function finlab.exam_active(text) to authenticated;
revoke all on function public.finlab_exam_draft(uuid,jsonb,integer,text),public.finlab_exam_active(text) from public,anon,authenticated;
grant execute on function public.finlab_exam_draft(uuid,jsonb,integer,text) to anon,authenticated;
grant execute on function public.finlab_exam_active(text) to authenticated;
notify pgrst,'reload schema';
