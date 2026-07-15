import {
  _decorator,
  Component,
  EventTouch,
  Label,
  Node,
  sys,
  tween,
  Tween,
  Vec3,
} from "cc";

const { ccclass, property } = _decorator;

enum ClawState {
  Ready = "Ready",
  Dropping = "Dropping",
  Grabbing = "Grabbing",
  Lifting = "Lifting",
  Transporting = "Transporting",
  Releasing = "Releasing",
  Returning = "Returning",
  GameOver = "GameOver",
}

interface SaveData {
  version: 1;
  score: number;
  attemptsLeft: number;
  bestScore: number;
  totalPrizes: number;
}

@ccclass("claw")
export class claw extends Component {
  @property(Node) background: Node = null!;
  @property(Node) machine: Node = null!;
  @property(Node) floor: Node = null!;
  @property(Node) titleNode: Node = null!;
  @property(Node) statusNode: Node = null!;
  @property(Node) dollNode: Node = null!;
  @property(Node) dollFaceNode: Node = null!;
  @property(Node) clawNode: Node = null!;
  @property(Node) clawRoot: Node = null!;
  @property(Node) cable: Node = null!;
  @property(Node) leftArm: Node = null!;
  @property(Node) rightArm: Node = null!;
  @property(Node) grabPoint: Node = null!;
  @property(Node) actionButton: Node = null!;
  @property(Node) actionLabelNode: Node = null!;

  @property maxAttempts = 5;
  @property moveSpeed = 150;
  @property dropSpeed = 500;
  @property grabTolerance = 92;

  private readonly saveKey = "twinkle-parade-save-v1";
  private readonly topY = 430;
  private readonly bottomY = -145;
  private readonly leftLimit = -190;
  private readonly rightLimit = 190;
  private readonly exitX = 225;
  private readonly exitY = -355;

  private state = ClawState.Ready;
  private moveDirection = 1;
  private hasDoll = false;
  private score = 0;
  private attemptsLeft = 5;
  private bestScore = 0;
  private totalPrizes = 0;
  private statusLabel!: Label;
  private titleLabel!: Label;
  private actionLabel!: Label;
  private dollHome = new Vec3();

  start() {
    this.statusLabel = this.requireLabel(this.statusNode, "StatusLabel");
    this.titleLabel = this.requireLabel(this.titleNode, "Title");
    this.actionLabel = this.requireLabel(this.actionLabelNode, "ActionLabel");
    this.dollHome.set(this.dollNode.position);
    this.actionButton.on(Node.EventType.TOUCH_END, this.onAction, this);
    this.loadGame();
    this.prepareRound(false);
  }

  onDestroy() {
    this.actionButton?.off(Node.EventType.TOUCH_END, this.onAction, this);
    this.stopMotion();
  }

  update(deltaTime: number) {
    if (this.state === ClawState.Ready) {
      this.updateHorizontalMovement(deltaTime);
    } else if (this.state === ClawState.Dropping) {
      this.updateDrop(deltaTime);
    }
  }

  private updateHorizontalMovement(deltaTime: number) {
    const current = this.clawNode.position;
    let nextX = current.x + this.moveDirection * this.moveSpeed * deltaTime;
    if (nextX >= this.rightLimit) {
      nextX = this.rightLimit;
      this.moveDirection = -1;
    } else if (nextX <= this.leftLimit) {
      nextX = this.leftLimit;
      this.moveDirection = 1;
    }
    this.clawNode.setPosition(nextX, this.topY, current.z);
  }

  private updateDrop(deltaTime: number) {
    const current = this.clawNode.position;
    const nextY = Math.max(this.bottomY, current.y - this.dropSpeed * deltaTime);
    this.clawNode.setPosition(current.x, nextY, current.z);
    if (nextY <= this.bottomY) this.resolveGrab();
  }

  private onAction(_event: EventTouch) {
    if (this.state === ClawState.Ready) {
      this.attemptsLeft -= 1;
      this.saveGame();
      this.setState(ClawState.Dropping, "Dropping...");
    } else if (this.state === ClawState.GameOver) {
      this.startNewGame();
    }
  }

  private resolveGrab() {
    if (this.state !== ClawState.Dropping) return;
    this.setState(ClawState.Grabbing, "Checking grip...");

    const distance = Math.abs(this.clawNode.position.x - this.dollNode.position.x);
    const caught = distance <= this.grabTolerance;
    this.playClawAnimation(false, () => {
      if (caught) {
        this.hasDoll = true;
        this.dollNode.setParent(this.grabPoint);
        this.dollNode.setPosition(Vec3.ZERO);
      }
      this.liftToTop();
    });
  }

  private liftToTop() {
    this.setState(ClawState.Lifting, this.hasDoll ? "Prize secured!" : "Missed prize");
    const target = new Vec3(this.clawNode.position.x, this.topY, 0);
    tween(this.clawNode)
      .to(1.1, { position: target }, { easing: "sineInOut" })
      .call(() => (this.hasDoll ? this.transportToExit() : this.finishAttempt()))
      .start();
  }

  private transportToExit() {
    this.setState(ClawState.Transporting, "Moving to prize chute...");
    tween(this.clawNode)
      .to(0.9, { position: new Vec3(this.exitX, this.topY, 0) }, { easing: "sineInOut" })
      .call(() => this.releasePrize())
      .start();
  }

  private releasePrize() {
    this.setState(ClawState.Releasing, "Prize delivered!");
    this.playClawAnimation(true, () => {
      this.dollNode.setParent(this.node);
      this.dollNode.setPosition(this.exitX, this.topY - 105, 0);
      tween(this.dollNode)
        .to(0.65, { position: new Vec3(this.exitX, this.exitY, 0) }, { easing: "quadIn" })
        .call(() => {
          this.score += 1;
          this.totalPrizes += 1;
          this.bestScore = Math.max(this.bestScore, this.score);
          this.hasDoll = false;
          this.saveGame();
          this.finishAttempt();
        })
        .start();
    });
  }

  private finishAttempt() {
    this.setState(ClawState.Returning, "Returning to start...");
    tween(this.clawNode)
      .to(0.75, { position: new Vec3(0, this.topY, 0) }, { easing: "sineInOut" })
      .call(() => {
        if (this.attemptsLeft <= 0) {
          this.setState(ClawState.GameOver, `Game over - score ${this.score}`);
          this.saveGame();
        } else {
          this.prepareRound(true);
        }
      })
      .start();
  }

  private prepareRound(randomizeDoll: boolean) {
    this.stopMotion();
    this.hasDoll = false;
    this.dollNode.setParent(this.node);
    const dollX = randomizeDoll ? this.randomDollX() : this.dollHome.x;
    this.dollNode.setPosition(dollX, this.dollHome.y, this.dollHome.z);
    this.dollNode.setScale(Vec3.ONE);
    this.clawNode.setPosition(0, this.topY, 0);
    this.leftArm.angle = -18;
    this.rightArm.angle = 18;
    this.setState(ClawState.Ready, "Tap DROP when aligned");
  }

  private startNewGame() {
    this.score = 0;
    this.attemptsLeft = this.maxAttempts;
    this.saveGame();
    this.prepareRound(true);
  }

  private playClawAnimation(open: boolean, done: () => void) {
    Tween.stopAllByTarget(this.leftArm);
    Tween.stopAllByTarget(this.rightArm);
    const leftAngle = open ? -18 : -4;
    const rightAngle = open ? 18 : 4;
    tween(this.leftArm).to(0.22, { angle: leftAngle }).start();
    tween(this.rightArm).to(0.22, { angle: rightAngle }).call(done).start();
  }

  private stopMotion() {
    if (!this.clawNode) return;
    Tween.stopAllByTarget(this.clawNode);
    Tween.stopAllByTarget(this.dollNode);
    Tween.stopAllByTarget(this.leftArm);
    Tween.stopAllByTarget(this.rightArm);
  }

  private setState(next: ClawState, message: string) {
    this.state = next;
    this.statusLabel.string = message;
    this.titleLabel.string = `TWINKLE PARADE  SCORE ${this.score}  TRY ${this.attemptsLeft}`;
    this.actionLabel.string = next === ClawState.GameOver ? "RESTART" : next === ClawState.Ready ? "DROP CLAW" : "PLEASE WAIT";
    console.info(`[ClawState] ${next}`);
  }

  private randomDollX() {
    return -155 + Math.random() * 310;
  }

  private loadGame() {
    try {
      const raw = sys.localStorage.getItem(this.saveKey);
      const data = raw ? (JSON.parse(raw) as Partial<SaveData>) : null;
      this.score = Math.max(0, data?.score ?? 0);
      this.attemptsLeft = Math.min(this.maxAttempts, Math.max(0, data?.attemptsLeft ?? this.maxAttempts));
      this.bestScore = Math.max(0, data?.bestScore ?? 0);
      this.totalPrizes = Math.max(0, data?.totalPrizes ?? 0);
      if (this.attemptsLeft <= 0) this.attemptsLeft = this.maxAttempts;
    } catch (error) {
      console.warn("Save data was invalid and has been reset.", error);
      this.score = 0;
      this.attemptsLeft = this.maxAttempts;
    }
  }

  private saveGame() {
    const data: SaveData = {
      version: 1,
      score: this.score,
      attemptsLeft: this.attemptsLeft,
      bestScore: this.bestScore,
      totalPrizes: this.totalPrizes,
    };
    sys.localStorage.setItem(this.saveKey, JSON.stringify(data));
  }

  private requireLabel(node: Node, name: string) {
    const label = node?.getComponent(Label);
    if (!label) throw new Error(`${name} requires a Label component.`);
    return label;
  }
}
