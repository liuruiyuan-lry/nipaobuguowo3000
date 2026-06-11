/**
 * ============================================================
 *  张雪峰快跑 - 2D 横版无尽跑酷游戏
 *  纯原生 HTML5 Canvas + JavaScript，零第三方框架依赖
 *  可直接上传到任意静态托管平台生成公网链接
 * ============================================================
 */

(function () {
    'use strict';

    // ==================== 游戏配置常量 ====================
    var CONFIG = {
        // 物理参数
        GRAVITY: 0.38,              // 重力加速度（低重力，滞空久）
        BASE_SPEED: 2.2,            // 初始游戏速度（慢，能看清障碍物）
        MAX_SPEED: 5.5,             // 最大速度上限
        SPEED_INC: 0.0004,          // 每帧速度增量（缓慢加速）

        // 跳跃参数
        MIN_JUMP_VEL: -10.5,        // 短按普通跳（轻松过障碍）
        MAX_JUMP_VEL: -15,          // 长按蓄满大跳
        SHORT_PRESS_THRESH: 150,    // 短按判定阈值（毫秒）
        MAX_CHARGE_TIME: 400,       // 最大有效蓄力时间（毫秒）

        // 玩家尺寸（相对于画布高度的比例）
        PLAYER_WIDTH_RATIO: 0.07,
        PLAYER_HEIGHT_RATIO: 0.115,
        PLAYER_X_RATIO: 0.14,       // 玩家X位置（距左侧比例）

        // 地面位置
        GROUND_RATIO: 0.785,        // 地面Y坐标比例

        // 障碍物参数
        OBSTACLE_MIN_GAP: 120,      // 障碍物最小间隔帧数
        OBSTACLE_MAX_GAP: 210,      // 障碍物最大间隔帧数
        OBSTACLE_WIDTH_RATIO: 0.055,
        OBSTACLE_TALL_RATIO: 0.06,  // 高障碍物，普通跳即可越过
        OBSTACLE_LOW_RATIO: 0.04,   // 低障碍物（需下蹲）

        // 音效
        VOICE_MIN_INTERVAL: 7000,   // 台词最小间隔（毫秒）
        VOICE_MAX_INTERVAL: 18000,  // 台词最大间隔（毫秒）

        // 传送带
        BELT_SEGMENT_COUNT: 10,     // 传送带分段数量
        BELT_HEIGHT_RATIO: 0.06,    // 传送带高度比例

        // 死亡后自动重启延迟
        RESTART_DELAY: 1400,        // 毫秒
    };

    // ==================== 获取DOM元素 ====================
    var canvas = document.getElementById('gameCanvas');
    var ctx = canvas.getContext('2d');

    var scoreEl = document.getElementById('currentScore');
    var highScoreEl = document.getElementById('highScore');
    var touchHintEl = document.getElementById('touchHint');

    // 音频元素
    var bgMusic = document.getElementById('bgMusic');
    var voiceLine = document.getElementById('voiceLine');
    var deathSound = document.getElementById('deathSound');

    // ==================== 游戏状态变量 ====================
    var displayW = 0;           // 显示宽度（CSS像素）
    var displayH = 0;           // 显示高度（CSS像素）
    var groundY = 0;            // 地面Y坐标

    var score = 0;              // 当前分数
    var highScore = 0;          // 历史最高分
    var gameSpeed = 0;          // 当前游戏速度
    var isGameOver = false;     // 是否游戏结束
    var deathTimer = 0;         // 死亡延迟计时器
    var frameCount = 0;         // 总帧数计数

    // 玩家状态
    var player = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        normalH: 0,             // 站立高度
        duckH: 0,               // 下蹲高度
        vy: 0,                  // 垂直速度
        isJumping: false,
        isDucking: false,
    };

    // 输入状态
    var keys = {};              // 键盘按键状态
    var chargeStart = 0;        // 蓄力开始时间
    var isCharging = false;     // 是否正在蓄力
    var touchStartY = 0;        // 触摸起始Y（用于检测下滑）
    var touchStartTime = 0;     // 触摸起始时间
    var touchMoved = false;     // 触摸是否移动（区分点击和滑动）
    var hasUserInteracted = false; // 用户是否已交互（用于音频自动播放）

    // 障碍物数组
    var obstacles = [];
    var obstacleTimer = 0;      // 障碍物生成计时器
    var nextObstacleAt = 0;     // 下次生成障碍物的帧数

    // 传送带滚动偏移
    var beltOffset = 0;

    // 粒子效果数组
    var particles = [];

    // 音频计时器
    var voiceTimer = 0;
    var nextVoiceAt = 0;

    // 动画帧
    var runAnimFrame = 0;       // 跑步动画帧

    // ==================== 高分存取 ====================
    function loadHighScore() {
        try {
            var saved = localStorage.getItem('zxf_high_score');
            return saved ? parseInt(saved, 10) || 0 : 0;
        } catch (e) {
            return 0;
        }
    }

    function saveHighScore(val) {
        try {
            localStorage.setItem('zxf_high_score', val);
        } catch (e) {
            // localStorage不可用时静默失败
        }
    }

    // ==================== 画布大小自适应 ====================
    function resizeCanvas() {
        var wrapper = canvas.parentElement;
        var rect = wrapper.getBoundingClientRect();
        var width = rect.width;

        // 竖屏：宽高比约 5:3；横屏时限制高度
        var height = Math.min(width * 0.62, window.innerHeight * 0.55);

        // 设备像素比（最多x2避免性能问题）
        var dpr = Math.min(window.devicePixelRatio || 1, 2);

        // 设置画布内部分辨率
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);

        // 设置画布CSS显示尺寸
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        // 重置变换矩阵并按DPR缩放（保证Retina屏清晰）
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        // 保存逻辑尺寸
        displayW = width;
        displayH = height;

        // 计算地面Y坐标
        groundY = Math.floor(displayH * CONFIG.GROUND_RATIO);

        // 更新玩家尺寸和位置
        player.width = Math.max(28, Math.floor(displayW * CONFIG.PLAYER_WIDTH_RATIO));
        player.normalH = Math.max(44, Math.floor(displayH * CONFIG.PLAYER_HEIGHT_RATIO));
        player.duckH = Math.floor(player.normalH * 0.48);
        player.height = player.isDucking ? player.duckH : player.normalH;
        player.x = Math.floor(displayW * CONFIG.PLAYER_X_RATIO);
        // 保持玩家在地面上
        if (!player.isJumping) {
            player.y = groundY - player.height;
        }
    }

    // ==================== 输入处理 ====================

    // --- 键盘 ---
    function onKeyDown(e) {
        // 防止方向键滚动页面
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
            e.key === ' ' || e.key === 'w' || e.key === 's' ||
            e.key === 'W' || e.key === 'S') {
            e.preventDefault();
        }

        // 跳跃键：空格 / 上箭头 / W
        if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && !keys[e.key]) {
            keys[e.key] = true;
            if (!isCharging && !player.isJumping) {
                isCharging = true;
                chargeStart = Date.now();
            }
        }

        // 下蹲键：下箭头 / S
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            keys[e.key] = true;
            if (!player.isJumping) {
                startDuck();
            }
        }

        // 首次交互时尝试播放背景音乐
        if (!hasUserInteracted) {
            hasUserInteracted = true;
            tryPlayBgMusic();
        }
    }

    function onKeyUp(e) {
        // 跳跃键释放
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            keys[e.key] = false;
            if (isCharging && !player.isJumping) {
                var chargeTime = Date.now() - chargeStart;
                doJump(chargeTime);
                isCharging = false;
            }
        }

        // 下蹲键释放
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            keys[e.key] = false;
            stopDuck();
        }
    }

    // --- 触摸 ---
    function onTouchStart(e) {
        e.preventDefault();
        var touch = e.touches[0];
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        touchMoved = false;

        if (!player.isJumping) {
            isCharging = true;
            chargeStart = Date.now();
        }

        if (!hasUserInteracted) {
            hasUserInteracted = true;
            tryPlayBgMusic();
        }
    }

    function onTouchMove(e) {
        e.preventDefault();
        if (!e.touches.length) return;
        var touch = e.touches[0];
        var dy = touch.clientY - touchStartY;

        // 下滑超过30px判定为下蹲手势
        if (dy > 30 && !touchMoved) {
            touchMoved = true;
            // 取消跳跃蓄力，改为下蹲
            if (isCharging && !player.isJumping) {
                isCharging = false;
            }
            startDuck();
        }
    }

    function onTouchEnd(e) {
        e.preventDefault();

        if (touchMoved) {
            // 是滑动手势，停止下蹲
            stopDuck();
        } else if (isCharging && !player.isJumping) {
            // 是点击，执行跳跃
            var chargeTime = Date.now() - chargeStart;
            doJump(chargeTime);
        }
        isCharging = false;
        touchMoved = false;
    }

    // --- 跳跃逻辑 ---
    function doJump(chargeTime) {
        // 蓄力时间越长，跳得越高
        var ratio = Math.min(chargeTime / CONFIG.MAX_CHARGE_TIME, 1.0);
        var jumpVel = CONFIG.MIN_JUMP_VEL + ratio * (CONFIG.MAX_JUMP_VEL - CONFIG.MIN_JUMP_VEL);

        player.vy = jumpVel;
        player.isJumping = true;
        player.isDucking = false;
        player.height = player.normalH;

        // 跳跃粒子效果
        spawnJumpParticles();
    }

    // --- 下蹲逻辑 ---
    function startDuck() {
        if (player.isJumping) return;
        player.isDucking = true;
        player.height = player.duckH;
        player.y = groundY - player.height;
    }

    function stopDuck() {
        player.isDucking = false;
        player.height = player.normalH;
        player.y = groundY - player.height;
    }

    // ==================== 障碍物系统 ====================

    /**
     * 生成障碍物
     * type: 'tall' = 地面高障碍（需跳跃跨越）
     *       'low'  = 空中低障碍（需下蹲躲避）
     */
    function spawnObstacle() {
        // 随机类型
        var type = Math.random() < 0.55 ? 'tall' : 'low';
        var obsW = Math.max(24, Math.floor(displayW * CONFIG.OBSTACLE_WIDTH_RATIO));
        var obsH;

        if (type === 'tall') {
            obsH = Math.max(38, Math.floor(displayH * CONFIG.OBSTACLE_TALL_RATIO));
        } else {
            obsH = Math.max(20, Math.floor(displayH * CONFIG.OBSTACLE_LOW_RATIO));
        }

        // 低障碍物悬浮在空中，高障碍物站在地面
        var obsY;
        if (type === 'tall') {
            obsY = groundY - obsH;          // 站在地面上
        } else {
            obsY = groundY - obsH - player.normalH * 0.6;  // 悬浮在头部高度
        }

        obstacles.push({
            x: displayW + obsW,             // 从屏幕右侧外部生成
            y: obsY,
            width: obsW,
            height: obsH,
            type: type,
        });
    }

    // ==================== 碰撞检测 ====================
    function checkCollision() {
        // 玩家碰撞箱（比视觉略小，增加游戏体验）
        var margin = Math.floor(player.width * 0.22);
        var px = player.x + margin;
        var py = player.y + margin * 0.6;
        var pw = player.width - margin * 2;
        var ph = player.height - margin * 1.2;

        for (var i = 0; i < obstacles.length; i++) {
            var obs = obstacles[i];
            // 障碍物碰撞箱也略微缩小
            var om = Math.floor(obs.width * 0.12);
            var ox = obs.x + om;
            var oy = obs.y + om;
            var ow = obs.width - om * 2;
            var oh = obs.height - om * 2;

            // AABB碰撞检测
            if (px < ox + ow &&
                px + pw > ox &&
                py < oy + oh &&
                py + ph > oy) {
                return true; // 碰撞！
            }
        }
        return false;
    }

    // ==================== 粒子效果 ====================
    function spawnJumpParticles() {
        var count = 6;
        for (var i = 0; i < count; i++) {
            particles.push({
                x: player.x + player.width / 2,
                y: player.y + player.height,
                vx: (Math.random() - 0.5) * 3,
                vy: -(Math.random() * 3 + 1),
                life: 20 + Math.random() * 15,
                maxLife: 35,
                size: 2 + Math.random() * 3,
                color: Math.random() < 0.5 ? '#e74c3c' : '#f39c12',
            });
        }
    }

    function spawnDeathParticles() {
        var count = 20;
        for (var i = 0; i < count; i++) {
            particles.push({
                x: player.x + player.width / 2,
                y: player.y + player.height / 2,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8 - 2,
                life: 25 + Math.random() * 30,
                maxLife: 55,
                size: 2 + Math.random() * 5,
                color: ['#e74c3c', '#c0392b', '#f39c12', '#fff'][Math.floor(Math.random() * 4)],
            });
        }
    }

    function updateParticles() {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // 轻微重力
            p.life--;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    // ==================== 音频控制 ====================
    function tryPlayBgMusic() {
        if (bgMusic) {
            bgMusic.volume = 0.45;
            bgMusic.play().catch(function () {
                // 浏览器自动播放策略限制，静默失败
            });
        }
    }

    function playVoice() {
        if (voiceLine) {
            voiceLine.volume = 0.7;
            voiceLine.currentTime = 0;
            voiceLine.play().catch(function () {});
        }
    }

    function playDeath() {
        if (deathSound) {
            deathSound.volume = 0.8;
            deathSound.currentTime = 0;
            deathSound.play().catch(function () {});
        }
    }

    // ==================== 游戏结束与重置 ====================
    function endGame() {
        if (isGameOver) return; // 防止重复触发

        isGameOver = true;
        deathTimer = CONFIG.RESTART_DELAY;

        // 更新最高分
        if (score > highScore) {
            highScore = score;
            saveHighScore(highScore);
            updateScoreDisplay();
        }

        // 死亡特效
        playDeath();
        spawnDeathParticles();

        // 停止背景音乐（可选：如果想让它继续播，注释掉这行）
        // bgMusic.pause();
    }

    function resetGame() {
        score = 0;
        gameSpeed = CONFIG.BASE_SPEED;
        isGameOver = false;
        deathTimer = 0;
        frameCount = 0;
        obstacleTimer = 0;
        voiceTimer = 0;
        particles = [];
        obstacles = [];

        player.vy = 0;
        player.isJumping = false;
        player.isDucking = false;
        player.height = player.normalH;
        player.y = groundY - player.height;

        isCharging = false;

        nextObstacleAt = randomRange(CONFIG.OBSTACLE_MIN_GAP, CONFIG.OBSTACLE_MAX_GAP);
        nextVoiceAt = randomRange(CONFIG.VOICE_MIN_INTERVAL, CONFIG.VOICE_MAX_INTERVAL);

        updateScoreDisplay();
    }

    function updateScoreDisplay() {
        scoreEl.textContent = score;
        highScoreEl.textContent = highScore;
    }

    // ==================== 辅助函数 ====================
    function randomRange(min, max) {
        return Math.floor(min + Math.random() * (max - min));
    }

    // ==================== 绘制函数 ====================

    /** 绘制背景 */
    function drawBackground() {
        // 浅白色背景
        ctx.fillStyle = '#fafaf5';
        ctx.fillRect(0, 0, displayW, displayH);

        // 背景装饰网格（极淡的线条，增加层次感）
        ctx.strokeStyle = 'rgba(0,0,0,0.03)';
        ctx.lineWidth = 0.5;
        var gridSize = 30;
        for (var x = gridSize; x < displayW; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, groundY);
            ctx.stroke();
        }
        for (var y = gridSize; y < groundY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(displayW, y);
            ctx.stroke();
        }
    }

    /** 绘制带滚轮的传送带地面 */
    function drawConveyorBelt() {
        var beltH = Math.max(18, Math.floor(displayH * CONFIG.BELT_HEIGHT_RATIO));
        var beltY = groundY;
        var beltBottom = beltY + beltH;

        // 传送带主体 - 深灰底色
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(0, beltY, displayW, beltH);

        // 传送带顶部高光线
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(0, beltY, displayW, 2);

        // 传送带分段线（滚动的竖线）
        var segmentW = displayW / CONFIG.BELT_SEGMENT_COUNT;
        beltOffset = (beltOffset + gameSpeed * 0.7) % segmentW;

        ctx.strokeStyle = '#6c7a7a';
        ctx.lineWidth = 1.5;
        for (var i = -1; i <= CONFIG.BELT_SEGMENT_COUNT + 1; i++) {
            var sx = i * segmentW - beltOffset;
            ctx.beginPath();
            ctx.moveTo(sx, beltY);
            ctx.lineTo(sx, beltBottom);
            ctx.stroke();
        }

        // 绘制每个分段接缝处的小滚轮
        ctx.fillStyle = '#bdc3c7';
        for (var j = -1; j <= CONFIG.BELT_SEGMENT_COUNT + 1; j++) {
            var rx = j * segmentW - beltOffset;
            // 顶部滚轮
            ctx.beginPath();
            ctx.arc(rx, beltY + 1, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#95a5a6';
            ctx.lineWidth = 0.8;
            ctx.stroke();
            // 底部滚轮
            ctx.beginPath();
            ctx.arc(rx, beltBottom - 1, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // 传送带底部阴影
        ctx.fillStyle = '#555';
        ctx.fillRect(0, beltBottom, displayW, 2);
    }

    /** 绘制像素风格张雪峰角色 */
    function drawPlayer() {
        var px = player.x;
        var py = player.y;
        var pw = player.width;
        var ph = player.height;

        ctx.save();
        ctx.translate(px, py);

        // 缩放因子（基于玩家实际尺寸）
        var s = pw / 30; // 基准宽度30px
        ctx.scale(s, s);

        var baseW = 30;
        var baseH = ph / s;

        if (player.isDucking) {
            // ===== 下蹲姿态 =====
            drawPlayerDuck(baseW, baseH);
        } else if (player.isJumping) {
            // ===== 跳跃姿态 =====
            drawPlayerJump(baseW, baseH);
        } else {
            // ===== 跑步姿态 =====
            drawPlayerRun(baseW, baseH);
        }

        ctx.restore();

        // 蓄力时的视觉效果
        if (isCharging && !player.isJumping) {
            var chargeRatio = Math.min((Date.now() - chargeStart) / CONFIG.MAX_CHARGE_TIME, 1.0);
            ctx.save();
            ctx.globalAlpha = 0.35 + chargeRatio * 0.3;
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.arc(px + pw / 2, py - 6, 5 + chargeRatio * 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    /** 绘制跑步姿态 */
    function drawPlayerRun(w, h) {
        // -- 身体 --
        // 西装（深蓝色）
        ctx.fillStyle = '#2c3e50';
        roundRect(8, 18, 14, 22, 3);

        // -- 腿（交替动画）--
        var legPhase = Math.floor(runAnimFrame / 6) % 4;
        ctx.fillStyle = '#34495e';
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1;

        // 左腿
        ctx.fillRect(10, 38, 5, 12);
        // 右腿
        ctx.fillRect(17, 38, 5, 12);

        // 根据动画帧调整腿部
        if (legPhase === 0 || legPhase === 2) {
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(10, 38, 5, 12);
            ctx.fillRect(17, 38, 5, 12);
        }

        // -- 鞋子 --
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(9, 48, 7, 3);
        ctx.fillRect(16, 48, 7, 3);

        // -- 领带（红色，张雪峰标志性元素之一）--
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(15, 19);
        ctx.lineTo(18, 26);
        ctx.lineTo(15, 30);
        ctx.lineTo(12, 26);
        ctx.closePath();
        ctx.fill();

        // -- 头 --
        // 脸部（肤色）
        ctx.fillStyle = '#f5d5b8';
        roundRect(9, 1, 13, 16, 5);

        // 头发（黑色短发）
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(15.5, 5, 8.5, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(7, 2, 17, 6);

        // -- 眼镜（张雪峰标志性特征！）--
        // 左镜框
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(12.5, 10, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        // 右镜框
        ctx.beginPath();
        ctx.arc(18.5, 10, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        // 镜桥
        ctx.beginPath();
        ctx.moveTo(16, 10);
        ctx.lineTo(15, 10);
        ctx.stroke();
        // 镜片反光
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(11.5, 9, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(17.5, 9, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // -- 眼睛（小黑点） --
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(12.5, 10, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(18.5, 10, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // -- 嘴 --
        ctx.strokeStyle = '#c0956b';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(15.5, 14, 2.5, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();

        // -- 手臂（跑步摆动）--
        ctx.fillStyle = '#f5d5b8';
        ctx.strokeStyle = '#d4b896';
        ctx.lineWidth = 0.8;
        // 根据跑步帧摆动
        if (legPhase === 0) {
            drawArm(6, 20, -0.3);   // 前摆
            drawArm(24, 20, 0.3);    // 后摆
        } else if (legPhase === 1) {
            drawArm(6, 20, 0);
            drawArm(24, 20, 0);
        } else if (legPhase === 2) {
            drawArm(6, 20, 0.3);
            drawArm(24, 20, -0.3);
        } else {
            drawArm(6, 20, 0);
            drawArm(24, 20, 0);
        }
    }

    /** 绘制跳跃姿态 */
    function drawPlayerJump(w, h) {
        // 身体略倾斜
        ctx.fillStyle = '#2c3e50';
        roundRect(8, 18, 14, 20, 3);

        // 腿缩起
        ctx.fillStyle = '#34495e';
        ctx.fillRect(10, 36, 5, 8);
        ctx.fillRect(17, 36, 5, 8);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(9, 42, 7, 3);
        ctx.fillRect(16, 42, 7, 3);

        // 领带飘起
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(15, 19);
        ctx.lineTo(19, 27);
        ctx.lineTo(15, 24);
        ctx.lineTo(11, 27);
        ctx.closePath();
        ctx.fill();

        // 头
        ctx.fillStyle = '#f5d5b8';
        roundRect(9, -1, 13, 16, 5);
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(15.5, 3, 8.5, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(7, 0, 17, 6);

        // 眼镜
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(12.5, 8, 3.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(18.5, 8, 3.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(16, 8); ctx.lineTo(15, 8); ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(12.5, 8, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(18.5, 8, 1.2, 0, Math.PI * 2); ctx.fill();

        // 开心张嘴（跳跃时兴奋）
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.arc(15.5, 13, 3, 0, Math.PI);
        ctx.fill();

        // 手臂上举
        ctx.fillStyle = '#f5d5b8';
        drawArm(6, 16, -0.8);
        drawArm(24, 16, 0.8);
    }

    /** 绘制下蹲姿态 */
    function drawPlayerDuck(w, h) {
        // 压扁的身体
        ctx.fillStyle = '#2c3e50';
        roundRect(7, 10, 16, 14, 3);

        // 缩起的腿
        ctx.fillStyle = '#34495e';
        ctx.fillRect(8, 22, 6, 5);
        ctx.fillRect(16, 22, 6, 5);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(7, 25, 8, 2);
        ctx.fillRect(15, 25, 8, 2);

        // 领带
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(14, 11, 3, 8);

        // 头
        ctx.fillStyle = '#f5d5b8';
        roundRect(9, 0, 13, 13, 4);
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(15.5, 4, 7.5, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(8, 1, 15, 5);

        // 眼镜
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(13, 8, 3, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(18, 8, 3, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(16, 8); ctx.lineTo(15, 8); ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(13, 8, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(18, 8, 1, 0, Math.PI * 2); ctx.fill();

        // 紧张的表情
        ctx.strokeStyle = '#c0956b';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(14, 11);
        ctx.lineTo(17, 11);
        ctx.stroke();

        // 手臂前伸保持平衡
        ctx.fillStyle = '#f5d5b8';
        drawArm(4, 12, 0);
        drawArm(23, 12, 0);
    }

    /** 绘制手臂辅助函数 */
    function drawArm(x, y, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillRect(0, 0, 3, 10);
        // 手
        ctx.fillStyle = '#f5d5b8';
        ctx.fillRect(-1, 8, 4, 4);
        ctx.restore();
    }

    /** 绘制圆角矩形 */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
    }

    /** 绘制巧乐兹雪糕障碍物 */
    function drawObstacle(obs) {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        var w = obs.width;
        var h = obs.height;

        // 缩放因子
        var s = w / 26;
        ctx.scale(s, s);
        var bw = 26; // 基准宽度
        var bh = h / s;

        if (obs.type === 'tall') {
            // ===== 高巧乐兹（地面障碍，需跳跃） =====
            // 木棍
            ctx.fillStyle = '#d4a574';
            ctx.fillRect(10, bh - 12, 6, 12);
            ctx.strokeStyle = '#b8885a';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(10, bh - 12, 6, 12);

            // 雪糕主体 - 巧克力外皮
            ctx.fillStyle = '#5D3A1A';
            roundRect(2, 4, 22, bh - 18, 4);

            // 巧克力涂层顶部（略深）
            ctx.fillStyle = '#4A2D12';
            roundRect(2, 4, 22, 10, 4);

            // 白色雪糕内芯
            ctx.fillStyle = '#FFF8E7';
            roundRect(6, 12, 14, bh - 32, 2);

            // 雪糕上的纹理
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(8, 12, 2, bh - 32);
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.fillRect(16, 16, 2, bh - 38);

            // 顶部巧克力碎粒
            ctx.fillStyle = '#3D2210';
            ctx.beginPath();
            ctx.arc(8, 7, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.arc(14, 5, 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.arc(20, 6, 1.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.arc(11, 9, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.arc(17, 8, 1.5, 0, Math.PI * 2); ctx.fill();

            // "巧乐兹"文字标签
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 5px "Microsoft YaHei","PingFang SC",sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('巧乐兹', 13, bh - 16);

        } else {
            // ===== 低巧乐兹（空中障碍，需下蹲） =====
            // 这个巧乐兹悬浮在空中，有翅膀装饰
            ctx.fillStyle = '#5D3A1A';
            roundRect(2, 2, 22, bh - 4, 4);

            // 巧克力涂层
            ctx.fillStyle = '#4A2D12';
            roundRect(2, 2, 22, 8, 4);

            // 白色内芯
            ctx.fillStyle = '#FFF8E7';
            roundRect(6, 8, 14, bh - 16, 2);

            // 纹理
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(8, 8, 2, bh - 16);

            // 小翅膀（示意这是飞行障碍）
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(0, 6);
            ctx.lineTo(-6, 2);
            ctx.lineTo(-6, 10);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(26, 6);
            ctx.lineTo(32, 2);
            ctx.lineTo(32, 10);
            ctx.closePath();
            ctx.fill();

            // 标签
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 4px "Microsoft YaHei","PingFang SC",sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('巧乐兹', 13, bh - 4);
        }

        ctx.restore();
    }

    /** 绘制粒子 */
    function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    /** 绘制游戏结束叠加层 */
    function drawGameOverOverlay() {
        // 半透明红色遮罩
        ctx.fillStyle = 'rgba(231, 76, 60, 0.35)';
        ctx.fillRect(0, 0, displayW, displayH);

        // 游戏结束文字
        ctx.fillStyle = '#fff';
        ctx.font = 'bold ' + Math.floor(displayH * 0.08) + 'px "Microsoft YaHei","PingFang SC",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8;

        var cx = displayW / 2;
        var cy = displayH * 0.35;
        ctx.fillText('游戏结束', cx, cy);

        // 得分
        ctx.font = 'bold ' + Math.floor(displayH * 0.045) + 'px "Microsoft YaHei","PingFang SC",sans-serif';
        ctx.fillText('得分: ' + score, cx, cy + displayH * 0.08);

        if (score >= highScore && score > 0) {
            ctx.fillStyle = '#f39c12';
            ctx.fillText('🎉 新纪录！', cx, cy + displayH * 0.15);
        }

        // 自动重启提示
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = Math.floor(displayH * 0.028) + 'px "Microsoft YaHei","PingFang SC",sans-serif';
        ctx.fillText('即将自动重启...', cx, cy + displayH * 0.23);

        ctx.shadowBlur = 0;
        ctx.textBaseline = 'alphabetic';
    }

    // ==================== 游戏主循环 ====================
    function update() {
        if (isGameOver) {
            // 死亡倒计时
            deathTimer -= 16.67; // 约60fps
            updateParticles();
            if (deathTimer <= 0) {
                resetGame();
            }
            return;
        }

        frameCount++;
        runAnimFrame++;

        // ---- 更新游戏速度（渐进加速） ----
        gameSpeed = Math.min(CONFIG.BASE_SPEED + frameCount * CONFIG.SPEED_INC, CONFIG.MAX_SPEED);

        // ---- 更新玩家 ----
        if (player.isJumping) {
            player.vy += CONFIG.GRAVITY;
            player.y += player.vy;

            // 落地检测
            if (player.y >= groundY - player.height) {
                player.y = groundY - player.height;
                player.vy = 0;
                player.isJumping = false;
            }
        }

        // 确保下蹲时脚贴地
        if (!player.isJumping && player.isDucking) {
            player.y = groundY - player.duckH;
        }

        // ---- 更新障碍物 ----
        obstacleTimer++;
        if (obstacleTimer >= nextObstacleAt) {
            spawnObstacle();
            obstacleTimer = 0;
            // 速度越快，障碍物间隔越短
            var minGap = Math.max(40, CONFIG.OBSTACLE_MIN_GAP - gameSpeed * 4);
            var maxGap = Math.max(80, CONFIG.OBSTACLE_MAX_GAP - gameSpeed * 5);
            nextObstacleAt = randomRange(minGap, maxGap);
        }

        // 移动障碍物（从右向左）
        for (var i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].x -= gameSpeed;
            // 移除已移出屏幕左侧的障碍物
            if (obstacles[i].x + obstacles[i].width < -20) {
                obstacles.splice(i, 1);
            }
        }

        // ---- 碰撞检测 ----
        if (checkCollision()) {
            endGame();
        }

        // ---- 更新计分 ----
        // 每6帧增加1分
        if (frameCount % 6 === 0) {
            score++;
            updateScoreDisplay();
        }

        // ---- 更新粒子 ----
        updateParticles();

        // ---- 音频：随机台词 ----
        voiceTimer += 16.67;
        if (voiceTimer >= nextVoiceAt) {
            playVoice();
            voiceTimer = 0;
            nextVoiceAt = randomRange(CONFIG.VOICE_MIN_INTERVAL, CONFIG.VOICE_MAX_INTERVAL);
        }
    }

    function render() {
        // 清空画布
        ctx.clearRect(0, 0, displayW, displayH);

        // 绘制背景
        drawBackground();

        // 绘制传送带地面
        drawConveyorBelt();

        // 绘制障碍物
        for (var i = 0; i < obstacles.length; i++) {
            drawObstacle(obstacles[i]);
        }

        // 绘制玩家
        drawPlayer();

        // 绘制粒子
        drawParticles();

        // 游戏结束叠加层
        if (isGameOver) {
            drawGameOverOverlay();
        }
    }

    function gameLoop() {
        update();
        render();
        requestAnimationFrame(gameLoop);
    }

    // ==================== 初始化 ====================
    function init() {
        // 加载最高分
        highScore = loadHighScore();

        // 初始化画布尺寸
        resizeCanvas();

        // 初始化玩家位置
        player.x = Math.floor(displayW * CONFIG.PLAYER_X_RATIO);
        player.normalH = Math.max(44, Math.floor(displayH * CONFIG.PLAYER_HEIGHT_RATIO));
        player.duckH = Math.floor(player.normalH * 0.48);
        player.height = player.normalH;
        player.y = groundY - player.height;

        // 初始化游戏参数
        gameSpeed = CONFIG.BASE_SPEED;
        nextObstacleAt = randomRange(CONFIG.OBSTACLE_MIN_GAP, CONFIG.OBSTACLE_MAX_GAP);
        nextVoiceAt = randomRange(CONFIG.VOICE_MIN_INTERVAL, CONFIG.VOICE_MAX_INTERVAL);

        // 更新UI
        updateScoreDisplay();

        // 绑定事件
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', function () {
            // 移动端旋转后延迟重新计算尺寸
            setTimeout(resizeCanvas, 300);
        });

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

        // 桌面端也支持鼠标操作（方便调试）
        canvas.addEventListener('mousedown', function (e) {
            e.preventDefault();
            touchStartY = e.clientY;
            touchStartTime = Date.now();
            touchMoved = false;
            if (!player.isJumping) {
                isCharging = true;
                chargeStart = Date.now();
            }
            if (!hasUserInteracted) {
                hasUserInteracted = true;
                tryPlayBgMusic();
            }
        });
        canvas.addEventListener('mousemove', function (e) {
            if (!isCharging) return;
            // 鼠标向下拖动超过30px判定为下蹲
            if (e.clientY - touchStartY > 30 && !touchMoved) {
                touchMoved = true;
                isCharging = false;
                startDuck();
            }
        });
        canvas.addEventListener('mouseup', function (e) {
            e.preventDefault();
            if (touchMoved) {
                stopDuck();
            } else if (isCharging && !player.isJumping) {
                var ct = Date.now() - chargeStart;
                doJump(ct);
            }
            isCharging = false;
            touchMoved = false;
        });
        canvas.addEventListener('mouseleave', function () {
            if (isCharging && !player.isJumping) {
                var ct = Date.now() - chargeStart;
                doJump(ct);
            }
            isCharging = false;
            stopDuck();
            touchMoved = false;
        });

        // 启动游戏循环
        requestAnimationFrame(gameLoop);
    }

    // 等待DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
