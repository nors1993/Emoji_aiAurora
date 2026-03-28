# aiAurora 情绪与表情映射文档

## 一、概述

本文档定义了 aiAurora 虚拟人的 21 种情绪与 3D avatar 表情的一一映射关系。基于产品白皮书的情绪框架，实现情绪到表情（眼部、嘴型、眉毛、脸颊）的精确映射，确保每种情绪都有独特、生动、符合心理预期的视觉表达。

**核心原则**：
- **一一映射**：每种情绪对应唯一的表情组合，绝不出现情绪与表情矛盾的情况
- **生动表达**：综合考虑眼部、嘴型、眉毛、脸颊四个维度的协同表达
- **流式友好**：模型回答期间保持 "thinking" 状态，回答完成后根据分析结果呈现对应表情

---

## 二、情绪三维度定义

本文档采用 **PAD 情绪模型**（愉快度-唤醒度-优势度模型）来量化每种情绪的特征。

### 2.1 愉悦度 (Valence)

表示情绪的积极或消极程度：
- **+1 (最积极)**：愉悦、快乐、爱
- **0 (中性)**：平静、无情绪
- **-1 (最消极)**：悲伤、恐惧、愤怒

### 2.2 唤醒度 (Arousal)

表示情绪的强烈程度或激活水平：
- **+1 (高唤醒)**：兴奋、惊讶、愤怒（强烈、激动）
- **0 (中等唤醒)**：平静、思考
- **-1 (低唤醒)**：困倦、无聊、平静放松

### 2.3 优势度 (Dominance)

表示情绪中主体对情绪的控制能力：
- **+1 (高优势)**：自信、自豪、愤怒（支配性强）
- **0 (中等优势)**：平静、思考
- **-1 (低优势)**：恐惧、害羞、顺从

---

## 三、情绪库（21 种情绪）

基于产品白皮书的三层情绪设计：

### 2.1 基础情绪（12 种）

| 情绪 ID | 中文名 | 英文名 | 愉悦度 (Valence) | 唤醒度 (Arousal) | 优势度 (Dominance) | 适合人格 |
|----------|--------|--------|-------------------|------------------|--------------------|----------|
| happy | 开心 | Happy | 0.8 | 0.3 | 0.2 | 治愈系，元气系、沉稳 |
| excited | 兴奋 | Excited | 0.9 | 0.9 | 0.3 | 元气系、戏精 |
| love | 喜爱 | Love | 0.9 | 0.4 | -0.1 | 治愈系、傲娇系 |
| sad | 悲伤 | Sad | -0.7 | -0.2 | -0.3 | 治愈系 |
| concerned | 担忧 | Concerned | -0.3 | 0.2 | -0.1 | 治愈系、沉稳 |
| angry | 愤怒 | Angry | -0.8 | 0.8 | 0.5 | 傲娇系、毒舌 |
| surprised | 惊讶 | Surprised | 0.2 | 0.9 | -0.1 | 元气系、戏精 |
| fearful | 恐惧 | Fearful | -0.7 | 0.7 | -0.6 | 治愈系 |
| disgusted | 厌恶 | Disgusted | -0.6 | 0.1 | 0.1 | 毒舌 |
| neutral | 平静 | Neutral | 0 | 0 | 0 | 沉稳 |
| thinking | 思考 | Thinking | 0.1 | -0.3 | 0.2 | 沉稳 |
| sleepy | 困倦 | Sleepy | 0.1 | -0.8 | -0.2 | 治愈系 |

### 2.2 复合情绪（9 种）

| 情绪 ID | 中文名 | 英文名 | 愉悦度 | 唤醒度 | 优势度 | 适合人格 |
|----------|--------|--------|--------|--------|--------|----------|
| confused | 困惑 | Confused | -0.3 | 0.3 | -0.2 | 治愈系、戏精 |
| embarrassed | 窘迫 | Embarrassed | 0.3 | 0.5 | -0.3 | 傲娇系、治愈系 |
| helpless | 无奈 | Helpless | 0.2 | -0.1 | 0.3 | 治愈系、傲娇系 |
| jealous | 吃醋 | Jealous | -0.2 | 0.4 | 0.1 | 傲娇系 |
| longing | 怅然若失 | Longing | -0.3 | 0.2 | -0.4 | 傲娇系、治愈系 |
| shy | 害羞 | Shy | 0.4 | 0.4 | -0.3 | 治愈系、傲娇系 |
| playful | 调皮 | Playful | 0.5 | 0.6 | 0.2 | 元气系、戏精、毒舌 |
| proud | 自豪 | Proud | 0.7 | 0.5 | 0.4 | 元气系、戏精 |
| grateful | 感激 | Grateful | 0.8 | 0.3 | -0.1 | 治愈系 |

---

## 三、情绪与表情映射表

### 3.1 完整映射矩阵

| 情绪 | 眼睛 (Eye) | 眉毛 (Eyebrow) | 嘴巴 (Mouth) | 脸颊 (Cheek) | 颜色 |
|------|------------|----------------|--------------|--------------|------|
| **happy** | 笑眼 (squinted, 0.85y) | 放松微抬 (+0.05y) | 微笑弧线 (smile) **嘴角上扬** | 粉色 50% | #FFD700 金色 |
| **excited** | 大眼 + 高光 (wide, 1.3x, sparkle) | 高抬 (-0.4, +0.1y) | 大笑 (bigSmile) **嘴角上扬** | 粉色 60% | #FF6B6B 红色 |
| **love** | 半闭眼 + 高光 (halfLidded, sparkle) | 柔和拱形 (-0.15) | 甜蜜微笑 (smile) **嘴角上扬** | 粉色 70% | #FF69B4 粉色 |
| **sad** | 下垂眼 + 小瞳孔 (droopy, 0.85x) | 内角抬起 (+0.2) | 嘴角下弯 (downturned) **嘴角下扬** | 无 | #4169E1 蓝色 |
| **concerned** | 轻微眯眼 (normal, 0.85y) | 轻微皱起 (+0.1, +0.02y) | 轻微下弯 (concerned) **嘴角下扬** | 苍白 15% | #87CEEB 天蓝 |
| **angry** | 眯眼 (narrowed, 0.7y) | V形下沉 (+0.4, -0.05y) | 龇牙 (snarl) | 红色 30% | #FF4500 橙红 |
| **surprised** | 瞪眼 + 大瞳孔 (wide, 1.3x, sparkle) | 高抬 (-0.5, +0.12y) | 张大嘴 (open) | 无 | #00CED1 青色 |
| **fearful** | 大眼 + 小瞳孔 (wide, 0.7x) | 高抬紧锁 (-0.3, +0.08y) | 小张嘴 (openSmall) | 苍白 20% | #9370DB 紫色 |
| **disgusted** | 不对称眯眼 (asymmetric) | 不对称皱眉 (左+0.25, 右+0.1) | 厌恶扭曲 (disgust) **嘴角下扬** | 绿色 25% | #32CD32 绿色 |
| **neutral** | 正常眼 (normal) | 平板 (0) | 直线 (neutral) | 无 | #7C3AED 紫罗兰 |
| **thinking** | 向上看 + 左眼略窄 | 不对称 (左-0.2, 右0) | 歪嘴思考 (hmm) | 无 | #87CEEB 天蓝 |
| **sleepy** | 几乎闭合 (droopy, 0.15y) | 下垂 (+0.1, -0.05y) | 打哈欠 (yawn) | 无 | #DDA0DD 淡紫 |
| **confused** | 不对称大小 (左1.1, 右0.9) | 不对称 (左-0.25, 右+0.05) | 纠结波浪 (wavy) | 无 | #FFA500 橙色 |
| **embarrassed** | 躲避 + 半闭 (offset -0.04, 0.85y) | 略抬 (-0.1) | 害羞微笑 (shySmile) **嘴角上扬** | 红色 50% | #FFB6C1 浅粉 |
| **helpless** | 柔和下垂 (droopy, 0.95y, offset -0.02) | 轻微内抬 (-0.05, +0.03y) | 叹气 (sigh) | 无 | #708090 石板灰 |
| **jealous** | 斜眼 + 眯眼 (offset +0.06, 0.8y) | 不对称 (左+0.15, 右-0.1) | 紧下弯 (tightFrown) **嘴角下扬** | 轻微 10% | #DC143C 深红 |
| **longing** | 下垂 + 远望 (droopy, 0.9y, offset +0.03) | 柔和拱形 (-0.1) | 轻下弯 (slightFrown) **嘴角下扬** | 无 | #8B4789 中紫红 |
| **shy** | 躲避 + 半闭 (offset -0.05, 0.8y) | 轻锁 (-0.08) | 极小微笑 (tinySmile) **嘴角上扬** | 红色 55% | #FF85A2 亮粉 |
| **playful** | 眨眼 (左眼闭, 右眼开+sparkle) | 不对称 (左-0.3, 右+0.05) | 龇牙grin) **嘴角上扬** | 粉色 40% | #20B2AA 浅海绿 |
| **proud** | 自信闭眼 (squinted, 0.85y) | 略抬 (-0.15, +0.04y) | 不对称上扬 (smirk) **嘴角上扬** | 轻微 10% | #DAA520 金麒麟 |
| **grateful** | 柔和 + 高光 (halfLidded, sparkle) | 柔和拱形 (-0.12) | 温暖微笑 (warmSmile) **嘴角上扬** | 暖粉 40% | #FFB6C1 暖粉 |

---

## 四、表情渲染详解

### 4.1 眼睛 (Eye) 渲染参数

| 情绪 | eyeScale [x, y] | pupilScale | pupilOffset [x, y] | isClosed | hasSparkle | eyeShape |
|------|-----------------|------------|--------------------|----------|------------|----------|
| happy | [1.0, 0.85] | 1.0 | [0, 0] | false | false | squinted |
| excited | [1.3, 1.3] | 1.3 | [0, 0] | false | true | wide |
| love | [1.0, 0.8] | 1.0 | [0, 0] | false | true | halfLidded |
| sad | [1.0, 0.95] | 0.85 | [0, -0.02] | false | false | droopy |
| concerned | [1.0, 0.85] | 0.9 | [0, 0] | false | false | normal |
| angry | [1.0, 0.7] | 1.0 | [0, 0] | false | false | narrowed |
| surprised | [1.4, 1.4] | 1.3 | [0, 0] | false | true | wide |
| fearful | [1.2, 1.2] | 0.7 | [0, 0] | false | false | wide |
| disgusted | [0.95, 0.85] | 1.0 | [0, 0] | false | false | asymmetric |
| neutral | [1.0, 1.0] | 1.0 | [0, 0] | false | false | normal |
| thinking | [1.0, 0.95] | 1.0 | [0, 0.05] | false | false | normal |
| sleepy | [1.0, 0.15] | 1.0 | [0, 0] | true | false | droopy |
| confused | [1.1, 1.0] | 1.0 | [0, 0] | false | false | asymmetric |
| embarrassed | [1.0, 0.85] | 1.0 | [-0.04, 0] | false | false | halfLidded |
| helpless | [1.0, 0.95] | 1.0 | [0, -0.02] | false | false | droopy |
| jealous | [0.9, 0.8] | 1.0 | [0.06, 0] | false | false | narrowed |
| longing | [1.0, 0.9] | 0.9 | [0, 0.03] | false | false | droopy |
| shy | [1.0, 0.8] | 1.0 | [-0.05, 0] | false | false | halfLidded |
| playful | [1.0, 1.0] | 1.2 | [0, 0] | false | true | normal |
| proud | [1.0, 0.85] | 1.0 | [0, 0] | false | false | squinted |
| grateful | [1.0, 0.9] | 1.0 | [0, 0] | false | true | halfLidded |

### 4.2 眉毛 (Eyebrow) 渲染参数

| 情绪 | rotation | verticalOffset | isAsymmetric | leftRotation | rightRotation |
|------|----------|----------------|---------------|--------------|---------------|
| happy | 0 | 0.05 | false | - | - |
| excited | -0.4 | 0.1 | false | - | - |
| love | -0.15 | 0 | false | - | - |
| sad | 0.2 | 0 | false | - | - |
| concerned | 0.1 | 0.02 | false | - | - |
| angry | 0.4 | -0.05 | false | - | - |
| surprised | -0.5 | 0.12 | false | - | - |
| fearful | -0.3 | 0.08 | false | - | - |
| disgusted | 0.1 | 0 | true | 0.25 | 0.1 |
| neutral | 0 | 0 | false | - | - |
| thinking | 0 | 0 | true | -0.2 | 0 |
| sleepy | 0.1 | -0.05 | false | - | - |
| confused | 0 | 0 | true | -0.25 | 0.05 |
| embarrassed | -0.1 | 0 | false | - | - |
| helpless | -0.05 | 0.03 | false | - | - |
| jealous | 0 | 0 | true | 0.15 | -0.1 |
| longing | -0.1 | 0 | false | - | - |
| shy | -0.08 | 0 | false | - | - |
| playful | 0 | 0 | true | -0.3 | 0.05 |
| proud | -0.15 | 0.04 | false | - | - |
| grateful | -0.12 | 0 | false | - | - |

### 4.3 嘴巴 (Mouth) 渲染参数

| 情绪 | 嘴巴形状 | 渲染方式 | 描述 |
|------|----------|----------|------|
| happy | smile | torusGeometry (rotation=π) | **向上弧线，嘴角上扬**，半径 0.2 |
| excited | bigSmile | torus (rotation=π) + circle | **宽弧线 + 张嘴圆形，嘴角上扬** |
| love | smile | torusGeometry (rotation=π) | **甜蜜微笑弧线，嘴角上扬** |
| sad | downregulated | torus (偏转) | **嘴角下弯，嘴角下扬**（两侧向下撇） |
| concerned | concerned | torusGeometry (rotation=π, 小弧度) | **轻微下弯，嘴角下扬**，比 sad 轻 |
| angry | snarl | box + plane | 龇牙露齿 + 暗色缝隙 |
| surprised | open | circleGeometry | 大圆形嘴巴 |
| fearful | openSmall | circleGeometry | 小圆形嘴巴 |
| disgusted | disgust | torus (无翻转) | **不对称下弯，嘴角下扬** |
| neutral | neutral | planeGeometry | 扁平直线 |
| thinking | hmm | torus (偏移) | 歪向一侧的小弧线 |
| sleepy | yawn | circleGeometry (拉伸) | 纵向拉伸的椭圆 |
| confused | wavy | torus (旋转) | 波浪形曲线 |
| embarrassed | shySmile | torusGeometry (rotation=π) | **小上扬弧线，嘴角上扬** |
| helpless | sigh | circleGeometry (横向) | 横向椭圆 |
| jealous | tightFrown | torusGeometry (rotation=π) | **紧凑下弯，嘴角下扬**，半径 0.12 |
| longing | slightFrown | torusGeometry (rotation=π) | **轻微下弯，嘴角下扬** |
| shy | tinySmile | torusGeometry (rotation=π) | **极小上扬弧线，嘴角上扬** |
| playful | grin | box + plane | **开心龇牙，嘴角上扬** |
| proud | smirk | torus (rotation=π, 偏转) | **不对称上扬，嘴角上扬** |
| grateful | warmSmile | torusGeometry (rotation=π) | **柔和宽弧线，嘴角上扬** |

---

## 五、情绪分析流程

### 5.1 情绪检测链路

```
用户发送消息
    ↓
模型流式返回回答 (thinking 状态)
    ↓
回答完成 → 调用情绪分析
    ↓
┌─────────────────────────────────────────────┐
│ 1. 解析 JSON: {"emotion": "?", "text": "?"}  │
│    └─ 成功 → 使用 emotion 字段               │
│    └─ 失败 → 步骤 2                         │
├─────────────────────────────────────────────┤
│ 2. 调用 LLM 二次分析 (analyzeEmotionWithLLM) │
│    └─ 成功 → 使用分析结果                    │
│    └─ 失败 → 步骤 3                         │
├─────────────────────────────────────────────┤
│ 3. 关键词回退 (detectEmotion)               │
│    └─ 基于关键词匹配返回情绪                  │
└─────────────────────────────────────────────┘
    ↓
Avatar 显示对应情绪的表情
```

### 5.2 流式期间的处理

- 流式传输期间，Avatar 保持 **"thinking"** 状态
- 原因：部分 JSON 片段会导致错误的情绪判断，产生表情闪烁
- 回答完成后，根据最终分析结果呈现对应表情

---

## 六、关键实现代码

### 6.1 情绪库定义 (src/types/index.ts)

```typescript
export type Emotion = 
  | 'happy' | 'excited' | 'love' | 'sad' | 'angry'
  | 'surprised' | 'fearful' | 'disgusted' | 'neutral'
  | 'thinking' | 'sleepy' | 'confused' | 'embarrassed'
  | 'helpless' | 'jealous' | 'longing' | 'shy' | 'playful'
  | 'proud' | 'grateful'
```

### 6.2 LLM 情绪分析 (src/utils/llm.ts)

```typescript
// 核心分析函数
export async function analyzeEmotionWithLLM(
  text: string,
  settings: Settings
): Promise<Emotion> {
  // 调用用户配置的 LLM 进行情绪分析
  // 返回 20 种合法情绪之一
}
```

---

## 七、验证清单

- [ ] **开心 (happy)** → 笑眼 + 微笑弧线 **（嘴角上扬）** + 粉色腮红
- [ ] **悲伤 (sad)** → **下垂眼 + 下弯嘴角（嘴角下扬）** + 无腮红
- [ ] **愤怒 (angry)** → 眯眼 + V形眉 + 龇牙
- [ ] **惊讶 (surprised)** → 瞪眼 + 大嘴
- [ ] **担忧 (concerned)** → 轻微眯眼 + 轻微下弯嘴角（嘴角下扬）
- [ ] **开心时绝不出现悲伤表情**
- [ ] **开心相关情绪嘴角必须上扬**（happy, excited, love, embarrassed, shy, playful, proud, grateful）
- [ ] **悲伤相关情绪嘴角必须下扬**（sad, concerned, jealous, longing）
- [ ] **流式期间保持 thinking 状态，回答完成后才切换表情**

---

## 九、版本信息

- **文档版本**: v1.3
- **更新日期**: 2026-03-16
- **更新内容**: 新增情绪三维度（愉悦度/唤醒度/优势度）定义说明
- **基于白皮书**: Emoji虚拟人产品白皮书.md
- **代码实现**: src/components/Avatar/AvatarCanvas.tsx, src/utils/llm.ts
