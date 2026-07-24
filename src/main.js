import './style.css'
import Phaser from 'phaser'

const WIDTH = 400
const HEIGHT = 700

const PIPE_GAP = 190
const PIPE_SPEED = 160
const PIPE_SPAWN_MS = 1400
const FLAP_VELOCITY = -350
const GRAVITY = 1400

const BEST_SCORE_KEY = 'flappy-lista-best-score'

class GameScene extends Phaser.Scene {
  constructor() {
    super('game')
  }

  init() {
    this.score = 0
    this.best = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0
    this.state = 'ready' // ready | playing | dead
    this.pipes = []
    this.nextPipeAt = 0
  }

  preload() {
    this.makeTextures()
  }

  makeTextures() {
    // Bird
    const bird = this.make.graphics({ x: 0, y: 0, add: false })
    bird.fillStyle(0xffd23f, 1)
    bird.fillCircle(16, 16, 16)
    bird.fillStyle(0xff9f1c, 1)
    bird.fillTriangle(28, 14, 40, 18, 28, 22)
    bird.fillStyle(0x1a1a2e, 1)
    bird.fillCircle(22, 11, 2.5)
    bird.generateTexture('bird', 40, 32)
    bird.destroy()

    // Pipe segment (stretched via displaySize)
    const pipe = this.make.graphics({ x: 0, y: 0, add: false })
    pipe.fillStyle(0x2ecc71, 1)
    pipe.fillRect(0, 0, 62, 40)
    pipe.fillStyle(0x27ae60, 1)
    pipe.fillRect(0, 0, 6, 40)
    pipe.fillRect(56, 0, 6, 40)
    pipe.generateTexture('pipe', 62, 40)
    pipe.destroy()

    // Pipe cap
    const cap = this.make.graphics({ x: 0, y: 0, add: false })
    cap.fillStyle(0x27ae60, 1)
    cap.fillRoundedRect(0, 0, 70, 28, 4)
    cap.generateTexture('pipeCap', 70, 28)
    cap.destroy()

    // Ground tile
    const ground = this.make.graphics({ x: 0, y: 0, add: false })
    ground.fillStyle(0xded895, 1)
    ground.fillRect(0, 0, WIDTH, 60)
    ground.fillStyle(0xc7bf6f, 1)
    ground.fillRect(0, 0, WIDTH, 8)
    ground.generateTexture('ground', WIDTH, 60)
    ground.destroy()
  }

  create() {
    this.cameras.main.setBackgroundColor('#4ec0e9')

    this.pipesGroup = this.physics.add.group()

    this.groundTop = HEIGHT - 60
    this.ground = this.physics.add.staticGroup()
    const groundImg = this.add.tileSprite(WIDTH / 2, this.groundTop + 30, WIDTH, 60, 'ground')
    this.physics.add.existing(groundImg, true)
    this.ground.add(groundImg)
    this.groundSprite = groundImg

    this.bird = this.physics.add.sprite(WIDTH * 0.28, HEIGHT / 2, 'bird')
    this.bird.setCollideWorldBounds(false)
    this.bird.body.allowGravity = false
    this.bird.setDepth(10)

    this.scoreText = this.add
      .text(WIDTH / 2, 60, '0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#1a1a2e',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(20)

    this.messageText = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 60, 'Toca para volar', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#1a1a2e',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(20)

    this.subText = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 70, `Mejor: ${this.best}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#1a1a2e',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20)

    this.physics.add.overlap(this.bird, this.pipesGroup, () => this.gameOver(), null, this)
    this.physics.add.collider(this.bird, this.ground, () => this.gameOver(), null, this)

    this.input.on('pointerdown', () => this.handleInput())
    this.input.keyboard?.on('keydown-SPACE', () => this.handleInput())
  }

  handleInput() {
    if (this.state === 'ready') {
      this.startGame()
    } else if (this.state === 'playing') {
      this.flap()
    } else if (this.state === 'dead') {
      this.scene.restart()
    }
  }

  startGame() {
    this.state = 'playing'
    this.messageText.setVisible(false)
    this.subText.setVisible(false)
    this.bird.body.allowGravity = true
    this.bird.body.gravity.y = GRAVITY
    this.flap()
    this.nextPipeAt = this.time.now + 600
  }

  flap() {
    this.bird.setVelocityY(FLAP_VELOCITY)
    this.tweens.add({
      targets: this.bird,
      angle: -20,
      duration: 100,
      ease: 'Sine.Out',
    })
  }

  spawnPipe() {
    const margin = 90
    const gapCenter = Phaser.Math.Between(margin + PIPE_GAP / 2, this.groundTop - margin - PIPE_GAP / 2)
    const x = WIDTH + 40

    const topPipe = this.pipesGroup.create(x, gapCenter - PIPE_GAP / 2, 'pipeCap')
    topPipe.setOrigin(0.5, 1)
    topPipe.setFlipY(true)
    topPipe.body.allowGravity = false
    topPipe.setVelocityX(-PIPE_SPEED)
    topPipe.setImmovable(true)

    const topBodyHeight = Math.max(gapCenter - PIPE_GAP / 2 - 28, 10)
    const topBody = this.pipesGroup.create(x, gapCenter - PIPE_GAP / 2 - 28, 'pipe')
    topBody.setOrigin(0.5, 1)
    topBody.setDisplaySize(70, topBodyHeight)
    topBody.body.allowGravity = false
    topBody.setVelocityX(-PIPE_SPEED)
    topBody.setImmovable(true)

    const bottomPipe = this.pipesGroup.create(x, gapCenter + PIPE_GAP / 2, 'pipeCap')
    bottomPipe.setOrigin(0.5, 0)
    bottomPipe.body.allowGravity = false
    bottomPipe.setVelocityX(-PIPE_SPEED)
    bottomPipe.setImmovable(true)

    const bottomBodyHeight = Math.max(this.groundTop - (gapCenter + PIPE_GAP / 2 + 28), 10)
    const bottomBody = this.pipesGroup.create(x, gapCenter + PIPE_GAP / 2 + 28, 'pipe')
    bottomBody.setOrigin(0.5, 0)
    bottomBody.setDisplaySize(70, bottomBodyHeight)
    bottomBody.body.allowGravity = false
    bottomBody.setVelocityX(-PIPE_SPEED)
    bottomBody.setImmovable(true)

    this.pipes.push({ x, scored: false, sprites: [topPipe, topBody, bottomPipe, bottomBody] })
  }

  gameOver() {
    if (this.state !== 'playing') return
    this.state = 'dead'
    this.physics.pause()
    this.bird.setTint(0xff4d4d)
    this.cameras.main.shake(150, 0.01)

    if (this.score > this.best) {
      this.best = this.score
      localStorage.setItem(BEST_SCORE_KEY, String(this.best))
    }

    this.messageText.setText('Fin del juego\nToca para reintentar')
    this.messageText.setVisible(true)
    this.subText.setText(`Puntuacion: ${this.score}   Mejor: ${this.best}`)
    this.subText.setVisible(true)
  }

  update(time, delta) {
    if (this.state === 'ready') {
      this.bird.y = HEIGHT / 2 + Math.sin(time / 300) * 8
      return
    }

    if (this.state === 'playing') {
      this.groundSprite.tilePositionX += 2
    }

    if (this.state !== 'playing') return

    if (this.bird.angle < 80) {
      this.bird.angle += delta * 0.2
    }

    if (time > this.nextPipeAt) {
      this.spawnPipe()
      this.nextPipeAt = time + PIPE_SPAWN_MS
    }

    for (const pipe of this.pipes) {
      if (!pipe.scored && pipe.sprites[0].x < this.bird.x) {
        pipe.scored = true
        this.score += 1
        this.scoreText.setText(String(this.score))
      }
    }

    this.pipes = this.pipes.filter((pipe) => {
      if (pipe.sprites[0].x < -80) {
        pipe.sprites.forEach((s) => s.destroy())
        return false
      }
      return true
    })

    if (this.bird.y < -20) {
      this.bird.y = -20
      this.bird.setVelocityY(0)
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'app',
  backgroundColor: '#4ec0e9',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [GameScene],
}

new Phaser.Game(config)
