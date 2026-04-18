// ============================================================
// Electron 预加载脚本
// 用于安全地暴露 Node.js API 给渲染进程
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用版本
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 获取平台信息
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // 监听窗口最大化状态变化
  onMaximizeChange: (callback) => {
    ipcRenderer.on('maximize-change', (event, isMaximized) => {
      callback(isMaximized);
    });
  },

  // 检查是否在 Electron 环境中运行
  isElectron: true,

  // 平台标识
  platform: process.platform
});

// 控制台提示
console.log('[Preload] Electron API 已加载');
