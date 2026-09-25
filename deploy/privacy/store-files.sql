-- Deleting a store on request (docs/phase2/DEPLOY.md, section 10). Run in psql
-- after: \set seller_id 'cm...'  -- read-only: prints storage keys, never personal data.
-- 1) Files of this store, as storage keys (no personal data). Keep the output for step 3.
SELECT 'public' AS bucket, substring("imageUrl" FROM '^/uploads/(.*)$') AS key
  FROM "Product" WHERE "sellerId" = :'seller_id' AND "imageUrl" LIKE '/uploads/%'
UNION ALL
SELECT 'public', substring("logoUrl" FROM '^/uploads/(.*)$')
  FROM "Seller" WHERE id = :'seller_id' AND "logoUrl" LIKE '/uploads/%'
UNION ALL
SELECT 'private', "receiptImageUrl"
  FROM "Order" WHERE "sellerId" = :'seller_id' AND "receiptImageUrl" IS NOT NULL;
