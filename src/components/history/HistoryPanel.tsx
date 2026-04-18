// ============================================================
// HistoryPanel - 历史记录面板
// ============================================================

'use client';

import React, { useState, useMemo } from 'react';
import {
  History,
  Filter,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  Clock,
  GitBranch,
  Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useTopologyStore } from '@/store/topologyStore';
import type { ChangeRecord, ChangeType, Snapshot } from '@/types';
import {
  exportChangeRecords,
  importChangeRecords,
  clearChangeRecords
} from '@/db/indexedDB';

// 变更类型配置
const CHANGE_TYPE_CONFIG: Record<
  ChangeType,
  { label: string; color: string; icon: string }
> = {
  node_add: { label: '添加节点', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: '➕' },
  node_remove: { label: '删除节点', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '➖' },
  node_update: { label: '更新节点', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: '✏️' },
  edge_add: { label: '添加连线', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: '🔗' },
  edge_remove: { label: '删除连线', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '✂️' },
  layout_change: { label: '布局变更', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: '📐' },
  import: { label: '导入', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: '📥' },
  rollback: { label: '回滚', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: '↩️' },
  snapshot: { label: '快照', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '📸' }
};

interface HistoryPanelProps {
  onRollback?: (record: ChangeRecord) => void;
  onRestoreSnapshot?: (snapshot: Snapshot) => void;
}

export default function HistoryPanel({ onRollback, onRestoreSnapshot }: HistoryPanelProps) {
  const { changeRecords, snapshots } = useTopologyStore();

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<ChangeType>>(
    new Set(Object.keys(CHANGE_TYPE_CONFIG) as ChangeType[])
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 导入/导出对话框
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState('');

  // 切换类型筛选
  const toggleType = (type: ChangeType) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
  };

  // 过滤记录
  const filteredRecords = useMemo(() => {
    return changeRecords.filter((record: ChangeRecord) => {
      if (!selectedTypes.has(record.type)) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          record.description.toLowerCase().includes(query) ||
          record.type.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [changeRecords, selectedTypes, searchQuery]);

  // 导出记录
  const handleExport = async () => {
    try {
      const json = await exportChangeRecords();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // 导入记录
  const handleImport = async () => {
    try {
      const count = await importChangeRecords(importData);
      alert(`成功导入 ${count} 条记录`);
      setImportData('');
      setIsImportDialogOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      alert('导入失败，请检查 JSON 格式');
    }
  };

  // 清空记录
  const handleClear = async () => {
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
      await clearChangeRecords();
      window.location.reload();
    }
  };

  // 格式化时间
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor(diff / 60000);
      if (hours > 0) return `${hours} 小时前`;
      if (minutes > 0) return `${minutes} 分钟前`;
      return '刚刚';
    }

    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 区分快照和普通记录
  const regularRecords = filteredRecords.filter((r: ChangeRecord) => r.type !== 'snapshot');
  const snapshotRecords = filteredRecords.filter((r: ChangeRecord) => r.type === 'snapshot');

  return (
    <div className="h-full flex flex-col bg-slate-800 rounded-lg border border-slate-700">
      {/* 头部 */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-400" />
          <h3 className="font-semibold text-white">历史记录</h3>
          <Badge variant="secondary" className="text-xs">
            {filteredRecords.length}
          </Badge>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="p-3 border-b border-slate-700 space-y-2">
        <Input
          placeholder="搜索历史记录..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-slate-700 border-slate-600"
        />

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <Filter className="h-3 w-3 mr-1" />
                筛选类型
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {(Object.keys(CHANGE_TYPE_CONFIG) as ChangeType[]).map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={selectedTypes.has(type)}
                  onCheckedChange={() => toggleType(type)}
                >
                  <span className="mr-1">{CHANGE_TYPE_CONFIG[type].icon}</span>
                  {CHANGE_TYPE_CONFIG[type].label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3 w-3" />
          </Button>

          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 快照列表 */}
      {snapshotRecords.length > 0 && (
        <div className="p-3 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="h-4 w-4 text-yellow-500" />
            <Label className="text-sm text-slate-400">快照 ({snapshotRecords.length})</Label>
          </div>
          <ScrollArea className="h-32">
            <div className="space-y-2">
              {snapshotRecords.slice(0, 5).map((record: ChangeRecord) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-2 bg-slate-700/50 rounded text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate">{record.description}</p>
                    <p className="text-slate-500 text-xs">{formatTime(record.timestamp)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (record.after) {
                        const snapshot: Snapshot = {
                          id: record.id,
                          timestamp: record.timestamp,
                          type: 'snapshot',
                          fullTopology: JSON.stringify(record.after),
                          description: record.description,
                          permanent: false
                        };
                        onRestoreSnapshot?.(snapshot);
                      }
                    }}
                    className="h-7 text-xs"
                  >
                    恢复
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* 变更记录列表 */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {regularRecords.length > 0 ? (
            regularRecords.map((record: ChangeRecord) => (
              <div
                key={record.id}
                className="bg-slate-700/50 rounded-lg overflow-hidden"
              >
                {/* 记录头部 */}
                <div
                  className="flex items-center gap-2 p-2 cursor-pointer hover:bg-slate-700/70"
                  onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                >
                  <span>{expandedId === record.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>

                  <Badge
                    variant="outline"
                    className={`text-xs ${CHANGE_TYPE_CONFIG[record.type].color}`}
                  >
                    {CHANGE_TYPE_CONFIG[record.type].icon} {CHANGE_TYPE_CONFIG[record.type].label}
                  </Badge>

                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{record.description}</p>
                    <p className="text-slate-500 text-xs flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(record.timestamp)}
                    </p>
                  </div>

                  {/* 回滚按钮 */}
                  {(record.before || record.after) && onRollback && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRollback(record);
                      }}
                      className="h-7"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* 展开详情 */}
                {expandedId === record.id && (
                  <div className="p-3 bg-slate-800/50 border-t border-slate-700 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Label className="text-slate-500">ID:</Label>
                      <span className="text-slate-400 font-mono">{record.id.slice(0, 8)}...</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-slate-500">操作人:</Label>
                      <span className="text-slate-400">{record.operator}</span>
                    </div>
                    {record.note && (
                      <div className="flex items-start gap-2">
                        <Label className="text-slate-500">备注:</Label>
                        <span className="text-slate-400">{record.note}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center text-slate-500 py-8">
              <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>暂无历史记录</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 清空按钮 */}
      {filteredRecords.length > 0 && (
        <div className="p-3 border-t border-slate-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            清空历史记录
          </Button>
        </div>
      )}

      {/* 导入对话框 */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入历史记录</DialogTitle>
            <DialogDescription>粘贴导出的 JSON 数据</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder='[{"id": "...", "timestamp": "...", ...}]'
              className="w-full h-48 p-2 bg-slate-700 border border-slate-600 rounded text-white font-mono text-xs resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleImport}>导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
