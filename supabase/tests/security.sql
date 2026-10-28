-- Integration assertions: run as postgres on an isolated FINLAB database.
-- All fixture users, documents and changes are rolled back.
begin;
insert into auth.users (id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at)
values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','finlab-rls-a@example.invalid',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','finlab-rls-b@example.invalid',now(),now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
declare fixture jsonb; saved jsonb;
begin
  fixture := '{"schemaVersion":1,"sourceId":"20000000-0000-4000-8000-000000000001","preferences":{"goal":"Финансовая грамотность","level":"С нуля","pace":15,"diagnosticScore":0,"recommendedLesson":"m1-money","onboardingDone":true},"preferencesUpdatedAt":"2026-10-28T00:00:00.000Z","states":{"m1-money":{"position":2,"runId":"30000000-0000-4000-8000-000000000001","drafts":{"q1":"7,5%"},"updatedAt":"2026-10-28T00:00:00.000Z"}},"attempts":[{"id":"40000000-0000-4000-8000-000000000001","lessonId":"m1-money","exerciseId":"q1","runId":"30000000-0000-4000-8000-000000000001","answer":"7,5%","correct":true,"at":"2026-10-28T00:00:00.000Z"}],"completions":[{"lessonId":"m1-money","runId":"30000000-0000-4000-8000-000000000001","version":1,"score":100,"completedAt":"2026-10-28T00:00:00.000Z"}]}'::jsonb;
  if not finlab.valid_progress(fixture) then raise exception 'legacy fixture rejected'; end if;
  if not finlab.valid_progress(jsonb_set(fixture,'{states,m1-money,contentVersion}','2')) then raise exception 'contentVersion rejected'; end if;
  if not finlab.valid_progress(jsonb_set(fixture,'{attempts,0,contentVersion}','2')) then raise exception 'attempt contentVersion rejected'; end if;
  if finlab.valid_progress(jsonb_set(fixture,'{attempts,0,contentVersion}','0')) then raise exception 'zero attempt version accepted'; end if;
  if finlab.valid_progress(jsonb_set(fixture,'{attempts,0,contentVersion}','1.5')) then raise exception 'fractional attempt version accepted'; end if;
  if finlab.valid_progress(jsonb_set(fixture,'{attempts,0,contentVersion}','null')) then raise exception 'null attempt version accepted'; end if;
  if finlab.valid_progress(jsonb_set(fixture,'{states,m1-money,contentVersion}','0')) then raise exception 'zero contentVersion accepted'; end if;
  if finlab.valid_progress(jsonb_set(fixture,'{states,m1-money,contentVersion}','1.5')) then raise exception 'fractional contentVersion accepted'; end if;
  if finlab.valid_progress(jsonb_set(fixture,'{states,m1-money,contentVersion}','null')) then raise exception 'null contentVersion accepted'; end if;
  if finlab.valid_progress(jsonb_set(fixture,'{preferencesUpdatedAt}','null')) then raise exception 'null timestamp accepted'; end if;
  if finlab.valid_progress(jsonb_set(fixture,'{preferences,recommendedLesson}','null')) then raise exception 'null content ID accepted'; end if;
  if finlab.valid_progress(jsonb_set(fixture,'{attempts,0,correct}','"true"')) then raise exception 'boolean coercion accepted'; end if;
  saved := public.finlab_sync_progress(fixture);
  if saved <> fixture then raise exception 'first sync lost fixture data'; end if;
  saved := public.finlab_sync_progress(fixture);
  if jsonb_array_length(saved->'attempts') <> 1 then raise exception 'duplicate import created duplicate attempts'; end if;
  if jsonb_array_length(saved->'completions') <> 1 then raise exception 'duplicate import created duplicate completion credit'; end if;
  saved := public.finlab_sync_progress(jsonb_set(fixture,'{attempts,0,correct}','false'));
  if saved->'attempts'->0->'correct' <> 'true' then raise exception 'immutable server attempt overwritten'; end if;
  if public.finlab_load_progress() <> saved then raise exception 'read after write mismatch'; end if;
  -- A later device adds another attempt and advances its draft. An older full
  -- snapshot must retain those facts instead of replacing the whole document.
  saved := public.finlab_sync_progress(jsonb_set(jsonb_set(fixture,'{attempts}',(fixture->'attempts') || '[{"id":"40000000-0000-4000-8000-000000000002","contentVersion":2,"lessonId":"m1-money","exerciseId":"q2","runId":"30000000-0000-4000-8000-000000000001","answer":["a"],"correct":true,"at":"2026-10-28T00:00:01.000Z"}]'::jsonb),'{states,m1-money}', '{"contentVersion":2,"position":3,"runId":"30000000-0000-4000-8000-000000000001","drafts":{"q2":["a"]},"updatedAt":"2026-10-28T00:00:01.000Z"}'::jsonb));
  saved := public.finlab_sync_progress(fixture);
  if jsonb_array_length(saved->'attempts') <> 2 then raise exception 'stale snapshot lost a newer attempt'; end if;
  if saved->'states'->'m1-money'->'position' <> '3' then raise exception 'stale snapshot overwrote newer draft'; end if;
  if saved->'states'->'m1-money'->'contentVersion' <> '2' then raise exception 'stale snapshot lost content version'; end if;
  if not exists (select 1 from jsonb_array_elements(saved->'attempts') a where a->>'id'='40000000-0000-4000-8000-000000000002' and a->'contentVersion'='2') then raise exception 'attempt content version lost'; end if;
  -- Offset strings must be compared as instants, not lexicographically.
  saved := public.finlab_sync_progress(jsonb_set(jsonb_set(jsonb_set(fixture,'{states,m1-money}', '{"contentVersion":2,"position":0,"runId":"30000000-0000-4000-8000-000000000001","drafts":{},"updatedAt":"2026-10-28T02:00:00+03:00"}'::jsonb),'{preferencesUpdatedAt}','"2026-10-28T02:00:00+03:00"'),'{preferences,goal}','"older-offset"'));
  if saved->'states'->'m1-money'->'position' <> '3' or saved->'preferences'->>'goal'='older-offset' then raise exception 'older offset timestamp won mutable conflict'; end if;
  saved := public.finlab_sync_progress(jsonb_set(jsonb_set(jsonb_set(fixture,'{states,m1-money}', '{"contentVersion":2,"position":4,"runId":"30000000-0000-4000-8000-000000000001","drafts":{},"updatedAt":"2026-10-28T02:00:00+01:00"}'::jsonb),'{preferencesUpdatedAt}','"2026-10-28T02:00:00+01:00"'),'{preferences,goal}','"newer-offset"'));
  if saved->'states'->'m1-money'->'position' <> '4' or saved->'preferences'->>'goal'<>'newer-offset' then raise exception 'newer offset timestamp lost mutable conflict'; end if;
  saved := public.finlab_sync_progress(jsonb_set(jsonb_set(fixture,'{attempts}',(fixture->'attempts') || '[{"id":"40000000-0000-4000-8000-000000000003","contentVersion":2,"lessonId":"m1-money","exerciseId":"q3","runId":"30000000-0000-4000-8000-000000000001","answer":"a","correct":true,"at":"2026-10-28T02:00:00+03:00"}]'::jsonb),'{completions}',(fixture->'completions') || '[{"lessonId":"m1-money","runId":"30000000-0000-4000-8000-000000000003","version":2,"score":100,"completedAt":"2026-10-28T02:00:00+03:00"}]'::jsonb));
  if saved->'attempts'->0->>'id'<>'40000000-0000-4000-8000-000000000003' then raise exception 'attempt array not sorted by actual time'; end if;
  if saved->'completions'->0->>'runId'<>'30000000-0000-4000-8000-000000000003' then raise exception 'completion array not sorted by actual time'; end if;


end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$
declare fixture jsonb; n integer; blocked boolean := false;
begin
  if public.finlab_load_progress() is not null then raise exception 'cross-user RPC read'; end if;
  if exists (select 1 from finlab.progress_documents) then raise exception 'cross-user table read'; end if;
  if exists (select 1 from finlab.exercise_attempts) then raise exception 'cross-user view read'; end if;
  update finlab.progress_documents set revision=revision+1 where user_id='10000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'cross-user update'; end if;
  fixture := '{"schemaVersion":1,"sourceId":"20000000-0000-4000-8000-000000000002","preferences":{"goal":"Инвестиции","level":"С нуля","pace":20,"diagnosticScore":0,"recommendedLesson":"m1-money","onboardingDone":false},"preferencesUpdatedAt":"2026-10-28T00:00:00.000Z","states":{},"attempts":[],"completions":[]}'::jsonb;
  perform public.finlab_sync_progress(fixture);
  if (select count(*) from finlab.profiles) <> 1 then raise exception 'own profile not readable'; end if;
  begin
    insert into finlab.progress_documents(user_id,document) values ('10000000-0000-4000-8000-000000000001',fixture);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'cross-user INSERT was not blocked by RLS'; end if;
  blocked := false;
  begin
    update finlab.progress_documents set user_id='10000000-0000-4000-8000-000000000003' where user_id='10000000-0000-4000-8000-000000000002';
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'ownership reassignment was not blocked by WITH CHECK'; end if;
end $$;

set local role anon;
do $$
declare blocked boolean := false;
begin
  begin perform public.finlab_load_progress(); exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'anonymous load RPC access'; end if;
  blocked := false;
  begin perform public.finlab_sync_progress('{}'); exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'anonymous sync RPC access'; end if;
end $$;
reset role;
select 'PASS: two-user RLS, own read/write, view isolation, ownership protection, anonymous denial, immutable import deduplication, malformed-data rejection' as finlab_security_checks;
rollback;
