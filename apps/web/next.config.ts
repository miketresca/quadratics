import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@quadratics/types", "@quadratics/config"]
};

export default nextConfig;
