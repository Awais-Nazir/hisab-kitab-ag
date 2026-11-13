# Hisab Kitab (حساب کتاب)

Hisab Kitab is a mobile-first web app for tracking personal expenses across cash, bank accounts and wallets like SadaPay and NayaPay, keeping a ledger of who owes whom, and logging entries by typing or speaking in Roman Urdu or English.

Live app: [hisab.awaisnazir.tech](https://hisab.awaisnazir.tech). Create an account with an email and password to try it. The AI assistant is at [hisab.awaisnazir.tech/chat](https://hisab.awaisnazir.tech/chat) and runs on a separate service, [Hisab-AI-Agent](https://github.com/Awais-Nazir/Hisab-AI-Agent).

## Why it exists

Handling money day to day gets messy in a few ways.

Your money sits in several places: physical cash, digital wallets (SadaPay, NayaPay) and bank accounts. Finding out what you can actually spend right now means checking all of them.

Informal debts (*udhar*) usually live in your head or in an old WhatsApp chat. You lend a friend money (*maine diye*) or borrow for fuel or lunch (*maine liye*), and a few weeks later nobody remembers the details.

Most split apps make you create a group first, even if you only want to split one meal with one colleague.

And picking from five dropdowns and typing an amount every time you buy chai is the reason a lot of people give up on budgeting apps.

Hisab Kitab puts expense tracking, multiple accounts, per-contact ledgers and an AI assistant in one app.

## What it does

### Accounts and wallets

It keeps live balances for cash in hand, bank accounts, SadaPay, NayaPay and Udhar Khata. Spending, received settlements, deposits and transfers between accounts all go through double-entry reconciliation, so balances stay accurate and never go negative.

### Shared expenses and udhar

You can split an expense with any contact straight from the dashboard, with no groups to set up. When you lend or borrow money (*lena* / *dena*), you log it with a timestamp and a note.

Every contact has their own ledger, a chronological timeline of net balance, past splits and settlements. You can settle up in part or in full, and your account balances adjust automatically.

### AI assistant

Type or speak in Roman Urdu or English:

> "Maine NayaPay se 250 PKR ka breakfast kiya"
> "Hamza ko 2000 cash udhar diya"

The assistant drafts a proposal card with the account, contact and category already filled in. You tap **Confirm & Save** to write it to your ledger, or **Reject** to cancel. It never writes anything without your confirmation.

### Analytics and daily timeline

The home screen compares what you spent today with yesterday. Categories have their own colors and icons, and search covers all your expenses, contacts and udhar records.

### Notes

You can keep reminders, rent agreements, payment deadlines and checklists next to your numbers.

### PWA and push notifications

The app installs to an Android or iOS home screen and behaves like a native app. Web push sends a gentle daily reminder to log your expenses.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router, Turbopack) and [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/), with a minimalist emerald look and full dark mode
- [PostgreSQL](https://www.postgresql.org/) on Neon serverless, accessed through [Prisma ORM](https://www.prisma.io/)
- A Python [FastAPI](https://fastapi.tiangolo.com/) agent service for the AI assistant ([Hisab-AI-Agent](https://github.com/Awais-Nazir/Hisab-AI-Agent)), reached through a server-to-server proxy in Next.js
- HTTP-only JWT sessions for auth, with passwords hashed using `bcryptjs`
- Web Push API (`web-push`) for notifications and [SendGrid](https://sendgrid.com/) for password recovery emails

## Running it locally

### 1. Clone and install dependencies

```bash
git clone https://github.com/Awais-Nazir/hisab-kitab-ag.git
cd hisab-kitab-ag
npm install
```

### 2. Set environment variables

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

### 3. Push the schema and start the dev server

```bash
npx prisma db push
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## License

No open-source license is included, so all rights are reserved. The code is public so you can read it, but you can't reuse it without permission from [Awais Nazir](https://github.com/Awais-Nazir).
