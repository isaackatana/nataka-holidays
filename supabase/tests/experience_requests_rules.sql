\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on
grant all on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated;
update experiences set is_published=true;
insert into experiences (id,title,slug,description,price,price_type,max_group_size,is_published) values
 ('40000000-0000-0000-0000-000000000001','Dhow Trip','dhow-trip','desc',5000,'per_person',6,true),
 ('40000000-0000-0000-0000-000000000002','Private Boat','private-boat','desc',20000,'per_group',null,true),
 ('40000000-0000-0000-0000-000000000003','Old Price Tour','old-price','desc',3000,null,null,true),
 ('40000000-0000-0000-0000-000000000004','Hidden','hidden','desc',100,'per_person',null,false);

\echo === E1 anon, per-person x 3 (expect 15000, status new, even though client sends fake values)
set role anon; select set_config('request.jwt.claim.sub','',false) \gset
insert into experience_requests (id,experience_id,experience_title,guest_name,guest_email,guest_phone,preferred_date,people,estimated_total,status)
 values ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','FAKE','Anon Guest','g@x.com','0711111111', current_date+3, 3, 1, 'confirmed');
reset role;
select 'E1 total='||estimated_total||' status='||status||' title='||experience_title||' customer='||coalesce(customer_id::text,'NULL') from experience_requests where id='50000000-0000-0000-0000-000000000001';

\echo === E2 anon cannot read requests back
set role anon; select 'E2 anon sees='||count(*) from experience_requests;
reset role;

\echo === E3 per-group (expect 20000 for 5 people) and unknown basis (expect null)
set role anon;
insert into experience_requests (id,experience_id,experience_title,guest_name,guest_email,guest_phone,preferred_date,people) values ('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','x','G','g@x.com','0711111111', current_date+1, 5);
insert into experience_requests (id,experience_id,experience_title,guest_name,guest_email,guest_phone,preferred_date,people) values ('50000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003','x','G','g@x.com','0711111111', current_date+1, 2);
reset role;
select 'E3 '||experience_title||' total='||coalesce(estimated_total::text,'NULL') from experience_requests where id in ('50000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000003') order by experience_title;

\echo === E4 refusals (each should ERROR)
set role anon;
insert into experience_requests (experience_id,experience_title,guest_name,guest_email,guest_phone,preferred_date,people) values ('40000000-0000-0000-0000-000000000001','x','G','g@x.com','0711111111', current_date-1, 2);
insert into experience_requests (experience_id,experience_title,guest_name,guest_email,guest_phone,preferred_date,people) values ('40000000-0000-0000-0000-000000000001','x','G','g@x.com','0711111111', current_date+2, 7);
insert into experience_requests (experience_id,experience_title,guest_name,guest_email,guest_phone,preferred_date,people) values ('40000000-0000-0000-0000-000000000004','x','G','g@x.com','0711111111', current_date+2, 2);
insert into experience_requests (experience_id,experience_title,guest_name,guest_email,guest_phone,preferred_date,people) values ('40000000-0000-0000-0000-000000000001','x','G','g@x.com','0711111111', current_date+2, 0);
insert into experience_requests (experience_id,experience_title,guest_name,guest_email,guest_phone,preferred_date,people,message) values ('40000000-0000-0000-0000-000000000001','x','G','g@x.com','0711111111', current_date+2, 2, repeat('x',1001));
reset role;

\echo === E5 signed-in guest A: request is linked to them and they can read only their own
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
insert into experience_requests (id,experience_id,experience_title,guest_name,guest_email,guest_phone,preferred_date,people,customer_id) values ('50000000-0000-0000-0000-0000000000a1','40000000-0000-0000-0000-000000000001','x','Amina','a@x.com','0711111111', current_date+4, 2, '00000000-0000-0000-0000-00000000000b');
select 'E5 A sees='||count(*)||' (own only)' from experience_requests;
select 'E5 customer forced to A: '||(customer_id = '00000000-0000-0000-0000-00000000000a')::text from experience_requests where id='50000000-0000-0000-0000-0000000000a1';
\echo --- guest A tries to self-confirm / delete (expect no change)
update experience_requests set status='confirmed' where id='50000000-0000-0000-0000-0000000000a1';
delete from experience_requests where id='50000000-0000-0000-0000-0000000000a1';
select 'E5 status after attempt='||status from experience_requests where id='50000000-0000-0000-0000-0000000000a1';
reset role;

\echo === E6 admin sees all and can confirm
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ad',false) \gset
select 'E6 admin sees='||count(*) from experience_requests;
update experience_requests set status='confirmed' where id='50000000-0000-0000-0000-000000000001';
select 'E6 status='||status from experience_requests where id='50000000-0000-0000-0000-000000000001';
reset role; select set_config('request.jwt.claim.sub','',false) \gset

\echo === E7 email claim is once-only, needs the secret
set role anon;
select 'E7 wrong secret:'; select claim_experience_request_notification('bad','50000000-0000-0000-0000-000000000002');
select 'E7 first claim='||claim_experience_request_notification('s3cret','50000000-0000-0000-0000-000000000002');
select 'E7 second claim='||claim_experience_request_notification('s3cret','50000000-0000-0000-0000-000000000002');
select release_experience_request_notification('s3cret','50000000-0000-0000-0000-000000000002');
select 'E7 claim after release='||claim_experience_request_notification('s3cret','50000000-0000-0000-0000-000000000002');
select 'E7 context: '||(experience_request_context('s3cret','50000000-0000-0000-0000-000000000002')->'request'->>'estimated_total');
reset role;

\echo === E8 existing columns constraint checks
insert into experiences (title,slug,description,price_type) values ('b','b','d','weekly');
insert into experiences (title,slug,description,category) values ('c','c','d','nonsense');
