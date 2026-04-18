// ============================================================
// DiffViewer - 拓扑对比视图
// ============================================================

'use client';

import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, Edit, ArrowRight, Columns, Layers, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useTopologyStore } from '@/store/topologyStore';
import TopologyCanvas from '@/components/topology/TopologyCanvas';
import type { DiffResult, DiffMode, Snapshot, ChangeRecord, NetworkNode, TopologyEdge, Topology } from '@/types';

interface DiffViewerProps {
  currentTopology: { nodes: NetworkNode[]; edges: TopologyEdge[] };
  otherTopology: { nodes: NetworkNode[]; edges: TopologyEdge[] } | null;
  otherLabel?: string;
  onClose: () => void;
  onRestore?: (topology: { nodes: NetworkNode[]; edges: TopologyEdge[] }) => void;
}

export default function DiffViewer({
  currentTopology,
  otherTopology,
  otherLabel = '对比版本',
  onClose,
  onRestore
}: DiffViewerProps) {
  const [diffMode, setDiffMode] = useState<DiffMode>('list');
  const { computeDiff } = useTopologyStore();

  // 计算差异
  const diffResult: DiffResult = useMemo(() => {
    if (!otherTopology) {
      return {
        added: { nodes: [], edges: [] },
        removed: { nodes: [], edges: [] },
        modified: { nodes: [], edges: [] }
      };
    }
    const otherAsTopology: Topology = {
      nodes: otherTopology.nodes,
      edges: otherTopology.edges,
      lastUpdated: '',
      version: 0
    };
    return computeDiff(otherAsTopology);
  }, [otherTopology, computeDiff]);

  // 总差异数
  const totalDiff =
    diffResult.added.nodes.length +
    diffResult.added.edges.length +
    diffResult.removed.nodes.length +
    diffResult.removed.edges.length +
    diffResult.modified.nodes.length +
    diffResult.modified.edges.length;

  if (!otherTopology) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-lg p-6 max-w-md text-center">
          <p className="text-slate-400 mb-4">请选择要对比的版本</p>
          <Button onClick={onClose}>关闭</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">拓扑对比</h2>
            <Badge variant="secondary">{totalDiff} 处差异</Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* 对比模式切换 */}
            <Tabs value={diffMode} onValueChange={(v) => setDiffMode(v as DiffMode)}>
              <TabsList>
                <TabsTrigger value="list" className="px-2">
                  <List className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="overlay" className="px-2">
                  <Layers className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="dual" className="px-2">
                  <Columns className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-hidden">
          {diffMode === 'list' && (
            <DiffListView diffResult={diffResult} />
          )}
          {diffMode === 'overlay' && (
            <OverlayView
              currentTopology={currentTopology}
              otherTopology={otherTopology}
              diffResult={diffResult}
            />
          )}
          {diffMode === 'dual' && (
            <DualView
              currentTopology={currentTopology}
              otherTopology={otherTopology}
              currentLabel="当前"
              otherLabel={otherLabel}
            />
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700">
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          {onRestore && (
            <Button onClick={() => onRestore(otherTopology)}>
              恢复到此版本
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// 列表对比视图
function DiffListView({ diffResult }: { diffResult: DiffResult }) {
  const { added, removed, modified } = diffResult;

  const hasChanges =
    added.nodes.length > 0 ||
    added.edges.length > 0 ||
    removed.nodes.length > 0 ||
    removed.edges.length > 0 ||
    modified.nodes.length > 0 ||
    modified.edges.length > 0;

  if (!hasChanges) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <p>两个版本完全相同</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full p-4">
      <div className="space-y-6">
        {/* 新增节点 */}
        {added.nodes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Plus className="h-4 w-4 text-green-500" />
              <Label className="text-green-400">新增节点 ({added.nodes.length})</Label>
            </div>
            <div className="space-y-2">
              {added.nodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center gap-2 p-2 bg-green-500/10 rounded border border-green-500/30"
                >
                  <span className="text-green-400">+</span>
                  <span className="font-mono text-white">{node.ip}</span>
                  <span className="text-slate-400">{node.hostname}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 删除节点 */}
        {removed.nodes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Minus className="h-4 w-4 text-red-500" />
              <Label className="text-red-400">删除节点 ({removed.nodes.length})</Label>
            </div>
            <div className="space-y-2">
              {removed.nodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center gap-2 p-2 bg-red-500/10 rounded border border-red-500/30"
                >
                  <span className="text-red-400">-</span>
                  <span className="font-mono text-white">{node.ip}</span>
                  <span className="text-slate-400">{node.hostname}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 修改节点 */}
        {modified.nodes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Edit className="h-4 w-4 text-yellow-500" />
              <Label className="text-yellow-400">修改节点 ({modified.nodes.length})</Label>
            </div>
            <div className="space-y-2">
              {modified.nodes.map(({ before, after }) => (
                <div
                  key={before.id}
                  className="p-3 bg-yellow-500/10 rounded border border-yellow-500/30"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                    <span className="font-mono text-white">{before.ip}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">主机名: </span>
                      <span className={before.hostname !== after.hostname ? 'text-red-400 line-through' : 'text-slate-300'}>
                        {before.hostname || '-'}
                      </span>
                      {before.hostname !== after.hostname && (
                        <>
                          <span className="text-slate-400 mx-1">→</span>
                          <span className="text-green-400">{after.hostname || '-'}</span>
                        </>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500">状态: </span>
                      <span className="text-slate-300">{before.status}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className="text-slate-300">{after.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 新增连线 */}
        {added.edges.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Plus className="h-4 w-4 text-green-500" />
              <Label className="text-green-400">新增连线 ({added.edges.length})</Label>
            </div>
            <div className="space-y-2">
              {added.edges.map((edge) => (
                <div
                  key={edge.id}
                  className="flex items-center gap-2 p-2 bg-green-500/10 rounded border border-green-500/30"
                >
                  <span className="text-green-400">+</span>
                  <span className="font-mono text-white">{edge.source}</span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span className="font-mono text-white">{edge.target}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 删除连线 */}
        {removed.edges.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Minus className="h-4 w-4 text-red-500" />
              <Label className="text-red-400">删除连线 ({removed.edges.length})</Label>
            </div>
            <div className="space-y-2">
              {removed.edges.map((edge) => (
                <div
                  key={edge.id}
                  className="flex items-center gap-2 p-2 bg-red-500/10 rounded border border-red-500/30"
                >
                  <span className="text-red-400">-</span>
                  <span className="font-mono text-white">{edge.source}</span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span className="font-mono text-white">{edge.target}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// 叠加对比视图
function OverlayView({
  currentTopology,
  otherTopology,
  diffResult
}: {
  currentTopology: { nodes: NetworkNode[]; edges: TopologyEdge[] };
  otherTopology: { nodes: NetworkNode[]; edges: TopologyEdge[] };
  diffResult: DiffResult;
}) {
  // 合并两个拓扑，用颜色标记差异
  const mergedNodes = useMemo(() => {
    const currentMap = new Map(currentTopology.nodes.map((n) => [n.ip, n]));
    const otherMap = new Map(otherTopology.nodes.map((n) => [n.ip, n]));

    // 添加当前版本中独有的节点（保留）
    const merged: NetworkNode[] = [...currentTopology.nodes];

    // 添加其他版本中独有的节点（标记为新）
    otherTopology.nodes.forEach((node) => {
      if (!currentMap.has(node.ip)) {
        merged.push({ ...node, status: 'online' });
      }
    });

    return merged;
  }, [currentTopology.nodes, otherTopology.nodes]);

  return (
    <div className="h-full relative">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/80 rounded text-sm">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span>新增节点</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/80 rounded text-sm">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span>删除节点</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/80 rounded text-sm">
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>修改节点</span>
        </div>
      </div>

      {/* 这里需要渲染合并后的拓扑，但需要特殊样式 */}
      <div className="h-full flex items-center justify-center text-slate-500">
        <p>叠加对比模式 - 拖拽两个拓扑图进行对比</p>
      </div>
    </div>
  );
}

// 双图对比视图
function DualView({
  currentTopology,
  otherTopology,
  currentLabel,
  otherLabel
}: {
  currentTopology: { nodes: NetworkNode[]; edges: TopologyEdge[] };
  otherTopology: { nodes: NetworkNode[]; edges: TopologyEdge[] };
  currentLabel: string;
  otherLabel: string;
}) {
  return (
    <div className="h-full flex gap-4 p-4">
      {/* 当前版本 */}
      <div className="flex-1 flex flex-col">
        <Label className="mb-2 text-center text-slate-400">{currentLabel}</Label>
        <div className="flex-1 bg-slate-900 rounded-lg">
          <div className="h-full flex items-center justify-center text-slate-500">
            <p>{currentTopology.nodes.length} 节点 / {currentTopology.edges.length} 连线</p>
          </div>
        </div>
      </div>

      {/* 对比版本 */}
      <div className="flex-1 flex flex-col">
        <Label className="mb-2 text-center text-slate-400">{otherLabel}</Label>
        <div className="flex-1 bg-slate-900 rounded-lg">
          <div className="h-full flex items-center justify-center text-slate-500">
            <p>{otherTopology.nodes.length} 节点 / {otherTopology.edges.length} 连线</p>
          </div>
        </div>
      </div>
    </div>
  );
}
