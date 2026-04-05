const express = require("express");
const router = express.Router();
const Episode = require("../models/Episode");

// GET /api/logs?page=1&limit=20&agentType=dqn
router.get("/", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;
    const filter = {};
    if (req.query.agentType) filter.agentType = req.query.agentType;

    const [episodes, total] = await Promise.all([
      Episode.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Episode.countDocuments(filter),
    ]);

    res.json({
      episodes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/logs  — clear all episodes
router.delete("/", async (req, res) => {
  try {
    await Episode.deleteMany({});
    res.json({ message: "All logs cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
