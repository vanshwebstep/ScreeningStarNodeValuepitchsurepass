module.exports = {
    apps: [
      {
        name: "screeningstarnode",
        script: "src/index.js", // Change this to your main file (e.g., index.js, server.js)
        exec_mode: "cluster",
        instances: 4, // Number of instances
        autorestart: true,
        watch: false,
        max_memory_restart: "300M", // Restart if memory exceeds 300MB
        env: {
          NODE_ENV: "production",
        },
        env_development: {
          NODE_ENV: "development",
        },
      },
    ],
  };
  