module.exports = {
  apps: [
    {
      name: "backend_envios_w",
      script: "dist/src/main.js",

      exec_mode: "fork",
      instances: 1,

      autorestart: true,
      watch: false,

      max_memory_restart: "1500M",
      node_args: "--max-old-space-size=2048",

      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};