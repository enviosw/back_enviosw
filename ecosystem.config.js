module.exports = {
  apps: [
    {
      name: "enviosw-api",
      script: "dist/src/main.js",

      exec_mode: "fork",   // correcto para chatbot
      instances: 1,        // solo una instancia

      autorestart: true,
      watch: false,

      // memoria segura para producción
      max_memory_restart: "800M",

      // más memoria para Node si el bot procesa mucho
      node_args: "--max-old-space-size=1024",

      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
