# aiAurora 情绪表情测试文档

## 一、测试概述

本文档记录 aiAurora 虚拟人 21 种情绪表情的测试验证结果。每种情绪都经过实际渲染验证，确保嘴巴、眼睛、眉毛、脸颊配置符合预期。

**测试日期**: 2026-03-16

---

## 二、情绪测试结果

### 2.1 开心/愉悦类情绪 (嘴角上扬)

| 情绪 | 嘴巴形状 | 嘴角方向 | 眼睛 | 眉毛 | 脸颊 | 测试状态 |
|------|----------|----------|------|------|------|----------|
| **happy** | smile | ✅ 上扬 | squinted | 放松微抬 | 粉色 50% | ✅ 通过 |
| **excited** | bigSmile | ✅ 上扬 | wide + sparkle | 高抬 | 粉色 60% | ✅ 通过 |
| **love** | smile | ✅ 上扬 | halfLidded + sparkle | 柔和拱形 | 粉色 70% | ✅ 通过 |
| **embarrassed** | shySmile | ✅ 上扬 | halfLidded | 略抬 | 红色 50% | ✅ 通过 |
| **shy** | tinySmile | ✅ 上扬 | halfLidded | 轻锁 | 红色 55% | ✅ 通过 |
| **playful** | grin | ✅ 上扬 | wink | 不对称 | 粉色 40% | ✅ 通过 |
| **proud** | smirk | ✅ 上扬 | squinted | 略抬 | 轻微 10% | ✅ 通过 |
| **grateful** | warmSmile | ✅ 上扬 | halfLidded + sparkle | 柔和拱形 | 暖粉 40% | ✅ 通过 |

---

### 2.2 悲伤/失落类情绪 (嘴角下扬)

| 情绪 | 嘴巴形状 | 嘴角方向 | 眼睛 | 眉毛 | 脸颊 | 测试状态 |
|------|----------|----------|------|------|------|----------|
| **sad** | downturn ed | ✅ 下扬 | droopy | 内角抬起 | 无 | ✅ 通过 |
| **concerned** | concerned | ✅ 下扬 | normal | 轻微皱起 | 苍白 15% | ✅ 通过 |
| **jealous** | tightFrown | ✅ 下扬 | narrowed | 不对称 | 轻微 10% | ✅ 通过 |
| **longing** | slightFrown | ✅ 下扬 | droopy | 柔和拱形 | 无 | ✅ 通过 |

---

### 2.3 愤怒类情绪

| 情绪 | 嘴巴形状 | 嘴巴描述 | 眼睛 | 眉毛 | 脸颊 | 测试状态 |
|------|----------|----------|------|------|------|----------|
| **angry** | snarl | 龇牙露齿 | narrowed | V形下沉 | 红色 30% | ✅ 通过 |

---

### 2.4 惊讶类情绪

| 情绪 | 嘴巴形状 | 嘴巴描述 | 眼睛 | 眉毛 | 脸颊 | 测试状态 |
|------|----------|----------|------|------|------|----------|
| **surprised** | open | 大圆形 | wide + sparkle | 高抬 | 无 | ✅ 通过 |
| **fearful** | openSmall | 小圆形 | wide | 高抬紧锁 | 苍白 20% | ✅ 通过 |

---

### 2.5 其他情绪

| 情绪 | 嘴巴形状 | 嘴巴描述 | 眼睛 | 眉毛 | 脸颊 | 测试状态 |
|------|----------|----------|------|------|------|----------|
| **disgusted** | disgust | 不对称下弯 | asymmetric | 不对称皱眉 | 绿色 25% | ✅ 通过 |
| **neutral** | neutral | 平板直线 | normal | 平板 | 无 | ✅ 通过 |
| **thinking** | hmm | 略歪 | normal | 不对称 | 无 | ✅ 通过 |
| **sleepy** | yawn | 纵向椭圆 | droopy | 下垂 | 无 | ✅ 通过 |
| **confused** | wavy | 纠结波浪 | asymmetric | 不对称 | 无 | ✅ 通过 |
| **helpless** | sigh | 横向椭圆 | droopy | 轻微内抬 | 无 | ✅ 通过 |

---

## 三、关键验证点

### 3.1 嘴角方向验证

✅ **开心类嘴角必须上扬**:
- [x] happy - smile (上扬)
- [x] excited - bigSmile (上扬)
- [x] love - smile (上扬)
- [x] embarrassed - shySmile (上扬)
- [x] shy - tinySmile (上扬)
- [x] playful - grin (上扬)
- [x] proud - smirk (上扬)
- [x] grateful - warmSmile (上扬)

✅ **悲伤类嘴角必须下扬**:
- [x] sad - downturn ed (下扬)
- [x] concerned - concerned (下扬) **已修复**
- [x] jealous - tightFrown (下扬) **已修复**
- [x] longing - slightFrown (下扬) **已修复**

✅ **厌恶类嘴角必须下扬**:
- [x] disgusted - disgust (下扬)

---

### 3.2 渲染实现验证

**嘴角上扬实现** (rotation={[Math.PI, 0, 0]}):
```typescript
case 'smile':
  return (
    <mesh rotation={[Math.PI, 0, 0]}>  // 翻转使弧线向上
      <torusGeometry args={[0.2, 0.04, 16, 32, Math.PI]} />
    </mesh>
  )
```

**嘴角下扬实现** (左右嘴角向下撇):
```typescript
case 'downturned':  // sad 专用
  return (
    <group>
      <mesh position={[-0.12, -0.02, 0]} rotation={[0, 0, -0.3]}>
        {/* 左侧嘴角向下撇 */}
      </mesh>
      <mesh position={[0.12, -0.02, 0]} rotation={[0, 0, 0.3]}>
        {/* 右侧嘴角向下撇 */}
      </mesh>
    </group>
  )
```

---

## 四、本次审查修复的问题

### 4.1 已修复的 Bug

| 问题 | 描述 | 修复状态 |
|------|------|----------|
| **concerned (担忧)** | 原本使用 rotation=PI 导致嘴角上扬，修复为使用左右嘴角下撇实现下扬 | ✅ 已修复 |
| **jealous (tightFrown)** | 原本使用 rotation=PI 导致嘴角上扬，修复为使用左右嘴角下撇实现紧下弯 | ✅ 已修复 |
| **longing (slightFrown)** | 原本使用 rotation=PI 导致嘴角上扬，修复为使用左右嘴角下撇实现轻下弯 | ✅ 已修复 |

### 4.2 待补充

- [ ] 添加所有 21 种情绪的 3D 渲染截图
- [ ] 验证流式响应期间保持 thinking 状态
- [ ] 验证回答完成后表情正确切换

---

## 五、测试方法

### 5.1 手动测试

1. 打开应用: `npm run dev`
2. 打开浏览器开发者工具 Console
3. 在 Chat 中发送触发特定情绪的消息
4. 观察 Avatar 表情变化

### 5.2 自动化测试

```bash
# 运行开发服务器
npm run dev

# 使用 Playwright 截图测试
npx playwright test
```

---

## 六、版本信息

- **文档版本**: v1.1
- **更新日期**: 2026-03-16
- **修复内容**: 修复 concerned、jealous、longing 三个情绪的嘴角方向错误
- **基于**: emotion_mapping.md, AvatarCanvas.tsx
