// ============================================================
// NetTopoHistory 拓扑状态管理 (Zustand Store)
// ============================================================

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  NetworkNode,
  TopologyEdge,
  Topology,
  ChangeRecord,
  ChangeType,
  NodeStatus,
  DiffResult,
  Snapshot
} from '@/types';
import {
  saveTopology,
  getCurrentTopology,
  addChangeRecord,
  getAllChangeRecords,
  addSnapshot,
  getAllSnapshots,
  cleanupOldSnapshots,
  setSnapshotPermanent as dbSetSnapshotPermanent
} from '@/db/indexedDB';

// 最大快照数量
const MAX_SNAPSHOTS = 72;

// 快照间隔 (1小时)
const SNAPSHOT_INTERVAL = 3600000;

// ============================================================
// Store 类型定义
// ============================================================

interface TopologyState {
  // 拓扑数据
  nodes: NetworkNode[];
  edges: TopologyEdge[];

  // 网关信息
  gateway: NetworkNode | null;
  localIp: string;

  // UI 状态
  selectedNodeId: string | null;
  searchKeyword: string;
  setSearchKeyword: (keyword: string) => void;
  isLoading: boolean;
  error: string | null;

  // 历史记录
  changeRecords: ChangeRecord[];
  snapshots: Snapshot[];

  // 定时器 ID
  snapshotTimerId: ReturnType<typeof setInterval> | null;

  // Actions
  setNodes: (nodes: NetworkNode[]) => void;
  setEdges: (edges: TopologyEdge[]) => void;
  addNode: (node: Omit<NetworkNode, 'id'>) => string;
  removeNode: (id: string) => void;
  updateNode: (id: string, updates: Partial<NetworkNode>) => void;
  updateNodeStatus: (id: string, status: NodeStatus, latency: number) => void;
  addEdge: (edge: Omit<TopologyEdge, 'id'>) => string;
  removeEdge: (id: string) => void;

  // 拓扑操作
  setSelectedNode: (id: string | null) => void;
  setLocalIp: (ip: string) => void;
  setGateway: (node: NetworkNode | null) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  resetLayout: () => void;
  clearTopology: () => void;
  loadTopology: (topology: Topology) => void;

  // 持久化
  saveCurrentTopology: () => Promise<void>;
  loadFromStorage: () => Promise<void>;

  // 变更记录
  recordChange: (
    type: ChangeType,
    description: string,
    before?: Topology,
    after?: Topology,
    diff?: Record<string, unknown>
  ) => Promise<void>;
  loadChangeRecords: () => Promise<void>;
  rollbackToVersion: (record: ChangeRecord) => Promise<void>;

  // 快照
  takeSnapshot: (description?: string) => Promise<void>;
  loadSnapshots: () => Promise<void>;
  startSnapshotTimer: () => void;
  stopSnapshotTimer: () => void;
  setSnapshotPermanent: (id: string, permanent: boolean) => Promise<void>;
  restoreSnapshot: (snapshot: Snapshot) => Promise<void>;

  // 差异对比
  computeDiff: (other: Topology) => DiffResult;

  // 初始化
  initialize: (localIp: string) => Promise<void>;
}

export const useTopologyStore = create<TopologyStore>((set, get) => ({
  // 初始状态
  nodes: [],
  edges: [],
  gateway: null,
  localIp: '',
  selectedNodeId: null,
  searchKeyword: '',
  setSearchKeyword: (keyword: string) => {
    set({ searchKeyword: keyword });
  },
  isLoading: false,
  error: null,
  changeRecords: [],
  snapshots: [],
  snapshotTimerId: null,

  // ============================================================
  // 节点操作
  // ============================================================

  setNodes: (nodes: NetworkNode[]) => {
    set({ nodes });
    get().saveCurrentTopology();
  },

  setEdges: (edges: TopologyEdge[]) => {
    set({ edges });
    get().saveCurrentTopology();
  },

  addNode: (nodeData: Omit<NetworkNode, 'id'>) => {
    const id = uuidv4();
    const node: NetworkNode = { ...nodeData, id };

    set((state) => ({
      nodes: [...state.nodes, node]
    }));

    const currentNodes = get().nodes;
    const currentEdges = get().edges;

    get().recordChange('node_add', `添加节点 ${node.ip}`, undefined, {
      nodes: currentNodes,
      edges: currentEdges,
      lastUpdated: new Date().toISOString(),
      version: currentNodes.length + 1
    });

    get().saveCurrentTopology();
    return id;
  },

  removeNode: (id: string) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;

    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id)
    }));

    get().recordChange('node_remove', `删除节点 ${node.ip}`);
    get().saveCurrentTopology();
  },

  updateNode: (id: string, updates: Partial<NetworkNode>) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, ...updates, lastSeen: new Date().toISOString() } : n
      )
    }));

    get().saveCurrentTopology();
  },

  updateNodeStatus: (id: string, status: NodeStatus, latency: number) => {
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== id) return n;
        const pingHistory = [...n.pingHistory, latency].slice(-5);
        return {
          ...n,
          status,
          latency,
          pingHistory,
          lastSeen: new Date().toISOString()
        };
      })
    }));
  },

  // ============================================================
  // 连线操作
  // ============================================================

  addEdge: (edgeData: Omit<TopologyEdge, 'id'>) => {
    const id = uuidv4();
    const edge: TopologyEdge = { ...edgeData, id };

    set((state) => ({
      edges: [...state.edges, edge]
    }));

    get().recordChange('edge_add', `添加连线 ${edge.source} -> ${edge.target}`);
    get().saveCurrentTopology();
    return id;
  },

  removeEdge: (id: string) => {
    const edge = get().edges.find((e) => e.id === id);
    if (!edge) return;

    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id)
    }));

    get().recordChange('edge_remove', `删除连线 ${edge.source} -> ${edge.target}`);
    get().saveCurrentTopology();
  },

  // ============================================================
  // UI 操作
  // ============================================================

  setSelectedNode: (id: string | null) => set({ selectedNodeId: id }),
  setLocalIp: (ip: string) => set({ localIp: ip }),
  setGateway: (node: NetworkNode | null) => set({ gateway: node }),

  updateNodePosition: (id: string, x: number, y: number) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, position: { x, y } } : n
      )
    }));

    get().saveCurrentTopology();
  },

  resetLayout: () => {
    set((state) => ({
      nodes: state.nodes.map((n) => ({ ...n, position: undefined }))
    }));

    get().recordChange('layout_change', '重置拓扑布局');
    get().saveCurrentTopology();
  },

  clearTopology: () => {
    set({ nodes: [], edges: [], gateway: null, selectedNodeId: null });
    get().recordChange('node_remove', '清空拓扑图');
    get().saveCurrentTopology();
  },

  loadTopology: (topology: Topology) => {
    set({
      nodes: topology.nodes,
      edges: topology.edges
    });
  },

  // ============================================================
  // 持久化
  // ============================================================

  saveCurrentTopology: async () => {
    const { nodes, edges } = get();
    const topology: Topology = {
      nodes,
      edges,
      lastUpdated: new Date().toISOString(),
      version: Date.now()
    };
    await saveTopology(topology);
  },

  loadFromStorage: async () => {
    set({ isLoading: true, error: null });
    try {
      const topology = await getCurrentTopology();
      if (topology) {
        set({
          nodes: topology.nodes,
          edges: topology.edges
        });
      }
      await get().loadChangeRecords();
      await get().loadSnapshots();
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  // ============================================================
  // 变更记录
  // ============================================================

  recordChange: async (
    type: ChangeType,
    description: string,
    before?: Topology,
    after?: Topology,
    diff?: Record<string, unknown>
  ) => {
    const record: ChangeRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type,
      description,
      before,
      after,
      diff,
      operator: 'user'
    };
    await addChangeRecord(record);
    set((state) => ({
      changeRecords: [record, ...state.changeRecords]
    }));
  },

  loadChangeRecords: async () => {
    const records = await getAllChangeRecords();
    set({ changeRecords: records });
  },

  rollbackToVersion: async (record: ChangeRecord) => {
    const { nodes, edges } = get();
    const currentTopology: Topology = {
      nodes,
      edges,
      lastUpdated: new Date().toISOString(),
      version: Date.now()
    };

    if (record.after) {
      set({
        nodes: record.after.nodes,
        edges: record.after.edges
      });
      await get().recordChange(
        'rollback',
        `回滚到: ${record.description}`,
        currentTopology,
        record.after
      );
    } else if (record.before) {
      set({
        nodes: record.before.nodes,
        edges: record.before.edges
      });
      await get().recordChange(
        'rollback',
        `回滚到变更前状态: ${record.description}`,
        currentTopology,
        record.before
      );
    }

    await get().saveCurrentTopology();
  },

  // ============================================================
  // 快照
  // ============================================================

  takeSnapshot: async (description?: string) => {
    const { nodes, edges } = get();
    const timestamp = new Date().toISOString();
    const fullTopology: Topology = {
      nodes,
      edges,
      lastUpdated: timestamp,
      version: Date.now()
    };

    const snapshot: Snapshot = {
      id: uuidv4(),
      timestamp,
      type: 'snapshot',
      fullTopology: JSON.stringify(fullTopology),
      description: description || `定时快照 ${new Date().toLocaleString('zh-CN')}`,
      permanent: false
    };

    await addSnapshot(snapshot);
    await cleanupOldSnapshots(MAX_SNAPSHOTS);

    set((state) => ({
      snapshots: [snapshot, ...state.snapshots]
    }));

    await get().recordChange('snapshot', snapshot.description, undefined, fullTopology);
  },

  loadSnapshots: async () => {
    const loadedSnapshots = await getAllSnapshots();
    set({ snapshots: loadedSnapshots });
  },

  startSnapshotTimer: () => {
    const existingTimer = get().snapshotTimerId;
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const timerId = setInterval(() => {
      get().takeSnapshot();
    }, SNAPSHOT_INTERVAL);

    set({ snapshotTimerId: timerId });
  },

  stopSnapshotTimer: () => {
    const timerId = get().snapshotTimerId;
    if (timerId) {
      clearInterval(timerId);
      set({ snapshotTimerId: null });
    }
  },

  setSnapshotPermanent: async (id: string, permanent: boolean) => {
    const { snapshots } = get();
    const updatedSnapshots = snapshots.map((s) =>
      s.id === id ? { ...s, permanent } : s
    );
    set({ snapshots: updatedSnapshots });
    await dbSetSnapshotPermanent(id, permanent);
  },

  restoreSnapshot: async (snapshot: Snapshot) => {
    const { nodes, edges } = get();
    const currentTopology: Topology = {
      nodes,
      edges,
      lastUpdated: new Date().toISOString(),
      version: Date.now()
    };

    const restoredTopology: Topology = JSON.parse(snapshot.fullTopology);

    set({
      nodes: restoredTopology.nodes,
      edges: restoredTopology.edges
    });

    await get().recordChange(
      'rollback',
      `从快照恢复: ${snapshot.description}`,
      currentTopology,
      restoredTopology
    );

    await get().saveCurrentTopology();
  },

  // ============================================================
  // 差异对比
  // ============================================================

  computeDiff: (other: Topology) => {
    const { nodes, edges } = get();

    const nodeMap = new Map(nodes.map((n) => [n.ip, n]));
    const otherNodeMap = new Map(other.nodes.map((n) => [n.ip, n]));

    const addedNodes = other.nodes.filter((n) => !nodeMap.has(n.ip));
    const removedNodes = nodes.filter((n) => !otherNodeMap.has(n.ip));
    const modifiedNodes: Array<{ before: NetworkNode; after: NetworkNode }> = [];

    for (const node of nodes) {
      const otherNode = otherNodeMap.get(node.ip);
      if (otherNode && JSON.stringify(node) !== JSON.stringify(otherNode)) {
        modifiedNodes.push({ before: node, after: otherNode });
      }
    }

    const edgeMap = new Map(edges.map((e) => [`${e.source}-${e.target}`, e]));
    const otherEdgeMap = new Map(other.edges.map((e) => [`${e.source}-${e.target}`, e]));

    const addedEdges = other.edges.filter(
      (e) => !edgeMap.has(`${e.source}-${e.target}`)
    );
    const removedEdges = edges.filter(
      (e) => !otherEdgeMap.has(`${e.source}-${e.target}`)
    );
    const modifiedEdges: Array<{ before: TopologyEdge; after: TopologyEdge }> = [];

    for (const edge of edges) {
      const otherEdge = otherEdgeMap.get(`${edge.source}-${edge.target}`);
      if (otherEdge && JSON.stringify(edge) !== JSON.stringify(otherEdge)) {
        modifiedEdges.push({ before: edge, after: otherEdge });
      }
    }

    return {
      added: { nodes: addedNodes, edges: addedEdges },
      removed: { nodes: removedNodes, edges: removedEdges },
      modified: { nodes: modifiedNodes, edges: modifiedEdges }
    };
  },

  // ============================================================
  // 初始化
  // ============================================================

  initialize: async (localIp: string) => {
    set({ isLoading: true, error: null, localIp });
    try {
      await get().loadFromStorage();
      get().startSnapshotTimer();
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set({ isLoading: false });
    }
  }
}));

// 修复 zustand 类型问题
type TopologyStore = Omit<TopologyState, 'recordChange'> & {
  recordChange: (
    type: ChangeType,
    description: string,
    before?: Topology,
    after?: Topology,
    diff?: Record<string, unknown>
  ) => Promise<void>;
};

export default useTopologyStore;
