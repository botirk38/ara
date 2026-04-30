CREATE TABLE `autonomy_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`allowed` integer NOT NULL,
	`reasons` text NOT NULL,
	`amount_threshold_passed` integer NOT NULL,
	`dispute_check_passed` integer NOT NULL,
	`days_overdue_passed` integer NOT NULL,
	`specter_risk_passed` integer NOT NULL,
	`relationship_passed` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`whatsapp` text,
	`relationship` text NOT NULL,
	`avg_days_late` integer DEFAULT 0,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'GBP',
	`due_date` text NOT NULL,
	`days_overdue` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_links` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`url` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recovery_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`channel` text NOT NULL,
	`action_type` text NOT NULL,
	`content` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `specter_enrichments` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`company_name` text NOT NULL,
	`risk_signal` text NOT NULL,
	`revenue_signal` text,
	`news_signal` text,
	`raw` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`actor` text NOT NULL,
	`message` text NOT NULL,
	`event_type` text NOT NULL,
	`created_at` text NOT NULL
);
