-- =========================================================
-- 0007_contact_messages_delete.sql
-- Adds the missing DELETE policy for contact_messages.
--
-- The admin Messages page has always had a delete button, and
-- deleteContactMessage() in services/admin/contactMessages.service.ts
-- issues a real DELETE — but 0003_rls_policies.sql only ever created
-- insert/select/update policies for this table. With RLS enabled and no
-- DELETE policy, Postgres blocks the delete silently: it matches zero
-- rows and returns no error, so the mutation "succeeds", the query cache
-- invalidates, and the message reappears on refetch. Verified against a
-- real Postgres before writing this (admin with is_admin() = true,
-- DELETE 0, row still present).
--
-- Every other admin-managed table already has a delete policy; this was
-- the one table where "admins can manage messages" was never actually
-- expressed in SQL.
-- =========================================================

create policy "contact_messages_delete_admin"
  on contact_messages for delete
  using (is_admin());
