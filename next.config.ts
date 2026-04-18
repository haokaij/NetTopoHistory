import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),  // Uncomment and add 'import path from "path"' if needed
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
  serverExternalPackages: ['ssh2'],  // ssh2 包有 ESM 兼容性问题，交给 Node.js 处理

  // Electron 支持 - 使用 standalone 输出模式
  output: 'standalone',

  // 图片配置
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
