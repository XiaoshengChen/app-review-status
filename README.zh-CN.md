# App Review Status Skill

[English](README.md) | [简体中文](README.zh-CN.md)

一个小巧、只读的 Agent Skill，通过 Apple 官方 App Store Connect API 查询 App Store 版本当前的审核状态。

它可以回答：

- 我的 App 是否正在等待审核？
- 审核是否已经开始？
- 当前版本是否被拒绝？
- 当前版本是否已可销售或分发？

![虚构的 App Store Connect 审核状态示例](assets/example-output.svg)

公开版本刻意保持无状态：读取当前状态、输出结果，然后退出。它不会安排定时任务、保存历史、估算审核时间、打开浏览器或修改 App Store Connect 中的任何内容。

## 获取 App Store Connect API 密钥

请从 [App Store Connect](https://appstoreconnect.apple.com/) 开始，并选择下面一种密钥类型。Apple 的[官方 API 设置指南](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/)介绍了两种流程。

### 方案 A：个人 API 密钥（个人使用推荐）

1. 登录 App Store Connect。
2. 点击右上角的用户名，然后选择 **编辑个人资料（Edit Profile）**。
3. 在 **个人 API 密钥（Individual API Key）** 下点击 **生成密钥（Generate Key）**。
4. 下载 `.p8` 文件，并记下 **密钥 ID（Key ID）**。

个人密钥会继承该用户可以访问的 App 和权限，不需要 Issuer ID。每位用户只能同时拥有一个有效的个人密钥。

### 方案 B：团队 API 密钥

1. 在 App Store Connect 中打开 **用户和访问（Users and Access）** → **集成（Integrations）**。
2. 如果尚未启用 API 访问权限，账户持有人需要先点击 **申请访问权限（Request Access）**，并完成 Apple 的审批流程。
3. 打开 **团队密钥（Team Keys）**，点击 **生成 API 密钥（Generate API Key）** 或 `+` 按钮。
4. 填写便于识别的名称，例如 `app-review-status-readonly`。
5. 选择能够查看目标 App 的最低权限角色，然后生成密钥。
6. 复制 **Issuer ID** 和 **Key ID**，并下载 `.p8` 文件。

> Apple 只允许下载私有 API 密钥一次。请安全保存它，绝不要把 `.p8` 文件、生成的 JWT 或真实配置文件提交到 Git。

## 五分钟完成设置

### 1. 安装 Skill

在 Codex 中，最简单的方法是直接告诉 Codex：

```text
Install the skill from https://github.com/XiaoshengChen/app-review-status
```

Codex 会把 GitHub 上的 Skill 安装到其 Skills 目录。安装后请新建一个任务，让 Codex 发现新安装的 Skill。

手动安装：

```bash
git clone https://github.com/XiaoshengChen/app-review-status.git
cd app-review-status
mkdir -p ~/.codex/skills
ln -s "$(pwd)" ~/.codex/skills/app-review-status
```

需要 Node.js 18 或更高版本。

### 2. 让 Skill 引导首次设置

```text
Use $app-review-status to check my review status. I do not have an API key yet.
```

Skill 会说明如何生成个人或团队 API 密钥、需要哪些非敏感信息、如何保护 `.p8` 文件，以及如何创建本地私有配置。它绝不会要求你粘贴私钥内容。

等待获取凭据时，可以先运行完全离线的虚构示例：

```bash
node scripts/app-review-status.mjs --fixture references/demo-response.json
```

### 3. 创建私有配置文件

请把此文件保存在仓库之外。个人密钥的配置如下：

```json
{
  "keyType": "individual",
  "keyId": "YOUR_KEY_ID",
  "privateKeyPath": "/absolute/path/to/AuthKey_YOUR_KEY_ID.p8",
  "appIds": ["YOUR_APP_ID"]
}
```

团队密钥需要额外添加 Issuer ID：

```json
{
  "keyType": "team",
  "issuerId": "YOUR_ISSUER_ID",
  "keyId": "YOUR_KEY_ID",
  "privateKeyPath": "/absolute/path/to/AuthKey_YOUR_KEY_ID.p8",
  "appIds": ["YOUR_APP_ID"]
}
```

`appIds` 是可选项。如果省略，脚本会检查该密钥有权访问的全部 App。

### 4. 保护私钥

在 macOS 或 Linux 上运行：

```bash
chmod 600 /absolute/path/to/AuthKey_YOUR_KEY_ID.p8
```

### 5. 查询审核状态

```bash
node scripts/app-review-status.mjs --config /absolute/path/to/config.json
```

## 结果示例

上方图片和下面的输出全部使用虚构数据：

```markdown
# App Store Connect Review Status

Checked: 2026-01-15T09:00:00.000Z

| App | Version | Platform | Status |
| --- | --- | --- | --- |
| Example Reader | 1.2.0 | IOS | `WAITING_FOR_REVIEW` |
```

## 其他输出选项

输出便于程序处理的 JSON：

```bash
node scripts/app-review-status.mjs --config /absolute/path/to/config.json --format json
```

返回全部 App Store 版本，而不只是每个平台上的最新版本：

```bash
node scripts/app-review-status.mjs --config /absolute/path/to/config.json --all-versions
```

## 安装为 Agent Skill

对于 Codex，上面的安装命令会将仓库放入或软链接到 `~/.codex/skills/app-review-status`。如果你将仓库克隆到了其他位置，请运行：

```bash
mkdir -p ~/.codex/skills
ln -s "$(pwd)" ~/.codex/skills/app-review-status
```

安装后请新建一个 Codex 任务，让它发现这个 Skill。

然后可以这样提问：

```text
Use $app-review-status to check the current App Store Connect review status with config /absolute/path/to/config.json.
```

## 实现原理

1. 脚本读取本地私有配置，其中包含密钥类型、标识符、`.p8` 文件路径和可选的 App ID。
2. 它在内存中创建一个短期 JSON Web Token，并使用 ES256 在本地签名。
3. 它通过经过身份验证的 `GET` 请求查找有权访问的 App，并读取其 App Store 版本。
4. 它为每个 App 与平台组合选择最新版本，并输出 Markdown 或 JSON。

状态取自 Apple 的 `appVersionState` 字段，仅在兼容性需要时回退到 `appStoreState`。私钥和 JWT 不会被输出，也不会写入磁盘。

## 仓库结构

```text
app-review-status/
├── SKILL.md
├── agents/openai.yaml
├── assets/example-output.svg
├── scripts/app-review-status.mjs
└── references/
    ├── config.example.json
    ├── config.individual.example.json
    ├── demo-response.json
    ├── limitations.md
    └── setup.md
```

## 安全特性

- 只读：实现中不包含 POST、PATCH、PUT 或 DELETE 请求。
- 无状态：不会创建历史记录或状态缓存。
- 凭据留在本地：`.p8` 密钥保留在用户设备上，仅发送用于身份验证的短期签名 JWT。
- 短期 JWT：生成的令牌在 10 分钟后过期，并且只存在于进程内存中。
- 私钥权限检查：在 macOS 和 Linux 上，如果密钥文件允许同组用户或其他用户读取，脚本会拒绝运行。
- 安全示例：仓库只包含占位符和合成测试数据。

## 局限性

- Apple 返回当前状态，但不会返回版本进入该状态的确切时间。
- API 不会返回 App Review 对话或详细的拒绝原因。
- 本项目不会计算排队时长或预计获批时间。
- 可访问的内容取决于 API 密钥关联的 App 和角色权限。

## 官方资料

- [App Store Connect API 设置与密钥生成](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/)
- [为 App Store Connect API 创建 API 密钥](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api)
- [生成 API 请求令牌](https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests)
- [列出 App 的所有 App Store 版本](https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps-_id_-appstoreversions)

## 许可证

MIT

— [chenxs.com](https://chenxs.com)
