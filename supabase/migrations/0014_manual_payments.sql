-- =========================================================
-- 0014_manual_payments.sql
-- Lets an admin record money received outside M-Pesa prompts: cash, bank
-- transfer, or an M-Pesa payment made some other way. Without this, such
-- guests show as still owing in Admin -> Reports and on self-pay.
--
-- Manual rows are created already 'success' and have no checkout id or
-- phone. M-Pesa rows keep their existing rules. Only manual rows can be
-- deleted (to fix a typo); M-Pesa rows are a record of what Safaricom
-- reported and stay put.
-- =========================================================

alter table payments
  add column method text not null default 'mpesa'
    check (method in ('mpesa', 'cash', 'bank', 'other')),
  add column note text check (note is null or char_length(note) <= 200);

alter table payments alter column checkout_request_id drop not null;
alter table payments alter column phone drop not null;

-- M-Pesa rows still need their Safaricom identifiers.
alter table payments
  add constraint payments_mpesa_fields check (
    method <> 'mpesa' or (checkout_request_id is not null and phone is not null)
  );

alter table payments
  add constraint payments_manual_amount check (method = 'mpesa' or amount <= 10000000);

drop policy "payments_insert_admin" on payments;
create policy "payments_insert_admin"
  on payments for insert
  with check (
    is_admin()
    and (
      (method = 'mpesa' and status = 'pending')
      or (method <> 'mpesa' and status = 'success' and checkout_request_id is null)
    )
  );

create policy "payments_delete_admin_manual"
  on payments for delete
  using (is_admin() and method <> 'mpesa');
