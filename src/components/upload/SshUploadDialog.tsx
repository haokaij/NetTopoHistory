// ============================================================
// SshUploadDialog - SSH 配置上传对话框
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, Key, Lock, Upload, Loader2, Check, X, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useTopologyStore } from '@/store/topologyStore';
import type { NetworkNode, SshExecuteRequest, SshExecuteResult, SshTemplate } from '@/types';
import { getAllSshTemplates, addSshTemplate } from '@/db/indexedDB';

interface SshUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetNode: NetworkNode | null;
}

export default function SshUploadDialog({
  open,
  onOpenChange,
  targetNode
}: SshUploadDialogProps) {
  const { nodes } = useTopologyStore();

  // SSH 凭证
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [useKeyAuth, setUseKeyAuth] = useState(false);

  // 命令输入
  const [commands, setCommands] = useState('');
  const [commandLines, setCommandLines] = useState<string[]>([]);

  // 执行状态
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<SshExecuteResult['results']>([]);
  const [error, setError] = useState<string | null>(null);

  // 模板
  const [templates, setTemplates] = useState<SshTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // 加载模板
  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    const loaded = await getAllSshTemplates();
    setTemplates(loaded);
  };

  // 更新命令行预览
  useEffect(() => {
    setCommandLines(
      commands
        .split('\n')
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
    );
  }, [commands]);

  // 应用模板
  const applyTemplate = (template: SshTemplate) => {
    setCommands(template.commands.join('\n'));
  };

  // 保存为模板
  const handleSaveTemplate = async () => {
    if (!newTemplateName || commandLines.length === 0) {
      alert('请输入模板名称并添加命令');
      return;
    }

    await addSshTemplate({
      id: crypto.randomUUID(),
      name: newTemplateName,
      commands: commandLines,
      description: `保存于 ${new Date().toLocaleString('zh-CN')}`
    });

    setNewTemplateName('');
    setShowSaveTemplate(false);
    await loadTemplates();
  };

  // 执行 SSH 命令
  const handleExecute = async () => {
    if (!targetNode) return;
    if (!username) {
      setError('请输入用户名');
      return;
    }
    if (!useKeyAuth && !password) {
      setError('请输入密码或使用密钥认证');
      return;
    }
    if (useKeyAuth && !privateKey) {
      setError('请输入私钥内容');
      return;
    }
    if (commandLines.length === 0) {
      setError('请输入要执行的命令');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResults([]);

    try {
      const request: SshExecuteRequest = {
        host: targetNode.ip,
        port: 22,
        username,
        password: useKeyAuth ? undefined : password,
        privateKey: useKeyAuth ? privateKey : undefined,
        commands: commandLines,
        timeout: 10000
      };

      const response = await fetch('/api/ssh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      const data: SshExecuteResult = await response.json();

      if (!response.ok) {
        setError(data.error || 'SSH 执行失败');
      } else if (!data.success) {
        setError(data.error || '部分命令执行失败');
        setResults(data.results);
      } else {
        setResults(data.results);
      }
    } catch (err) {
      setError((err as Error).message || '网络错误');
    } finally {
      setIsExecuting(false);
    }
  };

  // 清空表单
  const handleClear = () => {
    setUsername('');
    setPassword('');
    setPrivateKey('');
    setCommands('');
    setResults([]);
    setError(null);
  };

  // 关闭对话框
  const handleClose = () => {
    onOpenChange(false);
    // 延迟清空结果
    setTimeout(() => {
      handleClear();
    }, 300);
  };

  if (!targetNode) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            上传配置到 {targetNode.ip}
          </DialogTitle>
          <DialogDescription>
            {targetNode.hostname !== targetNode.ip && (
              <span className="text-slate-400">{targetNode.hostname}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="execute" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="execute">执行命令</TabsTrigger>
            <TabsTrigger value="templates">配置模板</TabsTrigger>
          </TabsList>

          {/* 执行命令 */}
          <TabsContent value="execute" className="flex-1 flex flex-col overflow-hidden space-y-4">
            {/* SSH 凭证 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-slate-700/50">
                  SSH 凭证
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">用户名</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="root"
                    className="bg-slate-700 border-slate-600"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">认证方式</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={useKeyAuth ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => setUseKeyAuth(false)}
                      className="flex-1"
                    >
                      <Lock className="h-3 w-3 mr-1" />
                      密码
                    </Button>
                    <Button
                      variant={useKeyAuth ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setUseKeyAuth(true)}
                      className="flex-1"
                    >
                      <Key className="h-3 w-3 mr-1" />
                      密钥
                    </Button>
                  </div>
                </div>
              </div>

              {useKeyAuth ? (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">私钥 (PEM 格式)</Label>
                  <Textarea
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                    className="h-20 bg-slate-700 border-slate-600 font-mono text-xs resize-none"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">密码</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入密码"
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              )}
            </div>

            {/* 命令输入 */}
            <div className="space-y-1 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400">命令列表 (每行一条)</Label>
                <span className="text-xs text-slate-500">{commandLines.length} 条命令</span>
              </div>
              <Textarea
                value={commands}
                onChange={(e) => setCommands(e.target.value)}
                placeholder="display current-configuration&#10;system-view&#10;interface GigabitEthernet0/0/1"
                className="flex-1 bg-slate-700 border-slate-600 font-mono text-sm resize-none"
              />
            </div>

            {/* 错误信息 */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 执行结果 */}
            {results.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">执行结果</Label>
                <ScrollArea className="h-40 bg-slate-900 rounded p-3">
                  <div className="space-y-3 font-mono text-xs">
                    {results.map((result, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400">
                          <span>$</span>
                          <span>{result.command}</span>
                        </div>
                        {result.stdout && (
                          <pre className="text-green-400 whitespace-pre-wrap">{result.stdout}</pre>
                        )}
                        {result.stderr && (
                          <pre className="text-red-400 whitespace-pre-wrap">{result.stderr}</pre>
                        )}
                        <div className={`text-xs ${result.exitCode === 0 ? 'text-slate-500' : 'text-yellow-400'}`}>
                          退出码: {result.exitCode}
                        </div>
                        {idx < results.length - 1 && <div className="border-b border-slate-700" />}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          {/* 配置模板 */}
          <TabsContent value="templates" className="flex-1 flex flex-col overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-slate-400">常用模板</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  保存当前
                </Button>
              </div>

              {/* 保存模板 */}
              {showSaveTemplate && (
                <div className="p-3 bg-slate-700/50 rounded space-y-2">
                  <Input
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="模板名称"
                    className="bg-slate-700 border-slate-600"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowSaveTemplate(false)}>
                      取消
                    </Button>
                    <Button size="sm" onClick={handleSaveTemplate}>
                      保存
                    </Button>
                  </div>
                </div>
              )}

              {/* 模板列表 */}
              <ScrollArea className="flex-1">
                {templates.length > 0 ? (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="p-3 bg-slate-700/50 rounded space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <span className="font-medium text-white">{template.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => applyTemplate(template)}
                          >
                            应用
                          </Button>
                        </div>
                        <pre className="text-xs text-slate-400 font-mono bg-slate-800 p-2 rounded max-h-24 overflow-auto">
                          {template.commands.join('\n')}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>暂无保存的模板</p>
                    <p className="text-xs mt-1">执行命令后可保存为模板</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            关闭
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isExecuting || !username || commandLines.length === 0}
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                执行中...
              </>
            ) : (
              <>
                <Terminal className="h-4 w-4 mr-2" />
                执行
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
