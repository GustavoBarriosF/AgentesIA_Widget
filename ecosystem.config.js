// El widget es un bundle estático (dist/widget.min.js).
// Este ecosystem solo se usa para regenerar el build si es necesario.
module.exports = {
  apps: [
    {
      name: "widget-build",
      cwd: "/root/apps/nexora/chat/widget",
      script: "node_modules/.bin/rollup",
      args: "-c rollup.config.js",
      interpreter: "none",
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: "production",
        BACKEND_URL: "https://backend.chat.nexoradeveloper.com",
      },
      error_file: "/root/apps/nexora/logs/widget-error.log",
      out_file: "/root/apps/nexora/logs/widget-out.log",
    },
  ],
};
