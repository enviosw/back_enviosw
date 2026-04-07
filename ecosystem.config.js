module.exports = {
  apps: [
    {
      name: "enviosw-api",
      script: "dist/src/main.js",

      exec_mode: "fork",
      instances: 1,

      autorestart: true,
      watch: false,

      max_memory_restart: "1.5G",
      node_args: "--max-old-space-size=2048",

      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};