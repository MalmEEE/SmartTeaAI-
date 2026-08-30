# SmartTeaAI

AI-powered Sri Lanka tea auction price prediction system. Full-stack: NestJS backend, Next.js frontend, Python/TensorFlow ML engine.

---

## Prerequisites

- Node.js 20+
- Python 3.10+
- MySQL 8+
- npm

---

## 1. Clone the Repository

```bash
git clone https://github.com/MalmEEE/SmartTeaAI-.git
cd SmartTeaAI-
```

---

## 2. Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.example backend/.env
```

Edit `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=smartteaai
DB_USER=root
DB_PASS=your_mysql_password

JWT_SECRET=change-this-to-a-long-random-string

PORT=3000
FRONTEND_URL=http://localhost:3001

PYTHON_BIN=python3
```

---

## 3. Database Setup

Create the database in MySQL:

```sql
CREATE DATABASE smartteaai;
```

The tables are auto-created on first backend start (`synchronize: true`).

---

## 4. Backend Setup

```bash
cd backend
npm install
npm run start:dev
```

The API runs at `http://localhost:3000/api`.

---

## 5. ML Engine Setup

```bash
cd ml-engine
pip install numpy pandas tensorflow xgboost scikit-learn joblib python-dateutil
```

The ML engine is called automatically by the backend as a subprocess. No separate process needed.

---

## 6. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

Start the dev server:

```bash
npm run dev
```

The app runs at `http://localhost:3001`.

---

## 7. Seed Demo Users

With the backend running, open a new terminal:

```bash
cd backend
npm run seed
```

This creates the following demo accounts (shared password: `TeaDemo@2025`):

| Role     | Email                |
|----------|----------------------|
| Farmer   | farmer@demo.test     |
| Broker   | broker@demo.test     |
| Exporter | exporter@demo.test   |
| Buyer    | buyer@demo.test      |
| Analyst  | analyst@demo.test    |
| Admin    | admin@demo.test      |

---

## 8. Running Everything Together

Open three terminals:

**Terminal 1 — Backend:**
```bash
cd backend
npm run start:dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 — (Optional) Data pipeline:**
```bash
cd ml-engine
python collect_sltb.py
```

---

## 9. Project Structure

```
SmartTeaAI-/
├── backend/          # NestJS REST API
│   └── src/
│       ├── auth/     # JWT authentication
│       ├── users/    # User management & roles
│       ├── prediction/  # ML prediction service
│       ├── data-pipeline/
│       ├── history/
│       ├── reports/
│       └── admin/
├── frontend/         # Next.js 15 App Router
│   └── app/
│       ├── dashboard/farmer/
│       ├── login/
│       └── register/
└── ml-engine/        # Python ML scripts
    ├── predict.py    # LSTM + XGBoost prediction
    └── *.py          # Data collection scripts
```

---

## 10. Deployment

### Backend — Railway

1. Push repo to GitHub
2. Create a Railway project, add a MySQL service
3. Add a service from GitHub repo, set **Root Directory** to `/` and **Dockerfile Path** to `backend/Dockerfile`
4. Set environment variables (Railway provides `MYSQL_URL` automatically)
5. Generate a public domain under **Settings → Networking**

### Frontend — Netlify

1. Connect GitHub repo on Netlify
2. Set **Base directory**: `frontend`, **Build command**: `npm run build`, **Publish directory**: `frontend/.next`
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-railway-domain.up.railway.app/api`
4. Deploy

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | NestJS, TypeORM, MySQL, JWT, Passport |
| Frontend  | Next.js 15, TypeScript, Tailwind v4, Recharts |
| ML Engine | Python, TensorFlow/Keras LSTM, XGBoost, scikit-learn |
| Deploy    | Railway (backend + DB), Netlify (frontend) |
