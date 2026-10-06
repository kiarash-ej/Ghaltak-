-- Deleting a store on request (docs/phase2/DEPLOY.md, section 10). Run in psql
-- after: \set seller_id 'cm...'  -- ends with the transaction OPEN: check, then COMMIT.
-- TrialGrant is kept on purpose: one free trial per mobile (A9).
-- 2) Delete the store and everything in it, in one transaction.
BEGIN;
SET LOCAL statement_timeout = '60s';
CREATE TEMP TABLE gone ON COMMIT DROP AS
  SELECT s.id, s.mobile, array(SELECT m."userId" FROM "Membership" m WHERE m."sellerId" = s.id) AS users
  FROM "Seller" s WHERE s.id = :'seller_id';
DELETE FROM "PaymentAttempt" WHERE "sellerId" = :'seller_id';
DELETE FROM "SmsMessage"
  WHERE "sellerId" = :'seller_id'
     OR "orderId" IN (SELECT id FROM "Order" WHERE "sellerId" = :'seller_id')
     OR ("sellerId" IS NULL AND "to" = (SELECT mobile FROM gone));
DELETE FROM "Order" WHERE "sellerId" = :'seller_id';              -- and its items
DELETE FROM "Invoice" WHERE "sellerId" = :'seller_id';
DELETE FROM "PurchaseLink" WHERE "sellerId" = :'seller_id';       -- and its daily views and product list
DELETE FROM "Customer" WHERE "sellerId" = :'seller_id';
DELETE FROM "ProductVariant" WHERE "sellerId" = :'seller_id';     -- and its stock history
DELETE FROM "Product" WHERE "sellerId" = :'seller_id';
DELETE FROM "OtpCode" WHERE mobile = (SELECT mobile FROM gone);
DELETE FROM "Seller" WHERE id = :'seller_id';                     -- and memberships, sessions, subscription, gateway
DELETE FROM "User" u
  WHERE u.id = ANY ((SELECT users FROM gone)::text[])
    AND NOT EXISTS (SELECT 1 FROM "Membership" m WHERE m."userId" = u.id);  -- keep people who belong to another store
SELECT
  (SELECT count(*) FROM gone) AS stores_deleted,
  (SELECT count(*) FROM "Seller" WHERE id = :'seller_id')
  + (SELECT count(*) FROM "Order" WHERE "sellerId" = :'seller_id')
  + (SELECT count(*) FROM "Customer" WHERE "sellerId" = :'seller_id')
  + (SELECT count(*) FROM "Product" WHERE "sellerId" = :'seller_id') AS rows_left;
-- Check: stores_deleted = 1 and rows_left = 0. Then type COMMIT; (or ROLLBACK; to undo).
