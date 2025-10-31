import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, date, decimal, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// ==================== USERS ====================
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  emailVerified: timestamp('email_verified'),
  username: varchar('username', { length: 50 }).unique(),
  password: text('password'), // Hashed password
  name: varchar('name', { length: 255 }),
  image: text('image'),
  bio: text('bio'),

  // Plan and limits
  plan: varchar('plan', { length: 20 }).default('free').notNull(), // free, pro, enterprise
  customerId: varchar('customer_id', { length: 255 }), // Stripe customer ID
  subscriptionId: varchar('subscription_id', { length: 255 }), // Stripe subscription ID
  subscriptionStatus: varchar('subscription_status', { length: 50 }), // active, canceled, past_due

  // Metadata
  metadata: jsonb('metadata').$type<{
    preferences?: Record<string, any>;
    onboardingCompleted?: boolean;
    timezone?: string;
    language?: string;
  }>(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  usernameIdx: index('users_username_idx').on(table.username),
}));

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// ==================== ACCOUNTS (NextAuth) ====================
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: varchar('token_type', { length: 255 }),
  scope: varchar('scope', { length: 255 }),
  id_token: text('id_token'),
  session_state: varchar('session_state', { length: 255 }),
}, (table) => ({
  providerProviderAccountIdIdx: uniqueIndex('accounts_provider_provider_account_id_idx')
    .on(table.provider, table.providerAccountId),
  userIdIdx: index('accounts_user_id_idx').on(table.userId),
}));

// ==================== SESSIONS (NextAuth) ====================
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sessionToken: varchar('session_token', { length: 255 }).unique().notNull(),
  expires: timestamp('expires').notNull(),
}, (table) => ({
  sessionTokenIdx: index('sessions_session_token_idx').on(table.sessionToken),
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
}));

// ==================== VERIFICATION TOKENS (NextAuth) ====================
export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).unique().notNull(),
  expires: timestamp('expires').notNull(),
}, (table) => ({
  identifierTokenIdx: uniqueIndex('verification_tokens_identifier_token_idx')
    .on(table.identifier, table.token),
}));

// ==================== FORMS ====================
export const forms = pgTable('forms', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  publicId: varchar('public_id', { length: 12 }).unique().notNull(),

  // Basic info
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),

  // Form structure and settings
  schema: jsonb('schema').notNull().$type<any>(), // Form structure JSON
  settings: jsonb('settings').notNull().$type<{
    theme?: 'light' | 'dark' | 'auto';
    logo?: string;
    coverImage?: string;
    submitButtonText?: string;
    successMessage?: string;
    redirectUrl?: string;
    notifications?: {
      email?: boolean;
      webhook?: boolean;
    };
    validation?: {
      requiredFields?: string[];
      customValidation?: Record<string, any>;
    };
  }>(),

  // Status and visibility
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft, published, archived
  isPublic: boolean('is_public').default(false).notNull(),
  requireAuth: boolean('require_auth').default(false).notNull(),
  password: varchar('password', { length: 255 }), // For password-protected forms

  // Limits and expiration
  maxSubmissions: integer('max_submissions'),
  submissionCount: integer('submission_count').default(0).notNull(),
  expiresAt: timestamp('expires_at'),
  closedAt: timestamp('closed_at'),

  // Analytics
  viewCount: integer('view_count').default(0).notNull(),
  uniqueViewCount: integer('unique_view_count').default(0).notNull(),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }),
  avgCompletionTime: integer('avg_completion_time'), // in seconds

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'),
  lastSubmissionAt: timestamp('last_submission_at'),
}, (table) => ({
  userIdIdx: index('forms_user_id_idx').on(table.userId),
  publicIdIdx: uniqueIndex('forms_public_id_idx').on(table.publicId),
  statusIdx: index('forms_status_idx').on(table.status),
  createdAtIdx: index('forms_created_at_idx').on(table.createdAt),
}));

export type Form = InferSelectModel<typeof forms>;
export type NewForm = InferInsertModel<typeof forms>;

// ==================== FORM SUBMISSIONS ====================
export const formSubmissions = pgTable('form_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  formId: uuid('form_id').references(() => forms.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  // Submission data
  data: jsonb('data').notNull().$type<Record<string, any>>(),
  files: jsonb('files').$type<Array<{
    fieldName: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }>>(),

  // Metadata
  metadata: jsonb('metadata').$type<{
    ip?: string;
    userAgent?: string;
    referrer?: string;
    country?: string;
    city?: string;
    device?: string;
    browser?: string;
    os?: string;
    sessionId?: string;
  }>(),

  // Status
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, processed, failed, spam

  // Scoring and validation
  spamScore: decimal('spam_score', { precision: 3, scale: 2 }),
  validationErrors: jsonb('validation_errors').$type<Record<string, string[]>>(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
}, (table) => ({
  formIdIdx: index('form_submissions_form_id_idx').on(table.formId),
  userIdIdx: index('form_submissions_user_id_idx').on(table.userId),
  createdAtIdx: index('form_submissions_created_at_idx').on(table.createdAt),
  statusIdx: index('form_submissions_status_idx').on(table.status),
}));

export type FormSubmission = InferSelectModel<typeof formSubmissions>;
export type NewFormSubmission = InferInsertModel<typeof formSubmissions>;

// ==================== FORM TEMPLATES ====================
export const formTemplates = pgTable('form_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  // Template info
  category: varchar('category', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  tags: jsonb('tags').$type<string[]>(),

  // Template content
  schema: jsonb('schema').notNull().$type<any>(),
  settings: jsonb('settings').$type<any>(),
  thumbnail: text('thumbnail_url'),

  // Visibility
  isPublic: boolean('is_public').default(false).notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  isOfficial: boolean('is_official').default(false).notNull(),

  // Usage
  useCount: integer('use_count').default(0).notNull(),
  rating: decimal('rating', { precision: 2, scale: 1 }),
  ratingCount: integer('rating_count').default(0).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index('form_templates_category_idx').on(table.category),
  isPublicIdx: index('form_templates_is_public_idx').on(table.isPublic),
  isFeaturedIdx: index('form_templates_is_featured_idx').on(table.isFeatured),
}));

export type FormTemplate = InferSelectModel<typeof formTemplates>;
export type NewFormTemplate = InferInsertModel<typeof formTemplates>;

// ==================== API KEYS ====================
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  name: varchar('name', { length: 255 }).notNull(),
  key: varchar('key', { length: 64 }).unique().notNull(),
  hashedKey: varchar('hashed_key', { length: 255 }).notNull(),

  // Permissions
  scopes: jsonb('scopes').$type<string[]>().default([]),

  // Usage
  lastUsedAt: timestamp('last_used_at'),
  usageCount: integer('usage_count').default(0).notNull(),

  // Expiration
  expiresAt: timestamp('expires_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
}, (table) => ({
  userIdIdx: index('api_keys_user_id_idx').on(table.userId),
  keyIdx: uniqueIndex('api_keys_key_idx').on(table.key),
}));

export type ApiKey = InferSelectModel<typeof apiKeys>;
export type NewApiKey = InferInsertModel<typeof apiKeys>;

// ==================== WEBHOOKS ====================
export const webhooks = pgTable('webhooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  formId: uuid('form_id').references(() => forms.id, { onDelete: 'cascade' }).notNull(),

  url: text('url').notNull(),
  secret: varchar('secret', { length: 64 }),

  // Events to trigger on
  events: jsonb('events').notNull().$type<string[]>(), // ['submission.created', 'submission.updated']

  // Status
  isActive: boolean('is_active').default(true).notNull(),

  // Delivery stats
  lastTriggeredAt: timestamp('last_triggered_at'),
  successCount: integer('success_count').default(0).notNull(),
  failureCount: integer('failure_count').default(0).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  formIdIdx: index('webhooks_form_id_idx').on(table.formId),
}));

export type Webhook = InferSelectModel<typeof webhooks>;
export type NewWebhook = InferInsertModel<typeof webhooks>;

// ==================== FORM ANALYTICS ====================
export const formAnalytics = pgTable('form_analytics', {
  id: uuid('id').defaultRandom().primaryKey(),
  formId: uuid('form_id').references(() => forms.id, { onDelete: 'cascade' }).notNull(),

  date: date('date').notNull(),

  // Metrics
  views: integer('views').default(0).notNull(),
  uniqueViews: integer('unique_views').default(0).notNull(),
  submissions: integer('submissions').default(0).notNull(),
  completions: integer('completions').default(0).notNull(),

  // Rates
  completionRate: decimal('completion_rate', { precision: 5, scale: 2 }),
  bounceRate: decimal('bounce_rate', { precision: 5, scale: 2 }),

  // Time metrics
  avgTimeToComplete: integer('avg_time_to_complete'), // in seconds
  avgTimeOnPage: integer('avg_time_on_page'), // in seconds

  // Breakdowns
  deviceBreakdown: jsonb('device_breakdown').$type<{
    desktop?: number;
    mobile?: number;
    tablet?: number;
  }>(),
  browserBreakdown: jsonb('browser_breakdown').$type<Record<string, number>>(),
  countryBreakdown: jsonb('country_breakdown').$type<Record<string, number>>(),
  referrerBreakdown: jsonb('referrer_breakdown').$type<Record<string, number>>(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  formDateIdx: uniqueIndex('form_analytics_form_date_idx').on(table.formId, table.date),
  dateIdx: index('form_analytics_date_idx').on(table.date),
}));

export type FormAnalytic = InferSelectModel<typeof formAnalytics>;
export type NewFormAnalytic = InferInsertModel<typeof formAnalytics>;

// ==================== RELATIONS ====================
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  forms: many(forms),
  apiKeys: many(apiKeys),
  submissions: many(formSubmissions),
  templates: many(formTemplates),
}));

export const formsRelations = relations(forms, ({ one, many }) => ({
  user: one(users, {
    fields: [forms.userId],
    references: [users.id],
  }),
  submissions: many(formSubmissions),
  webhooks: many(webhooks),
  analytics: many(formAnalytics),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  form: one(forms, {
    fields: [formSubmissions.formId],
    references: [forms.id],
  }),
  user: one(users, {
    fields: [formSubmissions.userId],
    references: [users.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  form: one(forms, {
    fields: [webhooks.formId],
    references: [forms.id],
  }),
}));

export const formAnalyticsRelations = relations(formAnalytics, ({ one }) => ({
  form: one(forms, {
    fields: [formAnalytics.formId],
    references: [forms.id],
  }),
}));