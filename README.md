# 进阶数独

面向儿童的数独训练网页，支持 5x5 到 9x9，不同尺寸可选择简单、中等、困难。

## 本地打开

直接用浏览器打开 `index.html`。

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

