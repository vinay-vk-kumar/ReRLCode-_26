"""
SmartCI Training Engine
Runs N episodes, logs metrics to CSV, saves trained model.
Usage:
    python train.py --episodes 1000 --agent dqn
    python train.py --episodes 500 --agent q_learning
"""
import argparse
import csv
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from simulation.environment import TESTS, simulate_commit, simulate_test_run
from agent.q_agent import QAgent
from agent.dqn_agent import DQNAgent


def calculate_reward(result: dict, selected_tests: list) -> float:
    reward = 0.0
    if result["bug_exists"]:
        reward += 10.0 if result["bug_detected"] else -10.0
    else:
        reward += 2.0  # correct negative
    # Efficiency bonus
    efficiency = (len(TESTS) - len(selected_tests)) / len(TESTS)
    reward += efficiency * 5.0
    return round(reward, 3)


def run_training(
    n_episodes: int = 1000,
    agent_type: str = "dqn",
    save_dir: str = "./models",
    log_dir: str = "./logs",
    verbose: bool = True,
):
    os.makedirs(save_dir, exist_ok=True)
    os.makedirs(log_dir, exist_ok=True)

    agent = DQNAgent() if agent_type == "dqn" else QAgent()

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = os.path.join(log_dir, f"training_{agent_type}_{stamp}.csv")

    correct = 0
    episode_logs = []

    with open(log_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "episode", "reward", "tests_selected",
            "bug_exists", "bug_detected", "epsilon", "accuracy", "loss",
        ])

        for ep in range(1, n_episodes + 1):
            changed = simulate_commit()
            selected = agent.choose_action(changed)
            result = simulate_test_run(selected, changed)
            reward = calculate_reward(result, selected)

            next_changed = simulate_commit()
            loss = 0.0

            if agent_type == "dqn":
                agent.remember(changed, selected, reward, next_changed)
                loss = agent.train_step()
            else:
                agent.update(changed, selected, reward, next_changed)

            agent.decay_epsilon()

            # Accuracy: did outcome match expectation?
            outcome_correct = (result["bug_exists"] and result["bug_detected"]) or (
                not result["bug_exists"] and not result["bug_detected"]
            )
            if outcome_correct:
                correct += 1
            accuracy = correct / ep

            row = [
                ep, reward, len(selected),
                result["bug_exists"], result["bug_detected"],
                round(agent.epsilon, 4), round(accuracy, 4), round(loss, 6),
            ]
            writer.writerow(row)
            episode_logs.append(row)

            if verbose and ep % 100 == 0:
                print(
                    f"Ep {ep:5d} | Reward {reward:6.2f} | "
                    f"Tests {len(selected):2d} | "
                    f"Acc {accuracy:.1%} | ε {agent.epsilon:.3f}"
                )

    # Save model
    ext = "pt" if agent_type == "dqn" else "pkl"
    model_path = os.path.join(save_dir, f"{agent_type}_model.{ext}")
    agent.save(model_path)

    if verbose:
        print(f"\n✅ Training complete — {n_episodes} episodes")
        print(f"   Model  → {model_path}")
        print(f"   Log    → {log_path}")
        print(f"   Final accuracy: {correct / n_episodes:.1%}")

    return agent, log_path, episode_logs


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--episodes", type=int, default=1000)
    parser.add_argument("--agent", type=str, default="dqn", choices=["dqn", "q_learning"])
    args = parser.parse_args()
    run_training(n_episodes=args.episodes, agent_type=args.agent)
