import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@whiskeysockets/baileys", "pino", "exceljs", "pdf-lib"],
  agentRules: false,
};

export default nextConfig;
