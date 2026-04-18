// ============================================================
// NodeDetail - 节点详情面板
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { X, Wifi, WifiOff, Clock, Activity, Server, Edit2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useTopologyStore } from '@/store/topologyStore';
import type { NetworkNode, NodeStatus } from '@/types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// 状态图标组件（定义在外部避免 render 时创建）
function StatusIcon({ status }: { status: NodeStatus }) {
  switch (status) {
    case 'online':
      return <Wifi className="h-4 w-4 text-green-500" />;
    case 'offline':
      return <WifiOff className="h-4 w-4 text-red-500" />;
    case 'high-latency':
      return <Activity className="h-4 w-4 text-yellow-500" />;
  }
}

interface NodeDetailProps {
  node: NetworkNode | null;
  onClose: () => void;
  onUploadConfig?: (node: NetworkNode) => void;
}

export default function NodeDetail({ node, onClose, onUploadConfig }: NodeDetailProps) {
  const { updateNode } = useTopologyStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editHostname, setEditHostname] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // 同步编辑状态
  useEffect(() => {
    if (node) {
      setEditHostname(node.hostname);
      setEditDescription(node.description || '');
      setIsEditing(false);
    }
  }, [node?.id]);

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <p>选择节点查看详情</p>
      </div>
    );
  }

  // 状态标签
  const statusLabel: Record<NodeStatus, string> = {
    online: '在线',
    offline: '离线',
    'high-latency': '高延迟'
  };

  // 状态颜色
  const statusColor: Record<NodeStatus, string> = {
    online: 'text-green-500',
    offline: 'text-red-500',
    'high-latency': 'text-yellow-500'
  };

  // 准备图表数据
  const chartData = node.pingHistory.map((latency, index) => ({
    index: index + 1,
    latency: latency >= 0 ? latency : 0
  }));

  // 保存编辑
  const handleSave = () => {
    updateNode(node.id, {
      hostname: editHostname || node.ip,
      description: editDescription
    });
    setIsEditing(false);
  };

  // 格式化时间
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-800 rounded-lg border border-slate-700">
      {/* 头部 */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-slate-400" />
          <h3 className="font-semibold text-white truncate max-w-[200px]">
            {node.hostname || node.ip}
          </h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 内容 */}
      <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full grid grid-cols-3 bg-slate-700/50 rounded-none">
          <TabsTrigger value="info">信息</TabsTrigger>
          <TabsTrigger value="ping">延迟</TabsTrigger>
          <TabsTrigger value="actions">操作</TabsTrigger>
        </TabsList>

        {/* 基本信息 */}
        <TabsContent value="info" className="flex-1 overflow-auto p-3 space-y-4">
          {/* 状态 */}
          <div className="flex items-center justify-between">
            <Label className="text-slate-400">状态</Label>
            <div className={`flex items-center gap-2 ${statusColor[node.status]}`}>
              <StatusIcon status={node.status} />
              <span>{statusLabel[node.status]}</span>
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* IP 地址 */}
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">IP 地址</Label>
            <p className="text-white font-mono">{node.ip}</p>
          </div>

          {/* 主机名 */}
          {isEditing ? (
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">主机名</Label>
              <Input
                value={editHostname}
                onChange={(e) => setEditHostname(e.target.value)}
                placeholder="输入主机名"
                className="bg-slate-700 border-slate-600"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">主机名</Label>
              <p className="text-white">{node.hostname || '-'}</p>
            </div>
          )}

          {/* 描述 */}
          {isEditing ? (
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">描述</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="输入描述"
                className="bg-slate-700 border-slate-600"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">描述</Label>
              <p className="text-white text-sm">{node.description || '-'}</p>
            </div>
          )}

          {/* 网关标识 */}
          {node.isGateway && (
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
              <span>🌐</span> 默认网关
            </div>
          )}

          <Separator className="bg-slate-700" />

          {/* 最后在线时间 */}
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              最后在线
            </Label>
            <p className="text-white text-sm">{formatTime(node.lastSeen)}</p>
          </div>

          {/* 来源 */}
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">来源</Label>
            <p className="text-white text-sm">
              {node.isManuallyAdded ? '手动添加' : '自动发现'}
            </p>
          </div>
        </TabsContent>

        {/* 延迟图表 */}
        <TabsContent value="ping" className="flex-1 overflow-auto p-3">
          <div className="space-y-4">
            {/* 当前延迟 */}
            <div className="text-center p-4 bg-slate-700/50 rounded-lg">
              <p className="text-slate-400 text-sm">当前延迟</p>
              <p
                className={`text-4xl font-bold ${
                  node.latency < 0
                    ? 'text-red-500'
                    : node.latency > 100
                      ? 'text-yellow-500'
                      : 'text-green-500'
                }`}
              >
                {node.latency >= 0 ? `${node.latency}` : 'OFF'}
              </p>
              <p className="text-slate-500 text-sm">{node.latency >= 0 ? 'ms' : ''}</p>
            </div>

            {/* 延迟历史图表 */}
            <div>
              <Label className="text-slate-400 text-xs mb-2 block">延迟历史 (最近 5 次)</Label>
              {chartData.length > 0 ? (
                <div className="h-[150px] bg-slate-700/30 rounded-lg p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="index" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} unit="ms" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '6px'
                        }}
                        labelStyle={{ color: '#e2e8f0' }}
                        formatter={(value: number) => [`${value}ms`, '延迟']}
                      />
                      <Line
                        type="monotone"
                        dataKey="latency"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                        activeDot={{ r: 6, fill: '#60a5fa' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[150px] flex items-center justify-center text-slate-500">
                  暂无延迟数据
                </div>
              )}
            </div>

            {/* 延迟详情 */}
            <div className="space-y-2">
              <Label className="text-slate-400 text-xs">延迟详情</Label>
              <div className="space-y-1">
                {node.pingHistory.length > 0 ? (
                  node.pingHistory.map((lat, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-slate-500">#{idx + 1}</span>
                      <span className={lat < 0 ? 'text-red-500' : 'text-green-500'}>
                        {lat >= 0 ? `${lat}ms` : '超时'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">暂无数据</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 操作 */}
        <TabsContent value="actions" className="flex-1 overflow-auto p-3 space-y-3">
          {isEditing ? (
            <>
              <Button onClick={handleSave} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                保存修改
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="w-full"
              >
                取消
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setIsEditing(true)} className="w-full">
                <Edit2 className="h-4 w-4 mr-2" />
                编辑节点
              </Button>

              {onUploadConfig && (
                <Button
                  variant="outline"
                  onClick={() => onUploadConfig(node)}
                  className="w-full"
                >
                  上传配置
                </Button>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
