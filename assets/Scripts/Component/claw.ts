import {
  _decorator,
  Component,
  EventTouch,
  Label,
  Node,
  tween,
  Tween,
  Vec3,
} from "cc";

const { ccclass, property } = _decorator;

/** 机械爪一次抓取流程中的五个状态。 */
enum ClawState {
  Idle = "Idle",
  Dropping = "Dropping",
  Grabbing = "Grabbing",
  Returning = "Returning",
  Finished = "Finished",
}

/**
 * M1：单娃娃、单次自动抓取演示。
 *
 * 为了让第一个学习场景容易复现，本组件会在运行时创建演示节点。
 * 后续学习到编辑器属性绑定时，可以逐步把这些节点改为场景中的预制节点。
 */
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

  private state = ClawState.Idle;
  private statusLabel!: Label;
  private actionLabel!: Label;

  private readonly startPosition = new Vec3(0, 430, 0);
  private readonly dollPosition = new Vec3(0, -250, 0);
  private readonly grabY = -155;
  private readonly dropSpeed = 360;
  private hasDoll = false;

  start() {
    this.buildScene();
    this.setState(ClawState.Idle);
  }

  update(deltaTime: number) {
    if (this.state !== ClawState.Dropping) return;

    const position = this.clawNode.position;
    const nextY = position.y - this.dropSpeed * deltaTime;
    this.clawNode.setPosition(position.x, nextY, position.z);

    if (nextY <= this.grabY) {
      this.beginGrab();
    }
  }

  private buildScene() {
    this.statusLabel = this.statusNode.getComponent(Label)!;
    this.actionLabel = this.actionLabelNode.getComponent(Label)!;
    this.actionButton.on(Node.EventType.TOUCH_END, this.onAction, this);
  }

  private onAction(_event: EventTouch) {
    if (this.state === ClawState.Idle || this.state === ClawState.Finished) {
      this.resetRound();
      this.setState(ClawState.Dropping);
    }
  }

  private beginGrab() {
    if (this.state !== ClawState.Dropping) return;
    this.setState(ClawState.Grabbing);

    tween(this.leftArm).to(0.25, { angle: -12 }).start();
    tween(this.rightArm)
      .to(0.25, { angle: 12 })
      .call(() => {
        this.hasDoll = true;
        this.dollNode.setParent(this.grabPoint);
        this.dollNode.setPosition(Vec3.ZERO);
        this.returnToTop();
      })
      .start();
  }

  private returnToTop() {
    this.setState(ClawState.Returning);
    tween(this.clawNode)
      .to(1.4, { position: this.startPosition }, { easing: "sineInOut" })
      .call(() => this.setState(ClawState.Finished))
      .start();
  }

  private resetRound() {
    Tween.stopAllByTarget(this.clawNode);
    this.hasDoll = false;
    this.dollNode.setParent(this.node);
    this.dollNode.setPosition(this.dollPosition);
    this.clawNode.setPosition(this.startPosition);
    this.leftArm.angle = -28;
    this.rightArm.angle = 28;
  }

  private setState(next: ClawState) {
    this.state = next;
    const descriptions: Record<ClawState, string> = {
      [ClawState.Idle]: "Idle · 等待开始",
      [ClawState.Dropping]: "Dropping · 机械爪下降",
      [ClawState.Grabbing]: "Grabbing · 抓取娃娃",
      [ClawState.Returning]: "Returning · 返回顶部",
      [ClawState.Finished]: this.hasDoll ? "Finished · 抓取成功" : "Finished · 本轮结束",
    };
    this.statusLabel.string = descriptions[next];
    this.actionLabel.string = next === ClawState.Finished ? "再来一次" : next === ClawState.Idle ? "开始抓取" : "运行中…";
    console.info(`[ClawState] ${next}`);
  }

}
