# dsh-desktop

把本机的 `dsh`（[@deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)，DeepSeek Harness 的 web profile）打包成独立 Windows 桌面应用。

目标机器**不需要安装 Node.js，也不需要 npm 安装 dsh**——应用内嵌了 dsh 本体，并用 Electron 自带的 Node 运行时（`ELECTRON_RUN_AS_NODE`）启动它。

## 原理

1. 启动时拉起内置的 `dsh web --port 0`（端口由系统自动分配）
2. 从 stdout 解析出 `dsh web: http://127.0.0.1:<port>`
3. Electron 窗口加载该地址
4. 关闭窗口时杀掉整个 dsh 进程树

用户数据（profile、session）仍在 `~/.dsh`，web profile 首次使用会自动初始化。

## 开发

```sh
npm install
npm run sync-dsh   # 从全局 npm 目录同步 dsh 本体到 dsh-bundle/（需先 npm i -g @deepseek-ai/dsh）
npm start          # 本地运行
```

## 打包

```sh
npm run dist           # NSIS 安装包 + 便携版 exe，产物在 dist/
npm run dist:portable  # 只打便携版
```

## 文件

- `main.js` — Electron 主进程（拉起/回收 dsh、窗口管理）
- `loading.html` — 启动等待与错误提示页
- `dsh-bundle/` — dsh 本体（由 `npm run sync-dsh` 生成，不入库）
