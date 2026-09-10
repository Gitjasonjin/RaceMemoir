# 山径线索板 · RaceMemoir

山径线索板是一款记录赛事与山野旅程的 Web 数字收藏板。

将奖牌悬挂、照片用大头钉固定、号码布用胶带贴住，再用红线串联每段记忆。

## 页面预览

![山径线索板页面截图](docs/images/board.png)

## 功能

- ✅ 收藏奖牌、照片、号码布、便签与路线卡。
- ✅ 自由拖拽、旋转、编辑、复制和删除藏品。
- ✅ 图钉红线串联记忆，连接随藏品移动与旋转。
- ✅ 大头钉、胶带、红线共 12 款样式，支持整板或单件替换。
- ✅ 画布缩放、平移、全景适应与缩略图导航。
- ✅ 撤销重做、本地自动保存与收藏板命名。
- ✅ 高清 PNG 导出、JSON 备份与导入恢复。

## 运行

需要 Node.js 22.18+（推荐 Node.js 24）。

```bash
npm install
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。

```bash
npm run build      # TypeScript 检查与生产构建
npm run preview    # 预览生产构建
npm test           # 运行测试
```
