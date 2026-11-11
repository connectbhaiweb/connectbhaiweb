-- Search on the admin lists (name / phone / reference code) used LIKE '%text%', which reads the whole table.
-- An ngram full-text index finds the same matches (any fragment of 2+ characters, including the middle digits of a phone number) from an index.
-- Prisma cannot describe "WITH PARSER ngram", so these two indexes live only in this migration. If `prisma migrate dev` ever proposes to drop them, keep them.
ALTER TABLE `leads` ADD FULLTEXT INDEX `ft_lead_search` (`customer_name`, `customer_phone`, `ref_code`) WITH PARSER ngram;
ALTER TABLE `users` ADD FULLTEXT INDEX `ft_user_search` (`name`, `phone`, `partner_code`) WITH PARSER ngram;
