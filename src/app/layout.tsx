import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'NetTopoHistory',
    template: '%s | NetTopoHistory',
  },
  description:
    '带变更追踪与定时快照的可编辑动态网络拓扑工具。支持网络设备自动发现、拓扑图可视化、手动编辑、SSH配置上传和历史对比。',
  keywords: [
    '网络拓扑',
    '网络扫描',
    '拓扑图',
    '网络监控',
    'SSH',
    '网络管理',
    '拓扑对比',
    '网络工具',
  ],
  authors: [{ name: 'NetTopoHistory Team' }],
  generator: 'Next.js + Cytoscape.js',
};

// 开发环境使用 Inspector
const InspectorWrapper = process.env.NODE_ENV === 'development' ? Inspector : React.Fragment;

import React from 'react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased">
        <InspectorWrapper>
          {children}
        </InspectorWrapper>
      </body>
    </html>
  );
}
