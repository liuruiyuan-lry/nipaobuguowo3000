# 🎮 张雪峰快跑 - 素材替换指南

本目录用于存放游戏所需的图片和音频素材。**代码中已预留好所有引用路径，你只需把素材文件放入此目录并确保文件名匹配即可。**

---

## 📁 素材清单

| 文件名 | 用途 | 格式建议 | 替换方法 |
|--------|------|----------|----------|
| `bgm.mp3` | 循环背景音乐《张雪峰老师我还记得你》| MP3, ~1-3MB | 放入此目录，或修改 `index.html` 中 `#bgMusic` 的 `src` |
| `voice.mp3` | 随机台词音效「你跑不过我你信吗」| MP3, ~100-500KB | 放入此目录，或修改 `index.html` 中 `#voiceLine` 的 `src` |
| `death.mp3` | 碰撞失败音效 | MP3, ~50-200KB | 放入此目录，或修改 `index.html` 中 `#deathSound` 的 `src` |

---

## 🖼️ 可选：替换角色和障碍物精灵图

当前游戏使用 **Canvas 纯代码绘制** 像素风格角色和巧乐兹障碍物，无需图片即可运行。

如果你想替换为**自定义图片素材**，可以在 `js/game.js` 中搜索以下函数并替换为 `drawImage` 调用：

| 函数名 | 绘制内容 | 替换位置（行内搜索） |
|--------|----------|---------------------|
| `drawPlayerRun()` | 跑步姿态 | 用 `ctx.drawImage(runImg, ...)` 替换 |
| `drawPlayerJump()` | 跳跃姿态 | 用 `ctx.drawImage(jumpImg, ...)` 替换 |
| `drawPlayerDuck()` | 下蹲姿态 | 用 `ctx.drawImage(duckImg, ...)` 替换 |
| `drawObstacle()` | 巧乐兹障碍物 | 用 `ctx.drawImage(obsImg, ...)` 替换 |

图片加载示例（添加到 `init()` 函数中）：
```javascript
var playerRunImg = new Image();
playerRunImg.src = 'assets/player_run.png';
```

---

## 🎵 使用在线音频URL（无需下载文件）

如果你有音频的在线链接，直接在 `index.html` 中修改 `<source>` 标签的 `src` 属性：

```html
<!-- 示例：使用在线音频 -->
<audio id="bgMusic" loop preload="auto">
    <source src="https://your-cdn.com/bgm.mp3" type="audio/mpeg">
</audio>
```

---

## ⚠️ 注意事项

1. **浏览器自动播放限制**：部分浏览器（尤其是移动端）会阻止自动播放音频。游戏会在用户**第一次触摸屏幕或按键**后开始播放背景音乐。
2. **文件大小**：建议单个音频文件不超过 3MB，确保移动网络下也能快速加载。
3. **格式兼容**：MP3 格式兼容性最好，推荐使用。如需支持所有浏览器，可同时提供 OGG 格式：
   ```html
   <source src="assets/bgm.mp3" type="audio/mpeg">
   <source src="assets/bgm.ogg" type="audio/ogg">
   ```
