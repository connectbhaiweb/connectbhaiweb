-- A speed test now runs in the background: the row is created as 'running' and the job fills in the result.
ALTER TABLE `speed_tests`
    ADD COLUMN `status` ENUM('running', 'done', 'failed') NOT NULL DEFAULT 'done',
    ADD COLUMN `error` VARCHAR(255) NULL;
