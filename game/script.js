/*
 * Simple arcade‑style game where you control a cute vapor character
 * trying to catch glowing metal bars that fall from a friendly forge.
 * The game runs for 60 seconds, and each missed bar costs a life.
 * Catch as many bars as you can to set a high score!
 */

// Obtain references to DOM elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const livesEl = document.getElementById('lives');
const playerNameEl = document.getElementById('player-name');
const gameOverHeadingEl = document.getElementById('game-over-heading');
const highScoresListEl = document.getElementById('high-scores-list');
const levelEl = document.getElementById('level');
const helpBtn = document.getElementById('help-btn');
const helpScreen = document.getElementById('help-screen');
const closeHelpBtn = document.getElementById('close-help-btn');

// Load high scores from localStorage
let highScores = [];
try {
  const stored = localStorage.getItem('forgeVaporHighScores');
  if (stored) highScores = JSON.parse(stored);
} catch (err) {
  highScores = [];
}

/**
 * Save the current high scores to localStorage for persistence across sessions.
 */
function saveHighScores() {
  localStorage.setItem('forgeVaporHighScores', JSON.stringify(highScores));
}

/**
 * Render the list of high scores into the start screen.
 */
function renderHighScores() {
  if (!highScoresListEl) return;
  highScoresListEl.innerHTML = '';
  highScores.forEach(({ name, score }) => {
    const li = document.createElement('li');
    li.textContent = `${name}: ${score} stars`;
    highScoresListEl.appendChild(li);
  });
}

// Initial render of high scores
renderHighScores();

// Toggle help screen from the start screen
helpBtn.addEventListener('click', () => {
  helpScreen.classList.remove('hidden');
  startScreen.classList.add('hidden');
});

closeHelpBtn.addEventListener('click', () => {
  helpScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
});

// Also hide the help screen when the user clicks anywhere on it (including
// the darkened backdrop). This provides a reliable way to exit the help
// overlay if the button is not reachable for some reason.
helpScreen.addEventListener('click', (e) => {
  // Only close if the user clicked outside the paragraph content or on the button
  if (e.target === helpScreen || e.target.tagName === 'BUTTON') {
    helpScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
  }
});

// Configuration for phpstan bullets
const bullets = [];
// Scale bullet dimensions and speed up for the larger canvas (1.25×)
const BULLET_WIDTH = 15;
const BULLET_HEIGHT = 15;
const BULLET_SPEED = 10;

// Probability that a falling bar is "bad". Bad bars grant an extra life when
// shot with a phpstan bullet, but will consume a life if caught by the player.
const BAD_BAR_PROBABILITY = 0.2;

// Score threshold required to win the game. If the player collects this many
// git stars before time runs out, the game ends in victory instead of defeat.
const WIN_SCORE = 20;

// Possible Laravel‑related player names. These are all inspired by official tools or
// famous concepts from the Laravel ecosystem.
const PLAYER_NAMES = [
  'Taylor',    // after Taylor Otwell, creator of Laravel
  'Artisan',   // Laravel’s CLI tool
  'Lambo',     // a tool for rapid Laravel project creation
  'Eloquent',  // the ORM
  'Nova',      // administration panel
  'Sail',      // Docker environment
  'Jetstream', // application starter kit
  'Breeze',    // lightweight auth scaffolding
  'Valet'      // local development environment
];

// Currently selected player name
let currentPlayerName = '';

// Timer (in milliseconds) for displaying on‑screen instructions at the
// beginning of each game. While this timer is > 0, a small banner
// explaining how to distinguish good (catch) and bad (shoot) bars will appear.
let instructionTimer = 0;

// Particle system for simple explosion effects when catching or shooting bars
const particles = [];

// Floating text messages. These display fun feedback when killing or fixing bugs.
const floatingTexts = [];

// Messages to show when a bad bar (bug) is destroyed by a projectile. The words
// are playful and emphasise squashing bugs.
const KILL_MESSAGES = [
  'KaBuug!',
  'BugSmack!',
  'Squashed!',
  'Bug Blast!',
  'Squish!'
];

// Messages to show when the player accidentally catches a bug. These highlight
// the tongue‑in‑cheek notion that fixing a bug often spawns more. Feel free
// to expand this array with additional humorous lines.
const FIX_MESSAGES = [
  '1 bug down – 2 new spawned!',
  'Fixed? … oh no!',
  'Bug patched!',
  'Another bug bites the dust?',
  'One squashed, more to go!'
];

/**
 * Spawn a floating text at the given position. The text will float upward
 * and fade out over time. A random message is chosen based on the type.
 * @param {number} x - x position where the text starts
 * @param {number} y - y position where the text starts
 * @param {'kill'|'fix'} type - whether this is for killing or fixing a bug
 */
function spawnFloatingText(x, y, type) {
  const messages = type === 'kill' ? KILL_MESSAGES : FIX_MESSAGES;
  const text = messages[Math.floor(Math.random() * messages.length)];
  floatingTexts.push({ x: x, y: y, text: text, alpha: 1, vy: 0.5 });
}

/**
 * Create a burst of particles at a given position and colour. Particles
 * gradually fade out and shrink as they move.
 * @param {number} x
 * @param {number} y
 * @param {string} color - Base colour in hex (e.g. '#e74c3c')
 * @param {number} count - Number of particles to spawn
 */
function createParticles(x, y, color, count = 8) {
  // Convert hex colour to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      radius: 4 + Math.random() * 3,
      r: r,
      g: g,
      b: b,
    });
  }
}

// Load images
const forgeImg = new Image();
forgeImg.src = 'forge.jpg';
const vaporImg = new Image();
vaporImg.src = 'vapor.jpg';

// Game constants
const GAME_DURATION = 60; // seconds
const BAR_SPAWN_INTERVAL = 1000; // base spawn interval in ms
// Player dimensions scaled for the larger canvas (approximately 1.25×). Speed
// is also increased to keep movement responsive relative to the new canvas size.
const PLAYER_WIDTH = 90;
const PLAYER_HEIGHT = 112;
const PLAYER_SPEED = 8;
// Bar dimensions scaled up for improved visibility
const BAR_WIDTH = 50;
const BAR_HEIGHT = 20;
const INITIAL_LIVES = 3;

// Game state variables
let score;
let timeLeft;
let lives;
let bars;
let lastSpawn;
let lastTime;
let gameRunning = false;
let keyState = {};
const player = {
  x: canvas.width / 2 - PLAYER_WIDTH / 2,
  y: canvas.height - PLAYER_HEIGHT - 20,
  width: PLAYER_WIDTH,
  height: PLAYER_HEIGHT,
};

// Current game level and dynamic spawn interval. Both are reset on each game
// start. As the player collects stars, the level increases and the spawn
// interval decreases, making the game progressively harder.
let level;
let currentSpawnInterval;

// Listen for keyboard input to move the player (legacy). Retained for optional
// keyboard support but primary control is now via mouse.
window.addEventListener('keydown', (e) => {
  keyState[e.key] = true;
});
window.addEventListener('keyup', (e) => {
  keyState[e.key] = false;
});

// Listen for mouse movement over the canvas to control the player. The
// player's horizontal position follows the mouse cursor, giving direct
// control. The Y coordinate remains fixed.
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  // Center the player under the cursor
  player.x = x - player.width / 2;
  // Clamp within canvas bounds
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
});

// Listen for mouse clicks on the canvas to fire phpstan bullets. The bullet
// originates from the top centre of the player sprite. Only fire when the
// game is running (ignores clicks during start/game over screens).
canvas.addEventListener('click', () => {
  if (!gameRunning) return;
  shootBullet();
});

// Optional: allow shooting with the spacebar.
window.addEventListener('keydown', (e) => {
  if (!gameRunning) return;
  if (e.code === 'Space') {
    e.preventDefault();
    shootBullet();
  }
});

// Start and restart button handlers
startBtn.addEventListener('click', () => {
  startGame();
});
restartBtn.addEventListener('click', () => {
  startGame();
});

/**
 * Initialise and begin a new game.
 */
function startGame() {
  // Reset game state variables
  score = 0;
  timeLeft = GAME_DURATION;
  lives = INITIAL_LIVES;
  bars = [];
  lastSpawn = 0;
  lastTime = performance.now();
  player.x = canvas.width / 2 - PLAYER_WIDTH / 2;
  // Pick a random name for this session
  currentPlayerName = PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)];
  playerNameEl.textContent = currentPlayerName;
  // Reset level and spawn interval
  level = 1;
  currentSpawnInterval = BAR_SPAWN_INTERVAL;
  levelEl.textContent = level;
  // Show instructions for the first few seconds of play to remind
  // the player how to distinguish between good (red) bars and bad (green) bars.
  instructionTimer = 4000; // milliseconds
  // Update UI
  scoreEl.textContent = score;
  timeEl.textContent = timeLeft;
  livesEl.textContent = lives;
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  gameRunning = true;
  // Kick off the game loop
  requestAnimationFrame(gameLoop);
}

/**
 * Main game loop. Uses requestAnimationFrame for smooth animation.
 * @param {DOMHighResTimeStamp} timestamp
 */
function gameLoop(timestamp) {
  if (!gameRunning) return;
  const delta = timestamp - lastTime;
  lastTime = timestamp;
  // Update game state
  update(delta);
  // Draw everything to the canvas
  draw();
  // Continue the loop
  if (gameRunning) {
    requestAnimationFrame(gameLoop);
  }
}

/**
 * Update the positions of all objects and handle game logic.
 * @param {number} delta - time elapsed since last update (ms)
 */
function update(delta) {
  // Move player based on key presses
  if (keyState['ArrowLeft'] || keyState['a']) {
    player.x -= PLAYER_SPEED;
  }
  if (keyState['ArrowRight'] || keyState['d']) {
    player.x += PLAYER_SPEED;
  }
  // Keep player within canvas bounds
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

  // Spawn new bars at an interval that decreases with level
  lastSpawn += delta;
  if (lastSpawn >= currentSpawnInterval) {
    spawnBar();
    lastSpawn = 0;
  }

  // Move bars and check for collisions
  for (let i = bars.length - 1; i >= 0; i--) {
    const bar = bars[i];
    bar.y += bar.speed;
    // Check for collision with player
    if (
      bar.x < player.x + player.width &&
      bar.x + bar.width > player.x &&
      bar.y < player.y + player.height &&
      bar.y + bar.height > player.y
    ) {
      // Collision detected: remove bar and increment score
      bars.splice(i, 1);
      if (bar.isBad) {
        // Catching a bad bar costs a life
        lives--;
        livesEl.textContent = lives;
        // Purple explosion for penalty
        createParticles(player.x + player.width / 2, player.y + player.height / 2, '#8e44ad');
        // Floating text effect for accidentally fixing a bug
        spawnFloatingText(player.x + player.width / 2, player.y, 'fix');
        if (lives <= 0) {
          endGame();
          return;
        }
      } else {
        // Catching a good bar awards a git star
        score++;
        scoreEl.textContent = score;
        // Red explosion for successful catch
        createParticles(player.x + player.width / 2, player.y + player.height / 2, '#e74c3c');
        // Check win condition
        if (score >= WIN_SCORE) {
          winGame();
          return;
        }
        // Level progression: increase level every 5 stars
        if (score % 5 === 0) {
          level++;
          levelEl.textContent = level;
          // Reduce spawn interval but do not go below a threshold
          currentSpawnInterval = Math.max(300, BAR_SPAWN_INTERVAL - (level - 1) * 100);
        }
      }
      continue;
    }
    // If bar falls off the bottom, remove it and decrease lives
    if (bar.y > canvas.height) {
      bars.splice(i, 1);
      lives--;
      livesEl.textContent = lives;
      // End game if no lives remain
      if (lives <= 0) {
        endGame();
        return;
      }
    }
  }

  // Decrease instruction timer if active
  if (instructionTimer > 0) {
    instructionTimer -= delta;
    if (instructionTimer < 0) instructionTimer = 0;
  }

  // Move bullets upwards and handle collisions with bars
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const bullet = bullets[bi];
    bullet.y -= BULLET_SPEED;
    // Remove bullets that leave the top of the screen
    if (bullet.y + bullet.height < 0) {
      bullets.splice(bi, 1);
      continue;
    }
    // Check collision with each bar
    let bulletRemoved = false;
    for (let i = bars.length - 1; i >= 0; i--) {
      const bar = bars[i];
      if (
        bullet.x < bar.x + bar.width &&
        bullet.x + bullet.width > bar.x &&
        bullet.y < bar.y + bar.height &&
        bullet.y + bullet.height > bar.y
      ) {
        // Bullet hits a bar
        bars.splice(i, 1);
        bullets.splice(bi, 1);
        bulletRemoved = true;
        if (bar.isBad) {
          // Destroying a bad bar with a bullet grants an extra life
          lives++;
          livesEl.textContent = lives;
          // Green explosion for good hit
          createParticles(bar.x + bar.width / 2, bar.y + bar.height / 2, '#2ecc71');
          // Floating text effect for bug kill
          spawnFloatingText(bar.x + bar.width / 2, bar.y + bar.height / 2, 'kill');
        } else {
          // Shooting a good bar simply removes it with a grey burst
          createParticles(bar.x + bar.width / 2, bar.y + bar.height / 2, '#bdc3c7');
        }
        // Do not award stars for shooting good bars
        break;
      }
    }
    if (bulletRemoved) {
      continue;
    }
  }

  // Update particles: move, fade and remove when invisible
  for (let pi = particles.length - 1; pi >= 0; pi--) {
    const p = particles[pi];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.02;
    p.radius *= 0.96;
    if (p.alpha <= 0 || p.radius <= 0.5) {
      particles.splice(pi, 1);
    }
  }

  // Update floating texts: move upward and fade out. Remove when invisible.
  for (let fi = floatingTexts.length - 1; fi >= 0; fi--) {
    const ft = floatingTexts[fi];
    ft.y -= ft.vy;
    ft.alpha -= 0.02;
    if (ft.alpha <= 0) {
      floatingTexts.splice(fi, 1);
    }
  }

  // Decrease the timer
  timeLeft -= delta / 1000;
  if (timeLeft <= 0) {
    timeLeft = 0;
    endGame();
    return;
  }
  timeEl.textContent = Math.ceil(timeLeft);
}

/**
 * Draw the game world to the canvas.
 */
function draw() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Draw forge background scaled to canvas size
  if (forgeImg.complete) {
    ctx.drawImage(forgeImg, 0, 0, canvas.width, canvas.height);
  }
  // Draw falling bars with a simple pseudo‑3D effect. Bars start smaller near
  // the top and grow larger as they fall, giving a sense of depth. Good bars
  // are rendered in a red gradient, bad bars in a green gradient.
  bars.forEach((bar) => {
    const scale = 0.5 + (bar.y / canvas.height) * 0.5;
    const w = bar.width * scale;
    const h = bar.height * scale;
    const drawX = bar.x + (bar.width - w) / 2;
    const drawY = bar.y + (bar.height - h) / 2;
    const lighten = 0.4 + (bar.y / canvas.height) * 0.6;
    let baseR, baseG, baseB;
    if (bar.isBad) {
      // Bad bars use a green palette
      baseR = 46; baseG = 204; baseB = 113; // 2ecc71
    } else {
      // Good bars use a red palette
      baseR = 231; baseG = 76; baseB = 60; // e74c3c
    }
    const r = Math.min(255, Math.floor(baseR * lighten));
    const g = Math.min(255, Math.floor(baseG * lighten));
    const b = Math.min(255, Math.floor(baseB * lighten));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(drawX, drawY, w, h);

    // Overlay a symbol to help the player distinguish between good and bad bars.
    // Good bars display a plus sign (catch), bad bars display a cross (avoid).
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    const centerX = drawX + w / 2;
    const centerY = drawY + h / 2;
    const size = Math.min(w, h) * 0.5; // relative size of symbol
    if (bar.isBad) {
      // Draw a cross
      ctx.beginPath();
      ctx.moveTo(centerX - size / 2, centerY - size / 2);
      ctx.lineTo(centerX + size / 2, centerY + size / 2);
      ctx.moveTo(centerX + size / 2, centerY - size / 2);
      ctx.lineTo(centerX - size / 2, centerY + size / 2);
      ctx.stroke();
    } else {
      // Draw a plus
      ctx.beginPath();
      ctx.moveTo(centerX - size / 2, centerY);
      ctx.lineTo(centerX + size / 2, centerY);
      ctx.moveTo(centerX, centerY - size / 2);
      ctx.lineTo(centerX, centerY + size / 2);
      ctx.stroke();
    }
  });

  // Draw phpstan bullets as blue circles
  bullets.forEach((bullet) => {
    ctx.fillStyle = '#3498db'; // blue
    ctx.beginPath();
    ctx.arc(
      bullet.x + bullet.width / 2,
      bullet.y + bullet.height / 2,
      bullet.width / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });

  // Draw particles
  particles.forEach((p) => {
    ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  // Draw player (vapor character) scaled
  if (vaporImg.complete) {
    ctx.drawImage(
      vaporImg,
      player.x,
      player.y,
      player.width,
      player.height
    );
  }

  // Draw floating texts. Use bold white or yellow to stand out. The alpha
  // channel controls opacity.
  floatingTexts.forEach((ft) => {
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Alternate colours for variety: kill messages in yellow, fix in cyan
    const isKill = KILL_MESSAGES.includes(ft.text);
    const color = isKill ? '255, 223, 0' : '0, 255, 255';
    ctx.fillStyle = `rgba(${color}, ${ft.alpha.toFixed(2)})`;
    ctx.fillText(ft.text, ft.x, ft.y);
  });

  // If the instruction timer is active, overlay a small banner at the top
  // explaining how to interact with the bars. This helps clarify which
  // bars should be caught versus shot. The banner fades out as the timer
  // approaches zero.
  if (instructionTimer > 0) {
    // Compute opacity based on remaining time. The banner fades during the last
    // two seconds of its lifetime.
    const alpha = Math.min(1, instructionTimer / 2000);
    const bannerHeight = 42;
    const bannerY = canvas.height - bannerHeight; // position at bottom
    ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * alpha})`;
    ctx.fillRect(0, bannerY, canvas.width, bannerHeight);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Catch the red bars (+) and shoot the green bars (×)', canvas.width / 2, bannerY + bannerHeight / 2);
    // Restore defaults
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

/**
 * Spawn a new glowing bar at a random x position at the top of the screen.
 * The falling speed increases slightly with score to add difficulty over time.
 */
function spawnBar() {
  const speed = 2 + Math.min(score * 0.1, 5); // cap speed increase
  const x = Math.random() * (canvas.width - BAR_WIDTH);
  // Determine if this bar is a "bad" bar with a chance. Bad bars are drawn
  // differently and grant an extra life if destroyed by a bullet. If caught
  // by the player they will consume a life instead of granting a star.
  const isBad = Math.random() < BAD_BAR_PROBABILITY;
  bars.push({ x: x, y: -BAR_HEIGHT, width: BAR_WIDTH, height: BAR_HEIGHT, speed: speed, isBad });
}

/**
 * Spawn a phpstan bullet at the player's current position. Bullets travel
 * upwards and can destroy falling bars. Destroying a bad bar with a bullet
 * grants an extra life. Shooting good bars simply removes them without
 * awarding points.
 */
function shootBullet() {
  const bulletX = player.x + player.width / 2 - BULLET_WIDTH / 2;
  const bulletY = player.y - BULLET_HEIGHT;
  bullets.push({ x: bulletX, y: bulletY, width: BULLET_WIDTH, height: BULLET_HEIGHT });
}

/**
 * Stop the game and show the game over screen.
 */
function endGame() {
  gameRunning = false;
  // Update heading for a loss
  gameOverHeadingEl.textContent = 'Game Over!';
  // Construct a summary of the collected git stars with pluralisation.
  const starLabel = score === 1 ? 'git star' : 'git stars';
  finalScoreEl.textContent = `You collected ${score} ${starLabel}!`;
  gameOverScreen.classList.remove('hidden');

  // Update high scores list
  updateHighScores(score, currentPlayerName);
}

/**
 * Display the victory screen when the player reaches the required number of
 * git stars before the timer runs out. This stops the game and shows a
 * congratulatory message.
 */
function winGame() {
  gameRunning = false;
  gameOverHeadingEl.textContent = 'You Win!';
  const starLabel = score === 1 ? 'git star' : 'git stars';
  finalScoreEl.textContent = `You collected ${score} ${starLabel} and won!`;
  gameOverScreen.classList.remove('hidden');

  // Update high scores list
  updateHighScores(score, currentPlayerName);
}

/**
 * Insert a new score into the high scores list, keep the list sorted
 * descending, and trim it to the top 5. Then save and render.
 * @param {number} newScore
 * @param {string} playerName
 */
function updateHighScores(newScore, playerName) {
  // Add new entry
  highScores.push({ name: playerName, score: newScore });
  // Sort descending by score
  highScores.sort((a, b) => b.score - a.score);
  // Keep only top 5
  if (highScores.length > 5) highScores = highScores.slice(0, 5);
  // Persist
  saveHighScores();
  // Update the visible list
  renderHighScores();
}