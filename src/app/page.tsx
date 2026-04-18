// ============================================================
// NetTopoHistory - 网络拓扑工具主页面
// ============================================================

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Network,
  History,
  GitCompare,
  AlertTriangle,
  Loader2,
  Wifi
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTopologyStore } from '@/store/topologyStore';
import { usePingPolling } from '@/hooks/usePingPolling';
import TopologyToolbar from '@/components/topology/TopologyToolbar';
import NodeDetail from '@/components/topology/NodeDetail';
import HistoryPanel from '@/components/history/HistoryPanel';
import SshUploadDialog from '@/components/upload/SshUploadDialog';
import DiffViewer from '@/components/history/DiffViewer';
import type { NetworkNode, Snapshot, ChangeRecord, DiffResult, TopologyEdge } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// 动态导入 Cytoscape 组件（避免 SSR 问题）
const TopologyCanvas = dynamic(
  () => import('@/components/topology/TopologyCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[400px] bg-slate-900 rounded-lg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }
);

export default function HomePage() {
  const {
    nodes,
    edges,
    gateway,
    selectedNodeId,
    localIp,
    isLoading,
    error,
    initialize,
    addNode,
    addEdge,
    setGateway,
    loadTopology,
    takeSnapshot,
    rollbackToVersion,
    restoreSnapshot
  } = useTopologyStore();

  // UI 状态
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [isSshDialogOpen, setIsSshDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [compareTarget, setCompareTarget] = useState<{
    nodes: NetworkNode[];
    edges: TopologyEdge[];
    label?: string;
  } | null>(null);

  // Ping 轮询
  const { isScanning, scanNetwork } = usePingPolling({
    interval: 30000,
    enabled: true
  });

  // 初始化
  useEffect(() => {
    initialize('');
  }, [initialize]);

  // 更新选中的节点详情
  useEffect(() => {
    if (selectedNodeId) {
      const node = nodes.find((n: NetworkNode) => n.id === selectedNodeId);
      setSelectedNode(node || null);
    } else {
      setSelectedNode(null);
    }
  }, [selectedNodeId, nodes]);

  // 处理网络扫描
  const handleScanNetwork = useCallback(async () => {
    try {
      const result = await scanNetwork();

      // 更新网关
      if (result.networkInfo.gateway && !gateway) {
        const gatewayNode: NetworkNode = {
          id: uuidv4(),
          ip: result.networkInfo.gateway,
          hostname: result.networkInfo.gateway,
          status: 'offline',
          latency: -1,
          lastSeen: new Date().toISOString(),
          isGateway: true,
          isManuallyAdded: false,
          pingHistory: []
        };
        addNode(gatewayNode);
        setGateway(gatewayNode);
      }

      // 添加在线设备
      const existingIps = new Set(nodes.map((n: NetworkNode) => n.ip));

      for (const pingResult of result.scanResults) {
        if (pingResult.online && !existingIps.has(pingResult.ip)) {
          // 跳过网关（已添加）
          if (pingResult.ip === result.networkInfo.gateway) continue;

          const newNode: NetworkNode = {
            id: uuidv4(),
            ip: pingResult.ip,
            hostname: pingResult.ip,
            status: 'online',
            latency: pingResult.latency,
            lastSeen: new Date().toISOString(),
            isGateway: false,
            isManuallyAdded: false,
            pingHistory: [pingResult.latency]
          };
          addNode(newNode);
        }
      }

      // 自动创建到网关的连线
      if (gateway && nodes.length > 0) {
        const { addEdge, edges: currentEdges } = useTopologyStore.getState();
        const existingEdges = new Set(
          currentEdges.map((e: TopologyEdge) => `${e.source}-${e.target}`)
        );

        for (const node of nodes) {
          if (node.id !== gateway.id) {
            const edgeKey1 = `${gateway.id}-${node.id}`;
            const edgeKey2 = `${node.id}-${gateway.id}`;

            if (!existingEdges.has(edgeKey1) && !existingEdges.has(edgeKey2)) {
              addEdge({
                source: gateway.id,
                target: node.id,
                directed: false
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Scan failed:', err);
    }
  }, [scanNetwork, gateway, nodes, addNode, setGateway]);

  // 添加节点
  const handleAddNode = useCallback(
    (ip: string, hostname?: string, description?: string) => {
      const newNode: NetworkNode = {
        id: uuidv4(),
        ip,
        hostname: hostname || ip,
        description,
        status: 'offline',
        latency: -1,
        lastSeen: new Date().toISOString(),
        isGateway: false,
        isManuallyAdded: true,
        pingHistory: []
      };

      addNode(newNode);

      // 如果有网关，自动连线
      if (gateway) {
        addEdge({
          source: gateway.id,
          target: newNode.id,
          directed: false
        });
      }
    },
    [addNode, gateway, addEdge]
  );

  // 处理添加连线
  const handleAddEdge = useCallback(
    (sourceId: string, targetId: string) => {
      addEdge({
        source: sourceId,
        target: targetId,
        directed: false
      });
    },
    [addEdge]
  );

  // 清空拓扑
  const handleClearTopology = useCallback(() => {
    if (confirm('确定要清空所有拓扑数据吗？此操作不可恢复。')) {
      const { clearTopology } = useTopologyStore.getState();
      clearTopology();
    }
  }, []);

  // 重置布局
  const handleResetLayout = useCallback(() => {
    const { resetLayout } = useTopologyStore.getState();
    resetLayout();
  }, []);

  // 保存快照
  const handleTakeSnapshot = useCallback(async () => {
    const description = prompt(
      '请输入快照描述（可选）：',
      `手动快照 ${new Date().toLocaleString('zh-CN')}`
    );
    await takeSnapshot(description || undefined);
  }, [takeSnapshot]);

  // 回滚
  const handleRollback = useCallback(
    (record: ChangeRecord) => {
      if (confirm(`确定要回滚到 "${record.description}" 吗？`)) {
        rollbackToVersion(record);
      }
    },
    [rollbackToVersion]
  );

  // 恢复快照
  const handleRestoreSnapshot = useCallback(
    async (snapshot: Snapshot) => {
      if (confirm(`确定要恢复到快照 "${snapshot.description}" 吗？`)) {
        await restoreSnapshot(snapshot);
      }
    },
    [restoreSnapshot]
  );

  // 打开对比
  const handleOpenDiff = useCallback(
    (target?: typeof compareTarget) => {
      setCompareTarget(target || null);
      setIsDiffOpen(true);
    },
    []
  );

  // 错误提示
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-white">加载失败</h2>
          <p className="text-slate-400">{error}</p>
          <Button onClick={() => window.location.reload()}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white">
      {/* 顶部导航 */}
      <header className="h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-slate-800">
        <div className="flex items-center gap-3">
          <Network className="h-6 w-6 text-blue-400" />
          <h1 className="text-lg font-semibold">NetTopoHistory</h1>
          <Badge variant="outline" className="text-xs bg-slate-700/50">
            {nodes.length} 设备
          </Badge>
          {localIp && (
            <Badge variant="outline" className="text-xs bg-slate-700/50">
              <Wifi className="h-3 w-3 mr-1" />
              {localIp}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 扫描按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleScanNetwork}
            disabled={isScanning}
            className="bg-slate-700 border-slate-600 hover:bg-slate-600"
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Network className="h-4 w-4 mr-2" />
            )}
            {isScanning ? '扫描中...' : '扫描网络'}
          </Button>

          {/* 历史面板 */}
          <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <History className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:max-w-[400px] p-0">
              <div className="h-full">
                <HistoryPanel
                  onRollback={handleRollback}
                  onRestoreSnapshot={handleRestoreSnapshot}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* 对比按钮 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenDiff()}
                  className="text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  <GitCompare className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>对比历史版本</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 拓扑画布 */}
        <div className="flex-1 flex flex-col p-4 gap-2">
          <TopologyToolbar
            onAddNode={handleAddNode}
            onAddEdge={handleAddEdge}
            onScanNetwork={handleScanNetwork}
            onClearTopology={handleClearTopology}
            onResetLayout={handleResetLayout}
            onTakeSnapshot={handleTakeSnapshot}
            isScanning={isScanning}
          />

          <div className="flex-1 rounded-lg overflow-hidden">
            {isLoading ? (
              <Skeleton className="w-full h-full bg-slate-800" />
            ) : (
              <TopologyCanvas
                onNodeSelect={(node) => setSelectedNode(node)}
                onNodeRightClick={(node) => {
                  if (node) setSelectedNode(node);
                }}
              />
            )}
          </div>
        </div>

        {/* 侧边详情面板 */}
        <aside className="w-[350px] p-4 overflow-auto border-l border-slate-700 bg-slate-800/50">
          <NodeDetail
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onUploadConfig={(node) => {
              setSelectedNode(node);
              setIsSshDialogOpen(true);
            }}
          />
        </aside>
      </div>

      {/* SSH 上传对话框 */}
      <SshUploadDialog
        open={isSshDialogOpen}
        onOpenChange={setIsSshDialogOpen}
        targetNode={selectedNode}
      />

      {/* 差异对比对话框 */}
      {isDiffOpen && (
        <DiffViewer
          currentTopology={{ nodes, edges }}
          otherTopology={compareTarget || null}
          otherLabel={compareTarget?.label || '选择版本'}
          onClose={() => setIsDiffOpen(false)}
          onRestore={(topology) => {
            loadTopology({
              ...topology,
              lastUpdated: new Date().toISOString(),
              version: Date.now()
            });
            setIsDiffOpen(false);
          }}
        />
      )}

      {/* 扫描进度提示 */}
      {isScanning && (
        <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span className="text-slate-300">正在扫描网络...</span>
          </div>
        </div>
      )}
    </div>
  );
}
