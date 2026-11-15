-- The Telephone number and Order No. a DSA (or admin) enters when assigning the TIP to a booked lead.
-- AlterTable
ALTER TABLE `leads` ADD COLUMN `telephone_no` VARCHAR(11) NULL,
    ADD COLUMN `order_no` VARCHAR(11) NULL;
