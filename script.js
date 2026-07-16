document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // I18N Logic
    // ----------------------------------------------------
    const i18n = {
        cn: {
            title: "回声迷宫 - 深渊探索",
            header_title: "🎮 回声迷宫",
            section_title: "暗视野潜入",
            floor_label: "层数:",
            status_label: "状态:",
            status_safe: "安全",
            status_stun: "眩晕!",
            status_overheat: "体力透支!",
            enemies_label: "怪物残存:",
            stamina_label: "STAMINA",
            skill_q: "穿透强音",
            skill_e: "爆破声雷",
            controls_hint: "<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动 | <kbd>鼠标左键</kbd> 探索波 | <kbd>鼠标右键</kbd> 攻击波<br><kbd>Q</kbd> 释放穿透强音 | <kbd>E</kbd> 放置爆破声雷",
            btn_enter: "进入暗影",
            btn_abandon: "放弃潜入",
            btn_retry: "重新潜入",
            desc_title: "游戏简介",
            desc_text: "身处伸手不见五指的深层印象空间，只能通过声波来感知周围的环境。<br><strong>注意：</strong>体力非常有限！声波消耗体力，过度发射会导致体力透支而陷入长时间的眩晕。通过升级获取技能卡片，寻找发光的出口进入下一层！<br><strong>变异暗影：</strong>深层区域潜伏着会冲刺的暗影以及能免疫探索波的幽灵暗影，请小心行事。",
            win_text: "MISSION ACCOMPLISHED",
            lose_text: "YOU ARE DEAD",
            upgrade_title: "进入深层区域 - 选择一项强化"
        },
        jp: {
            title: "ソナーメイズ - 深淵探索",
            header_title: "🎮 ソナーメイズ",
            section_title: "暗視潜入",
            floor_label: "階層:",
            status_label: "状態:",
            status_safe: "安全",
            status_stun: "スタン!",
            status_overheat: "スタミナ切れ!",
            enemies_label: "残存シャドウ:",
            stamina_label: "スタミナ",
            skill_q: "貫通強音",
            skill_e: "爆音雷",
            controls_hint: "<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移動 | <kbd>左クリック</kbd> 探索音波 | <kbd>右クリック</kbd> 攻撃音波<br><kbd>Q</kbd> 貫通強音を放つ | <kbd>E</kbd> 爆音雷を設置",
            btn_enter: "シャドウへ潜入",
            btn_abandon: "潜入放棄",
            btn_retry: "再潜入",
            desc_title: "ゲーム概要",
            desc_text: "一寸先も闇のメメントス深部。周囲の環境を知る術は音波のみ。<br><strong>注意：</strong>スタミナは限られている！音波はスタミナを消費し、過度な発射は過負荷によるスタンを招く。カードでスキルを獲得し、出口を探せ！<br><strong>変異シャドウ：</strong>深層にはダッシュするシャドウや探索波を無効化するゴーストが潜んでいる。",
            win_text: "MISSION ACCOMPLISHED",
            lose_text: "YOU ARE DEAD",
            upgrade_title: "深層へ進む - 強化を一つ選択"
        }
    };

    let currentLang = 'cn';
    const langToggleBtn = document.getElementById('lang-toggle');
    const ammoQEl = document.getElementById('ammo-q');
    const ammoEEl = document.getElementById('ammo-e');

    function updateLanguage() {
        const dict = i18n[currentLang];
        document.title = dict.title;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.innerHTML = dict[key];
        });
        
        if (isPlaying && !isChoosingUpgrade) startBtn.textContent = dict.btn_abandon;
        else if (overlay.classList.contains('win') || overlay.classList.contains('lose')) startBtn.textContent = dict.btn_retry;
        else startBtn.textContent = dict.btn_enter;

        updateStatusText();

        if (!overlay.classList.contains('hidden')) {
            overlayTitle.textContent = overlay.classList.contains('win') ? dict.win_text : dict.lose_text;
        }
        langToggleBtn.innerHTML = currentLang === 'cn' ? '🔄 日本語 / 中文' : '🔄 中文 / 日本語';
    }

    langToggleBtn.addEventListener('click', () => {
        currentLang = currentLang === 'cn' ? 'jp' : 'cn';
        updateLanguage();
        if (isChoosingUpgrade) renderUpgradeCards();
    });

    // ----------------------------------------------------
    // Game Logic & System
    // ----------------------------------------------------
    const canvas = document.getElementById('sonar-canvas');
    const ctx = canvas.getContext('2d');
    const startBtn = document.getElementById('sonar-start');
    const statusEl = document.getElementById('sonar-status');
    const enemiesEl = document.getElementById('sonar-enemies');
    const floorEl = document.getElementById('sonar-floor');
    const staminaFill = document.getElementById('stamina-bar-fill');
    
    const overlay = document.getElementById('game-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const upgradeOverlay = document.getElementById('upgrade-overlay');
    const cardsContainer = document.getElementById('cards-container');
    
    // Map Config
    const CELL_SIZE = 60;
    const COLS = 20; // 1200px
    const ROWS = 14; // 840px
    const MAP_WIDTH = COLS * CELL_SIZE;
    const MAP_HEIGHT = ROWS * CELL_SIZE;

    const memoryCanvas = document.createElement('canvas');
    memoryCanvas.width = MAP_WIDTH;
    memoryCanvas.height = MAP_HEIGHT;
    const mCtx = memoryCanvas.getContext('2d');
    
    let camera = { x: 0, y: 0 };
    let grid = [];
    let isPlaying = false;
    let isChoosingUpgrade = false;
    let gameLoop;
    let currentFloor = 1;
    
    // Player
    let player = {
        x: 90, y: 90, radius: 8, 
        speed: 3.5, stunned: 0,
        maxStamina: 35, stamina: 35, regenRate: 0.6, isOverheated: false, overheatTimer: 0,
        exploreCost: 5, attackCost: 20, attackRays: 5, exploreRays: 36, bounceLimit: 5, stunResistance: 1.0,
        skills: { Q: 0, E: 0 } // Ammo
    };
    
    let keys = {};
    let mouse = { x: 0, y: 0 };
    let particles = [];
    let enemies = [];
    let bombs = [];
    let exitObj = null;

    // Upgrades Pool
    const upgradePool = [
        { id: 'max_hp', title: '体力突破', title_jp: '体力突破', desc: '最大体力 +20', desc_jp: '最大スタミナ +20', apply: () => { player.maxStamina += 20; player.stamina = player.maxStamina; } },
        { id: 'regen', title: '肾上腺素', title_jp: 'アドレナリン', desc: '体力恢复速度加快', desc_jp: 'スタミナ回復速度アップ', apply: () => { player.regenRate += 0.3; } },
        { id: 'skill_q', title: '穿透强音 (x2)', title_jp: '貫通強音 (x2)', desc: '获得 2 次 Q 键技能', desc_jp: 'Qスキルを2回獲得', apply: () => { player.skills.Q += 2; updateAmmoUI(); } },
        { id: 'skill_e', title: '爆破声雷 (x2)', title_jp: '爆音雷 (x2)', desc: '获得 2 次 E 键炸弹', desc_jp: 'Eスキルの爆弾を2個獲得', apply: () => { player.skills.E += 2; updateAmmoUI(); } },
        { id: 'atk_rays', title: '散射增幅', title_jp: '拡散増幅', desc: '攻击波发射数量增加', desc_jp: '攻撃音波の数が増加', apply: () => { player.attackRays += 2; } },
        { id: 'bounce', title: '折射强音', title_jp: '反射強音', desc: '攻击波弹射次数 +2', desc_jp: '攻撃音波の反射回数 +2', apply: () => { player.bounceLimit += 2; } },
        { id: 'speed', title: '疾风步', title_jp: '疾風の歩み', desc: '移动速度提升', desc_jp: '移動速度アップ', apply: () => { player.speed += 0.4; } }
    ];

    document.addEventListener('keydown', e => { 
        keys[e.code] = true; 
        
        // Active Skills Input
        if (!isPlaying || isChoosingUpgrade || player.stunned > 0) return;
        
        if (e.code === 'KeyQ' && player.skills.Q > 0) {
            player.skills.Q--;
            updateAmmoUI();
            fireHyperWave();
        }
        
        if (e.code === 'KeyE' && player.skills.E > 0) {
            player.skills.E--;
            updateAmmoUI();
            placeBomb();
        }
    });
    document.addEventListener('keyup', e => { keys[e.code] = false; });
    
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    
    canvas.addEventListener('mousedown', e => {
        if (!isPlaying || isChoosingUpgrade || player.stunned > 0 || player.isOverheated) return;
        
        // Convert screen mouse to world coordinates
        let worldMouseX = mouse.x + camera.x;
        let worldMouseY = mouse.y + camera.y;
        
        let dx = worldMouseX - player.x;
        let dy = worldMouseY - player.y;
        let dist = Math.hypot(dx, dy);
        if (dist === 0) return;
        let dirX = dx / dist;
        let dirY = dy / dist;
        
        if (e.button === 2) { // Attack
            if (player.stamina < player.attackCost) { triggerOverheat(); return; }
            player.stamina -= player.attackCost;
            let half = Math.floor(player.attackRays / 2);
            for (let i = -half; i <= half; i++) {
                let angle = Math.atan2(dirY, dirX) + i * 0.08;
                spawnParticle(player.x, player.y, Math.cos(angle)*8, Math.sin(angle)*8, player.bounceLimit, 'attack', `hsl(${330 + Math.random()*30}, 100%, 50%)`);
            }
        } else if (e.button === 0) { // Explore
            if (player.stamina < player.exploreCost) { triggerOverheat(); return; }
            player.stamina -= player.exploreCost;
            for (let i = 0; i < player.exploreRays; i++) {
                let angle = (i / player.exploreRays) * Math.PI * 2;
                spawnParticle(player.x, player.y, Math.cos(angle)*5, Math.sin(angle)*5, 1, 'explore', `hsla(${180 + Math.random()*40}, 100%, 60%, 0.4)`);
            }
        }
    });

    function spawnParticle(x, y, vx, vy, maxBounces, type, color, life=80) {
        particles.push({ x, y, vx, vy, bounces: 0, maxBounces, life, type, active: true, color });
    }

    function fireHyperWave() {
        // Hyper wave shoots in 36 directions, ignores walls
        for (let i = 0; i < 36; i++) {
            let angle = (i / 36) * Math.PI * 2;
            spawnParticle(player.x, player.y, Math.cos(angle)*10, Math.sin(angle)*10, 0, 'hyper', '#FBEF00', 100);
        }
    }

    function placeBomb() {
        bombs.push({ x: player.x, y: player.y, timer: 60, radius: 100 });
    }

    function triggerOverheat() {
        player.stamina = 0; player.isOverheated = true;
        player.overheatTimer = 120; player.stunned = 30;
        updateStatusText();
    }

    function updateStatusText() {
        const dict = i18n[currentLang];
        if (player.isOverheated) { statusEl.textContent = dict.status_overheat; statusEl.style.color = 'var(--p5-red)'; }
        else if (player.stunned > 0) { statusEl.textContent = dict.status_stun; statusEl.style.color = 'var(--p5-yellow)'; }
        else { statusEl.textContent = dict.status_safe; statusEl.style.color = 'var(--p5-white)'; }
    }

    function updateAmmoUI() {
        ammoQEl.textContent = player.skills.Q;
        ammoEEl.textContent = player.skills.E;
    }

    function spawnExit() {
        let r, c;
        do {
            r = Math.floor(Math.random()*(ROWS-4))+2;
            c = Math.floor(Math.random()*(COLS-4))+2;
        } while (grid[r][c] === 1 || Math.hypot(c*CELL_SIZE - player.x, r*CELL_SIZE - player.y) < 200);
        exitObj = { x: c*CELL_SIZE + CELL_SIZE/2, y: r*CELL_SIZE + CELL_SIZE/2, radius: 15, pulse: 0 };
    }

    // Maze Generator (Recursive Backtracker for better maze feel)
    function generateMaze() {
        grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(1)); // Fill with walls
        let stack = [];
        let startR = 1, startC = 1;
        grid[startR][startC] = 0;
        stack.push({r: startR, c: startC});

        // Maze generation
        while (stack.length > 0) {
            let current = stack.pop();
            // Directions: step of 2 to ensure walls between paths
            let dirs = [[-2,0], [2,0], [0,-2], [0,2]];
            dirs.sort(() => Math.random() - 0.5); // Shuffle

            for (let d of dirs) {
                let nr = current.r + d[0];
                let nc = current.c + d[1];
                if (nr > 0 && nr < ROWS-1 && nc > 0 && nc < COLS-1 && grid[nr][nc] === 1) {
                    grid[nr][nc] = 0;
                    grid[current.r + d[0]/2][current.c + d[1]/2] = 0; // Carve wall between
                    stack.push(current); // Backtrack
                    stack.push({r: nr, c: nc});
                    break; // Only one neighbor per iteration
                }
            }
        }
        
        // Use structured wall removal to create loops without destroying the maze feel
        let loopChance = Math.max(0.1, 0.3 - currentFloor * 0.03); // Increased to make it more open
        for (let r=2; r<ROWS-2; r++) {
            for (let c=2; c<COLS-2; c++) {
                if (grid[r][c] === 1) {
                    // Only remove walls that separate two paths (creates a clean loop)
                    let horizontal = (grid[r][c-1] === 0 && grid[r][c+1] === 0 && grid[r-1][c] === 1 && grid[r+1][c] === 1);
                    let vertical = (grid[r-1][c] === 0 && grid[r+1][c] === 0 && grid[r][c-1] === 1 && grid[r][c+1] === 1);
                    
                    if ((horizontal || vertical) && Math.random() < loopChance) {
                        grid[r][c] = 0;
                    }
                }
            }
        }
        // Ensure starting area is clear
        for (let r=1; r<=3; r++) {
            for (let c=1; c<=3; c++) {
                grid[r][c] = 0;
            }
        }
    }

    function initGame(isNewRun = false) {
        if (isNewRun) {
            currentFloor = 1;
            player = {
                x: 90, y: 90, radius: 8, speed: 3.5, stunned: 0,
                maxStamina: 35, stamina: 35, regenRate: 0.6, isOverheated: false, overheatTimer: 0,
                exploreCost: 5, attackCost: 20, attackRays: 5, exploreRays: 36, bounceLimit: 5, stunResistance: 1.0,
                skills: { Q: 0, E: 0 }
            };
        }
        player.stamina = player.maxStamina; player.isOverheated = false; player.stunned = 0;
        player.x = 90; player.y = 90;
        floorEl.textContent = currentFloor;
        updateAmmoUI();
        
        generateMaze();
        
        particles = [];
        bombs = [];
        exitObj = null;
        
        // Spawn Enemies
        enemies = [];
        let enCount = Math.min(5 + currentFloor * 2, 30);
        
        for (let i=0; i<enCount; i++) {
            let er, ec;
            do {
                er = Math.floor(Math.random()*ROWS);
                ec = Math.floor(Math.random()*COLS);
            } while (grid[er][ec] === 1 || (er<5 && ec<5));
            
            // Difficulty scaling
            let baseSpeed = currentFloor < 4 ? 0.8 : (1.5 + Math.random() * 1.0 + (currentFloor * 0.05));
            let angle = Math.random() * Math.PI * 2;
            
            // Mutation Types
            let type = 'normal';
            let color = 'white';
            if (currentFloor >= 3 && Math.random() < 0.2) { type = 'dash'; color = 'yellow'; }
            if (currentFloor >= 5 && Math.random() < 0.2) { type = 'ghost'; color = '#aa00ff'; }
            
            enemies.push({
                x: ec * CELL_SIZE + CELL_SIZE/2, y: er * CELL_SIZE + CELL_SIZE/2,
                vx: Math.cos(angle) * baseSpeed, vy: Math.sin(angle) * baseSpeed,
                baseSpeed: baseSpeed, radius: 10, active: true, type: type, color: color,
                stateTimer: 0, state: 'patrol' // for dash
            });
        }
        
        mCtx.fillStyle = 'black'; mCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
        
        updateStatusText();
        enemiesEl.textContent = enemies.length;
        
        overlay.className = 'game-overlay hidden';
        upgradeOverlay.className = 'game-overlay hidden upgrade-overlay';
        isChoosingUpgrade = false; isPlaying = true;
        updateLanguage();
        
        if (gameLoop) cancelAnimationFrame(gameLoop);
        loop();
    }

    function createExplosion(x, y) {
        for(let i=0; i<15; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 3 + 1;
            spawnParticle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, 0, 'explosion', `hsl(${Math.random()*360}, 100%, 60%)`, 30 + Math.random()*20);
        }
    }

    function loop() {
        if (!isPlaying || isChoosingUpgrade) return;
        update(); draw();
        gameLoop = requestAnimationFrame(loop);
    }
    
    function update() {
        // Camera Follow
        if (MAP_WIDTH < canvas.width) {
            camera.x = (MAP_WIDTH - canvas.width) / 2;
        } else {
            camera.x = Math.max(0, Math.min(player.x - canvas.width / 2, MAP_WIDTH - canvas.width));
        }
        
        if (MAP_HEIGHT < canvas.height) {
            camera.y = (MAP_HEIGHT - canvas.height) / 2;
        } else {
            camera.y = Math.max(0, Math.min(player.y - canvas.height / 2, MAP_HEIGHT - canvas.height));
        }

        // Stamina Logic
        if (player.isOverheated) {
            player.overheatTimer--;
            if (player.overheatTimer <= 0) {
                player.isOverheated = false; player.stamina = player.maxStamina; updateStatusText();
            }
        } else {
            if (player.stamina < player.maxStamina) player.stamina = Math.min(player.maxStamina, player.stamina + player.regenRate);
        }

        let stPct = (player.stamina / player.maxStamina) * 100;
        staminaFill.style.width = stPct + '%';
        if (player.isOverheated) staminaFill.classList.add('overheat'); else staminaFill.classList.remove('overheat');

        // Player Movement
        if (player.stunned > 0) {
            player.stunned--;
            if (player.stunned === 0 && !player.isOverheated) updateStatusText();
        } else {
            let dx = 0, dy = 0;
            if (keys['KeyW'] || keys['ArrowUp']) dy -= player.speed;
            if (keys['KeyS'] || keys['ArrowDown']) dy += player.speed;
            if (keys['KeyA'] || keys['ArrowLeft']) dx -= player.speed;
            if (keys['KeyD'] || keys['ArrowRight']) dx += player.speed;
            if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
            
            player.x += dx; if (checkWallCollision(player.x, player.y, player.radius)) player.x -= dx;
            player.y += dy; if (checkWallCollision(player.x, player.y, player.radius)) player.y -= dy;
        }
        
        // Bombs
        for (let i = bombs.length - 1; i >= 0; i--) {
            let b = bombs[i];
            b.timer--;
            if (b.timer <= 0) {
                // Explode
                createExplosion(b.x, b.y);
                // Destroy walls
                let minC = Math.max(1, Math.floor((b.x - b.radius) / CELL_SIZE));
                let maxC = Math.min(COLS-2, Math.floor((b.x + b.radius) / CELL_SIZE));
                let minR = Math.max(1, Math.floor((b.y - b.radius) / CELL_SIZE));
                let maxR = Math.min(ROWS-2, Math.floor((b.y + b.radius) / CELL_SIZE));
                for(let r=minR; r<=maxR; r++) {
                    for(let c=minC; c<=maxC; c++) {
                        if (Math.hypot(c*CELL_SIZE+CELL_SIZE/2 - b.x, r*CELL_SIZE+CELL_SIZE/2 - b.y) <= b.radius) {
                            if (grid[r][c] === 1) {
                                grid[r][c] = 0; // Break wall
                                // Draw broken wall to memory canvas
                                mCtx.fillStyle = 'black';
                                mCtx.fillRect(c*CELL_SIZE, r*CELL_SIZE, CELL_SIZE, CELL_SIZE);
                                createExplosion(c*CELL_SIZE, r*CELL_SIZE);
                            }
                        }
                    }
                }
                // Kill enemies
                enemies.forEach(en => {
                    if (en.active && Math.hypot(en.x - b.x, en.y - b.y) <= b.radius) {
                        en.active = false;
                        createExplosion(en.x, en.y);
                    }
                });
                updateEnemiesCount();
                bombs.splice(i, 1);
            }
        }

        // Enemies
        enemies.forEach(en => {
            if (!en.active) return;
            
            // Dash logic
            if (en.type === 'dash') {
                if (en.state === 'patrol') {
                    en.x += en.vx; if (checkWallCollision(en.x, en.y, en.radius)) { en.x -= en.vx; en.vx *= -1; }
                    en.y += en.vy; if (checkWallCollision(en.x, en.y, en.radius)) { en.y -= en.vy; en.vy *= -1; }
                } else if (en.state === 'prepare') {
                    en.stateTimer--;
                    if (en.stateTimer <= 0) en.state = 'dash';
                } else if (en.state === 'dash') {
                    en.x += en.vx * 3; if (checkWallCollision(en.x, en.y, en.radius)) { en.x -= en.vx * 3; en.state = 'patrol'; }
                    en.y += en.vy * 3; if (checkWallCollision(en.x, en.y, en.radius)) { en.y -= en.vy * 3; en.state = 'patrol'; }
                    en.stateTimer--;
                    if (en.stateTimer <= 0) en.state = 'patrol';
                }
            } else {
                en.x += en.vx; if (checkWallCollision(en.x, en.y, en.radius)) { en.x -= en.vx; en.vx *= -1; }
                en.y += en.vy; if (checkWallCollision(en.x, en.y, en.radius)) { en.y -= en.vy; en.vy *= -1; }
            }

            if (Math.hypot(en.x - player.x, en.y - player.y) < en.radius + player.radius) endGame(false);
        });

        // Exit
        if (exitObj) {
            exitObj.pulse += 0.1;
            if (Math.hypot(exitObj.x - player.x, exitObj.y - player.y) < exitObj.radius + player.radius) showUpgrades();
        }
        
        // Particles
        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];
            if (!p.active) continue;
            p.life--;
            if (p.life <= 0) { p.active = false; continue; }
            
            let steps = p.type === 'attack' ? 2 : 1;
            let stepVx = p.vx / steps;
            let stepVy = p.vy / steps;
            
            for (let s = 0; s < steps; s++) {
                p.x += stepVx; p.y += stepVy;
                
                mCtx.fillStyle = p.color;
                mCtx.globalAlpha = p.type === 'explosion' ? 0.8 : 0.5;
                mCtx.beginPath();
                mCtx.arc(p.x, p.y, p.type === 'explosion' ? 2.5 : 1.5, 0, Math.PI*2);
                mCtx.fill();
                mCtx.globalAlpha = 1.0;
                
                if (p.type === 'explosion') continue; 
                
                let c = Math.floor(p.x / CELL_SIZE);
                let r = Math.floor(p.y / CELL_SIZE);

                // Hyper wave ignores walls
                if (p.type !== 'hyper') {
                    if (c >= 0 && c < COLS && r >= 0 && r < ROWS && grid[r][c] === 1) {
                        p.bounces++;
                        mCtx.fillStyle = p.color; mCtx.globalAlpha = 0.6;
                        mCtx.fillRect(c*CELL_SIZE, r*CELL_SIZE, CELL_SIZE, CELL_SIZE);
                        mCtx.globalAlpha = 1.0;
                        
                        if (p.bounces > p.maxBounces) { p.active = false; break; }
                        
                        let prevC = Math.floor((p.x - stepVx) / CELL_SIZE);
                        let prevR = Math.floor((p.y - stepVy) / CELL_SIZE);
                        if (prevC !== c) p.vx *= -1;
                        if (prevR !== r) p.vy *= -1;
                        if (prevC === c && prevR === r) { p.vx *= -1; p.vy *= -1; }
                        stepVx = p.vx / steps; stepVy = p.vy / steps;
                    }
                }

                // Hit Enemies
                if (p.type === 'attack' || p.type === 'hyper') {
                    enemies.forEach(en => {
                        if (en.active && Math.hypot(p.x - en.x, p.y - en.y) < en.radius) {
                            en.active = false; p.active = false;
                            createExplosion(en.x, en.y);
                            updateEnemiesCount();
                        }
                    });
                }
                
                // Explore illumination
                if (p.type === 'explore' || p.type === 'hyper') {
                    enemies.forEach(en => {
                        // Ghost ignores explore wave
                        if (en.type === 'ghost' && p.type === 'explore') return;
                        
                        if (en.active && Math.hypot(p.x - en.x, p.y - en.y) < en.radius) {
                            mCtx.fillStyle = en.color; // Show enemy color when illuminated
                            mCtx.beginPath(); mCtx.arc(en.x, en.y, en.radius + 2, 0, Math.PI*2); mCtx.fill();
                            
                            // Trigger dash
                            if (en.type === 'dash' && en.state === 'patrol') {
                                en.state = 'prepare'; en.stateTimer = 30;
                                let ex = player.x - en.x; let ey = player.y - en.y; let dist = Math.hypot(ex, ey);
                                en.vx = (ex/dist) * en.baseSpeed; en.vy = (ey/dist) * en.baseSpeed;
                            }
                        }
                    });
                    if (exitObj && Math.hypot(p.x - exitObj.x, p.y - exitObj.y) < exitObj.radius + 10) {
                        mCtx.fillStyle = '#FBEF00';
                        mCtx.beginPath(); mCtx.arc(exitObj.x, exitObj.y, exitObj.radius + 2, 0, Math.PI*2); mCtx.fill();
                    }
                }
                
                // Self Stun (attack only)
                if (p.type === 'attack' && p.bounces > 0 && p.active) {
                    if (Math.hypot(p.x - player.x, p.y - player.y) < player.radius + 3) {
                        player.stunned = 120 * player.stunResistance;
                        updateStatusText(); p.active = false;
                        mCtx.fillStyle = 'var(--p5-red)';
                        mCtx.beginPath(); mCtx.arc(player.x, player.y, 20, 0, Math.PI*2); mCtx.fill();
                    }
                }
            }
        }
        particles = particles.filter(p => p.active);
    }
    
    function draw() {
        // Clear screen with black
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Fade memory canvas slightly
        mCtx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        mCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
        
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        
        // Draw memory
        ctx.drawImage(memoryCanvas, 0, 0);

        // Draw Bombs
        bombs.forEach(b => {
            ctx.fillStyle = b.timer % 10 < 5 ? 'var(--p5-red)' : 'var(--p5-yellow)';
            ctx.beginPath(); ctx.arc(b.x, b.y, 5 + Math.sin(b.timer*0.5)*2, 0, Math.PI*2); ctx.fill();
        });
        
        // Draw Exit
        if (exitObj) {
            ctx.fillStyle = `rgba(251, 239, 0, ${0.5 + Math.sin(exitObj.pulse)*0.3})`;
            ctx.beginPath(); ctx.arc(exitObj.x, exitObj.y, exitObj.radius, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#FBEF00'; ctx.lineWidth = 2; ctx.stroke();
        }

        // Draw player
        ctx.fillStyle = player.isOverheated || player.stunned > 0 ? 'var(--p5-red)' : 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2); ctx.fill();
        
        ctx.restore();
    }
    
    function checkWallCollision(cx, cy, r) {
        let minC = Math.floor((cx - r) / CELL_SIZE);
        let maxC = Math.floor((cx + r) / CELL_SIZE);
        let minR = Math.floor((cy - r) / CELL_SIZE);
        let maxR = Math.floor((cy + r) / CELL_SIZE);
        if (minC < 0 || maxC >= COLS || minR < 0 || maxR >= ROWS) return true;
        for (let row = minR; row <= maxR; row++) {
            for (let col = minC; col <= maxC; col++) {
                if (grid[row][col] === 1) return true;
            }
        }
        return false;
    }
    
    function updateEnemiesCount() {
        let alive = enemies.filter(e => e.active).length;
        enemiesEl.textContent = alive;
        if (alive === 0 && !exitObj) spawnExit();
    }

    function showUpgrades() {
        isChoosingUpgrade = true;
        let shuffled = [...upgradePool].sort(() => 0.5 - Math.random());
        renderUpgradeCards(shuffled.slice(0, 3));
        upgradeOverlay.className = 'game-overlay upgrade-overlay';
    }

    let currentUpgradeChoices = [];
    function renderUpgradeCards(choices = null) {
        if (choices) currentUpgradeChoices = choices;
        cardsContainer.innerHTML = '';
        currentUpgradeChoices.forEach(cardData => {
            const cardEl = document.createElement('div');
            cardEl.className = 'upgrade-card';
            const titleStr = currentLang === 'cn' ? cardData.title : cardData.title_jp;
            const descStr = currentLang === 'cn' ? cardData.desc : cardData.desc_jp;
            cardEl.innerHTML = `<div class="card-title">${titleStr}</div><div class="card-desc">${descStr}</div>`;
            cardEl.addEventListener('click', () => {
                cardData.apply(); currentFloor++; initGame(false);
            });
            cardsContainer.appendChild(cardEl);
        });
    }
    
    function endGame(win) {
        isPlaying = false;
        const dict = i18n[currentLang];
        startBtn.textContent = dict.btn_retry;
        overlay.className = 'game-overlay';
        overlay.classList.add(win ? 'win' : 'lose');
        void overlay.offsetWidth; 
        overlayTitle.textContent = win ? dict.win_text : dict.lose_text;
    }

    startBtn.addEventListener('click', () => {
        if (!isPlaying) initGame(true);
        else { isPlaying = false; updateLanguage(); overlay.className = 'game-overlay hidden'; }
    });
    
    updateLanguage();
});
