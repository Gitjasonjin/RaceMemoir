# 本地抠图资源与完整性校验

抠图图片始终在浏览器本机处理。运行时只向本站的 `/background-removal/1.7.0/` 请求固定资源，不再读取第三方清单或动态下载第三方可执行程序。

## 准备与部署

- `npm ci` 安装 `package-lock.json` 固定的依赖。
- `npm run prepare:cutout` 准备模型和运行库；已有正确文件会直接复用。
- `npm run check:cutout` 仅验证文件，缺失、截断或哈希不一致时失败，不联网修复。
- 开发与生产构建会先准备并核验资源。首次准备需要网络访问 IMG.LY 官方模型分块，之后可离线构建。
- 部署完整 `dist/`，必须包含 `background-removal/1.7.0/`。资源共约 **96.2 MiB**，每个二进制分块不超过 **4 MiB**，适合有单文件大小限制的静态托管。

生成的 `public/background-removal/` 不提交 Git。应提交锁清单、准备脚本和许可证。CI 可缓存该目录，但每次构建仍会核验缓存内容。准备失败必须修复原因，不能跳过校验或回退到第三方远程执行。

## 信任来源

`resources/background-removal.lock.json` 是人工审核后提交的信任锚。准备脚本不会获取清单并自动更新哈希。

| 资源 | 来源 | 固定方式 |
| --- | --- | --- |
| CPU MJS / WASM | `onnxruntime-web@1.21.0` 的 npm 发布包 | `package-lock.json` 的 npm SHA-512 integrity、运行库完整 SHA-256，以及各分块 SHA-256 |
| ISNET FP16 模型 | IMG.LY `background-removal-data/1.7.0/dist/` | 仓库固定的 22 个分块 SHA-256、连续偏移及精确大小 |

IMG.LY 的 `background-removal-data@1.7.0` 未发布在 npm registry 中；旧版 npm `1.4.5` 模型与当前 FP16 模型不同，因此未替换。模型初始哈希来源为 2026-10-09 审核的官方版本清单，其摘要保留在锁文件中。后续构建直接使用仓库已固定的哈希，不再信任实时清单；模型仅作为数据输入，运行库可执行代码来自锁定的 npm 依赖。

浏览器将同样依据打包进应用的锁清单校验下载和缓存命中的每一块，全部通过后才交给抠图 SDK。未经校验的 MJS 不会进入动态导入。缓存不作为信任来源；损坏缓存应丢弃并重取，校验失败明确终止。

## 更新与许可

升级 SDK、ONNX Runtime 或模型时，需在单独变更中核对来源、版本、许可证和摘要，更新锁文件及缓存版本，并完成真实 CPU 抠图、篡改阻断、离线缓存复用与构建验收。不要在安装脚本中加入远程自动更新锁文件的逻辑。

ONNX Runtime 的 MIT 许可证和 ISNET 上游许可证原文保存在 `resources/licenses/`，准备时连同来源声明复制到同源资源目录并随站点部署。IMG.LY SDK 的第三方清单将 ISNET 标为 MIT，但 DIS 上游当前 `LICENSE.md` 是 Apache-2.0；本项目如实记录这一差异，保留上游原文，不自行重写授权。SDK 自身的 AGPL-3.0 条款继续适用。
