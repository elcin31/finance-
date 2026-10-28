-- Preserve per-attempt content versions; sort events by actual instants.
create or replace function finlab.valid_progress(doc jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare item jsonb; item_key text; prefs jsonb; ignored_uuid uuid; ignored_time timestamptz;
begin
  if jsonb_typeof(doc) <> 'object' or octet_length(doc::text) > 2000000 then return false; end if;
  if (select array_agg(key order by key) from jsonb_object_keys(doc) key)
     <> array['attempts','completions','preferences','preferencesUpdatedAt','schemaVersion','sourceId','states'] then return false; end if;
  if doc->'schemaVersion' <> '1'::jsonb then return false; end if;
  ignored_uuid := (doc->>'sourceId')::uuid;
  if ignored_uuid is null then return false; end if;
  if doc->>'preferencesUpdatedAt' !~ '^\d{4}-\d{2}-\d{2}T' then return false; end if;
  ignored_time := (doc->>'preferencesUpdatedAt')::timestamptz;
  if jsonb_typeof(doc->'preferencesUpdatedAt') <> 'string' or ignored_time is null then return false; end if;
  prefs := doc->'preferences';
  if jsonb_typeof(prefs) <> 'object' or (select array_agg(key order by key) from jsonb_object_keys(prefs) key)
     <> array['diagnosticScore','goal','level','onboardingDone','pace','recommendedLesson'] then return false; end if;
  if jsonb_typeof(prefs->'goal') <> 'string' or length(prefs->>'goal') not between 1 and 200
    or jsonb_typeof(prefs->'level') <> 'string' or length(prefs->>'level') not between 1 and 100
    or jsonb_typeof(prefs->'onboardingDone') <> 'boolean'
    or jsonb_typeof(prefs->'pace') <> 'number' or (prefs->>'pace')::numeric not between 1 and 240
    or (prefs->>'pace')::numeric <> trunc((prefs->>'pace')::numeric)
    or jsonb_typeof(prefs->'diagnosticScore') <> 'number' or (prefs->>'diagnosticScore')::numeric not between 0 and 100
    or jsonb_typeof(prefs->'recommendedLesson') <> 'string' or prefs->>'recommendedLesson' !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$' then return false; end if;
  if jsonb_typeof(doc->'states') <> 'object' or (select count(*) from jsonb_object_keys(doc->'states')) > 128 then return false; end if;
  for item_key,item in select key,val from jsonb_each(doc->'states') as entries(key,val) loop
    if item_key !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$'
      or jsonb_typeof(item) <> 'object' or ((select array_agg(key order by key) from jsonb_object_keys(item) key) <> array['drafts','position','runId','updatedAt'] and (select array_agg(key order by key) from jsonb_object_keys(item) key) <> array['contentVersion','drafts','position','runId','updatedAt'])
      or jsonb_typeof(item->'position') <> 'number' or (item->>'position')::numeric not between 0 and 256
      or (item->>'position')::numeric <> trunc((item->>'position')::numeric)
      or jsonb_typeof(item->'drafts') <> 'object' or (select count(*) from jsonb_object_keys(item->'drafts')) > 128
      or item->>'updatedAt' !~ '^\d{4}-\d{2}-\d{2}T' then return false; end if;
    if item ? 'contentVersion' then
      if jsonb_typeof(item->'contentVersion') <> 'number' or (item->>'contentVersion')::numeric not between 1 and 10000 or (item->>'contentVersion')::numeric <> trunc((item->>'contentVersion')::numeric) then return false; end if;
    end if;
    ignored_uuid := (item->>'runId')::uuid; ignored_time := (item->>'updatedAt')::timestamptz;
    if ignored_uuid is null or ignored_time is null then return false; end if;
    if exists (select 1 from jsonb_each(item->'drafts') d where d.key !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$' or not finlab.valid_answer(d.value)) then return false; end if;
  end loop;
  if jsonb_typeof(doc->'attempts') <> 'array' or jsonb_array_length(doc->'attempts') > 20000 then return false; end if;
  for item in select value from jsonb_array_elements(doc->'attempts') loop
    if jsonb_typeof(item) <> 'object' or ((select array_agg(key order by key) from jsonb_object_keys(item) key) <> array['answer','at','correct','exerciseId','id','lessonId','runId'] and (select array_agg(key order by key) from jsonb_object_keys(item) key) <> array['answer','at','contentVersion','correct','exerciseId','id','lessonId','runId'])
      or jsonb_typeof(item->'lessonId') <> 'string' or item->>'lessonId' !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$'
      or jsonb_typeof(item->'exerciseId') <> 'string' or item->>'exerciseId' !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$'
      or jsonb_typeof(item->'correct') <> 'boolean' or not finlab.valid_answer(item->'answer')
      or item->>'at' !~ '^\d{4}-\d{2}-\d{2}T' then return false; end if;
    if item ? 'contentVersion' then
      if jsonb_typeof(item->'contentVersion') <> 'number' or (item->>'contentVersion')::numeric not between 1 and 10000 or (item->>'contentVersion')::numeric <> trunc((item->>'contentVersion')::numeric) then return false; end if;
    end if;
    ignored_uuid := (item->>'id')::uuid; if ignored_uuid is null then return false; end if;
    ignored_uuid := (item->>'runId')::uuid; ignored_time := (item->>'at')::timestamptz;
    if ignored_uuid is null or ignored_time is null then return false; end if;
  end loop;
  if (select count(*) <> count(distinct value->>'id') from jsonb_array_elements(doc->'attempts')) then return false; end if;
  if jsonb_typeof(doc->'completions') <> 'array' or jsonb_array_length(doc->'completions') > 4000 then return false; end if;
  for item in select value from jsonb_array_elements(doc->'completions') loop
    if jsonb_typeof(item) <> 'object' or (select array_agg(key order by key) from jsonb_object_keys(item) key) <> array['completedAt','lessonId','runId','score','version']
      or jsonb_typeof(item->'lessonId') <> 'string' or item->>'lessonId' !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$'
      or jsonb_typeof(item->'version') <> 'number' or (item->>'version')::numeric not between 1 and 10000
      or (item->>'version')::numeric <> trunc((item->>'version')::numeric)
      or jsonb_typeof(item->'score') <> 'number' or (item->>'score')::numeric not between 0 and 100
      or item->>'completedAt' !~ '^\d{4}-\d{2}-\d{2}T' then return false; end if;
    ignored_uuid := (item->>'runId')::uuid; ignored_time := (item->>'completedAt')::timestamptz;
    if ignored_uuid is null or ignored_time is null then return false; end if;
  end loop;
  if (select count(*) <> count(distinct value->>'runId') from jsonb_array_elements(doc->'completions')) then return false; end if;
  return true;
exception when others then return false;
end;
$$;


create or replace function public.finlab_sync_progress(incoming jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); stored jsonb; merged jsonb; merged_states jsonb; merged_attempts jsonb; merged_completions jsonb; merged_prefs jsonb; merged_prefs_at jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if finlab.valid_progress(incoming) is not true then raise exception 'Invalid FINLAB progress document' using errcode = '22023'; end if;
  -- Insert a minimal document first; ON CONFLICT also serializes the first sync race.
  insert into finlab.progress_documents(user_id,document) values (owner_id,
    jsonb_build_object('schemaVersion',1,'sourceId',incoming->'sourceId','preferences',incoming->'preferences','preferencesUpdatedAt',incoming->'preferencesUpdatedAt','states','{}'::jsonb,'attempts','[]'::jsonb,'completions','[]'::jsonb))
    on conflict (user_id) do nothing;
  select document into stored from finlab.progress_documents where user_id = owner_id for update;
  if stored is null then raise exception 'User progress is inaccessible' using errcode = '42501'; end if;

  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into merged_states from (
    select distinct on (key) key,value from (
      select key,value,0 priority from jsonb_each(stored->'states')
      union all select key,value,1 priority from jsonb_each(incoming->'states')
    ) s order by key,(value->>'updatedAt')::timestamptz desc,priority
  ) chosen;
  select coalesce(jsonb_agg(value order by (value->>'at')::timestamptz,value->>'id'),'[]'::jsonb) into merged_attempts from (
    select distinct on (value->>'id') value from (
      select value,0 priority from jsonb_array_elements(stored->'attempts')
      union all select value,1 priority from jsonb_array_elements(incoming->'attempts')
    ) s order by value->>'id',priority
  ) chosen;
  select coalesce(jsonb_agg(value order by (value->>'completedAt')::timestamptz,value->>'runId'),'[]'::jsonb) into merged_completions from (
    select distinct on (value->>'runId') value from (
      select value,0 priority from jsonb_array_elements(stored->'completions')
      union all select value,1 priority from jsonb_array_elements(incoming->'completions')
    ) s order by value->>'runId',priority
  ) chosen;
  if (incoming->>'preferencesUpdatedAt')::timestamptz > (stored->>'preferencesUpdatedAt')::timestamptz then
    merged_prefs := incoming->'preferences'; merged_prefs_at := incoming->'preferencesUpdatedAt';
  else merged_prefs := stored->'preferences'; merged_prefs_at := stored->'preferencesUpdatedAt'; end if;
  merged := stored || jsonb_build_object('states',merged_states,'attempts',merged_attempts,'completions',merged_completions,'preferences',merged_prefs,'preferencesUpdatedAt',merged_prefs_at);
  update finlab.progress_documents set document=merged, revision=revision+1, updated_at=now() where user_id=owner_id;
  return merged;
end;
$$;
