const Actor = require("./actor");
const Scene = require("./scene");

const isURL = /^https?:\/\//i;

// 微信event映射关系
const eventsMap = {
  mobile: {
    onmousedown: "ontouchstart",
    onmouseup: "ontouchend",
    onmousemove: "ontouchmove"
  },
  wx: {
    onmousedown: "onTouchStart",
    onmouseup: "onTouchEnd",
    onmousemove: "onTouchMove"
  }
};

// 获取执行环境，wx, browser，node
const env = (() => {
  if (typeof wx === "object") return "wx";
  if (typeof window === "object") return "browser";
  if (typeof process === "object") return "node";
  throw Error("未知环境");
})();

// 获取平台类型 pc, mobile, unknown
const isMobile = (() => {
  if (env === "node") return "unknown";
  if (typeof wx !== "undefined") return true;
  return typeof document !== "undefined" && "ontouchstart" in document;
})();

/* eslint-disable no-undef */
const fetchFns = {
  wx(url) {
    return Promise.resolve({
      text() {
        return new Promise((success, fail) => {
          if (isURL.test(url)) {
            wx.request({ url, success, fail });
          } else {
            try {
              const fs = wx.getFileSystemManager();
              const content = fs.readFileSync(url);
              if (content instanceof ArrayBuffer) {
                const u8 = new Uint8Array(content);
                const text = String.fromCharCode(...u8);
                success(decodeURIComponent(text));
              } else {
                success(content);
              }
            } catch (e) {
              fail(e);
            }
          }
        });
      }
    });
  },
  browser(url) {
    return window.fetch(url);
  },
  node(url) {
    /* eslint-disable global-require */
    const fs = require("fs");
    /* eslint-enable global-require */
    return Promise.resolve({
      text() {
        return Promise.resolve(fs.readFileSync(url).toString());
      }
    });
  }
};

const requestAnimationFrameFns = {
  wx(callback) {
    return requestAnimationFrame(callback);
  },
  browser(callback) {
    return requestAnimationFrame(callback);
  },
  node(callback) {
    return setTimeout(callback, 17);
  }
};
/* eslint-enable no-undef */

const fetch = fetchFns[env];
const requestAnimationFrameFn = requestAnimationFrameFns[env];

/**
 * Game 类
 * @class
 *
 * @param {Object} canvas DOM对象，或者node.js 下 require('canvas').createCanvas()
 * @param {Function} Image 图片构造函数，浏览器下为 window.Image, node.js 下为 require('canvas').Image
 * @param {Number} width 期望的画布宽度，浏览器下全拼为 document.documentElement.clientWidth
 * @param {Number} height 期望的画布高度，浏览器下全拼为 document.documentElement.clientHeight
 * @param {[Number]} [widthRange] 画布宽度取值范围，不设置则宽度严格等于 width
 * @param {[Number]} [heightRange] 画布高度取值范围，不设置则宽度严格等于 heigth
 */
class Game {
  /** Create a game instance */
  constructor(canvas, Image, width, height, widthRange, heightRange) {
    this.debuggerInfoColor = "#000000";
    this.env = "development"; // 控制游戏是什么模式
    this.platform = {
      env,
      isMobile
    };
    this.fno = 0; // 程序主帧
    this.isPause = false; // 游戏是否暂停
    this.Image = Image; // 图片构造函数，用来加载资源
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    this.drawImgs = {}; // 合成图片绘制参数管理
    this.imgMaps = {}; // 合成图片分片管理器
    this.scene = null; // 当前场景名称
    this.imgMaps = {};
    this.R = {}; // 资源管理器
    this.scenes = {}; // 场景管理器
    this.actors = {}; // 角色管理器
    this.callbacks = new Map(); // 帧事件管理器
    this.wxEvents = {}; // 记录微信event事件函数，因为off的时候需要，否则取消不掉
    if (widthRange) {
      this.w = Math.max(widthRange[0], Math.min(widthRange[1], width));
    } else {
      this.w = width;
    }
    if (heightRange) {
      this.h = Math.max(heightRange[0], Math.min(heightRange[1], height));
    } else {
      this.h = height;
    }
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.eventListeners = [["onclick", "click"]];
    this.reset();
  }

  /**
   * 重置游戏参数, 例如积分
   *
   * @return {void}
   */
  reset() {}

  /**
   * 初始化并开始游戏
   * @param {Array.Object} resources 游戏所需静态资源对象 key => value 格式， key 为资源名称，value为object，格式如下
   * {
   *   type: 'image', // audio, video, image
   *   name: 'name', // 资源名称，预加载后会存入 this.R 方便随时获取
   *   url: 'https://urladress/', // 资源地址
   *   map: 'https://urladress/' // 图片资源对应的定位信息文件, 仅 type = image 有效
   * }
   *
   * @return {void}
   */
  async init(resources) {
    // 约束画布的宽高为屏幕的宽高
    await this.loadResources(resources);
    this.start();
  }

  // 创建角色, 并非游戏全部角色
  // 这里创建的角色一般为多场景共用的单一角色
  // 场景特有的角色一般在场景内创建
  createActors() {}

  // 创建场景
  createScenes() {}

  // 事件执行以及传递
  eventHandler(fnName, event) {
    const { changedTouches, clientX, clientY } = event;
    const x = (changedTouches && changedTouches[0].clientX) || clientX;
    const y = (changedTouches && changedTouches[0].clientY) || clientY;
    if (this.scene.eventHandler) this.scene.eventHandler(fnName, x, y);
  }

  // 添加事件监听
  listenEvent(evt, fnName) {
    if (env === "node") return;
    const listener = this.eventHandler.bind(this, fnName);
    if (env === "wx") {
      const wxEvt = eventsMap.wx[evt];
      wx[wxEvt](listener);
      this.canvas[wxEvt] = listener;
    } else {
      if (isMobile) evt = eventsMap.mobile[evt];
      this.canvas[evt] = listener;
    }
  }

  // 移除事件监听
  removeListenEvent(evt) {
    if (env === "wx") {
      const wxEvt = eventsMap.wx[evt];
      wx[`off${wxEvt.slice(2)}`](this.canvas[wxEvt]);
      this.canvas[wxEvt] = null;
    } else {
      if (isMobile) evt = eventsMap.mobile[evt];
      this.canvas[evt] = null;
    }
  }

  // 开始游戏，游戏资源全部加载完毕后
  start() {
    // 创建公共角色
    this.createActors();

    // 创建场景
    this.createScenes();

    // 进入start场景
    this.enter("start");

    // 事件监听
    if (Array.isArray(this.eventListeners) && this.eventListeners.length) {
      for (const args of this.eventListeners) {
        this.listenEvent(...args);
      }
    }
    this.draw = this.draw.bind(this);

    // 游戏主循环启动
    requestAnimationFrameFn(this.draw);
  }

  draw() {
    requestAnimationFrameFn(this.draw);
    if (this.isPause) return;
    this.fno += 1;
    // 擦除
    this.ctx.clearRect(0, 0, this.w, this.h);
    // 场景更新
    this.scene.update();
    // 场景渲染
    this.scene.render();
    // 输出调试信息
    if (this.env === "development") this.debugg();
    // 事件函数执行
    const handlers = this.callbacks.get(this.fno);
    if (handlers) {
      for (const handler of handlers) handler();
      this.callbacks.delete(this.fno);
    }
  }

  debugg() {
    this.ctx.font = "20px serif";
    this.ctx.fillStyle = this.debuggerInfoColor;
    this.ctx.fillText(`Fno: ${this.fno}`, 5, 20);
    this.ctx.fillText(`Scene: ${this.scene.name}`, 5, 40);
  }

  // 进入某个场景
  enter(name) {
    if (!name) throw Error("场景名不能为空");
    const scene = this.scenes[name];
    if (!scene) throw Error(`不存在此场景 ${name}`);
    this.scene = scene;
    scene.enter();
  }

  // 解析图片map
  // name x y w h 总共五个值
  parseImageMap(img, map) {
    map
      .trim()
      .split("\n")
      .forEach(line => {
        const [name, x, y, w, h] = line.split(" ").map((n, i) => {
          if (i) return parseInt(n, 10);
          return n;
        });
        this.imgMaps[name] = { x, y, w, h };
        this.drawImgs[name] = [img, x, y, w, h, 0, 0, w, h];
      });
  }

  /**
   * 输出错误信息, 在开发模式下
   * @param {string} msg 错误信息
   *
   * @return {void}
   */
  showMessage(msg, stack) {
    this.ctx.save();
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.ctx.fillStyle = "orange";
    this.ctx.font = "12px 宋体";
    const x = 10;
    let y = 16;
    this.ctx.fillText(msg, x, y);
    if (stack) {
      for (const line of stack.split("\n")) {
        y += 16;
        this.ctx.fillText(line, x, y);
      }
    }
    this.ctx.restore();
  }

  /**
   * 显示资源加载 loading 效果
   * @param {Array.URL} resources 游戏所需静态资源url列表
   *
   * @return {void}
   */
  progress(percent) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.strokeStyle = "rgba(255, 55, 20, 1)";
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 150, this.w - 60, 20);
    ctx.fillStyle = "rgba(30, 255, 10, 1)";
    ctx.fillRect(34, 154, Math.max(10, ((this.w - 68) * percent) / 100), 12);
    ctx.textAlign = "center";
    ctx.font = "15px Arial";
    ctx.fillText(`The resources loading... ${percent} %`, this.w / 2, 192);
    this.ctx.restore();
  }

  /**
   * 加载游戏所需静态资源
   * @param {Array.Object} resources 游戏所需静态资源对象 key => value 格式， key 为资源名称，value为object，格式如下
   * {
   *   type: 'image', // audio, video, image
   *   name: 'name', // 资源名称，预加载后会存入 this.R 方便随时获取
   *   url: 'https://urladress/', // 资源地址
   *   map: 'https://urladress/' // 图片资源对应的定位信息文件, 仅 type = image 有效
   * }
   *
   * @return {void}
   */
  async loadResources(resources) {
    const { length } = resources;
    let count = 0; // 记录已完成的数量
    this.progress(0); // 显示 loading 效果
    return new Promise((resolve, reject) => {
      for (const { name, type, url, map, scale } of resources) {
        // TODO 暂时只支持图片类型的预加载
        if (type !== "image") continue;
        const img = new this.Image();
        img.onload = () => {
          this.R[name] = img;
          if (map) {
            fetch(map)
              .then(res => res.text())
              .then(text => {
                this.parseImageMap(img, text);
                count += 1;
                this.progress(((count * 100) / length) | 0);
                if (count === length) resolve();
              })
              .catch(reject);
          } else {
            count += 1;
            let { width: w, height: h } = img;
            if (scale) {
              w *= scale;
              h *= scale;
            }
            this.progress(((count * 100) / length) | 0);
            this.imgMaps[name] = { x: 0, y: 0, w, h };
            this.drawImgs[name] = [
              img,
              0,
              0,
              img.width,
              img.height,
              0,
              0,
              w,
              h
            ];
            if (count === length) resolve();
          }
        };
        img.onerror = e => {
          console.error(e);
          reject(e);
        };
        img.src = url;
      }
    });
  }

  /**
   * 水平居中绘制图片获取图片切片
   * @param {string} name 图片名称
   * @param {number} y 在画布上的y坐标
   *
   * @return {void}
   */
  drawImageAlignCenterByName(name, y, w, h) {
    const args = this.drawImgs[name];
    if (!args) throw Error("图片不存在");
    args[5] = (this.w - args[7]) >> 1;
    args[6] = y;
    if (w) args[7] = w;
    if (h) args[8] = h;
    this.ctx.drawImage(...args);
  }

  /**
   * 绘制图片获取图片切片
   * @param {string} name 图片名称
   * @param {number} x 在画布上的x坐标
   * @param {number} y 在画布上的y坐标
   *
   * @return {void}
   */
  drawImageByNameFullScreen(name) {
    const args = this.drawImgs[name];
    if (!args) throw Error("图片不存在");
    args[5] = 0;
    args[6] = 0;
    args[7] = this.w;
    args[8] = this.h;
    this.ctx.drawImage(...args);
  }

  /**
   * 绘制图片获取图片切片
   * @param {string} name 图片名称
   * @param {number} x 在画布上的x坐标
   * @param {number} y 在画布上的y坐标
   *
   * @return {void}
   */
  drawImageByName(name, x, y, w, h) {
    const args = this.drawImgs[name];
    if (!args) throw Error("图片不存在");
    args[5] = x;
    args[6] = y;
    if (w) args[7] = w;
    if (h) args[8] = h;
    this.ctx.drawImage(...args);
  }

  /**
   * 注册帧回调函数
   * @param {number} frames 多少帧之后
   * @param {function} handler 执行的事件函数
   *
   * @return {void}
   */
  registCallback(frames, handler) {
    const fno = this.fno + frames;
    const handlers = this.callbacks.get(fno) || [];
    if (!handlers.length) this.callbacks.set(fno, handlers);
    handlers.push(handler);
  }
}

Game.Actor = Actor;
Game.Scene = Scene;

module.exports = Game;
