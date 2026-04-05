"""
SmartCI Deep Q-Network (DQN) Agent
Neural network Q-function with experience replay and target network.
"""
import random
from collections import deque
from typing import List

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

from simulation.environment import FILE_TO_TEST_MAP, FILES, TESTS


# ── Neural Network ────────────────────────────────────────────────────────────

class DQNetwork(nn.Module):
    def __init__(self, state_size: int, action_size: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_size, 256),
            nn.LayerNorm(256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, 128),
            nn.LayerNorm(128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, action_size),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ── Replay Buffer ─────────────────────────────────────────────────────────────

class ReplayBuffer:
    def __init__(self, maxlen: int = 10_000):
        self.buf = deque(maxlen=maxlen)

    def push(self, state, action, reward, next_state, done):
        self.buf.append((state, action, reward, next_state, done))

    def sample(self, batch_size: int):
        return random.sample(self.buf, batch_size)

    def __len__(self) -> int:
        return len(self.buf)


# ── DQN Agent ─────────────────────────────────────────────────────────────────

class DQNAgent:
    def __init__(
        self,
        alpha: float = 1e-3,
        gamma: float = 0.95,
        epsilon: float = 1.0,
        epsilon_min: float = 0.01,
        epsilon_decay: float = 0.995,
        batch_size: int = 32,
        target_update_freq: int = 10,
    ):
        self.files = FILES
        self.tests = TESTS
        self.state_size = len(FILES)
        self.action_size = len(TESTS)

        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_min = epsilon_min
        self.epsilon_decay = epsilon_decay
        self.batch_size = batch_size
        self.target_update_freq = target_update_freq
        self.episodes_trained = 0
        self.training_losses: List[float] = []

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        self.q_net = DQNetwork(self.state_size, self.action_size).to(self.device)
        self.target_net = DQNetwork(self.state_size, self.action_size).to(self.device)
        self.target_net.load_state_dict(self.q_net.state_dict())
        self.target_net.eval()

        self.optimizer = optim.Adam(self.q_net.parameters(), lr=alpha)
        self.loss_fn = nn.SmoothL1Loss()
        self.replay = ReplayBuffer()

    # ── Encoding ─────────────────────────────────────────────────────────────

    def encode_state(self, changed_files: List[str]) -> np.ndarray:
        s = np.zeros(self.state_size, dtype=np.float32)
        for f in changed_files:
            if f in self.files:
                s[self.files.index(f)] = 1.0
        return s

    def encode_action(self, selected_tests: List[str]) -> np.ndarray:
        a = np.zeros(self.action_size, dtype=np.float32)
        for t in selected_tests:
            if t in self.tests:
                a[self.tests.index(t)] = 1.0
        return a

    def decode_q_values(self, q_vals: np.ndarray, top_k: int) -> List[str]:
        indices = np.argsort(q_vals)[-top_k:][::-1]
        return [self.tests[i] for i in indices]

    # ── Action Selection ─────────────────────────────────────────────────────

    def _relevant(self, changed_files: List[str]) -> List[str]:
        rel: set = set()
        for f in changed_files:
            rel.update(FILE_TO_TEST_MAP.get(f, []))
        return list(rel)

    def choose_action(self, changed_files: List[str], top_k: int = None) -> List[str]:
        relevant = self._relevant(changed_files)
        if top_k is None:
            top_k = max(2, len(relevant))

        if random.random() < self.epsilon:
            # Explore: relevant tests + random noise from full test pool
            pool = list(set(relevant) | set(random.sample(TESTS, min(3, len(TESTS)))))
            k = random.randint(max(1, len(relevant)), min(top_k + 2, len(pool)))
            return random.sample(pool, k)

        # Exploit: ALWAYS include all relevant tests (they're always correct)
        # then use Q-network to decide if any extra tests are worth running
        state_t = torch.FloatTensor(self.encode_state(changed_files)).unsqueeze(0).to(self.device)
        with torch.no_grad():
            q_vals = self.q_net(state_t).squeeze().cpu().numpy()

        # Zero out Q-values for already-relevant tests (don't double-count)
        q_vals_extra = q_vals.copy()
        for t in relevant:
            if t in self.tests:
                q_vals_extra[self.tests.index(t)] = -999.0

        # Pick up to 2 bonus tests if their Q-value is positive
        extra_indices = [
            i for i in np.argsort(q_vals_extra)[::-1][:3]
            if q_vals[i] > 0
        ]
        extra_tests = [self.tests[i] for i in extra_indices]

        return list(set(relevant) | set(extra_tests))

    # ── Learning ─────────────────────────────────────────────────────────────

    def remember(
        self,
        changed_files: List[str],
        selected_tests: List[str],
        reward: float,
        next_changed_files: List[str],
        done: bool = False,
    ) -> None:
        self.replay.push(
            self.encode_state(changed_files),
            self.encode_action(selected_tests),
            reward,
            self.encode_state(next_changed_files),
            float(done),
        )

    def train_step(self) -> float:
        if len(self.replay) < self.batch_size:
            return 0.0

        batch = self.replay.sample(self.batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)

        states_t = torch.FloatTensor(np.array(states)).to(self.device)
        actions_t = torch.FloatTensor(np.array(actions)).to(self.device)
        rewards_t = torch.FloatTensor(rewards).to(self.device)
        next_t = torch.FloatTensor(np.array(next_states)).to(self.device)
        dones_t = torch.FloatTensor(dones).to(self.device)

        # Current Q values weighted by selected actions
        current_q = (self.q_net(states_t) * actions_t).sum(dim=1)

        with torch.no_grad():
            max_next_q = self.target_net(next_t).max(dim=1)[0]
            target_q = rewards_t + (1 - dones_t) * self.gamma * max_next_q

        loss = self.loss_fn(current_q, target_q)
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.q_net.parameters(), 1.0)
        self.optimizer.step()

        loss_val = loss.item()
        self.training_losses.append(loss_val)
        return loss_val

    def _soft_update_target(self, tau: float = 0.01) -> None:
        for tp, p in zip(self.target_net.parameters(), self.q_net.parameters()):
            tp.data.copy_(tau * p.data + (1 - tau) * tp.data)

    def decay_epsilon(self) -> None:
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
        self.episodes_trained += 1
        if self.episodes_trained % self.target_update_freq == 0:
            self._soft_update_target()

    # ── Stats / Persistence ───────────────────────────────────────────────────

    def get_stats(self) -> dict:
        avg_loss = float(np.mean(self.training_losses[-100:])) if self.training_losses else 0.0
        return {
            "type": "DQN",
            "epsilon": round(self.epsilon, 4),
            "replay_buffer_size": len(self.replay),
            "episodes_trained": self.episodes_trained,
            "device": str(self.device),
            "avg_loss_100": round(avg_loss, 6),
        }

    def save(self, path: str) -> None:
        torch.save(
            {
                "q_net": self.q_net.state_dict(),
                "target_net": self.target_net.state_dict(),
                "optimizer": self.optimizer.state_dict(),
                "epsilon": self.epsilon,
                "episodes_trained": self.episodes_trained,
                "losses": self.training_losses,
            },
            path,
        )

    def load(self, path: str) -> None:
        try:
            ckpt = torch.load(path, map_location=self.device)
            self.q_net.load_state_dict(ckpt["q_net"])
            self.target_net.load_state_dict(ckpt["target_net"])
            self.optimizer.load_state_dict(ckpt["optimizer"])
            self.epsilon = ckpt["epsilon"]
            self.episodes_trained = ckpt["episodes_trained"]
            self.training_losses = ckpt.get("losses", [])
        except FileNotFoundError:
            pass

    def reset(self) -> None:
        self.q_net = DQNetwork(self.state_size, self.action_size).to(self.device)
        self.target_net = DQNetwork(self.state_size, self.action_size).to(self.device)
        self.target_net.load_state_dict(self.q_net.state_dict())
        self.optimizer = optim.Adam(self.q_net.parameters(), lr=self.alpha)
        self.replay = ReplayBuffer()
        self.epsilon = 1.0
        self.episodes_trained = 0
        self.training_losses = []
