-- READ-ONLY audit. No data rows or passwords are selected.
BEGIN READ ONLY;
WITH expected(name) AS (VALUES
  ('users_profile'),
  ('customers'),
  ('vendors'),
  ('items'),
  ('bom_items'),
  ('orders'),
  ('deliveries'),
  ('delivery_items'),
  ('work_orders'),
  ('process_logs'),
  ('production_logs'),
  ('process_steps'),
  ('defect_types'),
  ('setup_types'),
  ('surface_treatments'),
  ('company_settings'),
  ('print_templates')
), objects AS (
 SELECT e.name,c.oid,c.relrowsecurity,c.relacl,pg_get_userbyid(c.relowner) owner
 FROM expected e LEFT JOIN pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.name AND c.relkind IN ('r','p')
)
SELECT name,oid IS NOT NULL AS exists,owner,relrowsecurity,relacl,
 CASE WHEN oid IS NOT NULL THEN has_table_privilege('authenticated',oid,'SELECT') END AS auth_select,
 CASE WHEN oid IS NOT NULL THEN has_table_privilege('authenticated',oid,'INSERT') END AS auth_insert,
 CASE WHEN oid IS NOT NULL THEN has_table_privilege('authenticated',oid,'UPDATE') END AS auth_update,
 CASE WHEN oid IS NOT NULL THEN has_table_privilege('authenticated',oid,'DELETE') END AS auth_delete,
 CASE WHEN oid IS NOT NULL THEN has_table_privilege('anon',oid,'SELECT') END AS anon_select
FROM objects ORDER BY name;
SELECT nspname,nspacl,has_schema_privilege('authenticated',oid,'USAGE') auth_usage
FROM pg_namespace WHERE nspname='public';
SELECT pg_get_userbyid(d.defaclrole) creator,coalesce(n.nspname,'<global>') schema,
 d.defaclobjtype,d.defaclacl FROM pg_default_acl d
 LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE n.nspname='public' OR d.defaclnamespace=0;
SELECT tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='S';
ROLLBACK;
