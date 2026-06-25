BEGIN TRANSACTION;

ALTER TABLE transactions ADD COLUMN budget_amount integer;

COMMIT;
