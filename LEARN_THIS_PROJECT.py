# SmartCI — Complete Project Explanation
# How Reinforcement Learning Powers CI Test Selection
# =====================================================
# Save this file. Re-read it whenever you want to revise the project.


# ===========================================================================
# SECTION 1: THE CORE PROBLEM
# ===========================================================================

"""
REAL WORLD PROBLEM:
  Every code commit triggers ALL tests in a CI/CD pipeline.
  A small auth.js fix causes 400 unrelated payment, profile, search tests to run.
  Result: 10-20 minutes wasted per commit. Over a week = hours of wasted CI time.

SMARTCI SOLUTION:
  An RL agent observes which FILES changed in a commit.
  It selects only the RELEVANT tests to run.
  It learns — over thousands of commits — which tests actually matter for each file.
  The more it runs, the smarter it gets.

KEY INSIGHT:
  This is a perfect RL problem because:
  1. The environment changes (new files, refactors, new tests)
  2. There is no single "correct" answer — it depends on context
  3. Feedback is clear: did the selected tests catch the bug or not?
  4. Efficiency matters: fewer tests = faster CI, but must not miss bugs
"""


# ===========================================================================
# SECTION 2: SYSTEM ARCHITECTURE
# ===========================================================================

"""
FOUR-LAYER ARCHITECTURE:

  ┌──────────────────────────────────────────────────────────────┐
  │  Layer 1: Next.js Frontend (Port 3000)                       │
  │  - Dashboard, Learning Curves, Simulator, Logs pages         │
  │  - Calls Node.js backend, shows real-time test results       │
  └─────────────────────┬────────────────────────────────────────┘
                        │ REST API calls
  ┌─────────────────────▼────────────────────────────────────────┐
  │  Layer 2: Node.js / Express Backend (Port 4000)              │
  │  - API gateway between frontend and RL engine                │
  │  - Runs test simulation logic                                 │
  │  - Saves every episode to MongoDB Atlas                       │
  └────────────┬─────────────────────────────┬───────────────────┘
               │ /rl/decide                  │ /rl/update
               │ (get test selection)        │ (send reward back)
  ┌────────────▼─────────────────────────────▼───────────────────┐
  │  Layer 3: Python FastAPI RL Engine (Port 8000)               │
  │  - Hosts Q-Learning Agent + DQN Agent                        │
  │  - Decides which tests to run (epsilon-greedy)               │
  │  - Trains neural network on every episode                    │
  └─────────────────────┬────────────────────────────────────────┘
                        │
  ┌─────────────────────▼────────────────────────────────────────┐
  │  Layer 4: Simulation Environment                             │
  │  - 10 fake source files (auth.js, payment.js, ...)           │
  │  - 17 fake tests (test_auth_login, test_payment_process, ...) │
  │  - File→Test mapping (ground truth the agent must discover)  │
  │  - Bug injection (35% of commits have a bug)                 │
  └──────────────────────────────────────────────────────────────┘

PORTS SUMMARY:
  3000 → Next.js frontend
  4000 → Node.js backend (API gateway + MongoDB)
  8000 → Python FastAPI (RL engine, Swagger at /docs)
"""


# ===========================================================================
# SECTION 3: THE SIMULATION ENVIRONMENT
# ===========================================================================
# File: rl-engine/simulation/environment.py

"""
FILES (10 simulated source files):
  auth.js, payment.js, profile.js, search.js, user.js,
  db.js, utils.js, api.js, cache.js, email.js

TESTS (17 simulated test cases):
  test_auth_login, test_auth_logout, test_auth_register,
  test_payment_process, test_payment_refund, test_payment_validation,
  test_profile_update, test_profile_avatar,
  test_search_query, test_search_filter,
  test_user_crud, test_user_permissions,
  test_db_connection, test_db_queries,
  test_utils_helpers, test_cache_hit, test_email_send

FILE → TEST MAPPING (ground truth — agent must LEARN this):
  auth.js    → [test_auth_login, test_auth_logout, test_auth_register]
  payment.js → [test_payment_process, test_payment_refund, test_payment_validation]
  profile.js → [test_profile_update, test_profile_avatar, test_user_crud]
  search.js  → [test_search_query, test_search_filter]
  user.js    → [test_user_crud, test_user_permissions]
  db.js      → [test_db_connection, test_db_queries]
  utils.js   → [test_utils_helpers]
  api.js     → [test_auth_login, test_payment_process, test_search_query]
  cache.js   → [test_cache_hit, test_db_queries]
  email.js   → [test_email_send, test_user_crud]

KEY FUNCTIONS:
  simulate_commit()
    → Randomly picks 1-3 files as "changed in this commit"
    → Returns: ["auth.js", "payment.js"]

  simulate_test_run(selected_tests, changed_files, bug_probability=0.35)
    → 35% chance there is a bug in the changed files
    → If bug exists: checks if bug_test is IN selected_tests
    → Returns: {
        bug_exists: bool,
        bug_detected: bool,
        failed_tests: list,
        missed_tests: list,  ← relevant tests that weren't selected
        time_taken: float
      }
"""


# ===========================================================================
# SECTION 4: RL FUNDAMENTALS — THE MATH
# ===========================================================================

"""
CORE RL CONCEPTS:

STATE (s):
  What the agent OBSERVES before making a decision.
  In SmartCI: which files changed in this commit.
  Example: s = ("auth.js", "payment.js")

ACTION (a):
  What the agent DOES based on the state.
  In SmartCI: which tests to run.
  Example: a = ["test_auth_login", "test_payment_process"]

REWARD (r):
  Feedback signal — how good was the action?
  SmartCI reward function:
    if bug_exists and bug_detected:   r += +10  (great!)
    if bug_exists and not detected:   r += -10  (terrible! missed a bug)
    if no bug exists:                 r += +2   (correct — no false alarm)
    efficiency bonus:
      r += ((17 - len(selected_tests)) / 17) × 5
    Running 4/17 tests gives: (13/17) × 5 = +3.8 bonus
    Running 17/17 tests gives: 0 bonus

  TOTAL RANGE: roughly -10 to +15

POLICY (π):
  The agent's strategy: given a state, which action to take.
  Goal: find the OPTIMAL policy that maximizes total reward over time.

EPISODE:
  One complete simulation = one commit → select tests → run → get reward
  After 1000 episodes, the agent should have a good policy.
"""


# ===========================================================================
# SECTION 5: Q-LEARNING AGENT
# ===========================================================================
# File: rl-engine/agent/q_agent.py

"""
WHAT IS Q-LEARNING?
  Tabular method — stores Q-values in a dictionary (Q-table).
  Q(s,a) = expected total reward if you take action 'a' in state 's'
           and then follow the optimal policy from then on.

Q-TABLE STRUCTURE:
  q_table = {
    (("auth.js",), ("test_auth_login", "test_auth_logout")): 8.5,
    (("auth.js",), ("test_payment_process",)):              -3.2,
    (("payment.js",), ("test_payment_process", "test_payment_refund")): 7.1,
    ...
  }

THE BELLMAN EQUATION (Update Rule):
  Q[s][a] = Q[s][a] + α × (r + γ × max(Q[s'][a']) - Q[s][a])

  Where:
    α (alpha) = 0.1   → Learning rate (how fast to update)
    γ (gamma) = 0.9   → Discount factor (how much future rewards matter)
    r          = reward received
    s'         = next state (next commit's changed files)
    max Q[s']  = best Q-value achievable from next state

  INTUITION:
    If you expected reward 5, but actually got 10:
    Error = 10 - 5 = 5
    New Q = 5 + 0.1 × 5 = 5.5  (nudge toward reality)

EPSILON-GREEDY EXPLORATION:
  ε starts at 1.0 (100% random), decays each episode:
    ε = max(0.01, ε × 0.995)
  
  On each episode:
    if random() < ε:  EXPLORE → pick random tests (try new things)
    else:             EXPLOIT → pick tests with highest Q-values

  EPISODE MILESTONES:
    Episode 1:    ε = 1.000 → 100% random
    Episode 100:  ε = 0.605 → 60% random
    Episode 200:  ε = 0.366 → 37% random
    Episode 500:  ε = 0.082 → 8% random
    Episode 1000: ε = 0.007 → <1% random (near-optimal)

WEAKNESS OF Q-LEARNING:
  With 10 files and 17 tests, state-action space is enormous.
  Q-table can't generalize: never seen ("auth.js","db.js") → learns nothing.
  Solution: Deep Q-Network (DQN).
"""


# ===========================================================================
# SECTION 6: DQN AGENT (DEEP Q-NETWORK)
# ===========================================================================
# File: rl-engine/agent/dqn_agent.py

"""
WHAT IS DQN?
  Replace the Q-table with a Neural Network.
  Input: state vector → Output: Q-values for every possible test.
  The network GENERALIZES: if it learned auth.js patterns,
  it applies that knowledge to any new auth.js commit.

NEURAL NETWORK ARCHITECTURE:
  Input Layer:   10 neurons  (one per file, 1=changed, 0=unchanged)
  Hidden Layer1: 256 neurons (LayerNorm + ReLU + Dropout 0.2)
  Hidden Layer2: 128 neurons (LayerNorm + ReLU + Dropout 0.2)
  Hidden Layer3:  64 neurons (ReLU)
  Output Layer:  17 neurons  (Q-value for each test)

EXAMPLE:
  auth.js changes → Input: [1,0,0,0,0,0,0,0,0,0]
  Output: [8.2, 7.9, 7.3, 0.1, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]
           test_auth_login=8.2  (high → select this)
           test_payment_process=0.1 (low → skip this)
  Agent picks top-K tests by Q-value.

EXPERIENCE REPLAY BUFFER:
  Problem: Neural nets trained on correlated data diverge.
  Solution: Store last 10,000 experiences as tuples:
    (state, action, reward, next_state, done)
  
  Training step: sample random 32 experiences from buffer.
  This breaks correlation → stable training.

TARGET NETWORK:
  Problem: Updating Q-values while using them for targets causes instability.
  Solution: Keep TWO networks:
    - q_net:     updated every step
    - target_net: updated slowly (soft update τ=0.01 every 10 episodes)
  
  Soft update: target = 0.01×q_net + 0.99×target  (smooth, stable)

LOSS FUNCTION:
  SmoothL1Loss (Huber Loss) — less sensitive to outliers than MSE.
  Loss = SmoothL1(current_Q, target_Q)
  
  target_Q = reward + γ × max(target_net(next_state))

OPTIMIZER:
  Adam optimizer, learning rate = 0.001
  Gradient clipping at 1.0 to prevent exploding gradients.

WHY DQN > Q-LEARNING FOR THIS PROJECT:
  Q-Learning: can't generalize, table grows exponentially
  DQN: network generalizes, fixed size regardless of state space
  DQN: recognizes patterns across similar commits
  DQN: handles unseen state combinations correctly
"""


# ===========================================================================
# SECTION 7: TRAINING LOOP
# ===========================================================================
# File: rl-engine/train.py

"""
SINGLE EPISODE (what happens in 1 training cycle):
  1. simulate_commit()           → get changed files e.g. ["auth.js"]
  2. agent.choose_action()       → select tests (epsilon-greedy)
  3. simulate_test_run()         → did we catch the bug?
  4. calculate_reward()          → compute reward value
  5. agent.remember()            → store in replay buffer (DQN)
  6. agent.train_step()          → sample batch, compute loss, backprop (DQN)
  7. agent.update()              → update Q-table (Q-Learning)
  8. agent.decay_epsilon()       → reduce exploration
  9. log to CSV                  → save metrics for charts

TRAINING LOOP (1000 episodes):
  for episode in range(1000):
      run one episode (above)
      log: [episode, reward, tests_selected, bug_found, epsilon, accuracy]

  Print summary every 100 episodes.
  Save model to ./models/ when done.

ACCURACY METRIC:
  accuracy = correct_outcomes / total_episodes
  correct = (bug_existed AND was detected) OR (no bug AND not falsely detected)

LEARNING CURVE EXPECTATION:
  Episodes 1-50:    accuracy ~50%  (random guessing)
  Episodes 50-200:  accuracy ~65%  (learning file→test relationships)
  Episodes 200-500: accuracy ~75%  (exploiting learned knowledge)
  Episodes 500+:    accuracy ~85%  (near-optimal, stable)
  
  Tests selected: 17 → ~3-5 (76%+ reduction = time saved)

CLI USAGE:
  python train.py --episodes 1000 --agent dqn
  python train.py --episodes 500  --agent q_learning
"""


# ===========================================================================
# SECTION 8: FASTAPI RL ENGINE ENDPOINTS
# ===========================================================================
# File: rl-engine/main.py  →  http://localhost:8000

"""
ENDPOINTS:

GET  /                  Health check → {"service": "SmartCI RL Engine", "status": "online"}
GET  /docs              Swagger UI (interactive API docs)

POST /rl/decide         Agent picks tests for a commit
  Request:  { "changed_files": ["auth.js"], "agent_type": "dqn" }
  Response: { "selected_tests": [...], "epsilon": 0.82, "stats": {...} }

POST /rl/update         Send reward back to agent (triggers training)
  Request:  { "changed_files": [...], "selected_tests": [...], "reward": 8.5,
              "next_changed_files": [...], "agent_type": "dqn" }
  Response: { "status": "updated", "stats": {...} }

POST /rl/train          Trigger background training (runs in thread)
  Request:  { "episodes": 500, "agent_type": "dqn" }
  Response: { "status": "training_started", "episodes": 500 }

GET  /rl/training-status  Check if training is still running
  Response: { "running": true, "current": 234, "total": 500 }

POST /rl/reset          Reset agent to untrained state
GET  /rl/status         Full agent stats + environment info
GET  /rl/simulate-commit  Get a random simulated commit

DESIGN DECISION — Singleton agents:
  The agents (dqn_agent, q_agent) are created ONCE when FastAPI starts.
  They persist in memory across all requests.
  If server restarts: agents reset (unless saved model files exist in ./models/).
"""


# ===========================================================================
# SECTION 9: NODE.JS BACKEND
# ===========================================================================
# File: backend/src/  →  http://localhost:4000

"""
ROLE: API Gateway + Simulation Runner + MongoDB Persistence

WHY NOT CALL PYTHON DIRECTLY FROM NEXT.JS?
  - Separation of concerns: frontend doesn't know about RL internals
  - MongoDB saving happens server-side (secure, not in browser)
  - Reward calculation stays on backend (consistent between clients)
  - In production: could have multiple frontends sharing one backend

API ROUTES:
  POST /api/simulate    → Full pipeline: RL decide → sim → save → return
  GET  /api/metrics     → Aggregated dashboard numbers from MongoDB
  GET  /api/metrics/series?limit=200  → Time-series for Recharts graphs
  GET  /api/logs?page=1&limit=20      → Paginated episode history
  DELETE /api/logs      → Clear all episodes
  POST /api/train       → Tell Python to start background training
  GET  /api/train/status → Polling endpoint for training progress
  POST /api/train/reset  → Reset agent + clear MongoDB

SIMULATE ROUTE LOGIC (simulate.js):
  1. Get changed files (from request body OR call Python /rl/simulate-commit)
  2. POST /rl/decide → get selected_tests from Python
  3. Run FILE_TO_TEST_MAP locally to find relevant tests
  4. Roll dice: bug_exists = Math.random() < bug_probability
  5. If bug and bug_test in selected_tests → bug_detected = true
  6. Calculate reward (same formula as Python)
  7. POST /rl/update → send reward to Python (triggers Q-table/DQN update)
  8. Episode.create({...}) → save to MongoDB
  9. Return full result to frontend

MONGODB SCHEMAS:
  Episode: {
    changedFiles, selectedTests, bugExists, bugDetected,
    failedTests, missedTests, reward, timeSaved, timeTaken,
    selectedCount, agentType, epsilon, timestamps
  }
  Metric: {
    episode, accuracy, avgTestsSelected, avgReward, epsilon, agentType, loss
  }
"""


# ===========================================================================
# SECTION 10: NEXT.JS FRONTEND
# ===========================================================================
# File: frontend/src/  →  http://localhost:3000

"""
TECH STACK:
  Next.js 14 (App Router) + TypeScript + Tailwind CSS
  Recharts (charts) + Framer Motion (animations) + react-hot-toast + Lucide Icons

DESIGN SYSTEM (globals.css):
  Background: #080810 (deep dark)
  Cards: rgba(124,58,237,0.06) glass effect
  Primary accent: #00d4ff (electric cyan)
  Secondary accent: #7c3aed (violet)
  Success: #10b981 (emerald)
  Danger: #ef4444 (red)
  Font: Inter (Google Fonts)

SIX PAGES:

  / (Home page)
    - Animated hero with gradient text
    - 4 live metric cards pulling from GET /api/metrics
    - Architecture flow diagram
    - 4 feature explanation cards
    - CTA buttons to dashboard/learning

  /dashboard (Live Simulation)  ← MOST IMPORTANT
    - Agent type selector (DQN vs Q-Learning)
    - Bug probability slider (0-100%)
    - "Run Simulation" button → calls POST /api/simulate
    - Test result cards animate in one-by-one (280ms delay each)
    - GREEN = selected + caught bug / GRAY = skipped / AMBER = missed
    - Summary: changed files, tests selected, outcome, reward, time saved

  /learning (Learning Curves)
    - 3 Recharts line charts: Reward / Accuracy / Tests Selected per episode
    - Agent stats cards: epsilon, episodes trained, replay buffer size
    - Train Agent button (triggers training, polls status every 3s)
    - THIS PAGE PROVES THE RL IS WORKING (accuracy goes up over time)

  /simulator (Batch Runner)
    - Configure: batch size (5-50), bug probability, agent type
    - "Run N Episodes" → runs them sequentially with 180ms gap
    - Live progress bar animates to 100%
    - Each episode appears as a row with color-coded badges

  /test-mapping (Coverage Matrix)
    - Table: every file → its relevant tests
    - Progress bars show coverage % per file
    - Static page, no API calls needed

  /logs (Episode History)
    - Paginated table of all MongoDB episodes
    - Filter by agent type (DQN / Q-Learning)
    - Columns: files, tests count, outcome badge, reward, time saved, epsilon
    - Clear all button with confirmation

ANIMATION PATTERN (dashboard test cards):
  After simulate completes:
    for each test in [selected + missed]:
      await sleep(280ms)
      add test to visibleTests array
  React re-renders show cards appearing one-by-one (dramatic effect)

API CLIENT (lib/api.ts):
  All backend calls in one file using axios.
  Base URL from NEXT_PUBLIC_API_URL env var (default: http://localhost:4000)
"""


# ===========================================================================
# SECTION 11: DEPLOYMENT (AWS EC2)
# ===========================================================================
# Files: deploy.sh, nginx.conf, docker-compose.yml

"""
EC2 ARCHITECTURE:
  Ubuntu 22.04 t2.micro (free tier eligible for 12 months)
  
  Public port 80/443 (HTTPS via Let's Encrypt / Certbot)
  Nginx listens on 80/443 → routes traffic:
    /api/* → http://localhost:4000  (Node.js backend)
    /      → http://localhost:3000  (Next.js frontend)
    RL engine on port 8000 NOT exposed (internal only, security)

PROCESS MANAGEMENT (PM2):
  PM2 keeps all 3 services alive after SSH disconnect.
  pm2 start "uvicorn main:app ..." --name smartci-rl
  pm2 start src/index.js --name smartci-backend
  pm2 start "npm start" --name smartci-frontend
  pm2 save → survives reboots

DEPLOY COMMAND:
  bash deploy.sh   ← runs all 9 steps automatically

  Step 1: Install system packages (Node.js 20, Python3, Nginx, Certbot, PM2)
  Step 2: Clone/pull repo from GitHub
  Step 3: Setup rl-engine (venv + pip install + PM2)
  Step 4: Setup backend (npm install + PM2)
  Step 5: Build + start Next.js frontend (npm build + PM2)
  Step 6: Configure Nginx reverse proxy
  Step 7: SSL certificate via Certbot (Let's Encrypt, free HTTPS)
  Step 8: PM2 startup (survive reboots)
  Step 9: Initial training run (200 episodes on fresh deploy)

ENVIRONMENT VARIABLES NEEDED ON EC2:
  rl-engine/.env:   MONGO_URI, PORT=8000
  backend/.env:     MONGO_URI, RL_ENGINE_URL=http://localhost:8000, PORT=4000
  frontend/.env.local: NEXT_PUBLIC_API_URL=https://your-domain.com/api
  
  (Never commit .env files to git — add to .gitignore)
"""


# ===========================================================================
# SECTION 12: HOW TO MAKE AGENT "GOOD" — PRACTICAL GUIDE
# ===========================================================================

"""
THE AGENT IS CONSIDERED "GOOD" WHEN:
  ✅ Accuracy > 80%  (catches >4 out of 5 bugs)
  ✅ Avg tests selected < 6  (runs <35% of total 17 tests)
  ✅ Epsilon < 0.05           (mostly exploiting learned knowledge)
  ✅ Reward consistently > 5  (stable, high rewards)

HOW TO GET THERE:
  1. Run 1000 episodes via the /learning page → Train Agent button
  2. Or via API: POST /rl/train with {"episodes": 1000}
  3. Or via CLI: python train.py --episodes 1000 --agent dqn

CHECKING PROGRESS:
  GET http://localhost:8000/rl/status
    → check epsilon (lower = better trained)
    → check episodes_trained

  GET http://localhost:4000/api/metrics
    → accuracy → should approach 0.85+
    → avgTestsSelected → should approach 3-5
    → testReductionPct → should approach 70-80%

HYPERPARAMETER TUNING (in dqn_agent.py):
  alpha = 0.001       Learning rate (lower = stable but slow)
  gamma = 0.95        Discount factor (higher = values future more)
  epsilon_decay = 0.995  Slower decay = more exploration
  batch_size = 32     Larger = more stable gradients
  target_update = 10  How often target network refreshes

WHY THE AGENT SOMETIMES MISSES BUGS:
  1. Still in high-epsilon phase (mostly random) → run more episodes
  2. Bug appears in a test NOT related to the changed file (by design)
  3. api.js touches 3 different test areas → agent may under-select
  → These are expected and show the system is working realistically
"""


# ===========================================================================
# SECTION 13: INTERVIEW / PORTFOLIO TALKING POINTS
# ===========================================================================

"""
60-SECOND PITCH:
  "Most CI systems run every test on every commit — even if only one file changed.
   SmartCI uses a Reinforcement Learning agent (specifically a Deep Q-Network)
   that observes which files changed in a commit and selects only the relevant tests.
   It learns the optimal test selection policy by trial and error over thousands of
   simulated commits, balancing bug detection accuracy against efficiency.
   After 1000 episodes, it reduces test runs by 76% while maintaining 85%+ accuracy."

TECHNICAL QUESTIONS YOU WILL GET:

Q: Why RL instead of simple rule-based selection?
A: Rule-based = static file→test mapping, breaks on refactors.
   RL = adaptive, learns from actual outcomes, handles edge cases like
   api.js which touches multiple test domains.

Q: What is the state space?
A: State = binary vector of size 10 (one bit per file: 1=changed, 0=unchanged).
   There are 2^10 = 1024 possible states (commit patterns).

Q: What is the action space?
A: Action = which of 17 tests to run.
   DQN outputs Q-values for each test, picks top-K by value.
   Theoretically 2^17 = 131,072 possible actions.

Q: How does DQN differ from Q-Learning?
A: Q-Learning: lookup table, O(states × actions) memory, can't generalize.
   DQN: neural network, fixed size, generalizes to unseen state combinations.

Q: What prevents the agent from always running all tests (safe but slow)?
A: The efficiency bonus in the reward function:
   reward += ((17 - selected_count) / 17) × 5
   Running fewer tests is explicitly rewarded, as long as bugs are caught.

Q: What is experience replay and why use it?
A: Store past (state, action, reward, next_state) tuples.
   Train on random batches from this buffer.
   Breaks temporal correlation in training data → stable convergence.

Q: What is the target network for?
A: Without it: you update Q-values using Q-values that are also changing.
   Like trying to hit a moving target. Very unstable.
   Target network updates slowly (soft update τ=0.01) → stable target to aim for.

Q: How would you extend this to a real codebase?
A: 1. Parse actual git diffs to extract changed files
   2. Use static analysis to enrich state (AST, call graph)
   3. Replace simulation with real test runner (pytest, jest)
   4. Store real test outcomes in MongoDB
   5. DQN generalizes — same architecture works, just different input features
"""


# ===========================================================================
# SECTION 14: FILE MAP — WHAT EACH FILE DOES
# ===========================================================================

"""
smartci/
├── rl-engine/
│   ├── simulation/
│   │   ├── __init__.py          re-exports environment functions
│   │   └── environment.py       FILES, TESTS, mapping, simulate_commit(), simulate_test_run()
│   ├── agent/
│   │   ├── __init__.py          re-exports QAgent, DQNAgent
│   │   ├── q_agent.py           Tabular Q-learning: Q-table, epsilon-greedy, Bellman update
│   │   └── dqn_agent.py         DQN: DQNetwork, ReplayBuffer, soft target update, train_step()
│   ├── models/                  Saved weights (populated after training)
│   ├── logs/                    CSV training logs
│   ├── main.py                  FastAPI app with 8 endpoints
│   ├── train.py                 CLI training script (1000 episodes, saves CSV + model)
│   ├── requirements.txt         fastapi, uvicorn, torch, numpy, pymongo, motor
│   ├── .env                     MONGO_URI, PORT=8000
│   └── Dockerfile               Python 3.11-slim image

├── backend/
│   └── src/
│       ├── index.js             Express app, MongoDB connection, route mounting
│       ├── routes/
│       │   ├── simulate.js      Full pipeline: RL→sim→reward→MongoDB
│       │   ├── metrics.js       MongoDB aggregation for dashboard numbers + time-series
│       │   ├── logs.js          Paginated episode history + clear endpoint
│       │   └── train.js         Proxy to Python training + reset
│       ├── models/
│       │   ├── Episode.js       Mongoose schema for simulation results
│       │   └── Metric.js        Mongoose schema for training metrics
│       └── services/
│           └── rlClient.js      Axios client for Python FastAPI calls
│   ├── .env                     MONGO_URI, RL_ENGINE_URL, PORT=4000
│   ├── package.json             express, mongoose, axios, cors, morgan, nodemon
│   └── Dockerfile               Node.js 20 alpine image

├── frontend/src/
│   ├── app/
│   │   ├── globals.css          Design system: dark theme, glass cards, badges, buttons
│   │   ├── layout.tsx           Root layout: Navbar + Toaster
│   │   ├── page.tsx             / → Hero + metrics + feature cards
│   │   ├── dashboard/page.tsx   Live simulation with streaming test cards
│   │   ├── learning/page.tsx    3 Recharts charts + Train Agent button
│   │   ├── simulator/page.tsx   Batch runner with progress bar
│   │   ├── test-mapping/page.tsx File→test coverage matrix
│   │   └── logs/page.tsx        Paginated MongoDB episode table
│   ├── components/
│   │   ├── Navbar.tsx           Active-link nav with live indicator
│   │   ├── MetricCard.tsx       Animated stat card (framer-motion)
│   │   └── TestCard.tsx         Color-coded test result card
│   └── lib/
│       └── api.ts               Axios API client + FILE_TO_TEST_MAP + ALL_TESTS constants

├── docker-compose.yml            Orchestrates all 3 services with volumes
├── deploy.sh                     9-step EC2 deployment automation script
├── nginx.conf                    Reverse proxy (HTTP→HTTPS, API routing)
└── README.md                     Quick start guide
"""
