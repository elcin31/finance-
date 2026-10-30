-- Run only against FINLAB, as postgres. Every fixture is transactionally removed.
begin;
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at) values
('61000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','finlab-v2-a@example.invalid',now(),now(),now()),
('61000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','finlab-v2-b@example.invalid',now(),now(),now());
create temp table finlab_v2_fixtures(key text primary key,value jsonb);
grant select,insert,update on finlab_v2_fixtures to authenticated,anon;
insert into finlab_v2_fixtures select b.module_id||':'||b.variant,jsonb_object_agg(q->>'id',finlab.exam_expected_answer(q)) from finlab.exam_bank b cross join lateral jsonb_array_elements(b.private_questions) q where b.bank_version=(select max(latest.bank_version) from finlab.exam_bank latest where latest.module_id=b.module_id) group by b.module_id,b.variant;
do $$begin
 if finlab.exam_passes(79.99) or not finlab.exam_passes(80) or not finlab.exam_passes(80.01) then raise exception '80 percent threshold is incorrect'; end if;
 if finlab.exam_parse_numeric('7,5%','percent')<>7.5 or finlab.exam_parse_numeric('1 234,56 ₽','currency')<>1234.56 or finlab.exam_parse_numeric('25 bp','bps')<>25 then raise exception 'numeric formats'; end if;
 if finlab.exam_parse_numeric('7,5 ₽','percent') is not null or finlab.exam_parse_numeric('NaN','number') is not null or finlab.exam_parse_numeric('1/0','number') is not null then raise exception 'invalid unit or numeric accepted'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
do $$
declare event jsonb; draft jsonb; data jsonb; blocked boolean:=false; old jsonb;
begin
 old:='{"schemaVersion":1,"sourceId":"62000000-0000-4000-8000-000000000001","preferences":{"goal":"Legacy retained","level":"С нуля","pace":15,"diagnosticScore":0,"recommendedLesson":"m1-money","onboardingDone":true},"preferencesUpdatedAt":"2001-01-01T00:00:00Z","states":{},"attempts":[],"completions":[{"lessonId":"m2-exam","runId":"63000000-0000-4000-8000-000000000002","version":1,"score":100,"completedAt":"2001-01-01T00:00:00Z"}]}'::jsonb;
 perform public.finlab_sync_progress(old);
 insert into finlab_v2_fixtures values('legacy',public.finlab_load_progress());
 event:='{"id":"64000000-0000-4000-8000-000000000001","sessionId":"63000000-0000-4000-8000-000000000001","exerciseId":"q1","templateId":"total-return","variantId":"v2:1:2","seed":1,"lessonId":"m3-total-return","contentVersion":2,"competencyIds":["returns"],"difficulty":2,"mode":"practice","answer":"10%","valid":true,"correct":false,"errorType":"calculation","hintsUsed":true,"at":"2001-01-01T00:00:00Z"}'::jsonb;
 draft:='{"id":"draft1","sessionId":"63000000-0000-4000-8000-000000000001","exerciseId":"q1","templateId":"total-return","seed":1,"mode":"practice","answer":"7,5%","hintsUsed":true,"updatedAt":"2001-01-01T03:00:00+03:00"}'::jsonb;
 if not finlab.valid_learning_event(event) or not finlab.valid_practice_draft(draft) then raise exception 'valid v2 fixtures rejected'; end if;
 if finlab.valid_learning_event(jsonb_set(event,'{mode}','"exam"')) or finlab.valid_learning_event(jsonb_set(event,'{mode}','null')) or finlab.valid_learning_event(jsonb_set(event,'{at}',to_jsonb(now()+interval '10 minutes'))) then raise exception 'unsupported mode/future time accepted'; end if;
 data:=public.finlab_learning_sync(jsonb_build_array(event),jsonb_build_object('draft1',draft));
 if jsonb_array_length(data->'events')<>1 or data->'drafts'->'draft1'->'hintsUsed'<>'true' or data->'examResults'<>'[]' then raise exception 'v2 sync or legacy trust isolation failed'; end if;
 data:=public.finlab_learning_sync(jsonb_build_array(jsonb_set(event,'{correct}','true')),jsonb_build_object('draft1',jsonb_set(jsonb_set(draft,'{answer}','"old"'),'{updatedAt}','"2001-01-01T02:00:00+03:00"')));
 if jsonb_array_length(data->'events')<>1 or data->'events'->0->'correct'<>'false' or data->'drafts'->'draft1'->>'answer'<>'7,5%' then raise exception 'idempotence or draft actual-time merge failed'; end if;
 begin update finlab.learning_events e set event=jsonb_set(e.event,'{correct}','true'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'direct event update allowed'; end if;
end $$;
do $$
declare session jsonb; again jsonb; answers jsonb; first_key text; blocked boolean:=false; variant integer; i integer;
begin
 session:=public.finlab_exam_start('m1','65000000-0000-4000-8000-000000000001',null);
 if session ? 'result' or session->'questions'::text is null then raise exception 'invalid public exam response'; end if;
 if (session->'questions')::text ~ '"(correct|expected|correctOrder|explanation|hint)"\s*:' then raise exception 'private grading data leaked'; end if;
 again:=public.finlab_exam_start('m1','65000000-0000-4000-8000-000000000001',null);
 if session->>'id'<>again->>'id' then raise exception 'start not idempotent'; end if;
 first_key:=session->'questions'->0->>'id';
 session:=public.finlab_exam_draft((session->>'id')::uuid,jsonb_build_object(first_key,'123'),3,null);
 again:=public.finlab_exam_get((session->>'id')::uuid,null);
 if again->'position'<>'3' or again->'draft'->>first_key<>'123' then raise exception 'draft failed to restore'; end if;
 if public.finlab_exam_active('m1')->>'id'<>session->>'id' then raise exception 'active exam cannot be found on another device'; end if;
 begin perform public.finlab_exam_draft((session->>'id')::uuid,'{"unknown":"1"}',0,null); exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'unknown draft question accepted'; end if;
 blocked:=false;
 begin perform public.finlab_exam_submit((session->>'id')::uuid,'{}',null); exception when invalid_parameter_value then blocked:=true; end;
 if not blocked then raise exception 'incomplete exam finalized'; end if;
 select value into answers from finlab_v2_fixtures where key='m1:'||(session->>'variant');
 session:=public.finlab_exam_submit((session->>'id')::uuid,answers,null);
 if session->'result'->'score'<>'100' or session->'result'->'passed'<>'true' or jsonb_array_length(session->'result'->'answers')<>8 then raise exception 'server grading failed'; end if;
 again:=public.finlab_exam_submit((session->>'id')::uuid,'{}',null);
 if again->'result'<>session->'result' then raise exception 'retry rescored immutable exam'; end if;
 again:=public.finlab_exam_draft((session->>'id')::uuid,'{}',0,null);
 if again->'draft'<>session->'draft' or again->'result'<>session->'result' then raise exception 'completed exam draft mutated'; end if;
 insert into finlab_v2_fixtures values('a-exam',session);
 if public.finlab_exam_active('m1') is not null then raise exception 'completed exam remains active'; end if;
 variant:=(session->>'variant')::integer;
 for i in 1..16 loop
  again:=public.finlab_exam_start('m1',gen_random_uuid(),null);
  if (again->>'variant')::integer<>(variant+i)%16 then raise exception 'retake variant did not rotate'; end if;
 end loop;
 blocked:=false;
 begin update finlab.exam_attempts set result='{"score":100}'; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'client can tamper with exam score'; end if;
 if public.finlab_load_progress()<>(select value from finlab_v2_fixtures where key='legacy') then raise exception 'legacy history changed'; end if;
 if exists(select 1 from jsonb_array_elements(public.finlab_learning_load()->'examResults') r where r->>'moduleId'='m2') then raise exception 'old client exam completion promoted to trusted v2 grade'; end if;
end $$;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002',true);
do $$
declare session jsonb; blocked boolean:=false; event jsonb; n integer;
begin
 if jsonb_array_length(public.finlab_learning_load()->'events')<>0 or jsonb_array_length(public.finlab_learning_load()->'examResults')<>0 then raise exception 'cross-user learning data read'; end if;
 if exists(select 1 from finlab.learning_events) or exists(select 1 from finlab.practice_drafts) then raise exception 'cross-user table read'; end if;
 session:=(select value from finlab_v2_fixtures where key='a-exam');
 begin perform public.finlab_exam_get((session->>'id')::uuid,null); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'cross-user exam read'; end if;
 blocked:=false;
 begin perform public.finlab_exam_submit((session->>'id')::uuid,'{}',null); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'cross-user exam submit'; end if;
 blocked:=false;
 begin perform public.finlab_exam_draft((session->>'id')::uuid,'{}',0,null); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'cross-user exam draft'; end if;
 blocked:=false;
 begin perform 1 from finlab.exam_bank; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'bank readable by client'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$
declare session jsonb; again jsonb; answers jsonb; blocked boolean:=false;
begin
 session:=public.finlab_exam_start('m3','65000000-0000-4000-8000-000000000003','66000000-0000-4000-8000-000000000003');
 insert into finlab_v2_fixtures values('guest-exam',session);
 if session ? 'guestToken' then raise exception 'server exposed guest secret'; end if;
 again:=public.finlab_exam_start('m3','65000000-0000-4000-8000-000000000003','66000000-0000-4000-8000-000000000003');
 if again->>'id'<>session->>'id' then raise exception 'guest idempotent start failed'; end if;
 begin perform public.finlab_exam_start('m3','65000000-0000-4000-8000-000000000003','66000000-0000-4000-8000-000000000004'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'known guest request leaked without capability'; end if;
 blocked:=false;
 begin perform public.finlab_exam_get((session->>'id')::uuid,null); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'guest exam readable without secret'; end if;
 session:=public.finlab_exam_draft((session->>'id')::uuid,jsonb_build_object(session->'questions'->0->>'id','10'),2,'66000000-0000-4000-8000-000000000003');
 if public.finlab_exam_get((session->>'id')::uuid,'66000000-0000-4000-8000-000000000003')->'position'<>'2' then raise exception 'guest draft resume failed'; end if;
 select value into answers from finlab_v2_fixtures where key='m3:'||(session->>'variant');
 session:=public.finlab_exam_submit((session->>'id')::uuid,answers,'66000000-0000-4000-8000-000000000003');
 if session->'result'->'score'<>'100' then raise exception 'guest server grade failed'; end if;
 update finlab_v2_fixtures set value=session where key='guest-exam';
 blocked:=false;
 begin perform public.finlab_learning_load(); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'anon learning history access'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002',true);
do $$
declare session jsonb; claimed jsonb; blocked boolean:=false;
begin
 session:=(select value from finlab_v2_fixtures where key='guest-exam');
 begin perform public.finlab_exam_claim((session->>'id')::uuid,'66000000-0000-4000-8000-000000000004'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'wrong capability claimed guest result'; end if;
 claimed:=public.finlab_exam_claim((session->>'id')::uuid,'66000000-0000-4000-8000-000000000003');
 if claimed->'result'<>session->'result' then raise exception 'claim changed grade'; end if;
 if jsonb_array_length(public.finlab_learning_load()->'examResults')<>1 then raise exception 'claimed result not visible to account'; end if;
 if public.finlab_exam_get((session->>'id')::uuid,null)->'result'<>session->'result' then raise exception 'owner cannot resume claimed exam'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$
declare session jsonb; blocked boolean:=false;
begin
 session:=(select value from finlab_v2_fixtures where key='guest-exam');
 begin perform public.finlab_exam_get((session->>'id')::uuid,'66000000-0000-4000-8000-000000000003'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'guest token not revoked on claim'; end if;
end $$;
reset role;
select 'PASS: legacy preservation, v2 append/dedup/RLS/LWW, time bounds, protected bank/grades, ownership/capabilities, immutable submit, roundrobin, drafts/device resume, guest claim/token revocation, exact80 threshold' as finlab_v2_security_checks;
rollback;
