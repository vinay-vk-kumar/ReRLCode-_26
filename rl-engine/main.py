"""
SmartCI RL Engine — FastAPI Service
Exposes Q-Learning and DQN agents via REST for the Node.js backend.
"""
import os
import threading
from contextlib import asynccontextmanager
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from agent.q_agent import QAgent
from agent.dqn_agent import DQNAgent
from simulation.environment import (
    FILES, TESTS, FILE_TO_TEST_MAP,
    simulate_commit, simulate_test_run,
)

# ── Model paths ───────────────────────────────────────────────────────────────

os.makedirs("./models", exist_ok=True)
DQN_PATH = "./models/dqn_model.pt"
Q_PATH   = "./models/q_learning_model.pkl"

# ── Singleton agents ──────────────────────────────────────────────────────────

dqn_agent = DQNAgent()
q_agent   = QAgent()

# Load saved weights on startup (safe no-op if files don't exist)
if os.path.exists(DQN_PATH):
    dqn_agent.load(DQN_PATH)
    print(f"✅ DQN model loaded from {DQN_PATH} (ε={dqn_agent.epsilon:.3f}, episodes={dqn_agent.episodes_trained})")
if os.path.exists(Q_PATH):
    q_agent.load(Q_PATH)
    print(f"✅ Q-Learning model loaded from {Q_PATH}")

def _save_all():
    """Persist both agents to disk."""
    dqn_agent.save(DQN_PATH)
    q_agent.save(Q_PATH)
    print(f"💾 Models saved (DQN ε={dqn_agent.epsilon:.4f}, ep={dqn_agent.episodes_trained})")

# ── Lifespan: save on shutdown ─────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield  # server is running
    print("🛑 Server shutting down — saving models...")
    _save_all()

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SmartCI RL Engine",
    description="Q-Learning + DQN-powered test selection engine",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ───────────────────────────────────────────────────────────

class DecideRequest(BaseModel):
    changed_files: List[str]
    top_k: Optional[int] = None
    agent_type: Optional[str] = "dqn"

class UpdateRequest(BaseModel):
    changed_files: List[str]
    selected_tests: List[str]
    reward: float
    next_changed_files: List[str]
    done: bool = False
    agent_type: Optional[str] = "dqn"

class TrainRequest(BaseModel):
    episodes: int = 200
    agent_type: str = "dqn"

# ── Training state ────────────────────────────────────────────────────────────

train_state = {
    "running": False,
    "current": 0,
    "total": 0,
    "agent_type": "",
    "logs": [],
}

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["health"])
def root():
    return {"service": "SmartCI RL Engine", "status": "online"}


@app.post("/rl/decide", tags=["agent"])
def decide(req: DecideRequest):
    agent = dqn_agent if req.agent_type == "dqn" else q_agent
    selected = agent.choose_action(req.changed_files, req.top_k)
    stats = agent.get_stats()
    return {
        "selected_tests": selected,
        "agent_type": req.agent_type,
        "epsilon": stats["epsilon"],
        "stats": stats,
    }


@app.post("/rl/update", tags=["agent"])
def update(req: UpdateRequest):
    if req.agent_type == "dqn":
        dqn_agent.remember(
            req.changed_files, req.selected_tests,
            req.reward, req.next_changed_files, req.done,
        )
        loss = dqn_agent.train_step()
        dqn_agent.decay_epsilon()
        stats = dqn_agent.get_stats()
        stats["loss"] = loss
        # Auto-save every 25 live episodes
        if dqn_agent.episodes_trained % 25 == 0:
            _save_all()
    else:
        q_agent.update(
            req.changed_files, req.selected_tests,
            req.reward, req.next_changed_files,
        )
        q_agent.decay_epsilon()
        stats = q_agent.get_stats()
        if q_agent.episodes_trained % 25 == 0:
            _save_all()
    return {"status": "updated", "stats": stats}


@app.post("/rl/train", tags=["training"])
def train(req: TrainRequest, background_tasks: BackgroundTasks):
    if train_state["running"]:
        return {"status": "already_running", "progress": train_state}

    def _run():
        from train import run_training, calculate_reward
        train_state["running"] = True
        train_state["current"] = 0
        train_state["total"] = req.episodes
        train_state["agent_type"] = req.agent_type
        train_state["logs"] = []
        try:
            run_training(n_episodes=req.episodes, agent_type=req.agent_type, verbose=False)
            train_state["current"] = req.episodes
        finally:
            train_state["running"] = False

    background_tasks.add_task(_run)
    return {"status": "training_started", "episodes": req.episodes, "agent_type": req.agent_type}


@app.get("/rl/training-status", tags=["training"])
def training_status():
    return train_state


@app.post("/rl/reset", tags=["agent"])
def reset(agent_type: str = "dqn"):
    if agent_type == "dqn":
        dqn_agent.reset()
    else:
        q_agent.reset()
    return {"status": "reset", "agent_type": agent_type}


@app.post("/rl/save", tags=["agent"])
def save_models():
    """Manually save both agent models to disk right now."""
    _save_all()
    return {
        "status": "saved",
        "dqn_path": DQN_PATH,
        "q_path": Q_PATH,
        "dqn_episodes": dqn_agent.episodes_trained,
        "dqn_epsilon": round(dqn_agent.epsilon, 4),
    }


@app.get("/rl/status", tags=["agent"])
def status():
    return {
        "dqn": dqn_agent.get_stats(),
        "q_learning": q_agent.get_stats(),
        "environment": {
            "files": FILES,
            "tests": TESTS,
            "file_to_test_map": FILE_TO_TEST_MAP,
        },
    }


@app.get("/rl/simulate-commit", tags=["simulation"])
def sim_commit():
    changed = simulate_commit()
    from simulation.environment import get_relevant_tests
    return {
        "changed_files": changed,
        "relevant_tests": get_relevant_tests(changed),
    }
