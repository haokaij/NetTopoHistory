// ============================================================
// GET /api/network-info
// 获取本机网络信息（IP、子网掩码、网关、主机名）
// ============================================================

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 执行命令并返回输出
async function runCommand(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 5000 });
    return stdout.trim();
  } catch {
    return '';
  }
}

// 获取默认网关
async function getDefaultGateway(): Promise<string> {
  // Linux
  let result = await runCommand('ip route | grep default | awk \'{print $3}\' | head -1');
  if (result) return result;

  // macOS
  result = await runCommand('netstat -rn | grep default | awk \'{print $2}\' | head -1');
  if (result) return result;

  // Windows
  result = await runCommand('route print 0* | findstr 0.0.0.0 | awk \'{print $3}\'');
  if (result) return result;

  return '';
}

// 获取本机 IP 地址
async function getLocalIp(): Promise<string> {
  // 优先获取与网关同网段的 IP
  const gateway = await getDefaultGateway();
  if (gateway) {
    const gatewayBase = gateway.split('.').slice(0, 3).join('.');

    // Linux
    let result = await runCommand(
      `ip -4 addr show | grep inet | grep -v 127.0.0.1 | awk '{print $2}' | grep ${gatewayBase} | cut -d'/' -f1 | head -1`
    );
    if (result) return result;

    // macOS
    result = await runCommand(
      `ifconfig | grep -A 1 'en' | grep 'inet ' | awk '{print $2}' | grep ${gatewayBase} | head -1`
    );
    if (result) return result;
  }

  // 降级：获取第一个非 127 的 IPv4 地址
  let result = await runCommand(
    "ip -4 addr show | grep inet | grep -v 127.0.0.1 | awk '{print $2}' | cut -d'/' -f1 | head -1"
  );
  if (result) return result;

  result = await runCommand(
    "ifconfig | grep -A 1 'en' | grep 'inet ' | awk '{print $2}' | head -1"
  );
  if (result) return result;

  // Windows
  result = await runCommand(
    'ipconfig | findstr /i "IPv4" | findstr /v 127 | awk -F: "{print $2}" | tr -d " " | head -1'
  );
  if (result) return result;

  return '192.168.1.100'; // 默认值
}

// 获取子网掩码
async function getSubnetMask(): Promise<string> {
  // Linux
  let result = await runCommand(
    "ip -4 addr show | grep inet | grep -v 127.0.0.1 | awk '{print $2}' | cut -d'/' -f2 | head -1"
  );
  if (result) {
    let prefix = parseInt(result, 10);
    if (prefix) {
      // 转换前缀长度为子网掩码
      const mask = [];
      for (let i = 0; i < 4; i++) {
        if (prefix >= 8) {
          mask.push(255);
          prefix -= 8;
        } else {
          mask.push(256 - Math.pow(2, 8 - prefix));
          prefix = 0;
        }
      }
      return mask.join('.');
    }
  }

  // macOS
  result = await runCommand(
    "ifconfig | grep -A 1 'en' | grep 'inet ' | awk '{print $4}' | head -1"
  );
  if (result) return result;

  return '255.255.255.0'; // 默认值
}

// 获取主机名
async function getHostname(): Promise<string> {
  const result = await runCommand('hostname');
  return result || 'unknown';
}

export async function GET() {
  try {
    const [localIp, subnetMask, gateway, hostname] = await Promise.all([
      getLocalIp(),
      getSubnetMask(),
      getDefaultGateway(),
      getHostname()
    ]);

    return NextResponse.json({
      localIp,
      subnetMask,
      gateway,
      hostname
    });
  } catch (error) {
    console.error('Error getting network info:', error);
    return NextResponse.json(
      { error: 'Failed to get network information' },
      { status: 500 }
    );
  }
}
