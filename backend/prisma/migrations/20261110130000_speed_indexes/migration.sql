-- Indexes for the admin lists/badges, the customer lead scope and the background reminder queries.
CREATE INDEX `ix_lead_status` ON `leads`(`status`, `id`);
CREATE INDEX `ix_lead_cust` ON `leads`(`customer_user_id`);
CREATE INDEX `ix_lead_status_upd` ON `leads`(`status`, `updated_at`);
CREATE INDEX `ix_bk_status` ON `bookings`(`status`, `scheduled_at`);
CREATE INDEX `ix_nt_tpl_user` ON `notifications`(`template`, `user_id`);
CREATE INDEX `ix_user_pstatus` ON `users`(`partner_status`, `created_at`);
CREATE INDEX `ix_ch_status` ON `charges`(`status`, `kind`, `created_at`);
