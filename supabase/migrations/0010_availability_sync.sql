-- =========================================================
-- 0010_availability_sync.sql
-- Keeps the public availability calendar in step with bookings.
--
-- Before this, booking_blocks only changed if someone inserted rows by
-- hand, so confirming a booking never made its dates unavailable. Now:
--   * confirming a booking creates a block for its dates,
--   * moving it to any other status (cancelled, completed, back to
--     pending...) removes that block,
--   * confirming dates that overlap an existing block is refused, so two
--     bookings can't be confirmed for the same nights.
-- Admins can still add their own blocks (owner stays, maintenance) in
-- Admin -> Properties -> Edit -> Availability; those have no booking_id.
--
-- NOTE: booking_blocks is publicly readable (the site greys out dates),
-- so `reason` must stay generic. Auto-created blocks use just "Booked".
-- =========================================================

alter table booking_blocks
  add column booking_id uuid references bookings(id) on delete cascade;

create unique index uq_booking_blocks_booking
  on booking_blocks (booking_id) where booking_id is not null;

create or replace function sync_booking_block()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'confirmed' and new.property_id is not null then
    if exists (
      select 1 from booking_blocks b
      where b.property_id = new.property_id
        and b.booking_id is distinct from new.id
        and b.start_date < new.check_out
        and b.end_date > new.check_in
    ) then
      raise exception 'Those dates are already booked or blocked for this property.'
        using errcode = '23P01';
    end if;

    delete from booking_blocks where booking_id = new.id;
    insert into booking_blocks (property_id, start_date, end_date, reason, booking_id)
    values (new.property_id, new.check_in, new.check_out, 'Booked', new.id);
  else
    delete from booking_blocks where booking_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_bookings_sync_block
  after insert or update of status, check_in, check_out, property_id on bookings
  for each row execute function sync_booking_block();

-- Backfill: bookings already confirmed before this migration.
insert into booking_blocks (property_id, start_date, end_date, reason, booking_id)
select b.property_id, b.check_in, b.check_out, 'Booked', b.id
from bookings b
where b.status = 'confirmed'
  and b.property_id is not null
  and not exists (select 1 from booking_blocks x where x.booking_id = b.id);
