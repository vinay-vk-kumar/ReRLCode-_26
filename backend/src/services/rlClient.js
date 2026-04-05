const axios = require("axios");

const RL_BASE = process.env.RL_ENGINE_URL || "http://localhost:8000";

const rlClient = axios.create({
  baseURL: RL_BASE,
  timeout: 30_000,
});

module.exports = {
  decide: (changedFiles, agentType = "dqn", topK = null) =>
    rlClient.post("/rl/decide", {
      changed_files: changedFiles,
      agent_type: agentType,
      top_k: topK,
    }),

  update: (changedFiles, selectedTests, reward, nextChangedFiles, agentType = "dqn") =>
    rlClient.post("/rl/update", {
      changed_files: changedFiles,
      selected_tests: selectedTests,
      reward,
      next_changed_files: nextChangedFiles,
      agent_type: agentType,
    }),

  train: (episodes = 200, agentType = "dqn") =>
    rlClient.post("/rl/train", { episodes, agent_type: agentType }),

  trainingStatus: () => rlClient.get("/rl/training-status"),

  reset: (agentType = "dqn") =>
    rlClient.post(`/rl/reset?agent_type=${agentType}`),

  status: () => rlClient.get("/rl/status"),

  simulateCommit: () => rlClient.get("/rl/simulate-commit"),
};
