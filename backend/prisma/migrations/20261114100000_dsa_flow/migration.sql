-- DSA-first lead flow.
-- 1) A booking is made by the DSA before any TIP is chosen, so a booking's TIP is empty until a TIP is assigned.
-- 2) The PIN codes a DSA serves, used to assign new leads to the DSA with the fewest open leads in that PIN code.

-- AlterTable
ALTER TABLE `bookings` MODIFY `tip_user_id` BIGINT UNSIGNED NULL;

-- CreateTable
CREATE TABLE `dsa_pincode_mapping` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pincode` CHAR(6) NOT NULL,
    `dsa_user_id` BIGINT UNSIGNED NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `ix_dsa`(`dsa_user_id`),
    UNIQUE INDEX `uq_dsa_pincode`(`pincode`, `dsa_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `dsa_pincode_mapping` ADD CONSTRAINT `dsa_pincode_mapping_dsa_user_id_fkey` FOREIGN KEY (`dsa_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing DSAs: each serves the PIN code on their profile, so auto-assign has something to work with on day one.
-- (Admin can change a DSA's PIN codes from DSA & TIP > Edit.)
INSERT IGNORE INTO `dsa_pincode_mapping` (`pincode`, `dsa_user_id`, `is_active`)
SELECT `pincode`, `id`, (`partner_status` = 'approved') FROM `users` WHERE `role` = 'dsa' AND `pincode` IS NOT NULL AND `pincode` <> '';
