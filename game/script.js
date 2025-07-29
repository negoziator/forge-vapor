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

// Load images
const forgeImg = new Image();
forgeImg.src = 'forge.jpg';
const vaporImg = new Image();
vaporImg.src = 'vapor.jpg';

// Game constants
const GAME_DURATION = 60; // seconds
const BAR_SPAWN_INTERVAL = 1000; // ms
const PLAYER_WIDTH = 72;
const PLAYER_HEIGHT = 90;
const PLAYER_SPEED = 6;
const BAR_WIDTH = 40;
const BAR_HEIGHT = 16;
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

// Listen for keyboard input to move the player
window.addEventListener('keydown', (e) => {
  keyState[e.key] = true;
});
window.addEventListener('keyup', (e) => {
  keyState[e.key] = false;
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

  // Spawn new bars at regular intervals
  lastSpawn += delta;
  if (lastSpawn >= BAR_SPAWN_INTERVAL) {
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
      score++;
      scoreEl.textContent = score;
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
  // Draw falling bars
  ctx.fillStyle = '#e74c3c';
  bars.forEach((bar) => {
    ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
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
}

/**
 * Spawn a new glowing bar at a random x position at the top of the screen.
 * The falling speed increases slightly with score to add difficulty over time.
 */
function spawnBar() {
  const speed = 2 + Math.min(score * 0.1, 5); // cap speed increase
  const x = Math.random() * (canvas.width - BAR_WIDTH);
  bars.push({ x: x, y: -BAR_HEIGHT, width: BAR_WIDTH, height: BAR_HEIGHT, speed: speed });
}

/**
 * Stop the game and show the game over screen.
 */
function endGame() {
  gameRunning = false;
  // Construct a summary of the collected git stars with pluralisation.
  const starLabel = score === 1 ? 'git star' : 'git stars';
  finalScoreEl.textContent = `You collected ${score} ${starLabel}!`;
  gameOverScreen.classList.remove('hidden');
}