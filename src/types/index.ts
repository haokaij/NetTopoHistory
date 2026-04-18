// ============================================================
// NetTopoHistory 类型定义
// ============================================================

// 节点状态枚举
export type NodeStatus = 'online' | 'offline' | 'high-latency';

// 网络设备节点
export interface NetworkNode {
  id: string;
  ip: string;
  hostname: string;
  description?: string;
  status: NodeStatus;
  latency: number; // ms, -1 表示离线
  lastSeen: string; // ISO 时间戳
  position?: { x: number; y: number }; // 用户手动位置
  isGateway: boolean;
  isManuallyAdded: boolean;
  pingHistory: number[]; // 最近 5 次延迟
}

// 拓扑连线
export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  directed: boolean;
  label?: string;
}

// 完整拓扑结构
export interface Topology {
  nodes: NetworkNode[];
  edges: TopologyEdge[];
  lastUpdated: string;
  version: number;
}

// 变更记录类型
export type ChangeType =
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
export interface ChangeRecord {
  id: string;
  timestamp: string;
  type: ChangeType;
  description: string;
  before?: Topology;
  after?: Topology;
  diff?: Record<string, unknown>;
  operator: string;
  note?: string;
}

// 快照记录
export interface Snapshot {
  id: string;
  timestamp: string;
  type: 'snapshot';
  fullTopology: string; // JSON 字符串
  description: string;
  permanent: boolean;
}

// SSH 配置模板
export interface SshTemplate {
  id: string;
  name: string;
  commands: string[];
  description?: string;
}

// SSH 执行请求
export interface SshExecuteRequest {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  commands: string[];
  timeout?: number; // 默认 10000ms
}

// SSH 执行结果
export interface SshExecuteResult {
  success: boolean;
  results: Array<{
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
  error?: string;
}

// Ping 扫描请求
export interface PingRequest {
  ips: string[];
}

// Ping 扫描结果项
export interface PingResultItem {
  ip: string;
  online: boolean;
  latency: number; // -1 表示离线
}

// Ping 扫描响应
export interface PingResponse {
  results: PingResultItem[];
}

// 网络信息
export interface NetworkInfo {
  localIp: string;
  subnetMask: string;
  gateway: string;
  hostname: string;
}

// 对比模式
export type DiffMode = 'dual' | 'overlay' | 'list';

// 对比结果
export interface DiffResult {
  added: {
    nodes: NetworkNode[];
    edges: TopologyEdge[];
  };
  removed: {
    nodes: NetworkNode[];
    edges: TopologyEdge[];
  };
  modified: {
    nodes: Array<{ before: NetworkNode; after: NetworkNode }>;
    edges: Array<{ before: TopologyEdge; after: TopologyEdge }>;
  };
}

// Cytoscape 节点数据
export interface CytoscapeNodeData {
  id: string;
  label: string;
  ip: string;
  status: NodeStatus;
  latency: number;
  hostname: string;
  description?: string;
  isGateway: boolean;
}

// Cytoscape 边数据
export interface CytoscapeEdgeData {
  id: string;
  source: string;
  target: string;
  directed: boolean;
  label?: string;
}

// 应用设置
export interface AppSettings {
  pingInterval: number; // ms
  snapshotInterval: number; // ms
  maxSnapshots: number;
  defaultGateway?: string;
}
