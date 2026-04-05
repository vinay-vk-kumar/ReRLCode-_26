"""
SmartCI Q-Learning Agent
Tabular Q-learning with epsilon-greedy exploration.
"""
import pickle
import random
from typing import Dict, List, Tuple

from simulation.environment import FILE_TO_TEST_MAP, TESTS


class QAgent:
    def __init__(
        self,
        alpha: float = 0.1,
        gamma: float = 0.9,
        epsilon: float = 1.0,
        epsilon_min: float = 0.01,
        epsilon_decay: float = 0.995,
    ):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_min = epsilon_min
        self.epsilon_decay = epsilon_decay
        self.q_table: Dict[Tuple, float] = {}
        self.episodes_trained = 0

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _get_q(self, state: tuple, action: tuple) -> float:
        return self.q_table.get((state, action), 0.0)

    def _set_q(self, state: tuple, action: tuple, value: float) -> None:
        self.q_table[(state, action)] = value

    def encode_state(self, changed_files: List[str]) -> tuple:
        return tuple(sorted(changed_files))

    def encode_action(self, selected_tests: List[str]) -> tuple:
        return tuple(sorted(selected_tests))

    def _relevant(self, changed_files: List[str]) -> List[str]:
        rel: set = set()
        for f in changed_files:
            rel.update(FILE_TO_TEST_MAP.get(f, []))
        return list(rel)

    # ── Core API ─────────────────────────────────────────────────────────────

    def choose_action(self, changed_files: List[str], top_k: int = None) -> List[str]:
        relevant = self._relevant(changed_files)
        if not top_k:
            top_k = max(1, len(relevant))

        if random.random() < self.epsilon:
            # Explore: mix relevant + random noise
            pool = list(set(relevant + random.sample(TESTS, min(3, len(TESTS)))))
            k = random.randint(1, min(top_k + 2, len(pool)))
            return random.sample(pool, k)

        # Exploit: find best known action for this state
        state = self.encode_state(changed_files)
        best_action = relevant[:top_k] if relevant else TESTS[:3]
        best_q = float("-inf")

        # Sample candidate subsets (bounded to avoid combinatorial explosion)
        from itertools import combinations
        candidates: List[List[str]] = []
        for k in range(1, min(top_k + 2, len(TESTS) + 1)):
            for combo in combinations(TESTS, k):
                candidates.append(list(combo))
            if len(candidates) > 300:
                break

        for candidate in candidates:
            a = self.encode_action(candidate)
            q = self._get_q(state, a)
            if q > best_q:
                best_q = q
                best_action = candidate

        return best_action

    def update(
        self,
        changed_files: List[str],
        selected_tests: List[str],
        reward: float,
        next_changed_files: List[str],
    ) -> None:
        state = self.encode_state(changed_files)
        action = self.encode_action(selected_tests)
        next_state = self.encode_state(next_changed_files)

        next_rel = self._relevant(next_changed_files)
        next_action = self.encode_action(next_rel[:3] if next_rel else TESTS[:3])
        max_next_q = self._get_q(next_state, next_action)

        current_q = self._get_q(state, action)
        new_q = current_q + self.alpha * (
            reward + self.gamma * max_next_q - current_q
        )
        self._set_q(state, action, new_q)

    def decay_epsilon(self) -> None:
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
        self.episodes_trained += 1

    def get_stats(self) -> dict:
        return {
            "type": "Q-Learning",
            "epsilon": round(self.epsilon, 4),
            "q_table_size": len(self.q_table),
            "episodes_trained": self.episodes_trained,
            "alpha": self.alpha,
            "gamma": self.gamma,
        }

    def save(self, path: str) -> None:
        with open(path, "wb") as f:
            pickle.dump(
                {
                    "q_table": self.q_table,
                    "epsilon": self.epsilon,
                    "episodes_trained": self.episodes_trained,
                },
                f,
            )

    def load(self, path: str) -> None:
        try:
            with open(path, "rb") as f:
                data = pickle.load(f)
            self.q_table = data["q_table"]
            self.epsilon = data["epsilon"]
            self.episodes_trained = data["episodes_trained"]
        except FileNotFoundError:
            pass

    def reset(self) -> None:
        self.q_table = {}
        self.epsilon = 1.0
        self.episodes_trained = 0
