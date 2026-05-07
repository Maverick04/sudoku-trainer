# 进阶数独

面向儿童的数独训练网页，支持 5x5 到 9x9，不同尺寸可选择简单、中等、困难。

## 功能

- 5x5 到 9x9 数独，6x6、8x8、9x9 含小宫格规则。
- 每个尺寸都有简单、中等、困难三档难度。
- 题目随机生成，并用求解器保障唯一解。
- 候选数、手动笔记、即时错误反馈、分步提示。
- 支持撤销、擦除、同行同列同宫高亮、相同数字高亮。
- 自动保存未完成局面，重新打开可继续游戏。
- 数字键盘显示每个数字还剩多少个。
- 单格答对、连续答对、整局完成都有动画反馈。
- 完成弹窗、星星奖励和浏览器内置音效。
- 做题记录本地保存 500 条，支持 CSV 导出。
- 手机和平板可直接访问。

## 本地打开

直接用浏览器打开 `index.html`。

## 自动化测试

首次安装依赖：

```bash
npm install
```

运行 UI 回归测试：

```bash
npm test
```

当前覆盖桌面和移动端的核心流程：尺寸/难度切换、错误反馈、擦除、撤销、笔记模式、自动完成、做题记录、移动端横向溢出。

## 线上部署

当前部署目标是 Cloudflare Pages。

```bash
npx wrangler pages deploy . --project-name sudoku-trainer --commit-dirty=true
```

生产地址：

- https://sudoku-trainer.pages.dev/
- https://sudoku.dhl-es.art/

## 版本流程

1. 修改代码。
2. 本地打开 `index.html` 验证。
3. 更新 `CHANGELOG.md`。
4. 提交 Git。
5. 部署到 Cloudflare Pages。
