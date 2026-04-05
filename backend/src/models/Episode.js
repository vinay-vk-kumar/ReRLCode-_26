const mongoose = require("mongoose");

const EpisodeSchema = new mongoose.Schema(
  {
    changedFiles:   { type: [String], required: true },
    selectedTests:  { type: [String], required: true },
    bugExists:      { type: Boolean, required: true },
    bugDetected:    { type: Boolean, required: true },
    failedTests:    { type: [String], default: [] },
    missedTests:    { type: [String], default: [] },
    reward:         { type: Number, required: true },
    timeSaved:      { type: Number, default: 0 },
    timeTaken:      { type: Number, default: 0 },
    totalTests:     { type: Number, default: 17 },
    selectedCount:  { type: Number, required: true },
    agentType:      { type: String, enum: ["dqn", "q_learning"], default: "dqn" },
    epsilon:        { type: Number, default: 0 },
    episode:        { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Episode", EpisodeSchema);
