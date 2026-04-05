const express = require("express");
const router = express.Router();
const rl = require("../services/rlClient");
const Episode = require("../models/Episode");

const TOTAL_TESTS = 17;
const TOTAL_TIME_PER_TEST = 2; // avg seconds per test

function computeTimeSaved(selectedCount) {
  return Math.round((TOTAL_TESTS - selectedCount) * TOTAL_TIME_PER_TEST);
}

function calculateReward(bugExists, bugDetected, selectedCount) {
  let reward = 0;
  if (bugExists) {
    reward += bugDetected ? 10 : -10;
  } else {
    reward += 2;
  }
  const efficiency = (TOTAL_TESTS - selectedCount) / TOTAL_TESTS;
  reward += efficiency * 5;
  return Math.round(reward * 100) / 100;
}

// POST /api/simulate
router.post("/", async (req, res) => {
  try {
    const agentType = req.body.agentType || "dqn";
    const bugProbability = req.body.bugProbability ?? 0.35;

    // 1. Get changed files (from request or simulate)
    let changedFiles = req.body.changedFiles;
    if (!changedFiles || changedFiles.length === 0) {
      const commitRes = await rl.simulateCommit();
      changedFiles = commitRes.data.changed_files;
    }

    // 2. Ask RL agent which tests to select
    const decideRes = await rl.decide(changedFiles, agentType);
    const { selected_tests: selectedTests, epsilon } = decideRes.data;

    // 3. Simulate test execution (local logic mirrors environment.py)
    const FILES_MAP = {
      "auth.js":    ["test_auth_login", "test_auth_logout", "test_auth_register"],
      "payment.js": ["test_payment_process", "test_payment_refund", "test_payment_validation"],
      "profile.js": ["test_profile_update", "test_profile_avatar", "test_user_crud"],
      "search.js":  ["test_search_query", "test_search_filter"],
      "user.js":    ["test_user_crud", "test_user_permissions"],
      "db.js":      ["test_db_connection", "test_db_queries"],
      "utils.js":   ["test_utils_helpers"],
      "api.js":     ["test_auth_login", "test_payment_process", "test_search_query"],
      "cache.js":   ["test_cache_hit", "test_db_queries"],
      "email.js":   ["test_email_send", "test_user_crud"],
    };
    const relevant = [...new Set(changedFiles.flatMap(f => FILES_MAP[f] || []))];
    const bugExists = Math.random() < bugProbability;
    let bugDetected = false;
    let failedTests = [];
    let missedTests = relevant.filter(t => !selectedTests.includes(t));

    if (bugExists && relevant.length > 0) {
      const bugTest = relevant[Math.floor(Math.random() * relevant.length)];
      if (selectedTests.includes(bugTest)) {
        bugDetected = true;
        failedTests = [bugTest];
      }
    }

    // 4. Calculate reward
    const reward = calculateReward(bugExists, bugDetected, selectedTests.length);
    const timeSaved = computeTimeSaved(selectedTests.length);

    // 5. Update RL agent
    const nextCommit = await rl.simulateCommit();
    await rl.update(changedFiles, selectedTests, reward, nextCommit.data.changed_files, agentType);

    // 6. Persist to MongoDB
    const episode = await Episode.create({
      changedFiles,
      selectedTests,
      bugExists,
      bugDetected,
      failedTests,
      missedTests,
      reward,
      timeSaved,
      timeTaken: Math.round(selectedTests.length * 2),
      totalTests: TOTAL_TESTS,
      selectedCount: selectedTests.length,
      agentType,
      epsilon,
    });

    res.json({
      success: true,
      episodeId: episode._id,
      changedFiles,
      selectedTests,
      relevantTests: relevant,
      bugExists,
      bugDetected,
      failedTests,
      missedTests,
      reward,
      timeSaved,
      epsilon,
      agentType,
    });
  } catch (err) {
    console.error("Simulate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
