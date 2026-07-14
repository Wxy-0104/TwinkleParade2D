import { _decorator, Component, Node, tween, Vec3 } from "cc";
const { ccclass, property } = _decorator;
/**
 * 公共工具函数库
 * 作为基础库使用
 **/

/**
 * 将节点 reparent 到新的父节点，并（可选）移动到指定位置
 * @param child 要移动的子节点
 * @param newParent 新的父节点
 * @param targetPos 新父节点坐标系下的目标位置（可选，不传则保持当前相对位置）
 * @param time 移动时间（秒，可选，默认0）
 */
export function reparentMove(
  child: Node,
  newParent: Node,
  targetPos?: Vec3,
  time: number = 0
) {
  // 先获取当前世界坐标
  const worldPos = child.worldPosition.clone();

  // 把节点挂到新的父节点
  child.parent = newParent;

  // 转换为新父节点下的本地坐标
  const localPos = new Vec3();
  newParent.inverseTransformPoint(localPos, worldPos);

  // 如果没传 targetPos，就只设置回原本位置
  if (!targetPos) {
    child.setPosition(localPos);
    return;
  }

  // 如果需要移动到目标位置
  if (time <= 0) {
    // 立即设置
    child.setPosition(targetPos);
    return;
  }
  // tween平滑移动
  tween(child).to(time, { position: targetPos }).start();
}
