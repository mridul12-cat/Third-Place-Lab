import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
// Aggregate request counts only: no API credentials, IPs, venue profiles, or Qloo data.
export const qlooRequestBudget=sqliteTable('qloo_request_budget',{
 id:text('id').primaryKey(),utcDay:integer('utc_day').notNull(),dayCount:integer('day_count').notNull(),
 utcMinute:integer('utc_minute').notNull(),minuteCount:integer('minute_count').notNull(),
});
