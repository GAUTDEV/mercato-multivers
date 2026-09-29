import {integer,sqliteTable,text,index} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('rooms',{code:text('code').primaryKey(),version:integer('version').notNull(),state:text('state').notNull(),updatedAt:integer('updated_at').notNull()},(t)=>[index('idx_rooms_updated_at').on(t.updatedAt)]);
export const rateLimits=sqliteTable('rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()});
