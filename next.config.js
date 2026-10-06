const nextConfig = {
  // "standalone" é só pro Docker self-hosted — na Vercel ela gera o próprio
  // output e "standalone" quebra o build, então só entra fora dela.
  ...(!process.env.VERCEL && { output: "standalone" }),
  // O driver nativo do libSQL não pode ser empacotado pelo bundler.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Bind mount do Windows -> WSL2 não propaga inotify; só polling detecta
  // mudanças pra hot-reload no container de dev.
  ...(process.env.WATCHPACK_POLLING === "true" && {
    webpack: (config) => {
      config.watchOptions = { poll: 1000, aggregateTimeout: 300 };
      return config;
    },
  }),
};

module.exports = nextConfig;
