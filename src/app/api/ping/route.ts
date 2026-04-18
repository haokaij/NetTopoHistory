// ============================================================
// POST /api/ping
// 对指定 IP 地址列表执行 Ping 探测
// 返回每个 IP 的在线状态和延迟
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { PingRequest, PingResultItem } from '@/types';

const execAsync = promisify(exec);

// 内网 IP 范围验证
const PRIVATE_IP_PATTERNS = [
  /^10\.\d+\.\d+\.\d+$/, // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // 172.16.0.0/12
  /^192\.168\.\d+\.\d+$/ // 192.168.0.0/16
];

// 验证 IP 是否为内网地址
function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

// 对单个 IP 执行 Ping
async function pingHost(ip: string, timeout = 3000): Promise<PingResultItem> {
  const result: PingResultItem = {
    ip,
    online: false,
    latency: -1
  };

  try {
    // 跨平台 ping 命令
    const isWindows = process.platform === 'win32';
    const cmd = isWindows
      ? `ping -n 1 -w ${timeout} ${ip}`
      : `ping -c 1 -W ${Math.ceil(timeout / 1000)} ${ip}`;

    const { stdout } = await execAsync(cmd, { timeout: timeout + 1000 });

    // 解析延迟
    const latencyMatch = isWindows
      ? stdout.match(/time[=<](\d+)ms/i)
      : stdout.match(/time=(\d+(?:\.\d+)?)\s*ms/i);

    if (latencyMatch) {
      result.online = true;
      result.latency = parseFloat(latencyMatch[1]);
    }
  } catch {
    // Ping 失败，保持 offline 状态
    result.online = false;
    result.latency = -1;
  }

  return result;
}

// 根据网段生成 IP 列表
function generateIpRange(cidr: string): string[] {
  const ips: string[] = [];

  // 解析 CIDR (如 192.168.1.0/24)
  const match = cidr.match(/^(\d+\.\d+\.\d+)\.(\d+)\/(\d+)$/);
  if (!match) return ips;

  const [, base, startStr, prefixStr] = match;
  const prefix = parseInt(prefixStr, 10);
  const start = parseInt(startStr, 10);

  if (prefix !== 24) return ips; // 仅支持 /24 简化处理

  for (let i = start; i <= 254; i++) {
    ips.push(`${base}.${i}`);
  }

  return ips;
}

// 最大并发数
const MAX_CONCURRENT = 64;

// 并发 Ping 多个 IP
async function pingBatch(
  ips: string[],
  onProgress?: (done: number, total: number) => void
): Promise<PingResultItem[]> {
  const results: PingResultItem[] = [];
  const total = ips.length;
  let completed = 0;

  // 分批处理
  for (let i = 0; i < ips.length; i += MAX_CONCURRENT) {
    const batch = ips.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(batch.map((ip) => pingHost(ip)));

    results.push(...batchResults);
    completed += batch.length;

    if (onProgress) {
      onProgress(completed, total);
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body: PingRequest = await request.json();
    const { ips } = body;

    // 验证 IP 列表
    if (!ips || !Array.isArray(ips) || ips.length === 0) {
      return NextResponse.json({ error: 'IP list is required' }, { status: 400 });
    }

    // 过滤非内网 IP（SSRF 防护）
    const validIps: string[] = [];
    const invalidIps: string[] = [];

    for (const ip of ips) {
      if (isPrivateIp(ip)) {
        validIps.push(ip);
      } else {
        invalidIps.push(ip);
      }
    }

    if (invalidIps.length > 0) {
      console.warn('Blocked non-private IPs:', invalidIps);
    }

    if (validIps.length === 0) {
      return NextResponse.json(
        { error: 'No valid private IPs in the request' },
        { status: 400 }
      );
    }

    // 执行 Ping
    const results = await pingBatch(validIps);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Ping error:', error);
    return NextResponse.json({ error: 'Ping failed' }, { status: 500 });
  }
}

// GET 方法：扫描指定网段
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cidr = searchParams.get('cidr');

    if (!cidr) {
      return NextResponse.json({ error: 'CIDR parameter is required' }, { status: 400 });
    }

    // 验证 CIDR 网段
    if (!isPrivateIp(cidr.replace('/24', '.0'))) {
      return NextResponse.json(
        { error: 'Only private network ranges are allowed' },
        { status: 400 }
      );
    }

    const ips = generateIpRange(cidr);

    if (ips.length === 0) {
      return NextResponse.json(
        { error: 'Invalid CIDR format. Use format like 192.168.1.0/24' },
        { status: 400 }
      );
    }

    // 执行 Ping
    const results = await pingBatch(ips);

    return NextResponse.json({
      cidr,
      total: ips.length,
      online: results.filter((r) => r.online).length,
      results
    });
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
