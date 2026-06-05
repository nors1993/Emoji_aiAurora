本项目基于 **PAD 情绪模型**（Pleasure-Arousal-Dominance，愉悦度-唤醒度-优势度）设计 21 种情绪：

**PAD 三维度**：

- **Valence（愉悦度，-1~1）**：情绪的积极/消极程度。开心=0.8，悲伤=-0.7。
- **Arousal（唤醒度，-1~1）**：情绪的强烈程度。兴奋=0.9，困倦=-0.8。
- **Dominance（优势度，-1~1）**：主体对情绪的控制力。愤怒=0.5（支配性强），恐惧=-0.6（顺从性强）。

**层次设计**：

```
基础情绪（12种） ← 愉悦度/唤醒度/优势度量化
    ├── 开心(happy)、兴奋(excited)、喜爱(love) — 高愉悦度
    ├── 悲伤(sad)、担忧(concerned)、愤怒(angry) — 低愉悦度
    ├── 惊讶(surprised)、恐惧(fearful) — 高唤醒度
    └── 平静(neutral)、思考(thinking)、困倦(sleepy) — 低唤醒度

复合人格情绪（9种） ← 基于人格标签 + PAD 维度微调
    ├── 困惑(confused)：-0.3/0.3/-0.2
    ├── 窘迫(embarrassed)：0.3/0.5/-0.3
    ├── 无奈(helpless)：0.2/-0.1/0.3
    ├── 吃醋(jealous)：-0.2/0.4/0.1
    ├── 怅然若失(longing)：-0.3/0.2/-0.4
    ├── 害羞(shy)：0.4/0.4/-0.3
    ├── 调皮(playful)：0.5/0.6/0.2
    ├── 自豪(proud)：0.7/0.5/0.4
    └── 感激(grateful)：0.8/0.3/-0.1
```

**PAD 模型的作用**：

1. **量化可计算**：PAD 值使情绪可被程序化处理，如"愉悦度 > 0.5 的情绪才配粉色腮红"。
2. **映射到视觉**：高 Arousal → 更大瞳孔 + 高光；低 Dominance → 眉毛内抬。
3. **TTS 语气映射**：emotionToInstruct() 将 21 种情绪映射为自然语言指令，如 `happy → "用开心愉悦的语气说"`。

**完整数据流**：

```
LLM 响应 → 情绪检测(emotion detection)
  → Zustand store (currentEmotion 更新)
    → AuroraAvatar 组件 (useEffect 响应)
      → Three.js 场景更新：颜色、眼睛、嘴巴、眉毛、动态效果
        → requestAnimationFrame 循环渲染
```

**Three.js 具体实现**：

1. **颜色渐变**：`material.color.lerp(targetColor, lerpFactor)` 实现平滑过渡。高强度情绪（excited/angry）lerpFactor=0.15，低强度为 0.05。

2. **眼睛系统**：通过 `EyeConfig` 接口定义 6 个维度：
   - `eyeScale`：宽高缩放（兴奋时 1.3x，开心时 0.85y）
   - `pupilScale`：瞳孔大小
   - `pupilOffset`：瞳孔偏移（实现视线微动）
   - `isClosed/hasSparkle/isWink`：布尔开关
   - `eyeShape`：7 种形状（squinted/wide/droopy/narrowed/halfLidded/asymmetric）

3. **动态效果**：
   - **脉动（Pulse）**：情绪高涨时（excited/angry），整体缩放周期性变化
   - **抖动（Shake）**：愤怒时，mesh 位置随机偏移（`Math.random() * 0.15`）
   - **呼吸（Breath）**：持续轻微的缩放循环，模拟呼吸感
   - **眼睛微动**：随机瞳孔偏移，模拟真实注视

4. **Intro 模式**：初始时每 2 秒随机切换情绪，展示表情多样性；用户交互后自动退出。

- 关键词匹配准确率低，但速度最快。

**三层情绪检测链**：

```
第一层：JSON 解析（流式）
  ├── 在 LLM 流式响应中提取 JSON 块
  ├── 如 { "emotion": "happy", "text": "..." }
  ├── 解析成功 → 直接使用，跳过后续
  └── 解析失败 → 进入第二层

第二层：LLM Analyze（独立请求）
  ├── 将完整对话发送给 LLM，要求分析情绪
  ├── 使用专门的 analyze prompt
  ├── 更准确但多一次 API 调用
  └── 失败 → 进入第三层

第三层：关键词回退（本地）
  ├── analyzeEmotionFromContext() 分析用户消息
  ├── detectEmotion() 检测助手回复中的关键词
  ├── 逻辑规则（感叹号多→excited，省略号→thinking）
  └── 全部失败 → 返回 'neutral'
```

**优势**：

- **流式友好**：第一层在流式过程中即可触发，无需等待完整响应。
- **零成本降级**：关键词检测零 API 成本，适合免费/自部署场景。
- **可配置性**：不同 provider（OpenAI vs Ollama）可跳过特定层级。