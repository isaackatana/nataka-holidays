\set ON_ERROR_STOP off
\pset pager off
\pset format unaligned
\pset tuples_only on
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated;

-- fixtures (superuser)
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','a@x.com'),
 ('00000000-0000-0000-0000-00000000000b','b@x.com'),
 ('00000000-0000-0000-0000-00000000000c','c@x.com'),
 ('00000000-0000-0000-0000-0000000000ad','admin@x.com');
update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000ad';
insert into app_secrets (key, value) values ('mpesa_callback_secret','s3cret');
insert into properties (id,title,slug,description,location,price_per_night,is_published)
 values ('10000000-0000-0000-0000-000000000001','Beach Villa','beach-villa','d','Diani',10000,true);
insert into bookings (id,property_id,customer_id,guest_name,guest_email,guest_phone,check_in,check_out,status) values
 ('20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','A','a@x.com','0700000001', current_date-10, current_date-7,'completed'),
 ('20000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','B','b@x.com','0700000002', current_date-20, current_date-17,'completed'),
 ('20000000-0000-0000-0000-00000000000c','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','C','c@x.com','0700000003', current_date+5, current_date+8,'confirmed');

\echo === T1: guest A reviews own completed stay, tries to send status=approved + owner_reply
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
insert into reviews (id,property_id,customer_id,booking_id,rating,comment,status,owner_reply,owner_replied_at)
 values ('30000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a',5,'Great','approved','fake reply',now());
select 'T1 status='||status||' reply='||coalesce(owner_reply,'NULL') from reviews where id='30000000-0000-0000-0000-00000000000a';

\echo === T2: guest C (confirmed, not completed) cannot review
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false) \gset
insert into reviews (property_id,customer_id,booking_id,rating) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-00000000000c',5);

\echo === T3: guest B cannot review using A's booking
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false) \gset
insert into reviews (property_id,customer_id,booking_id,rating) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-00000000000a',5);

\echo === T4: comment over 1000 chars rejected
insert into reviews (property_id,customer_id,booking_id,rating,comment) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-00000000000b',4, repeat('x',1001));

\echo === T5: B submits valid review
insert into reviews (id,property_id,customer_id,booking_id,rating,comment) values ('30000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-00000000000b',3,'OK');
select 'T5 inserted' ;

\echo === T6: guest A cannot self-approve or set a reply via update
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
update reviews set status='approved', owner_reply='hax' where id='30000000-0000-0000-0000-00000000000a';
select 'T6 status='||status||' reply='||coalesce(owner_reply,'NULL') from reviews where id='30000000-0000-0000-0000-00000000000a';

\echo === T7: anon sees no pending reviews; rating stats empty
reset role; set role anon; select set_config('request.jwt.claim.sub','',false) \gset
select 'T7 anon visible reviews='||count(*) from reviews;
select 'T7 stats rows='||count(*) from property_rating_stats();

\echo === T8: admin approves A and B, adds reply
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ad',false) \gset
update reviews set status='approved' where id in ('30000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000b');
update reviews set owner_reply='Thanks A!', owner_replied_at=now() where id='30000000-0000-0000-0000-00000000000a';
select 'T8 '||id::text||' '||status||' reply='||coalesce(owner_reply,'NULL') from reviews order by rating desc;

\echo === T9: anon sees approved + rating stats (avg of 5 and 3 = 4.0, count 2)
reset role; set role anon;
select 'T9 anon visible reviews='||count(*) from reviews;
select 'T9 stats '||average||' / '||review_count from property_rating_stats();

\echo === T10: guest A photo flow: add 3 ok, 4th rejected; approved review returns to pending
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
insert into review_images (review_id,storage_path) values ('30000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a/p1.webp');
select 'T10 after 1 photo status='||status from reviews where id='30000000-0000-0000-0000-00000000000a';
insert into review_images (review_id,storage_path) values ('30000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a/p2.webp');
insert into review_images (review_id,storage_path) values ('30000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a/p3.webp');
\echo --- 4th photo (expect error)
insert into review_images (review_id,storage_path) values ('30000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a/p4.webp');
select 'T10 photo count='||count(*) from review_images;

\echo === T11: guest A cannot add photo with another guest's folder path
delete from review_images where storage_path like '%p3.webp';
insert into review_images (review_id,storage_path) values ('30000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b/evil.webp');

\echo === T12: guest B cannot attach photo to A's review, and cannot see A's pending review images
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false) \gset
insert into review_images (review_id,storage_path) values ('30000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b/x.webp');
select 'T12 B sees A images='||count(*) from review_images where review_id='30000000-0000-0000-0000-00000000000a';

\echo === T13: anon cannot see pending images; after admin approval can
reset role; set role anon;
select 'T13 anon images while pending='||count(*) from review_images;
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ad',false) \gset
update reviews set status='approved' where id='30000000-0000-0000-0000-00000000000a';
reset role; set role anon;
select 'T13 anon images after approval='||count(*) from review_images;

\echo === T14: guest A deleting own photo re-pends review; guest cannot delete review
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
delete from review_images where storage_path like '%p2.webp';
select 'T14 status after photo removal='||status from reviews where id='30000000-0000-0000-0000-00000000000a';
delete from reviews where id='30000000-0000-0000-0000-00000000000a';
select 'T14 review still exists='||count(*) from reviews where id='30000000-0000-0000-0000-00000000000a';

\echo === T15: owner reply survives guest editing their review text
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ad',false) \gset
update reviews set status='approved' where id='30000000-0000-0000-0000-00000000000a';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
update reviews set comment='Great, edited' where id='30000000-0000-0000-0000-00000000000a';
select 'T15 status='||status||' reply='||coalesce(owner_reply,'NULL') from reviews where id='30000000-0000-0000-0000-00000000000a';

\echo === T16: storage policies
reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false) \gset
insert into storage.objects (bucket_id,name) values ('review-images','00000000-0000-0000-0000-00000000000a/ok.webp');
select 'T16 own folder inserted';
\echo --- other folder (expect error)
insert into storage.objects (bucket_id,name) values ('review-images','00000000-0000-0000-0000-00000000000b/nope.webp');
\echo --- guest C with no completed stay (expect error)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false) \gset
insert into storage.objects (bucket_id,name) values ('review-images','00000000-0000-0000-0000-00000000000c/nope.webp');

\echo === T17: server functions (superuser/anon with secret)
reset role; set role anon;
select 'T17 due review requests (wrong secret): ' ;
select bookings_due_review_request('bad', current_date-14, current_date);
select 'T17 due (right secret, expect none: both reviewed) = '||coalesce(array_length(bookings_due_review_request('s3cret', current_date-14, current_date),1),0);
reset role;
select 'T17 context review: '||(notification_context('s3cret','20000000-0000-0000-0000-00000000000a')->'review')::text;
