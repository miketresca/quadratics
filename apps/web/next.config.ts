import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@quadratics/types", "@quadratics/config"]
};

export default nextConfig;
