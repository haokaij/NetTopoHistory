# NetTopoHistory - 网络拓扑工具开发规范

## 1. 项目概述

**NetTopoHistory** 是一个带变更追踪与定时快照的可编辑动态网络拓扑工具，支持：
- 网络设备自动发现（Ping 扫描）
- Cytoscape.js 拓扑图展示
- 手动编辑拓扑（增删节点/连线）
- SSH 配置上传
- 历史变更追踪与对比
- 每小时自动快照

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| 拓扑图库 | Cytoscape.js 3.33+ |
| 状态管理 | Zustand |
| 持久化存储 | Dexie.js (IndexedDB) |
| Diff 算法 | jsondiffpatch |
| 后端 Ping | Node.js child_process (系统 ping) |
| SSH 执行 | ssh2 库 |
| UI 组件 | shadcn/ui + Tailwind CSS 4 |

## 3. 目录结构

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API 路由
│   │   ├── network-info/         # 获取本机网络信息
│   │   ├── ping/                # Ping 扫描接口
│   │   └── ssh/                 # SSH 执行接口
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # 主页面
├── components/
│   ├── topology/                 # 拓扑图相关组件
│   │   ├── TopologyCanvas.tsx   # Cytoscape 画布
│   │   ├── TopologyToolbar.tsx  # 工具栏
│   │   ├── NodeDetail.tsx       # 节点详情面板
│   │   └── NodeContextMenu.tsx  # 右键菜单
│   ├── history/                 # 历史记录组件
│   │   ├── HistoryPanel.tsx     # 历史面板
│   │   ├── HistoryTimeline.tsx  # 时间轴
│   │   └── DiffViewer.tsx       # 差异对比
│   ├── upload/                  # 配置上传组件
│   │   └── SshUploadDialog.tsx  # SSH 上传对话框
│   └── layout/                  # 布局组件
│       └── AppShell.tsx
├── db/                          # 数据库层
│   └── indexedDB.ts             # Dexie.js 数据库定义
├── hooks/                       # 自定义 Hooks
│   ├── useTopology.ts           # 拓扑状态管理
│   ├── usePingPolling.ts        # Ping 轮询
│   └── useSnapshot.ts           # 定时快照
├── lib/                         # 工具库
│   └── utils.ts
├── store/                       # Zustand Store
│   └── topologyStore.ts         # 拓扑状态
├── types/                       # 类型定义
│   └── index.ts
└── server.ts                    # 自定义服务端入口
```

## 4. 类型定义 (src/types/index.ts)

```typescript
// 节点状态
type NodeStatus = 'online' | 'offline' | 'high-latency';

// 网络设备节点
interface NetworkNode {
  id: string;
  ip: string;
  hostname: string;
  description?: string;
  status: NodeStatus;
  latency: number;              // ms
  lastSeen: string;             // ISO 时间戳
  position?: { x: number; y: number }; // 用户手动位置
  isGateway: boolean;
  isManuallyAdded: boolean;
  pingHistory: number[];       // 最近 5 次延迟
}

// 拓扑连线
interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  directed: boolean;
  label?: string;
}

// 完整拓扑结构
interface Topology {
  nodes: NetworkNode[];
  edges: TopologyEdge[];
  lastUpdated: string;
  version: number;
}

// 变更记录类型
type ChangeType =
  | 'node_add'
  | 'node_remove'
  | 'node_update'
  | 'edge_add'
  | 'edge_remove'
  | 'layout_change'
  | 'import'
  | 'rollback'
  | 'snapshot';

// 变更记录
interface ChangeRecord {
  id: string;
  timestamp: string;
  type: ChangeType;
  description: string;
  before?: Topology;
  after?: Topology;
  diff?: object;
  operator: string;
  note?: string;
}

// 快照记录
interface Snapshot {
  id: string;
  timestamp: string;
  type: 'snapshot';
  fullTopology: string;        // JSON 字符串
  description: string;
  permanent: boolean;
}

// SSH 配置模板
interface SshTemplate {
  id: string;
  name: string;
  commands: string[];
  description?: string;
}
```

## 5. 数据库设计 (Dexie.js)

### 表结构

```typescript
// db/indexedDB.ts
import Dexie, { Table } from 'dexie';

class NetTopoDB extends Dexie {
  topologies!: Table<Topology>;
  changes!: Table<ChangeRecord>;
  snapshots!: Table<Snapshot>;
  templates!: Table<SshTemplate>;
  settings!: Table<{ key: string; value: unknown }>;

  constructor() {
    super('NetTopoHistoryDB');
    this.version(1).stores({
      topologies: 'id, lastUpdated',
      changes: 'id, timestamp, type',
      snapshots: 'id, timestamp, permanent',
      templates: 'id, name',
      settings: 'key'
    });
  }
}
```

## 6. API 设计

### 6.1 GET /api/network-info
获取本机网络信息
```typescript
// Response
{
  localIp: string;
  subnetMask: string;
  gateway: string;
  hostname: string;
}
```

### 6.2 POST /api/ping
Ping 扫描指定 IP 列表
```typescript
// Request
{ ips: string[] }

// Response
{
  results: Array<{
    ip: string;
    online: boolean;
    latency: number;  // -1 表示离线
  }>
}
```

### 6.3 POST /api/ssh
执行 SSH 命令
```typescript
// Request
{
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  commands: string[];
  timeout?: number;  // 默认 10000ms
}

// Response
{
  success: boolean;
  results: Array<{
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
  error?: string;
}
```

## 7. 核心组件规范

### 7.1 TopologyCanvas
- 使用 Cytoscape.js 渲染拓扑图
- 支持力导向布局 (fcose)
- 节点颜色: 绿(在线) / 红(离线) / 黄(高延迟>100ms)
- 拖拽节点后保存位置到 IndexedDB
- 右键菜单支持添加/删除节点、连接、上传配置

### 7.2 HistoryPanel
- 侧边栏形式展示变更记录
- 按时间倒序，支持筛选
- 支持查看差异详情
- 支持回滚操作

### 7.3 DiffViewer
- 三种对比模式: 双图对比、叠加对比、列表对比
- 使用 jsondiffpatch 计算差异
- 新增节点绿色高亮，删除红色虚影，修改黄色

### 7.4 SnapshotManager
- 定时器每 3600000ms (1小时) 保存快照
- 保留最近 72 个快照
- 支持标记永久保留
- 支持手动保存

## 8. 安全约束

### 8.1 SSRF 防护
- Ping 接口仅允许内网 IP 范围 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- 拒绝公网 IP 地址

### 8.2 SSH 凭证
- 密码/私钥仅存内存，不持久化
- 支持超时控制 (10秒)

## 9. 开发命令

```bash
# 开发模式
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务
pnpm start

# 代码检查
pnpm lint
pnpm ts-check
```

## 10. 环境变量

```env
# 后端配置
SSH_TIMEOUT=10000        # SSH 超时 ms
MAX_PING_BATCH=64       # 单次 Ping 最大数量
PING_SCOPE=192.168.1.0/24  # 扫描范围

# 前端配置
NEXT_PUBLIC_PING_INTERVAL=30000  # Ping 轮询间隔 ms
NEXT_PUBLIC_SNAPSHOT_INTERVAL=3600000  # 快照间隔 ms
```
