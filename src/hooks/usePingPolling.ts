// ============================================================
// usePingPolling - Ping 轮询 Hook
// ============================================================

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTopologyStore } from '@/store/topologyStore';
import type { NetworkNode, PingResultItem } from '@/types';

const DEFAULT_PING_INTERVAL = 30000; // 30秒
const MAX_BATCH_SIZE = 64;

interface UsePingPollingOptions {
  interval?: number;
  enabled?: boolean;
}

export function usePingPolling(options: UsePingPollingOptions = {}) {
  const { interval = DEFAULT_PING_INTERVAL, enabled = true } = options;

  const { nodes, updateNodeStatus } = useTopologyStore();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);

  // 执行 Ping 扫描
  const performPing = useCallback(async () => {
    if (nodes.length === 0) return;

    setIsScanning(true);
    abortRef.current = false;

    try {
      const allIps = nodes.map((n: NetworkNode) => n.ip);
      const batches: string[][] = [];

      for (let i = 0; i < allIps.length; i += MAX_BATCH_SIZE) {
        batches.push(allIps.slice(i, i + MAX_BATCH_SIZE));
      }

      setProgress({ current: 0, total: allIps.length });

      const results: PingResultItem[] = [];

      for (const batch of batches) {
        if (abortRef.current) break;

        const response = await fetch('/api/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ips: batch })
        });

        if (!response.ok) {
          console.error('Ping API error:', response.statusText);
          continue;
        }

        const data = await response.json();
        results.push(...data.results);
        setProgress((p) => ({ ...p, current: Math.min(p.current + batch.length, p.total) }));
      }

      const resultMap = new Map(results.map((r: PingResultItem) => [r.ip, r]));

      for (const node of nodes) {
        if (abortRef.current) break;

        const result = resultMap.get(node.ip);
        if (result) {
          const status: NetworkNode['status'] =
            result.latency < 0
              ? 'offline'
              : result.latency > 100
                ? 'high-latency'
                : 'online';

          updateNodeStatus(node.id, status, result.latency);
        }
      }
    } catch (error) {
      console.error('Ping polling error:', error);
    } finally {
      setIsScanning(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [nodes, updateNodeStatus]);

  // 手动扫描网络
  const scanNetwork = useCallback(async (cidr?: string) => {
    try {
      const infoResponse = await fetch('/api/network-info');
      if (!infoResponse.ok) {
        throw new Error('Failed to get network info');
      }

      const networkInfo = await infoResponse.json();

      const scanCidr =
        cidr ||
        `${networkInfo.localIp.split('.').slice(0, 3).join('.')}.0/24`;

      // 从 CIDR 生成 IP 列表
      const baseIp = scanCidr.split('.').slice(0, 3).join('.');
      const ips: string[] = [];
      for (let i = 1; i <= 254; i++) {
        ips.push(`${baseIp}.${i}`);
      }

      setIsScanning(true);

      // 使用 POST 请求发送 IP 列表
      const response = await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips })
      });

      if (!response.ok) {
        throw new Error('Ping scan failed');
      }

      const data = await response.json();

      return {
        networkInfo,
        scanResults: data.results,
        onlineCount: data.results?.filter((r: PingResultItem) => r.online).length || 0
      };
    } catch (error) {
      console.error('Network scan error:', error);
      throw error;
    } finally {
      setIsScanning(false);
    }
  }, []);

  // 启动轮询
  useEffect(() => {
    if (!enabled) return;

    performPing();

    timerRef.current = setInterval(performPing, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      abortRef.current = true;
    };
  }, [enabled, interval, performPing]);

  return {
    isScanning,
    progress,
    scanNetwork,
    performPing
  };
}
