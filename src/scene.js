/**
 * Scene 类
 * @class
 * @param {Game} game 游戏实例
 * @return {Scene} Instance
 */
class Scene {
  /** Create a scene instance */
  constructor(game, name) {
    // 当前场景需要的角色名称
    this.actors = [];

    this.name = name;
    this.game = game;
  }

  /**
   * 更新各成员
   *
   * @return {void}
   */
  update() {
    for (const key of this.actors) {
      const actor = this.game.actors[key];
      if (!actor) continue;
      if (Array.isArray(actor)) {
        for (const x of actor) x.update(actor);
      } else {
        actor.update();
      }
    }
  }

  /**
   * 渲染各成员
   *
   * @return {void}
   */
  render() {
    for (const key of this.actors) {
      const actor = this.game.actors[key];
      if (!actor) continue;
      if (Array.isArray(actor)) {
        for (const x of actor) x.render();
      } else {
        actor.render();
      }
    }
  }

  /**
   * 进入场景
   *
   * @return {void}
   */
  enter() {
    throw Error("进入场景无法实现公用方法, 请子类实现");
  }

  /**
   * 鼠标按下事件
   *
   * @return {void}
   */
  mousedown(x, y) {
    for (const key of this.actors) {
      const actor = this.game.actors[key];
      if (actor.mousedown) actor.mousedown(x, y);
    }
  }

  /**
   * 鼠标松开事件
   *
   * @return {void}
   */
  mouseup(x, y) {
    for (const key of this.actors) {
      const actor = this.game.actors[key];
      if (actor.mouseup) actor.mouseup(x, y);
    }
  }

  /**
   * 鼠标移动事件
   *
   * @return {void}
   */
  mousemove(x, y) {
    for (const key of this.actors) {
      const actor = this.game.actors[key];
      if (actor.mousemove) actor.mousemove(x, y);
    }
  }

  /**
   * 鼠标点击事件
   *
   * @return {void}
   */
  click(x, y) {
    for (const key of this.actors) {
      const actor = this.game.actors[key];
      if (actor.click) actor.click(x, y);
    }
  }
}

module.exports = Scene;
