\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on
grant all on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated;
-- Run after reviews_rules.sql and experience_requests_rules.sql (they create users, experiences, requests).
-- Request 50..0a1 belongs to guest A for "Dhow Trip" (per person, 5000, 2 people = 10000). Set it up fresh:
update experiences set deposit_percent = 30 where id = '40000000-0000-0000-0000-000000000001';
update experience_requests set status='confirmed', deposit_percent=30, estimated_total=10000, agreed_total=null, customer_id='00000000-0000-0000-0000-00000000000a' where id='50000000-0000-0000-0000-0000000000a1';
delete from experience_payments;

\echo === P1 guest A sees the deposit due: 30 percent of 10000 = 3000
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
select 'P1 '||experience_amount_due('50000000-0000-0000-0000-0000000000a1')::text;

\echo === P2 guest B (not the owner) learns nothing
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false) \gset
select 'P2 '||experience_amount_due('50000000-0000-0000-0000-0000000000a1')::text;
select record_experience_payment_request('s3cret','50000000-0000-0000-0000-0000000000a1','254712345678','ws_CO_B1','m1');
reset role;

\echo === P3 guest A saves a prompt: amount forced to 3000, wrong secret refused
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
select record_experience_payment_request('bad','50000000-0000-0000-0000-0000000000a1','254712345678','ws_CO_BAD','m1');
select 'P3 amount='||amount||' status='||status from record_experience_payment_request('s3cret','50000000-0000-0000-0000-0000000000a1','254712345678','ws_CO_1','m1');

\echo === P4 a second prompt within 90 seconds is refused
select record_experience_payment_request('s3cret','50000000-0000-0000-0000-0000000000a1','254712345678','ws_CO_2','m2');

\echo === P5 guest cannot insert, edit or delete payments directly
insert into experience_payments (request_id,amount,checkout_request_id,status) values ('50000000-0000-0000-0000-0000000000a1',1,'hack','success');
update experience_payments set status='success', paid_amount=999999 where checkout_request_id='ws_CO_1';
delete from experience_payments where checkout_request_id='ws_CO_1';
select 'P5 payments visible to A='||count(*)||' status='||max(status) from experience_payments;
reset role;

\echo === P6 callback (anon, secret): success resolves once, replay changes nothing, wrong secret refused
set role anon; select set_config('request.jwt.claim.sub','',false) \gset
select 'P6 first: status='||status||' receipt='||mpesa_receipt from record_experience_payment_result('s3cret','ws_CO_1',0,'ok','QWE123',3000);
select 'P6 replay id is null: '||(id is null)::text from record_experience_payment_result('s3cret','ws_CO_1',1,'fail','X',0);
select record_experience_payment_result('bad','ws_CO_1',0,'ok','Q',3000);
reset role;
select 'P6 stored status='||status||' paid='||paid_amount from experience_payments where checkout_request_id='ws_CO_1';

\echo === P7 after the deposit, the balance 7000 is due
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
select 'P7 '||experience_amount_due('50000000-0000-0000-0000-0000000000a1')::text;
reset role;

\echo === P8 a failed payment does not count; unavailable states
update experience_payments set created_at = now() - interval '5 minutes';
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
select 'P8 saved second prompt amount='||amount from record_experience_payment_request('s3cret','50000000-0000-0000-0000-0000000000a1','254712345678','ws_CO_3','m3');
reset role;
set role anon; select record_experience_payment_result('s3cret','ws_CO_3',1032,'cancelled by user',null,null); reset role;
select 'P8 failed=' || status from experience_payments where checkout_request_id='ws_CO_3';
update experience_requests set status='cancelled' where id='50000000-0000-0000-0000-0000000000a1';
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
select 'P8 cancelled request: '||experience_amount_due('50000000-0000-0000-0000-0000000000a1')::text;
select record_experience_payment_request('s3cret','50000000-0000-0000-0000-0000000000a1','254712345678','ws_CO_4','m4');
reset role;
update experience_requests set status='confirmed', deposit_percent=null where id='50000000-0000-0000-0000-0000000000a1';
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
select 'P8 no deposit set: '||experience_amount_due('50000000-0000-0000-0000-0000000000a1')::text;
reset role;
update experience_requests set deposit_percent=30, estimated_total=null, agreed_total=null where id='50000000-0000-0000-0000-0000000000a1';
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
select 'P8 no total: '||experience_amount_due('50000000-0000-0000-0000-0000000000a1')::text;
reset role;

\echo === P9 admin agrees a different total, records cash, fully paid; guest cannot record cash
update experience_requests set estimated_total=10000, agreed_total=9000 where id='50000000-0000-0000-0000-0000000000a1';
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ad',false) \gset
select 'P9 admin cash: status='||status||' method='||method from admin_record_experience_payment('50000000-0000-0000-0000-0000000000a1', 6000, 'cash', 'paid at the jetty');
select 'P9 admin sees: '||experience_amount_due('50000000-0000-0000-0000-0000000000a1')::text;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
select admin_record_experience_payment('50000000-0000-0000-0000-0000000000a1', 1, 'cash', 'x');
reset role;

\echo === P10 receipt-email context for the successful M-Pesa payment
select 'P10 '||(experience_payment_context('s3cret', (select id from experience_payments where checkout_request_id='ws_CO_1'))->'request'->>'paid')||' paid of '||(experience_payment_context('s3cret', (select id from experience_payments where checkout_request_id='ws_CO_1'))->'request'->>'total');
