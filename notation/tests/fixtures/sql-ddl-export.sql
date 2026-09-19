-- DDN SQL DDL export · TEXT columns · declaration order · synthetic illustrative DDL, not a deployable schema

CREATE TABLE customer (
  customer_id TEXT,
  display_name TEXT,
  PRIMARY KEY (customer_id)
);

CREATE TABLE purchase (
  purchase_id TEXT,
  customer_id TEXT,
  ordered_on TEXT,
  PRIMARY KEY (purchase_id),
  FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
);

-- skipped: ddn.examples.sql-ddl::shop.note (kind note is not table)
-- skipped: ddn.examples.sql-ddl::shop.note_customer (endpoint is not an exported table)
