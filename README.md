<![CDATA[<div align="center">

# 💰 SettleX

**MSME Financial Intelligence Platform**

A Paytm-style fintech web app giving Micro, Small & Medium Enterprises a unified dashboard for payments, bond-backed treasury simulation, GST compliance, and real-time cash flow intelligence — powered by an agentic AI backbone.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql)](https://neon.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Private-red)]()

</div>

---

## 🧭 Overview

SettleX is a full-stack fintech platform designed for Indian MSMEs to manage their finances from a single, unified dashboard. It combines real-time treasury management with simulated government and corporate bond instruments, an automated ledger system, AI-driven intelligence, and GST compliance tools.

### Key Highlights

- **📱 Paytm-style UX** — Familiar card-based layout with quick-action grids, recharge, bill payments, and travel booking modules
- **🏦 Treasury Bond Engine** — Simulated bond marketplace with real yield accrual math, per-second maturity, and risk profiling
- **🔐 OTP Authentication** — Twilio Verify powered phone-number login with fallback local simulation
- **📊 AI Intelligence** — Cash flow forecasting, spending analytics, and intelligent bond recommendations
- **🧾 GST Compliance** — Automated transaction classification, HSN code mapping, and compliance scoring
- **💳 Payment Gateway** — Tokenized checkout, UPI simulation, provider reconciliation engine

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS 16 FRONTEND                         │
│    Dashboard │ Treasury │ Payments │ Compliance │ Intelligence   │
│    Recharge  │ Flights  │ Trains   │ Merchants  │ Profile        │
└────────────────────────┬────────────────────────────────────────┘
                         │  REST API (JSON)
┌────────────────────────▼────────────────────────────────────────┐
│                     FASTAPI BACKEND                              │
│  /auth  /bonds  /payments  /checkout  /compliance  /analytics   │
│  /intelligence  /gateway  /admin                                 │
└──┬──────────────────────────────────────────────────────────────┘
   │
   PostgreSQL (Neon)  ──  Primary ledger, bonds, users, compliance
```

| Service          | Port   | Description                    |
| ---------------- | ------ | ------------------------------ |
| Next.js Frontend | `3000` | Main application               |
| FastAPI Backend  | `8000` | All API routes (`/api/v1/...`) |
| PostgreSQL       | `5432` | Neon serverless (production)   |

---

## 📂 Project Structure

```
settle-x/
├── frontend/                   # Next.js 16 (App Router)
│   ├── app/
│   │   ├── components/         # AuthModal, Navbar, PinModal
│   │   ├── treasury/           # Bond portfolio & management
│   │   ├── payments/           # Send & receive money
│   │   ├── checkout/           # Tokenized checkout flow
│   │   ├── compliance/         # GST compliance dashboard
│   │   ├── history/            # Transaction history
│   │   ├── profile/            # User profile & settings
│   │   ├── merchants/          # Merchant directory
│   │   ├── recharge/           # Mobile recharge
│   │   ├── electricity-bill-payment/
│   │   ├── dth-recharge/
│   │   ├── fastag-recharge/
│   │   ├── loan-emi-payment/
│   │   ├── flights/            # Domestic flights
│   │   ├── intl-flights/       # International flights
│   │   ├── trains/             # Train booking
│   │   ├── bus/                # Bus booking
│   │   ├── all-products/       # Services catalog
│   │   ├── admin/              # Admin panel
│   │   └── api/                # Next.js API routes (proxy)
│   ├── lib/                    # Utilities & API client
│   └── types/                  # TypeScript type definitions
│
├── backend/                    # FastAPI (Python)
│   ├── api/                    # Route handlers
│   │   ├── auth.py             # OTP login (Twilio Verify)
│   │   ├── bonds.py            # Treasury bond engine
│   │   ├── payments.py         # Ledger & payment processing
│   │   ├── checkout.py         # Tokenized checkout
│   │   ├── compliance.py       # GST classification & scoring
│   │   ├── analytics.py        # Spending & revenue analytics
│   │   ├── intelligence.py     # AI-driven insights
│   │   ├── gateway.py          # Provider reconciliation
│   │   └── admin.py            # Admin controls
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── user.py             # User, OtpSession
│   │   ├── bonds.py            # Bond, BondHolding, BondEvent, RiskProfile, Recommendations
│   │   ├── ledger.py           # LedgerAccount, Transaction, LedgerEntry, PaymentIntent
│   │   ├── compliance.py       # GstProfile, ClassificationOverride
│   │   └── provider.py         # ProviderTransaction, WebhookLog, Reconciliation
│   ├── schemas/                # Pydantic request/response schemas
│   ├── core/                   # Settings, security, JWT
│   ├── database/               # Engine, session, migrations
│   ├── seed.py                 # Database seeder (seedconfig.json)
│   └── main.py                 # Application entrypoint
│
└── implementation-idea-v1.md   # Full system design document
```

---

## ⚡ Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **PostgreSQL** — or a [Neon](https://neon.tech) serverless instance

### 1. Clone the repository

```bash
git clone https://github.com/your-org/settle-x.git
cd settle-x
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate   # macOS/Linux
# venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

# Seed the database
python seed.py

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API base URL

# Start the dev server
npm run dev
```

### 4. Open the app

Navigate to **http://localhost:3000** 🚀

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable                   | Description                     | Example                                              |
| -------------------------- | ------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string    | `postgresql://user:pass@host/db?sslmode=require`     |
| `SECRET_KEY`               | JWT signing secret              | `your-random-secret-key`                             |
| `TWILIO_ACCOUNT_SID`       | Twilio Account SID              | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`                 |
| `TWILIO_AUTH_TOKEN`        | Twilio Auth Token               | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`                   |
| `TWILIO_VERIFY_SERVICE_SID`| Twilio Verify Service SID       | `VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`                 |

### Frontend (`frontend/.env.local`)

| Variable                | Description              | Example                           |
| ----------------------- | ------------------------ | --------------------------------- |
| `NEXT_PUBLIC_API_BASE`  | Backend API base URL     | `http://localhost:8000/api/v1`    |

---

## 🧩 API Endpoints

All routes are prefixed with `/api/v1`. Authentication is via JWT Bearer token (except auth routes).

| Module              | Method   | Endpoint                        | Description                              |
| ------------------- | -------- | ------------------------------- | ---------------------------------------- |
| **Auth**            | `POST`   | `/auth/request-otp`             | Send OTP to phone number                 |
|                     | `POST`   | `/auth/verify-otp`              | Verify OTP and get JWT                   |
| **Treasury**        | `GET`    | `/bonds/catalog`                | List available bonds                     |
|                     | `POST`   | `/bonds/purchase`               | Purchase bond units                      |
|                     | `GET`    | `/bonds/portfolio`              | Get user's bond holdings                 |
|                     | `POST`   | `/bonds/transfer`               | Transfer bonds between users             |
|                     | `POST`   | `/bonds/recommend`              | AI-powered bond recommendations          |
| **Payments**        | `GET`    | `/payments/balance`             | Get wallet balance                       |
|                     | `POST`   | `/payments/send`                | Send money                               |
|                     | `GET`    | `/payments/transactions`        | Transaction history                      |
| **Checkout**        | `POST`   | `/checkout/initiate`            | Create tokenized payment session         |
| **Compliance**      | `GET`    | `/compliance/gst-profile`       | GST classification for transactions      |
|                     | `GET`    | `/compliance/score`             | Compliance health score                  |
| **Analytics**       | `GET`    | `/analytics/summary`            | Revenue & spending analytics             |
| **Intelligence**    | `GET`    | `/intelligence/insights`        | AI-generated financial insights          |
| **Gateway**         | `POST`   | `/gateway/webhook`              | Payment provider webhook receiver        |
|                     | `GET`    | `/gateway/reconciliation`       | Reconciliation reports                   |
| **Admin**           | `GET`    | `/admin/stats`                  | Platform-level statistics                |

---

## 🏦 Treasury Bond System

SettleX features a simulated bond marketplace with production-grade financial logic:

- **Real Yield Accrual** — Interest compounds per-second using APY formulas
- **Risk Profiling** — Each bond has safety/liquidity scores and risk tier classification
- **AI Recommendations** — Policy-driven allocation engine with full audit trails
- **Bond Events** — Complete lifecycle tracking (purchase → transfer → maturity → settlement)
- **Regulatory Simulation** — ISIN codes, credit ratings, YTM calculations, face values in paise

### Seed Bonds

The platform ships with 3 pre-configured demo bonds (via `seedconfig.json`):

| Bond Name                       | ISIN           | Rating | APY     | Maturity   |
| ------------------------------- | -------------- | ------ | ------- | ---------- |
| SettleX Rapid Treasury Bond     | `INE0SETX0001` | AAA    | 15.00%  | 60 seconds |
| Sovereign SDL 91D (Simulated)   | `INE0SDL91D01` | AAA    | 7.25%   | 1 day      |
| PSU Credit Note (Simulated)     | `INE0PSUCRD01` | AA+    | 8.50%   | 2 days     |

---

## 🛠️ Tech Stack

### Frontend

| Technology       | Purpose                    |
| ---------------- | -------------------------- |
| Next.js 16       | React framework (App Router) |
| React 19         | UI library                 |
| TypeScript 5     | Type safety                |
| Tailwind CSS 4   | Utility-first styling      |
| Lucide React     | Icon library               |
| NextAuth         | Session management         |

### Backend

| Technology       | Purpose                    |
| ---------------- | -------------------------- |
| FastAPI          | API framework              |
| SQLAlchemy       | ORM & database toolkit     |
| Pydantic         | Data validation            |
| Psycopg2         | PostgreSQL driver          |
| Twilio           | SMS OTP delivery           |
| Python-JOSE      | JWT token handling          |
| Passlib + Bcrypt | Password hashing           |

### Infrastructure

| Service          | Purpose                    |
| ---------------- | -------------------------- |
| Neon PostgreSQL  | Serverless database        |
| Vercel           | Frontend & backend hosting |
| Twilio Verify    | OTP authentication         |

---

## 📜 Scripts

### Backend

```bash
# Run development server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Seed database with demo bonds
python seed.py

# Health check
curl http://localhost:8000/health
```

### Frontend

```bash
# Development (Webpack)
npm run dev

# Development (Turbopack — faster)
npm run dev:turbo

# Production build
npm run build

# Start production server
npm start
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is private and proprietary.

---

<div align="center">

**Built with ❤️ for Indian MSMEs**

</div>
]]>
