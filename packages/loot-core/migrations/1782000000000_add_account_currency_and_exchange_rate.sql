BEGIN TRANSACTION;

ALTER TABLE accounts ADD COLUMN currency text;
ALTER TABLE transactions ADD COLUMN exchange_rate real;

COMMIT;
