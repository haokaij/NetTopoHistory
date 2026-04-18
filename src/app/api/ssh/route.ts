// ============================================================
// POST /api/ssh
// 通过 SSH 在远程设备上执行命令
// 注意：凭证仅在内存中使用，不持久化
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import type { SshExecuteRequest, SshExecuteResult } from '@/types';

// 默认超时时间 (10秒)
const DEFAULT_TIMEOUT = 10000;

// 内网 IP 范围验证
const PRIVATE_IP_PATTERNS = [
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

// SSH 执行单个命令
function executeCommand(conn: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = '';
      let stderr = '';

      stream.on('close', () => {
        // 如果有 stderr 且没有 stdout，返回 stderr
        if (stderr && !stdout) {
          resolve(stderr);
        } else {
          resolve(stdout);
        }
      });

      stream.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    });
  });
}

// 执行多条命令
async function executeCommands(
  host: string,
  port: number,
  username: string,
  password: string | undefined,
  privateKey: string | undefined,
  commands: string[],
  timeout: number
): Promise<SshExecuteResult> {
  return new Promise((resolve) => {
    const result: SshExecuteResult = {
      success: true,
      results: [],
      error: undefined
    };

    const conn = new Client();

    // 连接配置
    const config: Record<string, unknown> = {
      host,
      port,
      username,
      readyTimeout: timeout,
      keepaliveInterval: 0
    };

    // 认证方式
    if (privateKey) {
      config.privateKey = privateKey;
    } else if (password) {
      config.password = password;
    } else {
      resolve({
        success: false,
        results: [],
        error: 'Either password or private key is required'
      });
      return;
    }

    // 超时处理
    const timeoutId = setTimeout(() => {
      conn.end();
      resolve({
        success: false,
        results: [],
        error: `Connection timeout after ${timeout}ms`
      });
    }, timeout);

    conn.on('ready', async () => {
      clearTimeout(timeoutId);

      try {
        for (const command of commands) {
          try {
            const output = await Promise.race([
              executeCommand(conn, command),
              new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error('Command timeout')), timeout / 2)
              )
            ]);

            result.results.push({
              command,
              stdout: output,
              stderr: '',
              exitCode: 0
            });
          } catch (cmdError) {
            result.results.push({
              command,
              stdout: '',
              stderr: (cmdError as Error).message,
              exitCode: 1
            });
            result.success = false;
          }
        }

        conn.end();
        resolve(result);
      } catch (error) {
        conn.end();
        resolve({
          success: false,
          results: [],
          error: (error as Error).message
        });
      }
    });

    conn.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        results: [],
        error: `SSH connection error: ${err.message}`
      });
    });

    conn.connect(config as Parameters<Client['connect']>[0]);
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: SshExecuteRequest = await request.json();
    const {
      host,
      port = 22,
      username,
      password,
      privateKey,
      commands,
      timeout = DEFAULT_TIMEOUT
    } = body;

    // 验证必填字段
    if (!host || !username || !commands || commands.length === 0) {
      return NextResponse.json(
        { error: 'host, username, and commands are required' },
        { status: 400 }
      );
    }

    // SSRF 防护：仅允许内网 IP
    if (!isPrivateIp(host)) {
      return NextResponse.json(
        { error: 'Only private network hosts are allowed' },
        { status: 403 }
      );
    }

    // 验证凭证
    if (!password && !privateKey) {
      return NextResponse.json(
        { error: 'Either password or privateKey is required' },
        { status: 400 }
      );
    }

    // 执行 SSH 命令
    const result = await executeCommands(
      host,
      port,
      username,
      password,
      privateKey,
      commands,
      timeout
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('SSH error:', error);
    return NextResponse.json(
      { success: false, results: [], error: (error as Error).message },
      { status: 500 }
    );
  }
}
