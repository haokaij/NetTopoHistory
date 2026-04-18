# NetTopoHistory

带变更追踪与定时快照的可编辑动态网络拓扑工具。

## 功能特性

- **网络设备自动发现** - 通过 Ping 扫描自动发现同网段内的在线设备
- **动态拓扑图展示** - 使用 Cytoscape.js 渲染实时网络拓扑
- **手动编辑拓扑** - 支持添加/删除节点和连线，拖拽调整布局
- **配置上传** - 支持通过 SSH 向设备批量执行配置命令
- **历史变更追踪** - 完整记录所有拓扑变更，支持回滚
- **定时快照** - 每小时自动保存拓扑快照，保留最近 72 个
- **拓扑对比** - 支持双图对比、叠加对比和列表对比三种模式

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + React 19 + TypeScript |
| 拓扑图库 | Cytoscape.js |
| 状态管理 | Zustand |
| 持久化存储 | Dexie.js (IndexedDB) |
| Diff 算法 | jsondiffpatch |
| 后端 Ping | Node.js child_process |
| SSH 执行 | ssh2 |
| UI 组件 | shadcn/ui + Tailwind CSS |

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 9+

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

启动后访问 [http://localhost:5000](http://localhost:5000)

### 构建生产版本

```bash
pnpm build
```

### 启动生产服务

```bash
pnpm start
```

## 使用说明

### 1. 网络扫描

点击工具栏右侧的「扫描网络」按钮，应用将自动：

1. 获取本机网络信息（IP、网关）
2. 扫描 /24 网段内的所有 IP
3. 在拓扑图中显示在线设备
4. 自动创建到网关的连线

### 2. 手动添加节点

点击工具栏的「+」按钮，输入：

- **IP 地址**（必填）
- **主机名**（可选）
- **描述**（可选）

### 3. 编辑拓扑

- **拖拽节点** - 调整位置
- **点击节点** - 查看详情
- **右键节点** - 上下文菜单
- **Delete 键** - 删除选中元素

### 4. 上传配置

1. 点击选中节点
2. 切换到「操作」标签
3. 点击「上传配置」
4. 输入 SSH 凭证和命令

### 5. 历史记录

- 点击右上角「历史」按钮打开面板
- 支持按类型筛选、搜索
- 点击回滚按钮恢复历史版本

### 6. 快照管理

- 每小时自动保存一次快照
- 点击工具栏「设置」按钮可手动保存
- 快照可标记为「永久保留」

## API 接口

### GET /api/network-info

获取本机网络信息。

```bash
curl http://localhost:5000/api/network-info
```

响应示例：
```json
{
  "localIp": "192.168.1.100",
  "subnetMask": "255.255.255.0",
  "gateway": "192.168.1.1",
  "hostname": "my-computer"
}
```

### POST /api/ping

对指定 IP 列表执行 Ping 探测。

```bash
curl -X POST http://localhost:5000/api/ping \
  -H "Content-Type: application/json" \
  -d '{"ips": ["192.168.1.1", "192.168.1.100", "192.168.1.200"]}'
```

响应示例：
```json
{
  "results": [
    {"ip": "192.168.1.1", "online": true, "latency": 2.5},
    {"ip": "192.168.1.100", "online": true, "latency": 5.1},
    {"ip": "192.168.1.200", "online": false, "latency": -1}
  ]
}
```

### POST /api/ssh

在远程设备上执行 SSH 命令。

```bash
curl -X POST http://localhost:5000/api/ssh \
  -H "Content-Type: application/json" \
  -d '{
    "host": "192.168.1.1",
    "username": "admin",
    "password": "password",
    "commands": ["display version", "display interface"],
    "timeout": 10000
  }'
```

响应示例：
```json
{
  "success": true,
  "results": [
    {
      "command": "display version",
      "stdout": "Version 5.20 ...",
      "stderr": "",
      "exitCode": 0
    }
  ]
}
```

## Docker 部署

### 构建镜像

```bash
docker build -t nettopohistory .
```

### 使用 Docker Compose 启动

```bash
docker-compose up -d
```

访问 [http://localhost:5000](http://localhost:5000)

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| NODE_ENV | 运行环境 | production |
| PORT | 服务端口 | 5000 |
| SSH_TIMEOUT | SSH 超时时间 (ms) | 10000 |
| MAX_PING_BATCH | Ping 批量大小 | 64 |

## 安全说明

1. **内网限制** - Ping 和 SSH 接口仅允许内网 IP 访问
2. **凭证不持久化** - SSH 密码/私钥仅存内存，不写入存储
3. **超时保护** - SSH 执行默认 10 秒超时

## 浏览器兼容性

- Chrome 90+
- Firefox 90+
- Edge 90+
- Safari 14+

## 数据存储

| 数据类型 | 存储位置 | 说明 |
|----------|----------|------|
| 拓扑结构 | IndexedDB | 浏览器本地存储 |
| 历史记录 | IndexedDB | 变更追踪 |
| 快照 | IndexedDB | 最近 72 个 |
| SSH 模板 | IndexedDB | 用户配置 |
| SSH 凭证 | 内存 | 不持久化 |

## 许可证

MIT License
