# Brightloop – Subscription Management System

Production-quality Subscription Management System for **Brightloop Software** with a live relational database, idempotent billing engine, and brightened modern design system.

---

## Quick Start

### 1. Start the Live Backend & Web Server
```bash
node server/index.js
```
The server will start at: **`http://localhost:4000`**

### 2. Open the Web Application
Open [http://localhost:4000](http://localhost:4000) in any web browser.  
*(Alternatively, you can open `index.html` directly in your browser; it connects automatically to `http://localhost:4000/api` with live status indicator `● Live DB`).*

---

## Demo Credentials (One per Role)

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@brightloop.com` | `Brightloop@2026` | Full system access: config, staff management, discounts, taxes, billing run, analytics. |
| **Staff** | `staff@brightloop.com` | `Brightloop@2026` | Subscriptions, customers, invoices, manual billing runs, payment recording. |
| **Customer** | `aarav@traders.in` | `Brightloop@2026` | Customer portal: view own subscriptions, pause/cancel, invoice history. |

---

## Architecture & Features

### 1. Database & Relational Engine
- **Engine**: Real relational SQLite database (`dev.db`) utilizing Node.js native engine with foreign key enforcement (`PRAGMA foreign_keys = ON`), WAL mode, and indexes on status, customer IDs, due dates, and billing periods.
- **Tables**: `users`, `customers`, `products`, `product_variants`, `plans`, `quotation_templates`, `taxes`, `discounts`, `subscriptions`, `subscription_lines`, `invoices`, `invoice_lines`, `payments`, `audit_logs`, `password_reset_tokens`.
- **Prisma Schema**: Also defined in `prisma/schema.prisma` for PostgreSQL / Docker environments.

### 2. Idempotent Billing Engine
- When clicking **`⚡ Run Billing Engine`** (or triggering `POST /api/invoices/run-billing`), the system generates invoices for all due active subscriptions.
- **Idempotency Guarantee**: Unique composite key `(subscription_id, billing_period_start)` guarantees no subscription is billed twice or skipped for any period.
- **Atomic Discount Counter**: Evaluates eligible promo codes (minimum quantity, active date window, plan applicability) and atomically increments usage counters.
- **Tax Calculation**: Automated 18% GST calculation applied per line item.

### 3. Payments & Automated Reconciliation
- Record payments with method (UPI, Bank Transfer, Card, Cash) and notes.
- Validates that recorded payments do not exceed remaining due balances.
- Automatically transitions invoice status from `Confirmed` to `Paid` upon full settlement.

### 4. Brightened UI & Design System
- **Brightened Theme**: Crisp light slate canvas (`#f4f7fb`), pure white elevated cards (`#ffffff`), clean borders (`#e2e8f0`), high-contrast slate text (`#0f172a`), and vibrant jewel accents (emerald teal `#0d9488`, electric blue `#2563eb`, amber `#d97706`).
- **Theme Toggle**: Switch between **☀ Bright Mode** and **🌙 Dark Mode** seamlessly via the top header button.
- **Status Pills**: Vibrant badges for `Active`, `Paid`, `Draft`, `Quotation`, `Confirmed`, `Closed`, `Overdue`, `Paused`, and `Cancelled`.
- **Accessibility**: Meets WCAG AA contrast standards, keyboard accessible modals (Esc to close, focus management), and skip navigation links.
