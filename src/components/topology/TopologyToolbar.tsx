// ============================================================
// TopologyToolbar - 拓扑图工具栏
// ============================================================

'use client';

import React, { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  Plus,
  Trash2,
  RefreshCw,
  Wifi,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTopologyStore } from '@/store/topologyStore';
import type { NetworkNode } from '@/types';

interface TopologyToolbarProps {
  onAddNode?: (ip: string, hostname?: string, description?: string) => void;
  onAddEdge?: (source: string, target: string) => void;
  onScanNetwork?: () => void;
  onClearTopology?: () => void;
  onResetLayout?: () => void;
  onTakeSnapshot?: () => void;
  onSearchNode?: (keyword: string) => void;
  isScanning?: boolean;
}

export default function TopologyToolbar({
  onAddNode,
  onAddEdge,
  onScanNetwork,
  onClearTopology,
  onResetLayout,
  onTakeSnapshot,
  onSearchNode,
  isScanning = false
}: TopologyToolbarProps) {
  const { nodes, edges, gateway } = useTopologyStore();

  // 添加节点对话框状态
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newNodeIp, setNewNodeIp] = useState('');
  const [newNodeHostname, setNewNodeHostname] = useState('');
  const [newNodeDesc, setNewNodeDesc] = useState('');

  // 添加连线对话框状态
  const [isAddEdgeDialogOpen, setIsAddEdgeDialogOpen] = useState(false);
  const [edgeSource, setEdgeSource] = useState('');
  const [edgeTarget, setEdgeTarget] = useState('');

  // 搜索状态
  const [searchKeyword, setSearchKeyword] = useState('');

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    onSearchNode?.(value);
  };

  // 处理添加节点
  const handleAddNode = () => {
    if (!newNodeIp) return;

    // 简单的 IP 格式验证
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newNodeIp)) {
      alert('请输入有效的 IP 地址');
      return;
    }

    onAddNode?.(newNodeIp, newNodeHostname, newNodeDesc);
    setNewNodeIp('');
    setNewNodeHostname('');
    setNewNodeDesc('');
    setIsAddDialogOpen(false);
  };

  // 处理添加连线
  const handleAddEdge = () => {
    if (!edgeSource || !edgeTarget) return;
    if (edgeSource === edgeTarget) {
      alert('起点和终点不能相同');
      return;
    }
    onAddEdge?.(edgeSource, edgeTarget);
    setEdgeSource('');
    setEdgeTarget('');
    setIsAddEdgeDialogOpen(false);
  };

  // 获取设备图标
  const getDeviceIcon = (node: NetworkNode) => {
    if (node.isGateway) return '🌐';
    if (node.hostname?.toLowerCase().includes('router')) return '📡';
    if (node.hostname?.toLowerCase().includes('server')) return '🖥️';
    if (node.hostname?.toLowerCase().includes('printer')) return '🖨️';
    if (node.hostname?.toLowerCase().includes('phone')) return '📱';
    if (node.hostname?.toLowerCase().includes('laptop')) return '💻';
    return '🖧';
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 p-2 bg-slate-800 border-b border-slate-700 rounded-t-lg">
        {/* 网络扫描 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onScanNetwork}
              disabled={isScanning}
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>扫描网络设备</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-slate-600" />

        {/* 搜索设备 */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
          <Input
            type="text"
            placeholder="搜索设备..."
            value={searchKeyword}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-8 w-[180px] pl-7 text-xs bg-slate-700/50 border-slate-600 focus:border-blue-500"
          />
          {searchKeyword && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* 添加节点 */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>添加网络节点</DialogTitle>
              <DialogDescription>手动添加一个网络设备到拓扑图中</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ip" className="text-right">
                  IP 地址
                </Label>
                <Input
                  id="ip"
                  value={newNodeIp}
                  onChange={(e) => setNewNodeIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="hostname" className="text-right">
                  主机名
                </Label>
                <Input
                  id="hostname"
                  value={newNodeHostname}
                  onChange={(e) => setNewNodeHostname(e.target.value)}
                  placeholder="可选"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="desc" className="text-right">
                  描述
                </Label>
                <Input
                  id="desc"
                  value={newNodeDesc}
                  onChange={(e) => setNewNodeDesc(e.target.value)}
                  placeholder="可选"
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAddNode}>添加</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 添加连线 */}
        <Dialog open={isAddEdgeDialogOpen} onOpenChange={setIsAddEdgeDialogOpen}>
          <DialogTrigger asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={nodes.length < 2}
                  className="text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>添加连线</p>
              </TooltipContent>
            </Tooltip>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>添加设备连线</DialogTitle>
              <DialogDescription>连接两个网络设备</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="source" className="text-right">
                  起点设备
                </Label>
                <select
                  id="source"
                  value={edgeSource}
                  onChange={(e) => setEdgeSource(e.target.value)}
                  className="col-span-3 flex h-10 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                >
                  <option value="">选择设备...</option>
                  {nodes.map((node: NetworkNode) => (
                    <option key={node.id} value={node.id}>
                      {node.hostname || node.ip}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="target" className="text-right">
                  终点设备
                </Label>
                <select
                  id="target"
                  value={edgeTarget}
                  onChange={(e) => setEdgeTarget(e.target.value)}
                  className="col-span-3 flex h-10 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                >
                  <option value="">选择设备...</option>
                  {nodes.map((node: NetworkNode) => (
                    <option key={node.id} value={node.id}>
                      {node.hostname || node.ip}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddEdgeDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAddEdge} disabled={!edgeSource || !edgeTarget}>
                添加连线
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="w-px h-6 bg-slate-600" />

        {/* 清空拓扑 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearTopology}
              disabled={nodes.length === 0}
              className="text-slate-300 hover:text-red-400 hover:bg-slate-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>清空拓扑图</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-slate-600" />

        {/* 重置布局 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onResetLayout}
              disabled={nodes.length === 0}
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>重置布局</p>
          </TooltipContent>
        </Tooltip>

        {/* 保存快照 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onTakeSnapshot}
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>保存快照</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        {/* 状态统计 */}
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>{nodes.filter((n: NetworkNode) => n.status === 'online').length}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>{nodes.filter((n: NetworkNode) => n.status === 'offline').length}</span>
          </div>
          <div className="text-slate-500">
            <span>{nodes.length}</span> 节点 / <span>{edges.length}</span> 连线
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
