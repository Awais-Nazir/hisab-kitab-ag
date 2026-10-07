# Hisab Kitab (حساب کتاب) 💸

> **Modern personal finance, peer-to-peer debt ledger, and AI-powered expense tracking designed for everyday life.**

---

## 📌 The Problem It Solves

Managing money in daily life is surprisingly messy:
- **Scattered Wallets:** You juggle physical cash, digital wallets (SadaPay, NayaPay), and bank accounts. Knowing your actual available balance across all of them at any given moment is a headache.
- **Informal Debts (*Udhar*):** Lending money to a friend (*Maine Diye*) or borrowing for fuel/lunch (*Maine Liye*) is usually tracked through mental math or lost WhatsApp chats, leading to awkward confusion weeks later.
- **The Group Friction:** Traditional split apps force you to create and manage isolated "groups" just to split a single meal with a colleague.
- **Logging Fatigue:** Opening an app, selecting 5 dropdowns, and typing an amount every single time you buy chai or groceries leads to abandoned budgets.

**Hisab Kitab** solves this by unifying **Personal Expense Tracking**, **Multi-Wallet Accounts**, **Contact-to-Contact Ledgers**, and an **AI Assistant** into one frictionless, mobile-first experience.

---

## ✨ Key Features

### 1. 💳 Multi-Account & Wallet Balances
- Keep real-time balances for **Cash in hand**, **Bank Accounts**, **SadaPay**, **NayaPay**, and **Udhar Khata**.
- Automatic double-entry reconciliation: spending, receiving settlements, deposits, and account-to-account transfers update balances accurately with zero negative balance leaks.

### 2. 🤝 Peer-to-Peer Shared Expenses & Udhar
- **No rigid group silos:** Split expenses directly with any contact from your dashboard.
- **Lena / Dena Tracking:** Log when you lend or borrow money with clear timestamps and notes.
- **Interactive Person Ledger:** Every contact has a chronological timeline showing net balance, past splits, and mutual settlements.
- **One-Click Settlements:** Pay or receive money (partial or full) with automatic account balance adjustments.

### 3. 🤖 Hisab AI Assistant (Natural Language Entry)
- Type or speak naturally in **Roman Urdu or English**:
  > *"Maine NayaPay se 250 PKR ka breakfast kiya"*  
  > *"Hamza ko 2000 cash udhar diya"*
- **Human-in-the-Loop:** The assistant drafts an interactive **Proposal Card** resolving accounts, contacts, and categories.
- Review and tap **Confirm & Save** to write directly to your ledger, or **Reject** to cancel. Never write blindly.

### 4. 📊 Analytics & Daily Timeline
- High-level daily comparison: see what you spent today vs. yesterday at a glance.
- Category breakdowns with custom color codes and icons.
- Instant search across all expenses, contacts, and udhar records.

### 5. 📝 Financial Notes & Daily Logs
- Keep financial reminders, rent agreements, payment deadlines, and checklists organized in one place alongside your numbers.

### 6. 📱 Progressive Web App (PWA) & Push Alerts
- Installable directly to your Android or iOS home screen for an app-like feel.
- Web push notification support to give you gentle daily reminders to log your expenses.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack) & [React 19](https://react.dev/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) (Clean minimalist emerald aesthetic with full Dark Mode support)
- **Database & ORM:** [PostgreSQL](https://www.postgresql.org/) (Neon Serverless) with [Prisma ORM](https://www.prisma.io/)
- **AI Agent Integration:** Next.js Server-to-Server secure proxy connecting to a Python [FastAPI](https://fastapi.tiangolo.com/) agent service
- **Authentication:** Secure HTTP-only JWT sessions with password hashing via `bcryptjs`
- **Notifications & Mail:** Web Push API (`web-push`) & [SendGrid](https://sendgrid.com/) for password recovery

---

## 🚀 Quick Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Awais-Nazir/hisab-kitab-ag.git
cd hisab-kitab-ag
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the project root:
```env
DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"
JWT_SECRET="your-jwt-secret-key"

# Optional: Email & Push Notifications
SENDGRID_API_KEY="your-sendgrid-api-key"
SENDGRID_FROM_EMAIL="hello@yourdomain.com"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"

# AI Agent Backend
HISAB_AGENT_API_URL="http://127.0.0.1:8000"
HISAB_AGENT_SECRET="your-agent-secret"
```

### 3. Database Migration & Run
```bash
npx prisma db push
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 License
Private project built with passion by [Awais Nazir](https://github.com/Awais-Nazir).
