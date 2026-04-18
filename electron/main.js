// ============================================================
// Electron 主进程入口
// NetTopoHistory - 网络拓扑工具
// ============================================================

const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// 是否为开发模式
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 存储窗口实例
let mainWindow = null;
// 存储 Next.js 进程
let nextServer = null;

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'NetTopoHistory - 网络拓扑工具',
    backgroundColor: '#0f172a',  // 与项目主题色一致
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false  // 需要访问本地文件系统
    },
    show: false  // 等待加载完成后再显示
  });

  // 窗口准备好后显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 加载应用
  if (isDev) {
    // 开发模式：启动 Next.js 开发服务器
    startNextServer('pnpm', ['dev', '-p', '3456'], () => {
      mainWindow.loadURL('http://localhost:3456');
    });
    // 开发模式下打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：启动 Next.js 生产服务器
    startNextServer('node', ['.next/standalone/server.js'], () => {
      mainWindow.loadURL('http://localhost:3000');
    });
  }

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 窗口关闭时清理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 启动 Next.js 服务器
function startNextServer(command, args, onReady) {
  console.log(`[Electron] Starting Next.js server: ${command} ${args.join(' ')}`);

  // 设置环境变量
  const env = { ...process.env };
  if (!isDev) {
    // 生产模式下设置端口
    env.PORT = '3000';
  }

  nextServer = spawn(command, args, {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // 收集服务器输出
  let serverOutput = '';

  nextServer.stdout.on('data', (data) => {
    serverOutput += data.toString();
    console.log(`[Next.js] ${data.toString().trim()}`);

    // 检测服务器就绪
    if (data.toString().includes('Ready') || data.toString().includes('started server')) {
      // 等待一小段时间确保服务器完全启动
      setTimeout(() => {
        if (onReady) onReady();
      }, 2000);
    }
  });

  nextServer.stderr.on('data', (data) => {
    console.error(`[Next.js Error] ${data.toString().trim()}`);
  });

  nextServer.on('error', (error) => {
    console.error(`[Electron] Failed to start Next.js server:`, error);
  });

  nextServer.on('close', (code) => {
    console.log(`[Electron] Next.js server exited with code ${code}`);
    nextServer = null;
  });
}

// 停止 Next.js 服务器
function stopNextServer() {
  if (nextServer) {
    console.log('[Electron] Stopping Next.js server...');
    nextServer.kill('SIGTERM');
    setTimeout(() => {
      if (nextServer) {
        nextServer.kill('SIGKILL');
      }
    }, 5000);
  }
}

// 创建应用菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '重新加载',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        },
        {
          label: '全屏',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const zoom = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(Math.min(zoom + 0.1, 2));
            }
          }
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const zoom = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(Math.max(zoom - 0.1, 0.5));
            }
          }
        },
        {
          label: '重置缩放',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.setZoomFactor(1);
            }
          }
        },
        { type: 'separator' },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 NetTopoHistory',
              message: 'NetTopoHistory',
              detail: '网络拓扑工具\n版本 0.1.0\n\n支持设备发现、拓扑编辑、配置上传和历史追踪。'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 应用就绪
app.whenReady().then(() => {
  console.log('[Electron] App is ready');
  createMenu();
  createWindow();

  // macOS 特性：点击 dock 图标时重建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭
app.on('window-all-closed', () => {
  stopNextServer();
  // macOS 除外
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  stopNextServer();
});

// IPC 通信：获取应用版本
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// IPC 通信：获取平台信息
ipcMain.handle('get-platform', () => {
  return process.platform;
});

// IPC 通信：最小化窗口
ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

// IPC 通信：最大化/还原窗口
ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

// IPC 通信：关闭窗口
ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});

// IPC 通信：打开外部链接
ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});
