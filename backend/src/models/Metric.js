const mongoose = require("mongoose");

const MetricSchema = new mongoose.Schema(
  {
    episode:          { type: Number, required: true },
    accuracy:         { type: Number, required: true },
    avgTestsSelected: { type: Number, required: true },
    avgReward:        { type: Number, required: true },
    epsilon:          { type: Number, required: true },
    agentType:        { type: String, default: "dqn" },
    loss:             { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Metric", MetricSchema);
