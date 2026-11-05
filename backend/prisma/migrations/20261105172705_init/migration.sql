-- CreateTable
CREATE TABLE `cities` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `status` ENUM('live', 'soon', 'hidden') NOT NULL DEFAULT 'soon',

    UNIQUE INDEX `uq_city_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `areas` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `city_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `pincode` CHAR(6) NOT NULL,

    INDEX `ix_pincode`(`pincode`),
    UNIQUE INDEX `uq_area`(`city_id`, `name`, `pincode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tip_pincode_mapping` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pincode` CHAR(6) NOT NULL,
    `tip_user_id` BIGINT UNSIGNED NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `ix_tip`(`tip_user_id`),
    UNIQUE INDEX `uq_tip_pincode`(`pincode`, `tip_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan_categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `type` ENUM('fiber', 'airfiber', 'tv', 'ott', 'sim') NOT NULL DEFAULT 'fiber',
    `logo_url` VARCHAR(255) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uq_cat`(`name`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plans` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `plan_code` VARCHAR(40) NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `speed_mbps` INTEGER NULL,
    `data_limit` VARCHAR(40) NULL,
    `validity_days` INTEGER NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `install_charge` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `router_charge` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `needs_install` BOOLEAN NOT NULL DEFAULT true,
    `has_tv` BOOLEAN NOT NULL DEFAULT false,
    `tv_channels` INTEGER NULL,
    `benefits` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_plan_code`(`plan_code`),
    INDEX `ix_plan_cat`(`category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ott_apps` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `logo_url` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uq_ott`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan_ott_apps` (
    `plan_id` BIGINT UNSIGNED NOT NULL,
    `ott_app_id` BIGINT UNSIGNED NOT NULL,

    INDEX `ix_ott`(`ott_app_id`),
    PRIMARY KEY (`plan_id`, `ott_app_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pincode_plan_mapping` (
    `pincode` CHAR(6) NOT NULL,
    `plan_id` BIGINT UNSIGNED NOT NULL,
    `is_available` BOOLEAN NOT NULL DEFAULT true,

    INDEX `ix_plan`(`plan_id`),
    PRIMARY KEY (`pincode`, `plan_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `role` ENUM('customer', 'dsa', 'tip', 'admin') NOT NULL,
    `partner_code` VARCHAR(30) NULL,
    `name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(15) NOT NULL,
    `email` VARCHAR(160) NULL,
    `password_hash` VARCHAR(255) NULL,
    `city_id` BIGINT UNSIGNED NULL,
    `address` VARCHAR(255) NULL,
    `pincode` CHAR(6) NULL,
    `business_name` VARCHAR(160) NULL,
    `gst_number` VARCHAR(20) NULL,
    `gst_state_code` CHAR(2) NULL,
    `aadhaar_enc` VARBINARY(255) NULL,
    `aadhaar_last4` CHAR(4) NULL,
    `pan_enc` VARBINARY(255) NULL,
    `pan_last4` CHAR(4) NULL,
    `bank_name` VARCHAR(120) NULL,
    `bank_account_enc` VARBINARY(255) NULL,
    `bank_account_last4` CHAR(4) NULL,
    `bank_ifsc` VARCHAR(15) NULL,
    `upi_id` VARCHAR(80) NULL,
    `docs` JSON NULL,
    `partner_status` ENUM('pending', 'approved', 'rejected', 'suspended') NULL,
    `approved_by` BIGINT UNSIGNED NULL,
    `approved_at` DATETIME(3) NULL,
    `is_internal` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_partner_code`(`partner_code`),
    INDEX `ix_role_status`(`role`, `partner_status`),
    UNIQUE INDEX `uq_role_phone`(`role`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_codes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(15) NOT NULL,
    `code_hash` VARCHAR(255) NOT NULL,
    `purpose` ENUM('login', 'signup', 'reset') NOT NULL DEFAULT 'login',
    `attempts` TINYINT NOT NULL DEFAULT 0,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ix_otp_phone`(`phone`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `ref_code` VARCHAR(30) NOT NULL,
    `source` ENUM('website', 'callback', 'dsa', 'admin') NOT NULL DEFAULT 'website',
    `customer_user_id` BIGINT UNSIGNED NULL,
    `customer_name` VARCHAR(120) NOT NULL,
    `customer_phone` VARCHAR(15) NOT NULL,
    `customer_email` VARCHAR(160) NULL,
    `address` VARCHAR(255) NULL,
    `area_id` BIGINT UNSIGNED NULL,
    `pincode` CHAR(6) NOT NULL,
    `plan_id` BIGINT UNSIGNED NULL,
    `brought_by_user_id` BIGINT UNSIGNED NULL,
    `tip_user_id` BIGINT UNSIGNED NULL,
    `status` ENUM('new', 'contacted', 'followup', 'scheduled', 'installed', 'lost', 'cancelled') NOT NULL DEFAULT 'new',
    `followup_at` DATETIME(3) NULL,
    `lost_reason` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `care_plan` BOOLEAN NOT NULL DEFAULT false,
    `care_plan_at` DATETIME(3) NULL,
    `installed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_ref`(`ref_code`),
    INDEX `ix_lead_tip`(`tip_user_id`, `status`),
    INDEX `ix_lead_dsa`(`brought_by_user_id`, `status`),
    INDEX `ix_lead_pin`(`pincode`),
    INDEX `ix_lead_phone`(`customer_phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `lead_id` BIGINT UNSIGNED NOT NULL,
    `actor_user_id` BIGINT UNSIGNED NULL,
    `event_type` VARCHAR(40) NOT NULL,
    `from_status` VARCHAR(20) NULL,
    `to_status` VARCHAR(20) NULL,
    `note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ix_le_lead`(`lead_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `lead_id` BIGINT UNSIGNED NOT NULL,
    `tip_user_id` BIGINT UNSIGNED NOT NULL,
    `scheduled_at` DATETIME(3) NOT NULL,
    `status` ENUM('scheduled', 'completed', 'rescheduled', 'cancelled') NOT NULL DEFAULT 'scheduled',
    `completed_at` DATETIME(3) NULL,
    `connection_id` VARCHAR(60) NULL,
    `router_serial` VARCHAR(60) NULL,
    `router_mac` VARCHAR(20) NULL,
    `notes` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ix_bk_lead`(`lead_id`),
    INDEX `ix_bk_tip`(`tip_user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `dsa_user_id` BIGINT UNSIGNED NOT NULL,
    `lead_id` BIGINT UNSIGNED NOT NULL,
    `booking_id` BIGINT UNSIGNED NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('pending', 'approved', 'paid', 'cancelled') NOT NULL DEFAULT 'pending',
    `approved_by` BIGINT UNSIGNED NULL,
    `approved_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `paid_mode` ENUM('upi', 'bank', 'cash', 'other') NULL,
    `paid_reference` VARCHAR(80) NULL,
    `paid_by` BIGINT UNSIGNED NULL,
    `notes` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_comm_lead`(`lead_id`),
    INDEX `ix_comm_dsa`(`dsa_user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `charges` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `kind` ENUM('tip_onboarding', 'tip_install_fee', 'tip_care_plan_fee', 'customer_payment', 'other') NOT NULL,
    `payer_user_id` BIGINT UNSIGNED NOT NULL,
    `lead_id` BIGINT UNSIGNED NULL,
    `description` VARCHAR(255) NULL,
    `base_amount` DECIMAL(12, 2) NOT NULL,
    `gst_percent` DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    `cgst_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `sgst_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `igst_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('pending', 'paid', 'failed', 'waived', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    `pay_mode` ENUM('razorpay', 'offline') NULL,
    `razorpay_order_id` VARCHAR(60) NULL,
    `razorpay_payment_id` VARCHAR(60) NULL,
    `razorpay_signature` VARCHAR(255) NULL,
    `offline_reference` VARCHAR(80) NULL,
    `recorded_by` BIGINT UNSIGNED NULL,
    `paid_at` DATETIME(3) NULL,
    `invoice_no` VARCHAR(40) NULL,
    `invoice_url` VARCHAR(255) NULL,
    `install_fee_key` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_rzp_order`(`razorpay_order_id`),
    UNIQUE INDEX `uq_invoice`(`invoice_no`),
    UNIQUE INDEX `uq_install_fee`(`install_fee_key`),
    INDEX `ix_ch_payer`(`payer_user_id`, `kind`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `charge_leads` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `charge_id` BIGINT UNSIGNED NOT NULL,
    `lead_id` BIGINT UNSIGNED NOT NULL,
    `base_amount` DECIMAL(12, 2) NOT NULL,

    UNIQUE INDEX `uq_cl_lead`(`lead_id`),
    UNIQUE INDEX `uq_cl_charge_lead`(`charge_id`, `lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tickets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `ticket_code` VARCHAR(30) NOT NULL,
    `lead_id` BIGINT UNSIGNED NULL,
    `raised_by` BIGINT UNSIGNED NOT NULL,
    `assigned_to` BIGINT UNSIGNED NULL,
    `category` ENUM('no_internet', 'slow_speed', 'billing', 'shifting', 'other') NOT NULL DEFAULT 'other',
    `subject` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `priority` ENUM('low', 'normal', 'high') NOT NULL DEFAULT 'normal',
    `status` ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_ticket_code`(`ticket_code`),
    INDEX `ix_tk_raised`(`raised_by`, `status`),
    INDEX `ix_tk_assigned`(`assigned_to`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `thread_type` ENUM('lead', 'support', 'ticket') NOT NULL,
    `thread_id` BIGINT UNSIGNED NOT NULL,
    `sender_user_id` BIGINT UNSIGNED NOT NULL,
    `body` TEXT NULL,
    `attachment_url` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ix_chat_thread`(`thread_type`, `thread_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_reads` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `thread_type` ENUM('lead', 'support', 'ticket') NOT NULL,
    `thread_id` BIGINT UNSIGNED NOT NULL,
    `last_read_message_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`user_id`, `thread_type`, `thread_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `care_plan_devices` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `lead_id` BIGINT UNSIGNED NOT NULL,
    `tip_user_id` BIGINT UNSIGNED NOT NULL,
    `genieacs_device_id` VARCHAR(120) NULL,
    `serial_number` VARCHAR(60) NULL,
    `mac_address` VARCHAR(20) NULL,
    `model` VARCHAR(80) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `online` BOOLEAN NULL,
    `last_seen_at` DATETIME(3) NULL,
    `rx_power_dbm` DECIMAL(5, 2) NULL,
    `wifi_ssid` VARCHAR(64) NULL,
    `connected_clients` INTEGER NULL,
    `last_status` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_cpd_lead`(`lead_id`),
    UNIQUE INDEX `uq_cpd_serial`(`serial_number`),
    INDEX `ix_cpd_tip`(`tip_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_actions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `care_plan_device_id` BIGINT UNSIGNED NOT NULL,
    `requested_by` BIGINT UNSIGNED NOT NULL,
    `action` ENUM('reboot', 'change_wifi', 'factory_reset', 'refresh') NOT NULL,
    `params` JSON NULL,
    `status` ENUM('queued', 'sent', 'done', 'failed') NOT NULL DEFAULT 'queued',
    `error` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `ix_da_dev`(`care_plan_device_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `speed_tests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `care_plan_device_id` BIGINT UNSIGNED NOT NULL,
    `download_mbps` DECIMAL(8, 2) NULL,
    `upload_mbps` DECIMAL(8, 2) NULL,
    `ping_ms` DECIMAL(8, 2) NULL,
    `tested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ix_st_dev`(`care_plan_device_id`, `tested_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `waitlist` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `city_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(120) NULL,
    `phone` VARCHAR(15) NOT NULL,
    `notified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_wait`(`city_id`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `phone` VARCHAR(15) NULL,
    `channel` ENUM('whatsapp', 'sms', 'in_app') NOT NULL DEFAULT 'whatsapp',
    `template` VARCHAR(60) NOT NULL,
    `payload` JSON NULL,
    `status` ENUM('queued', 'sent', 'delivered', 'failed') NOT NULL DEFAULT 'queued',
    `provider_msg_id` VARCHAR(80) NULL,
    `error` VARCHAR(255) NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ix_nt_user`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_settings` (
    `key` VARCHAR(60) NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `description` VARCHAR(255) NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `areas` ADD CONSTRAINT `areas_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tip_pincode_mapping` ADD CONSTRAINT `tip_pincode_mapping_tip_user_id_fkey` FOREIGN KEY (`tip_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plans` ADD CONSTRAINT `plans_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `plan_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_ott_apps` ADD CONSTRAINT `plan_ott_apps_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_ott_apps` ADD CONSTRAINT `plan_ott_apps_ott_app_id_fkey` FOREIGN KEY (`ott_app_id`) REFERENCES `ott_apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pincode_plan_mapping` ADD CONSTRAINT `pincode_plan_mapping_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_customer_user_id_fkey` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_brought_by_user_id_fkey` FOREIGN KEY (`brought_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_tip_user_id_fkey` FOREIGN KEY (`tip_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_events` ADD CONSTRAINT `lead_events_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_events` ADD CONSTRAINT `lead_events_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_tip_user_id_fkey` FOREIGN KEY (`tip_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `commissions_dsa_user_id_fkey` FOREIGN KEY (`dsa_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `commissions_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `commissions_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `charges` ADD CONSTRAINT `charges_payer_user_id_fkey` FOREIGN KEY (`payer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `charges` ADD CONSTRAINT `charges_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `charge_leads` ADD CONSTRAINT `charge_leads_charge_id_fkey` FOREIGN KEY (`charge_id`) REFERENCES `charges`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `charge_leads` ADD CONSTRAINT `charge_leads_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_raised_by_fkey` FOREIGN KEY (`raised_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_sender_user_id_fkey` FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_reads` ADD CONSTRAINT `chat_reads_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `care_plan_devices` ADD CONSTRAINT `care_plan_devices_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `care_plan_devices` ADD CONSTRAINT `care_plan_devices_tip_user_id_fkey` FOREIGN KEY (`tip_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_actions` ADD CONSTRAINT `device_actions_care_plan_device_id_fkey` FOREIGN KEY (`care_plan_device_id`) REFERENCES `care_plan_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_actions` ADD CONSTRAINT `device_actions_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `speed_tests` ADD CONSTRAINT `speed_tests_care_plan_device_id_fkey` FOREIGN KEY (`care_plan_device_id`) REFERENCES `care_plan_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `waitlist` ADD CONSTRAINT `waitlist_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
