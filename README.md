# dsh-custom-reasoning

为 DeepSeek Harness（DSH）的自定义 `pi-ai` 模型配置推理等级和思考格式。

插件会在 DSH Web 的 Settings 页面增加"思考等级"区域。配置保存后，对话中的模型选择器会将模型支持的推理等级作为单选项展示。

## 功能

- 为每个自定义模型配置多个推理等级：
  - `off`
  - `minimal`
  - `low`
  - `medium`
  - `high`
  - `xhigh`
  - `max`
- 为每个 Provider 配置思考格式：
  - 自动检测
  - `openai`
  - `deepseek`
  - `openrouter`
  - `together`
  - `zai`
  - `qwen`
  - `string-thinking`
  - `ant-ling`
- 修改后自动保存，无需手动提交。
- 支持按住鼠标拖动，快速勾选或取消多个推理等级。
- 支持复制一个模型的等级配置，并点击或拖动粘贴到其他模型。
- 保存时使用 Settings revision，避免静默覆盖并发修改。

## 前置条件

- 已安装并可以运行 DSH Web。
- 已在 DSH 的 Models 页面添加至少一个自定义 Provider 和模型。
- 自定义模型配置由 `llm-pi-ai` Settings namespace 管理。

## 安装

```powershell
# 1. 拉取仓库
git clone https://github.com/gao-gao-zai/dsh-custom-reasoning.git
cd dsh-custom-reasoning

# 2. 装配插件
dsh plugin --profile web add .

# 3. 按提示重启 DSH，刷新页面
```

## 使用

1. 打开 DSH Web。
2. 进入 `Settings`。
3. 打开"思考等级"区域。
4. 为每个 Provider 选择合适的思考格式。
5. 勾选每个模型支持的推理等级。
6. 等待界面显示"已保存"。

每个模型至少保留一个推理等级，界面不会允许取消最后一个选项。

### 复制等级配置

1. 点击"复制配置"。
2. 点击一个模型的任意等级标签，将该模型设为模板。
3. 点击目标模型，或按住鼠标拖过多个目标模型。
4. 按 `Esc` 或点击"取消复制"退出复制模式。

复制操作只复制模型的 `reasoningEfforts`，不会修改 Provider 的思考格式。

## 保存机制

插件直接调用 DSH Settings API：

- 使用 `settings.describe` 读取 `llm-pi-ai` 配置。
- 使用 `settings.mutate` 写入变化。
- 修改后等待 800 ms 再保存，以合并连续操作。
- Provider 思考格式写入 `providers.<provider>.compat`。
- 模型推理等级写回对应 Provider 的 `models` 数组。
- 保存请求携带 `expectedRevision`，服务端配置已变化时不会直接覆盖。

如果保存失败，页面会显示 API 返回的错误。插件不会在本地存储 Provider 凭证或模型密钥。

## 项目结构

```text
dsh-custom-reasoning/
├── cordis.patch.yml   # 将插件挂载到 DSH Web composition
├── lib/
│   ├── client.js      # Settings 页面、交互和保存逻辑
│   └── index.js       # Host 入口；当前无需 Host 侧 RPC
├── package.json       # 插件元数据和 DSH bundle/client 声明
└── README.md
```

## 实现说明

该插件是纯 Web 客户端插件。Host 入口只导出空的 `apply()`，客户端通过 DSH connection 提供的 Settings API 直接读写配置。

客户端模块注册为 `dsh-custom-reasoning`，并向 `settings.section` slot 注册以下页面项：

- ID：`custom-reasoning`
- 标签：`思考等级`
- 顺序：`12`

## 当前限制

- 只管理自定义 `pi-ai` Provider，不管理 DSH 内置模型。
- 推理等级和思考格式选项目前由插件内的固定列表提供。
- 当前包只包含可加载的 JavaScript 文件，没有独立构建脚本和自动化测试。
- 保存模型等级时会写回所属 Provider 的完整 `models` 数组；并发修改由 revision 检查保护，但冲突后需要刷新页面重新加载最新配置。

## License

MIT