# SubSync — Subscription Management Dashboard

A modern subscription management platform built for the **Odoo × FLUX Hackathon**. SubSync helps businesses manage customers, subscriptions, and payment records through a centralized dashboard powered by Next.js and Supabase.

## 🚀 Project Overview

Managing subscriptions, customers, and recurring payments across different systems can become complicated. Businesses need a simple way to monitor subscription activity, track payments, and understand their revenue.

**SubSync** aims to simplify this process by providing a centralized dashboard where users can view subscription information, manage customer records, and track payment statuses.

The project combines a modern web interface with Supabase as its backend database.

## 🎯 Problem Statement

Businesses that operate on subscription-based models often face challenges such as:

- Keeping customer and subscription records organized.
- Tracking successful, pending, and failed payments.
- Monitoring recurring revenue.
- Identifying overdue subscriptions and outstanding payments.
- Managing information across multiple systems.

SubSync aims to address these challenges through a simple and centralized subscription management interface.

## ✨ Key Features

### 1. Dashboard
- Centralized overview of subscription activity.
- Active subscription count.
- Revenue collected from successful payments.
- Outstanding pending payments.
- Customer count.
- Overdue subscription overview.
- Monthly revenue visualization.
- Recent subscription records.
- Search and status filtering.

### 2. Customer Management
- Dedicated customer management page.
- Customer records connected to the Supabase database.
- Customer information such as name, email, and phone number.

### 3. Subscription Management
- Dedicated subscriptions page.
- Subscription information displayed in an organized interface.
- Customer and subscription relationship through database IDs.
- Subscription status and billing information.

### 4. Payment Management
- Dedicated payments dashboard.
- Payment records retrieved from Supabase.
- Payment status tracking:
  - Paid
  - Pending
  - Failed
- Payment metrics and collected revenue.
- Search and status filters.
- Add Payment form that inserts payment records into Supabase.
- Payment methods such as UPI, Card, and Net Banking.

### 5. Database Integration
- Supabase PostgreSQL database.
- Supabase JavaScript client.
- Real-time application data retrieval through database queries.
- Relational references between customers, subscriptions, and payments.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Next.js 16 | React framework and application routing |
| React 19 | User interface |
| TypeScript | Type-safe development |
| Tailwind CSS 4 | Styling and responsive UI |
| Supabase | Backend database and data access |
| PostgreSQL | Relational database |
| Git & GitHub | Version control |

## 🏗️ Project Structure

```text
subsync/
│
├── app/
│   ├── page.tsx
│   ├── customers/
│   │   └── page.tsx
│   ├── payments/
│   │   └── page.tsx
│   └── subscriptions/
│       └── page.tsx
│
├── lib/
│   └── supabase.ts
│
├── public/
│
├── .env.local
├── package.json
├── package-lock.json
└── README.md
```

## ⚙️ Getting Started

Follow these instructions to run SubSync locally.

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- Git
- A Supabase account

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Navigate to the project directory

```bash
cd subsync
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env.local` file in the root directory.

Add the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Replace the placeholder values with your Supabase project credentials.

**Important:** Never expose your Supabase secret or service-role key in frontend code or commit private credentials to GitHub.

### 5. Start the development server

```bash
npm run dev
```

Open the application:

```text
http://localhost:3000
```

### 6. Create a production build

```bash
npm run build
```

## 🗄️ Database Setup

SubSync uses Supabase PostgreSQL.

The main database tables are:

### Customers

| Column | Description |
|---|---|
| id | Unique customer ID |
| name | Customer name |
| email | Customer email |
| phone | Customer phone number |
| created_at | Record creation timestamp |

### Subscriptions

The subscriptions table stores subscription records and includes a `customer_id` reference to connect subscriptions with customers.

### Payments

| Column | Description |
|---|---|
| id | Unique payment ID |
| customer_id | Reference to customer |
| subscription_id | Reference to subscription |
| amount | Payment amount |
| payment_date | Payment timestamp |
| status | Paid, Pending, or Failed |
| payment_method | Payment method |
| created_at | Record creation timestamp |

### Relationships

```text
Customers
   |
   | customer_id
   |
Subscriptions
   |
   | subscription_id
   |
Payments
```

The database uses foreign keys to maintain relationships between records.

### Row Level Security

Row Level Security (RLS) is enabled on the payments table.

The current demo configuration includes policies for public read access and payment inserts for anonymous and authenticated users.

**Production note:** These demo policies should be tightened before handling real customer or payment information. Add proper authentication and authorization.

## 🌐 Deployment

SubSync can be deployed using Netlify.

### Netlify Deployment Steps

1. Push the project to GitHub.
2. Sign in to [Netlify](https://www.netlify.com/).
3. Select **Add new project → Import an existing project**.
4. Connect your GitHub account.
5. Select the SubSync repository.
6. Configure the build command:

```bash
npm run build
```

7. Add the environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

8. Click **Deploy**.
9. Open the generated deployment URL and test the application.

## 🔐 Security Considerations

- Keep private API keys out of frontend code.
- Never commit `.env.local` to GitHub.
- Configure Supabase Row Level Security carefully.
- Restrict database access based on authenticated users and permissions.
- Do not use unrestricted demo policies for production data.

## 🔮 Future Enhancements

Some possible improvements for future versions include:

- Complete subscription creation, editing, and cancellation workflows.
- Automated recurring payment tracking.
- Payment reminders and notifications.
- Subscription renewal alerts.
- Advanced revenue analytics.
- Invoice generation and management.
- User authentication and role-based access control.
- Odoo integration for business and subscription workflows.
- FLUX integration as part of the hackathon's intended ecosystem.
- Improved reporting and export functionality.

## 👥 Hackathon Project

**Project Name:** SubSync  
**Event:** Odoo × FLUX Hackathon  
**Category:** Subscription Management / Business Management  
**Status:** Hackathon prototype

## ❤️ Acknowledgements

Built with Next.js, React, Tailwind CSS, and Supabase.

Thanks to the Odoo × FLUX Hackathon for the opportunity to build and explore solutions for modern business management.

---

**SubSync — Simplifying Subscription Management.**
