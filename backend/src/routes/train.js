const express = require("express");
const router = express.Router();
const rl = require("../services/rlClient");
const Episode = require("../models/Episode");

// Training state (in-process)
let trainState = { running: false, current: 0, total: 0, agentType: "" };

// ─── Inline simulate logic (same as simulate.js but callable internally) ──────
const { FILE_TO_TEST_MAP, TESTS } = (() => {
  const FILE_TO_TEST_MAP = {
    "auth.js":    ["test_auth_login","test_auth_logout","test_auth_register"],
    "payment.js": ["test_payment_process","test_payment_refund","test_payment_validation"],
    "profile.js": ["test_profile_update","test_profile_avatar","test_user_crud"],
    "search.js":  ["test_search_query","test_search_filter"],
    "user.js":    ["test_user_crud","test_user_permissions"],
    "db.js":      ["test_db_connection","test_db_queries"],
    "utils.js":   ["test_utils_helpers"],
    "api.js":     ["test_auth_login","test_payment_process","test_search_query"],
    "cache.js":   ["test_cache_hit","test_db_queries"],
    "email.js":   ["test_email_send","test_user_crud"],
  };
  const TESTS = [...new Set(Object.values(FILE_TO_TEST_MAP).flat())];
  return { FILE_TO_TEST_MAP, TESTS };
})();

const FILES = Object.keys(FILE_TO_TEST_MAP);

function simulateCommit() {
  const n = Math.floor(Math.random() * 3) + 1;
  const shuffled = [...FILES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function getRelevantTests(changedFiles) {
  const rel = new Set();
  changedFiles.forEach(f => (FILE_TO_TEST_MAP[f] || []).forEach(t => rel.add(t)));
  return [...rel];
}

function calculateReward(bugExists, bugDetected, selectedCount) {
  let reward = 0;
  if (bugExists) { reward += bugDetected ? 10 : -10; }
  else { reward += 2; }
  reward += ((TESTS.length - selectedCount) / TESTS.length) * 5;
  return Math.round(reward * 100) / 100;
}

async function runOneEpisode(agentType = "dqn", bugProbability = 0.4) {
  const changedFiles = simulateCommit();
  const relevant = getRelevantTests(changedFiles);

  // Ask RL agent which tests to run
  const decideRes = await rl.decide(changedFiles, agentType);
  const selectedTests = decideRes.data.selected_tests || relevant;
  const epsilon = decideRes.data.epsilon || 0;

  // Simulate bug
  const bugExists = Math.random() < bugProbability;
  let bugDetected = false;
  let failedTests = [];
  let missedTests = [];

  if (bugExists) {
    const bugFile = changedFiles[Math.floor(Math.random() * changedFiles.length)];
    const bugTests = FILE_TO_TEST_MAP[bugFile] || [];
    const bugTest = bugTests[Math.floor(Math.random() * bugTests.length)];
    if (bugTest && selectedTests.includes(bugTest)) {
      bugDetected = true;
      failedTests = [bugTest];
    } else if (bugTest) {
      missedTests = [bugTest];
    }
  }

  const reward = calculateReward(bugExists, bugDetected, selectedTests.length);
  const timeSaved = Math.round((TESTS.length - selectedTests.length) * 2.1);

  const nextChanged = simulateCommit();
  await rl.update(changedFiles, selectedTests, reward, nextChanged, agentType);

  // Save episode to MongoDB
  const ep = await Episode.create({
    changedFiles, selectedTests, bugExists, bugDetected,
    failedTests, missedTests, reward, timeSaved,
    selectedCount: selectedTests.length, agentType, epsilon,
  });

  // No separate Metric needed — /api/metrics/series reads Episodes directly

  return ep;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/train
router.post("/", async (req, res) => {
  if (trainState.running) {
    return res.json({ status: "already_running", progress: trainState });
  }

  const { episodes = 200, agentType = "dqn" } = req.body;
  trainState = { running: true, current: 0, total: episodes, agentType };

  res.json({ status: "training_started", episodes, agent_type: agentType });

  // Background loop
  (async () => {
    try {
      for (let i = 1; i <= episodes; i++) {
        await runOneEpisode(agentType, 0.4);
        trainState.current = i;
        await new Promise(r => setTimeout(r, 25));
      }
    } catch (err) {
      console.error("Training loop error:", err.message);
    } finally {
      trainState.running = false;
    }
  })();
});

// GET /api/train/status
router.get("/status", (req, res) => {
  res.json(trainState);
});

// POST /api/train/reset
router.post("/reset", async (req, res) => {
  try {
    const { agentType = "dqn" } = req.body;
    await rl.reset(agentType);
    await Episode.deleteMany({});
    trainState = { running: false, current: 0, total: 0, agentType: "" };
    res.json({ status: "reset", agentType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/train/agent-status
router.get("/agent-status", async (req, res) => {
  try {
    const response = await rl.status();
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
