# SmartCI — RL-Based Dynamic Test Selection System

Team Members:
Vinay Kumar : 23BAI10125  
Aditi Gupta : 23BAI10968

> **Reinforcement Learning agent that learns which tests to run for each commit — cutting CI/CD time without missing bugs.**

## Architecture

```
Next.js (3000) → Node.js/Express (4000) → Python FastAPI RL Engine (8000) ↔ MongoDB Atlas
```

## Quick Start (Local)

### 1. RL Engine (Python FastAPI)
```bash
cd rl-engine
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env     # fill in MONGO_URI
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Node.js Backend
```bash
cd backend
npm install
cp .env.example .env     # fill in MONGO_URI
npm run dev
```

### 3. Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```

Open → http://localhost:3000

## Environment Variables

| Service    | File              | Key Variable        |
|------------|-------------------|---------------------|
| rl-engine  | `rl-engine/.env`  | `MONGO_URI`         |
| backend    | `backend/.env`    | `MONGO_URI`, `RL_ENGINE_URL=http://localhost:8000` |
| frontend   | `frontend/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:4000` |

## API Docs

- RL Engine Swagger UI: http://localhost:8000/docs
- Backend health: http://localhost:4000/health

## Pages

| Route | Page |
|-------|------|
| `/` | Home — hero + live metrics |
| `/dashboard` | Live simulation with test result cards |
| `/learning` | Reward, accuracy, efficiency charts |
| `/simulator` | Batch runner with sliders |
| `/test-mapping` | File → test coverage matrix |
| `/logs` | Paginated episode history |

## Train the Agent
```bash
# Quick training via API (runs in background)
curl -X POST http://localhost:8000/rl/train -H "Content-Type: application/json" -d '{"episodes": 500, "agent_type": "dqn"}'

# Or via CLI in rl-engine/
python train.py --episodes 1000 --agent dqn
```

## Deployment (AWS EC2)
```bash
# 1. Upload project to EC2
scp -r smartci/ ubuntu@your-ec2-ip:~/

# 2. SSH in and run deploy script
ssh ubuntu@your-ec2-ip
cd ~/smartci
bash deploy.sh
```
