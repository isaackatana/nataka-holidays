\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on
grant all on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated;
-- Run after reviews_rules.sql and experience_requests_rules.sql (they create the users, experiences and requests).
update profiles set full_name='Amina Kamau' where id='00000000-0000-0000-0000-00000000000a';

\echo === X1 guest A cannot review a request that is not completed
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
insert into experience_reviews (experience_id,customer_id,request_id,rating) values ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-0000000000a1',5);
reset role;

\echo === X2 admin marks the request completed, as the business would
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ad',false) \gset
update experience_requests set status='completed' where id='50000000-0000-0000-0000-0000000000a1';
reset role;

\echo === X3 now A can review it; tries to send status=approved, a reply and a fake name
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
insert into experience_reviews (id,experience_id,customer_id,request_id,rating,comment,status,owner_reply,reviewer_name) values ('60000000-0000-0000-0000-0000000000a1','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-0000000000a1',5,'Wonderful trip','approved','fake reply','FAKE');
select 'X3 status='||status||' reply='||coalesce(owner_reply,'NULL')||' name='||reviewer_name from experience_reviews where id='60000000-0000-0000-0000-0000000000a1';

\echo === X4 second review for the same request is refused
insert into experience_reviews (experience_id,customer_id,request_id,rating) values ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-0000000000a1',4);

\echo === X5 wrong experience for that request is refused
insert into experience_reviews (experience_id,customer_id,request_id,rating) values ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-0000000000a1',4);

\echo === X6 comment over 1000 characters refused
insert into experience_reviews (experience_id,customer_id,request_id,rating,comment) values ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-0000000000a1',4,repeat('x',1001));

\echo === X7 guest B cannot review another guest request, and cannot see their pending review
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false) \gset
insert into experience_reviews (experience_id,customer_id,request_id,rating) values ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','50000000-0000-0000-0000-0000000000a1',1);
select 'X7 B sees='||count(*) from experience_reviews;
reset role;

\echo === X8 anon sees nothing while pending; stats empty
set role anon; select set_config('request.jwt.claim.sub','',false) \gset
select 'X8 anon sees='||count(*) from experience_reviews;
select 'X8 stats rows='||count(*) from experience_rating_stats();
reset role;

\echo === X9 A cannot self-approve or write a reply by editing; edit keeps pending
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
update experience_reviews set status='approved', owner_reply='hax', reviewer_name='Hacker', rating=4 where id='60000000-0000-0000-0000-0000000000a1';
select 'X9 status='||status||' reply='||coalesce(owner_reply,'NULL')||' name='||reviewer_name||' rating='||rating from experience_reviews where id='60000000-0000-0000-0000-0000000000a1';
reset role;

\echo === X10 admin approves and replies; public sees it with stats
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ad',false) \gset
update experience_reviews set status='approved', owner_reply='Asante sana!', owner_replied_at=now() where id='60000000-0000-0000-0000-0000000000a1';
reset role; set role anon; select set_config('request.jwt.claim.sub','',false) \gset
select 'X10 anon sees='||count(*)||' reply='||max(owner_reply)||' name='||max(reviewer_name) from experience_reviews;
select 'X10 stats '||average||' / '||review_count from experience_rating_stats();
reset role;

\echo === X11 reply survives A editing the text; A cannot delete
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
update experience_reviews set comment='Edited comment' where id='60000000-0000-0000-0000-0000000000a1';
select 'X11 status='||status||' reply='||coalesce(owner_reply,'NULL') from experience_reviews where id='60000000-0000-0000-0000-0000000000a1';
delete from experience_reviews where id='60000000-0000-0000-0000-0000000000a1';
select 'X11 still exists='||count(*) from experience_reviews where id='60000000-0000-0000-0000-0000000000a1';
reset role;
