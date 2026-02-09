module.exports = {
  apps: [
    {
      name: "enviosw-api",
      script: "dist/src/main.js",
      exec_mode: "fork",     // ✅ fuerza fork
      instances: 1,          // ✅ se puede dejar o quitar
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
