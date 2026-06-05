# Emoji_aiAurora Benchmark 评测指南

## 概述

本目录包含项目的完整评测基准，涵盖情绪系统、LLM集成、语音服务、端到端集成和性能五个维度。

---

## 一、文件说明

| 文件 | 用途 |
|------|------|
| `benchmark.md` | 总览，包含覆盖范围、严重级别定义、测试方法论 |
| `emotion-benchmark.json` | 21种情绪的视觉表现、PAD值、关键词、TTS指令 |
| `llm-benchmark.json` | SSE/NDJSON流式解析、情感检测链、API集成、安全测试 |
| `voice-benchmark.json` | AudioCapture PCM转换、TTS流式、端点健康检查 |
| `integration-benchmark.json` | 完整聊天流程、设置持久化、Electron IPC、错误处理 |
| `performance-benchmark.json` | FPS、延迟、内存、包体积的性能阈值 |

---

## 二、快速开始

### 1. 环境准备

```bash
# 安装测试依赖
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test

# 安装 Playwright 浏览器
npx playwright install chromium
```

### 2. 执行验证

```bash
# 快速验证（无需启动服务器）
./scripts/validate-benchmark.sh

# 运行所有测试
npm run test

# 运行 E2E 测试（需要服务器）
npm run test:e2e

# 运行性能测试
./scripts/performance-benchmark.sh
```

---

## 三、评测方法详解

### 方法一：自动化测试（推荐）

#### 单元测试（Vitest）

测试纯函数逻辑，无需启动服务器：

```bash
npm run test:unit
```

覆盖范围：
- `detectEmotion()` - 情感检测（21种情绪）
- `cleanTextForTTS()` - 文本清理
- SSE/NDJSON 流解析
- AudioCapture PCM 转换
- TTSClient 错误处理

#### E2E 测试（Playwright）

测试完整用户流程，需要服务器运行：

```bash
# 启动服务器
npm run dev &

# 运行 E2E 测试
npx playwright test
```

覆盖范围：
- 页面加载和渲染
- 设置持久化
- Avatar 渲染
- 性能指标（FCP）

---

### 方法二：手动验证

对于无法自动化的测试（如视觉表现），使用手动检查清单：

#### 情绪系统验证

| 情绪 | 触发关键词 | 预期视觉表现 |
|------|-----------|-------------|
| happy | "开心"、"happy" | 眯眼、#FFD700 颜色 |
| excited | "太棒了！！！" | 大眼睛带闪光、脉冲效果 |
| angry | "生气" | 眯眼、#DC143C 颜色、抖动效果 |
| sad | "难过"、"伤心" | 下垂眼、#4169E1 颜色 |
| thinking | "想想..."、"emmm" | 眯眼、#708090 颜色 |
| neutral | "好的" | 标准配置 |

**验证步骤：**
1. 打开浏览器访问 `http://localhost:5173`
2. 在 Chat 输入触发关键词
3. 观察 Avatar 面部变化（眼睛形状、颜色）
4. 检查控制台是否有错误

#### LLM 流式响应验证

| 测试项 | 验证方法 |
|--------|---------|
| SSE 解析 | 发送消息，文本应逐字显示而非一次性出现 |
| NDJSON 解析 | 切换到 Ollama 模式，验证同样逐字显示 |
| [DONE] 信号 | 流结束后，loading 状态正确关闭 |
| 错误处理 | 断开网络，验证友好错误提示 |

**验证步骤：**
1. 打开 DevTools > Network
2. 筛选 XHR/fetch 请求
3. 发送消息
4. 观察 `data:` 前缀的行逐条返回

#### 语音服务验证

| 服务 | 端点 | 验证方法 |
|------|------|---------|
| ASR | `http://localhost:8001` | 点击语音按钮，说一句话，验证文字转录 |
| TTS | `http://localhost:8002` | 回复文本，验证音频逐句播放 |

**验证步骤：**
1. 确保本地推理服务器运行
2. 打开浏览器控制台
3. 点击语音按钮
4. 检查音频波形指示器

---

### 方法三：性能测试

#### FPS 测量

1. 打开 Chrome DevTools > Performance
2. 访问 `http://localhost:5173`
3. 录制 5 秒 idle 状态
4. 查看 FPS 曲线

**阈值：**
| 场景 | 目标 | 最低 | 严重 |
|------|------|------|------|
| Idle | 60 FPS | 55 FPS | 30 FPS |
| 情绪切换 | 55 FPS | 45 FPS | 24 FPS |

#### 延迟测量

```javascript
// 在控制台执行
const start = performance.now()
fetch('/v1/chat/completions', {...})
  .then(r => {
    const firstToken = performance.now() - start
    console.log(`First token: ${firstToken}ms`)
  })
```

**阈值：**
| 指标 | 目标 | 严重 |
|------|------|------|
| LLM 首 token (OpenAI) | < 500ms | > 5000ms |
| LLM 首 token (Ollama) | < 200ms | > 3000ms |
| 情绪检测 | < 50ms | > 200ms |

#### 内存测量

1. DevTools > Memory
2. 拍摄堆快照
3. 与 baseline 对比
4. 检测泄漏（50条消息后增长 < 10MB）

---

## 四、优先级说明

| 级别 | 定义 | 处理要求 |
|------|------|---------|
| **P0** | 功能完全损坏、数据丢失、安全泄漏 | 必须修复，立即处理 |
| **P1** | 核心功能降级 | 24小时内修复 |
| **P2** | 非核心功能损坏，有 fallback | 72小时内修复 |
| **P3** | cosmetic 问题 | 下一版本修复 |

---

## 五、常见问题排查

### 测试失败：找不到模块

```bash
# 重新安装依赖
rm -rf node_modules
npm install
```

### Playwright 连接失败

```bash
# 确保服务器运行
npm run dev

# 或使用内置服务器
npx playwright test --headed
```

### 性能测试结果异常

1. 关闭浏览器扩展
2. 使用无痕模式
3. 关闭其他占用资源程序

---

## 六、持续集成

可在 CI 中加入基础检查：

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: |
    npm run validate
    npm run test:unit
    npx playwright test
```

---

## 七、扩展测试

如需添加新测试，在对应文件中添加：

```json
// emotion-benchmark.json
{
  "id": "EM-022",
  "emotion": "new_emotion",
  "name": "新情绪",
  "test_inputs": [...]
}
```

```typescript
// tests/unit/llm.test.ts
it('EM-022: Detects new_emotion', () => {
  expect(detectEmotion('触发词')).toBe('new_emotion')
})
```

---

## 八、联系方式

如有问题，请查看：
- `benchmark.md` - 总览文档
- 各 `*-benchmark.json` - 详细测试用例
- `scripts/` - 自动化工具