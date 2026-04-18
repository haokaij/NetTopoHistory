# Electron 打包配置

## 图标准备

在 Windows 上，Electron 应用需要 `.ico` 格式的图标文件。

### 方法 1: 使用在线工具转换

1. 准备一张 256x256 或更大尺寸的 PNG 图片
2. 访问 https://www.icoconverter.com/ 或 https://convertio.co/png-ico/
3. 上传 PNG 图片并转换为 .ico 格式
4. 将转换后的文件保存为 `electron/build/icon.ico`

### 方法 2: 使用 PowerShell 脚本转换

如果你有 ImageMagick，可以直接转换：

```powershell
magick convert input.png -define icon:auto-resize="256,128,96,64,48,32,16" electron/build/icon.ico
```

### 注意事项

- 如果暂时没有图标，electron-builder 会使用默认图标
- 建议图标尺寸至少为 256x256 像素
- ICO 文件可以包含多个尺寸的图标

## 打包步骤

### 1. 安装依赖

```powershell
pnpm install
```

### 2. 开发测试（可选）

```powershell
pnpm electron:dev
```

### 3. 构建 Windows 安装包

```powershell
pnpm electron:build
```

构建完成后，安装包会生成在 `release` 目录下：

```
release/
└── NetTopoHistory-Setup-0.1.0.exe
```

### 4. 直接运行 EXE（无需安装）

```powershell
pnpm electron:preview
```

## 常见问题

### Q: 构建失败，提示缺少模块

确保执行了 `pnpm install` 来安装所有依赖，包括 devDependencies 中的 electron 和 electron-builder。

### Q: 图标显示不正确

1. 清理构建缓存：`rmdir /s /q release 2>nul & rmdir /s /q node_modules\.cache 2>nul`
2. 重新构建：`pnpm electron:build`

### Q: 应用启动后白屏

1. 检查是否正确配置了 Next.js standalone 输出
2. 查看 Electron 控制台日志
3. 确认 .next 目录存在且包含正确的文件

### Q: 打包后的 EXE 在其他电脑无法运行

1. Windows 安装包需要 Microsoft Visual C++ Redistributable
2. 某些杀毒软件可能误报，请添加信任或联系杀毒软件厂商

## 目录结构

```
electron/
├── main.js          # Electron 主进程
├── preload.js       # 预加载脚本
├── build/
│   └── icon.ico     # 应用图标（需要自行准备）
└── README.md        # 本文件
```
