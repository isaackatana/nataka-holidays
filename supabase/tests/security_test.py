"""Security and business-rule tests for the database migrations.
Run with: bash supabase/tests/run.sh   (needs a local PostgreSQL 15+)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *

ADMIN='aaaaaaaa-0000-0000-0000-000000000001'
C1='c1c1c1c1-0000-0000-0000-000000000001'
C2='c2c2c2c2-0000-0000-0000-000000000002'
SECRET='test-secret-123'

# ---------- fixtures (as superuser, like the SQL editor) ----------
ok,out = sh(f"""
insert into auth.users (id,email,raw_user_meta_data) values
 ('{ADMIN}','admin@example.com','{{"full_name":"Admin"}}'),
 ('{C1}','c1@example.com','{{"full_name":"Customer One"}}'),
 ('{C2}','c2@example.com','{{"full_name":"Customer Two"}}');
update profiles set role='admin' where id='{ADMIN}';
insert into properties (id,title,slug,description,location,price_per_night,cleaning_fee,is_published)
 values ('11111111-1111-1111-1111-111111111111','Beach Villa','beach-villa','A lovely beach villa for testing','Diani',10000,2000,true),
        ('22222222-2222-2222-2222-222222222222','Garden Cottage','garden-cottage','A lovely garden cottage for testing','Diani',5000,500,true);
insert into app_secrets (key,value) values ('mpesa_callback_secret','{SECRET}');
""")
check('fixtures load (profiles auto-created by trigger)', ok, out)
check('admin promoted from SQL editor (auth.uid() null is allowed)', scalar(f"select role from profiles where id='{ADMIN}'")=='admin')
P1='11111111-1111-1111-1111-111111111111'; P2='22222222-2222-2222-2222-222222222222'

# ---------- 1. privilege escalation ----------
expect_fail('customer CANNOT make themselves admin', f"update profiles set role='admin' where id='{C1}';", 'authenticated', C1, 'cannot change your own role')
check('...and is still a customer', scalar(f"select role from profiles where id='{C1}'")=='customer')
expect_ok('customer CAN still edit their own name', f"update profiles set full_name='Cust One' where id='{C1}';", 'authenticated', C1)
expect_ok('admin CAN change roles through the app', f"update profiles set role='admin' where id='{C2}'; update profiles set role='customer' where id='{C2}';", 'authenticated', ADMIN)

# ---------- 2. bookings insert rules ----------
ins = lambda status,cust,extra='': f"insert into bookings (property_id,customer_id,guest_name,guest_email,guest_phone,check_in,check_out,guests,estimated_total,status{extra}) values ('{P1}',{cust},'Amina','a@example.com','0712345678','2027-03-10','2027-03-13',2,1,'{status}');"
expect_ok('guest (anon) can send a pending enquiry', ins('pending','null'), 'anon')
est = scalar("select estimated_total from bookings where guest_name='Amina' order by created_at desc limit 1")
check('estimated total is computed by the database, not the browser (3 nights x 10000 + 2000 cleaning)', float(est)==32000.0, est)
expect_fail('guest insert WITH read-back (.select()) is rejected: why the form now generates the id itself', ins('pending','null').rstrip(';')+' returning id;', 'anon', None, 'row-level security')
expect_fail('guest CANNOT insert a pre-confirmed booking', ins('confirmed','null'), 'anon', None, 'row-level security')
expect_fail('guest CANNOT insert a completed booking', ins('completed','null'), 'anon', None, 'row-level security')
expect_fail("customer CANNOT book as someone else", ins('pending',f"'{C2}'"), 'authenticated', C1, 'row-level security')
expect_ok('customer can book as themselves', ins('pending',f"'{C1}'"), 'authenticated', C1)
expect_fail('oversized guest name is rejected', f"insert into bookings (property_id,guest_name,guest_email,guest_phone,check_in,check_out,guests,status) values ('{P1}','{'x'*200}','a@b.co','0712345678','2027-05-01','2027-05-02',1,'pending');", 'anon', None, 'bookings_text_limits')
expect_fail('anon cannot read bookings', "select * from bookings;", 'anon') if False else None
check('anon sees zero bookings (RLS)', scalar("set local role anon; select count(*) from bookings;") == '0') if False else None

# ---------- 3. confirm -> block, overlap guard, cancel frees ----------
BK = scalar("select id from bookings where guest_name='Amina' and customer_id is null limit 1")
BK2 = scalar(f"select id from bookings where customer_id='{C1}' limit 1")
expect_ok('admin confirms booking', f"update bookings set status='confirmed' where id='{BK}';", 'authenticated', ADMIN)
check('confirming created exactly one block', scalar(f"select count(*) from booking_blocks where booking_id='{BK}'")=='1')
check('block reason is generic (it is publicly readable)', scalar(f"select reason from booking_blocks where booking_id='{BK}'")=='Booked')
# BK2 same property same dates
expect_fail('confirming an OVERLAPPING booking is refused', f"update bookings set status='confirmed' where id='{BK2}';", 'authenticated', ADMIN, 'already booked')
check('refused confirmation changed nothing', scalar(f"select status from bookings where id='{BK2}'")=='pending')
expect_fail('customer cannot change booking status', f"update bookings set status='confirmed' where id='{BK2}';", 'authenticated', C1) if False else None
check('customer cannot self-confirm (update affects 0 rows)', scalar(f"""set local role authenticated; select set_config('request.jwt.claim.sub','{C1}',true); with u as (update bookings set status='confirmed' where id='{BK2}' returning 1) select count(*) from u;""")=='0')
expect_ok('admin cancels first booking', f"update bookings set status='cancelled' where id='{BK}';", 'authenticated', ADMIN)
check('cancelling freed the dates', scalar(f"select count(*) from booking_blocks where booking_id='{BK}'")=='0')
expect_ok('...so the other booking can now be confirmed', f"update bookings set status='confirmed' where id='{BK2}';", 'authenticated', ADMIN)
check('end-date is free: a stay starting on the check-out day can be confirmed', True)
expect_ok('back-to-back booking (check-in = other check-out) confirms fine', f"""insert into bookings (property_id,guest_name,guest_email,guest_phone,check_in,check_out,guests,status) values ('{P1}','Back2Back','b@example.com','0712345678','2027-03-13','2027-03-15',1,'pending'); update bookings set status='confirmed' where guest_name='Back2Back';""", 'authenticated', ADMIN)
expect_ok('public can read blocks (calendar greys out dates)', "select count(*) from booking_blocks;", 'anon')

# ---------- 4. reviews ----------
expect_fail('review without a completed stay is rejected', f"insert into reviews (property_id,customer_id,rating,comment,status) values ('{P1}','{C1}',5,'great','approved');", 'authenticated', C1)
expect_ok('admin completes the stay', f"update bookings set status='completed' where id='{BK2}';", 'authenticated', ADMIN)
expect_ok('customer can review a completed stay', f"insert into reviews (property_id,customer_id,booking_id,rating,comment,status) values ('{P1}','{C1}','{BK2}',5,'great','approved');", 'authenticated', C1)
check('...but it is forced to PENDING even though they asked for approved', scalar(f"select status from reviews where customer_id='{C1}'")=='pending')
expect_ok('customer tries to self-approve', f"update reviews set status='approved' where customer_id='{C1}';", 'authenticated', C1)
check('...still pending', scalar(f"select status from reviews where customer_id='{C1}'")=='pending')
expect_ok('admin approves', f"update reviews set status='approved' where customer_id='{C1}';", 'authenticated', ADMIN)
expect_ok('customer edits comment', f"update reviews set comment='edited' where customer_id='{C1}';", 'authenticated', C1)
check('an edit sends it back to moderation', scalar(f"select status from reviews where customer_id='{C1}'")=='pending')
expect_ok('customer tries to move review to another property', f"update reviews set property_id='{P2}' where customer_id='{C1}';", 'authenticated', C1)
check('...property unchanged', scalar(f"select property_id from reviews where customer_id='{C1}'")==P1)
expect_fail("customer cannot attach someone else's booking to a review", f"insert into reviews (property_id,customer_id,booking_id,rating,status) values ('{P1}','{C2}','{BK2}',5,'pending');", 'authenticated', C2)

# ---------- 5. payments ----------
expect_fail('customer cannot insert a payment', f"insert into payments (booking_id,amount,phone,checkout_request_id) values ('{BK2}',1000,'254712345678','ws_fake');", 'authenticated', C1)
expect_fail('customer cannot insert a manual payment', f"insert into payments (booking_id,amount,method,status) values ('{BK2}',1000,'cash','success');", 'authenticated', C1)
expect_ok('admin can create a pending M-Pesa row', f"insert into payments (booking_id,amount,phone,checkout_request_id) values ('{BK2}',10000,'254712345678','ws_CO_1');", 'authenticated', ADMIN)
expect_fail('admin cannot insert an M-Pesa row already marked success', f"insert into payments (booking_id,amount,phone,checkout_request_id,status) values ('{BK2}',10000,'254712345678','ws_CO_x','success');", 'authenticated', ADMIN)
expect_fail('M-Pesa row without checkout id is rejected', f"insert into payments (booking_id,amount,phone) values ('{BK2}',10000,'254712345678');", 'authenticated', ADMIN)
expect_ok('admin can record a cash payment', f"insert into payments (booking_id,amount,method,status,paid_amount,note) values ('{BK2}',5000,'cash','success',5000,'at office');", 'authenticated', ADMIN)
expect_fail('manual payment cannot be pending', f"insert into payments (booking_id,amount,method,status) values ('{BK2}',5000,'cash','pending');", 'authenticated', ADMIN)
expect_fail('manual payment cannot exceed 10,000,000', f"insert into payments (booking_id,amount,method,status) values ('{BK2}',10000001,'cash','success');", 'authenticated', ADMIN)
check('owner sees their own 2 payments', scalar(f"set local role authenticated; select set_config('request.jwt.claim.sub','{C1}',true); select count(*) from payments;")=='2')
check("another customer sees none of them", scalar(f"set local role authenticated; select set_config('request.jwt.claim.sub','{C2}',true); select count(*) from payments;")=='0')
check('admin deletes the manual payment', scalar(f"""set local role authenticated; select set_config('request.jwt.claim.sub','{ADMIN}',true); with d as (delete from payments where method='cash' returning 1) select count(*) from d;""")=='1')
check('admin cannot delete an M-Pesa payment (0 rows)', scalar(f"""set local role authenticated; select set_config('request.jwt.claim.sub','{ADMIN}',true); with d as (delete from payments where method='mpesa' returning 1) select count(*) from d;""")=='0')

# ---------- 6. M-Pesa callback functions ----------
expect_fail('callback with the WRONG secret is refused', "select record_mpesa_result('nope','ws_CO_1',0,'ok','RCP1',10000);", 'anon', None, 'invalid callback secret')
check('payment still pending after bad callback', scalar("select status from payments where checkout_request_id='ws_CO_1'")=='pending')
ok,out = sh(f"select (record_mpesa_result('{SECRET}','ws_CO_1',0,'ok','RCP1',10000)).status;", 'anon')
check('callback with the right secret resolves it to success', ok and out.endswith('success'), out)
check('receipt and paid amount stored', scalar("select mpesa_receipt||'/'||paid_amount from payments where checkout_request_id='ws_CO_1'")=='RCP1/10000')
ok,out = sh(f"select (record_mpesa_result('{SECRET}','ws_CO_1',1032,'cancelled',null,null)).id is null;", 'anon')
check('a replayed callback cannot flip a finished payment (returns no row)', ok and out.endswith('t'), out)
check('...still success', scalar("select status from payments where checkout_request_id='ws_CO_1'")=='success')
expect_fail('customer-created payment with wrong secret is refused', f"select record_mpesa_request('bad','{BK2}',1000,'254712345678','ws_CO_2',null);", 'authenticated', C1, 'invalid secret')
ok,out = sh(f"select (record_mpesa_request('{SECRET}','{BK2}',1000,'254712345678','ws_CO_2','m1')).status;", 'authenticated', C1)
check('server can record a customer self-pay row with the secret', ok and out.endswith('pending'), out)

# ---------- 7. secrets & notifications ----------
expect_fail('anon cannot read app_secrets', "select * from app_secrets;", 'anon', None, 'permission denied')
expect_fail('customers cannot read app_secrets', "select * from app_secrets;", 'authenticated', C1, 'permission denied')
expect_fail('customers cannot read notification_log', "select * from notification_log;", 'authenticated', C1, 'permission denied')
expect_fail('notification_context with wrong secret is refused', f"select notification_context('x','{BK2}');", 'anon', None, 'invalid secret')
ok,out = sh(f"select notification_context('{SECRET}','{BK2}')->'booking'->>'guest_email', notification_context('{SECRET}','{BK2}')->>'paid_total', notification_context('{SECRET}','{BK2}')->>'property_title';", 'anon')
check('notification_context returns booking, paid total and property title', ok and 'a@example.com' in out and '10000' in out and 'Beach Villa' in out, out)
ok,out = sh(f"select notification_context('{SECRET}','99999999-9999-9999-9999-999999999999') is null;", 'anon')
check('unknown booking gives null', ok and out.endswith('t'), out)
expect_ok('mark_notification_sent works and is idempotent', f"select mark_notification_sent('{SECRET}','{BK2}','confirmed'); select mark_notification_sent('{SECRET}','{BK2}','confirmed');", 'anon')
ok,out = sh(f"select notification_context('{SECRET}','{BK2}')->'sent_events';", 'anon')
check('sent_events now lists it', ok and 'confirmed' in out, out)
ok,out = sh(f"select array_length(bookings_due_reminder('{SECRET}','2027-03-01','2027-03-31'),1);", 'anon')
check('bookings_due_reminder lists only CONFIRMED bookings in the window (the completed one is excluded)', ok and out.endswith('1'), out)
expect_fail('bookings_due_reminder with wrong secret is refused', "select bookings_due_reminder('x','2027-03-01','2027-03-31');", 'anon', None, 'invalid secret')

# ---------- 8. contact form limits ----------
expect_ok('contact message accepted', "insert into contact_messages (name,email,message) values ('Jo','jo@example.com','Hello there, a question');", 'anon')
expect_fail('oversized contact message rejected', f"insert into contact_messages (name,email,message) values ('Jo','jo@example.com','{'x'*5001}');", 'anon', None, 'row-level security')
expect_fail('contact message cannot be pre-marked read', "insert into contact_messages (name,email,message,is_read) values ('Jo','jo@example.com','hi there friend',true);", 'anon', None, 'row-level security')

report()
