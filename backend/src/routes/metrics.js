const express = require("express");
const router = express.Router();
const Episode = require("../models/Episode");
const rl = require("../services/rlClient");

// GET /api/metrics  — aggregate dashboard numbers
router.get("/", async (req, res) => {
  try {
    const total = await Episode.countDocuments();
    if (total === 0) {
      return res.json({
        totalEpisodes: 0, accuracy: 0, avgTestsSelected: 0,
        avgReward: 0, avgTimeSaved: 0, testReductionPct: 0,
      });
    }

    const agg = await Episode.aggregate([
      {
        $group: {
          _id: null,
          totalEpisodes:    { $sum: 1 },
          bugsAvoided:      { $sum: { $cond: ["$bugDetected", 1, 0] } },
          bugsExisted:      { $sum: { $cond: ["$bugExists", 1, 0] } },
          avgTestsSelected: { $avg: "$selectedCount" },
          avgReward:        { $avg: "$reward" },
          avgTimeSaved:     { $avg: "$timeSaved" },
          totalTimeSaved:   { $sum: "$timeSaved" },
        },
      },
    ]);

    const d = agg[0];
    const accuracy = d.bugsExisted > 0 ? d.bugsAvoided / d.bugsExisted : 1;
    const TOTAL_TESTS = 17;
    const testReductionPct = ((TOTAL_TESTS - d.avgTestsSelected) / TOTAL_TESTS) * 100;

    // Also fetch agent stats from RL engine
    let agentStats = {};
    try {
      const statusRes = await rl.status();
      agentStats = statusRes.data;
    } catch (_) {}

    res.json({
      totalEpisodes: d.totalEpisodes,
      accuracy:      Math.round(accuracy * 100) / 100,
      avgTestsSelected: Math.round(d.avgTestsSelected * 10) / 10,
      avgReward:     Math.round(d.avgReward * 100) / 100,
      avgTimeSaved:  Math.round(d.avgTimeSaved),
      totalTimeSaved: d.totalTimeSaved,
      testReductionPct: Math.round(testReductionPct * 10) / 10,
      agentStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/metrics/series?limit=200  — time-series for charts
router.get("/series", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 5000);
    const episodes = await Episode.find()
      .sort({ createdAt: 1 })
      .limit(limit)
      .select("reward selectedCount bugDetected bugExists epsilon createdAt agentType");

    // Build rolling accuracy
    let correct = 0;
    const series = episodes.map((ep, i) => {
      const correctOutcome =
        (ep.bugExists && ep.bugDetected) || (!ep.bugExists && !ep.bugDetected);
      if (correctOutcome) correct++;
      return {
        episode: i + 1,
        reward: ep.reward,
        testsSelected: ep.selectedCount,
        accuracy: Math.round((correct / (i + 1)) * 1000) / 1000,
        epsilon: ep.epsilon,
        agentType: ep.agentType,
      };
    });

    res.json({ series });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
