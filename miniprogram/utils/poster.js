/**
 * 班级邀请卡片（海报）
 *
 * 用途：老师把「班级名 + 邀请码 + 小程序码」拼成一张图片，
 *      用 wx.showShareImageMenu 直接发到班级群，同学长按识别 / 扫码进班。
 *
 * 实现：Canvas 2D（基础库 2.9.0+），页面里需要放一个 canvas 节点：
 *   <canvas type="2d" id="posterCanvas" class="poster-canvas"></canvas>
 */

const CARD_W = 375;
const CARD_H = 520;

/** 兜底拿设备像素比（海报要清晰，按 dpr 放大再导出） */
function getDpr() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    return Math.min(info.pixelRatio || 2, 3);
  } catch (e) {
    return 2;
  }
}

/** 取页面里的 canvas 节点 */
function queryCanvas(page, canvasId) {
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery()
      .in(page)
      .select('#' + canvasId)
      .fields({ node: true, size: true })
      .exec((res) => {
        const node = res && res[0] && res[0].node;
        if (node) resolve(node);
        else reject(new Error('canvas not found'));
      });
  });
}

/** 载入图片（失败返回 null，不阻断绘制） */
function loadImage(canvas, src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = canvas.createImage();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 圆角矩形路径（兼容没有 roundRect 的基础库） */
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/** 按宽度折行，超出 maxLines 用省略号收尾 */
function wrapText(ctx, text, maxWidth, maxLines) {
  const chars = String(text || '').replace(/\s+/g, ' ').split('');
  const lines = [];
  let line = '';
  chars.forEach((ch) => {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const out = lines.slice(0, maxLines);
    const last = out[maxLines - 1];
    out[maxLines - 1] = last.slice(0, Math.max(1, last.length - 1)) + '…';
    return out;
  }
  return lines;
}

/** 居中绘制带字距的文字（邀请码那种要撑开更好看） */
function drawSpacedText(ctx, text, centerX, y, gap) {
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  const chars = String(text || '').split('');
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, chars.length - 1);
  let x = centerX - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + gap;
  });
  ctx.textAlign = prevAlign;
  return total;
}

/**
 * 绘制班级邀请卡片
 * @param {Object} page 当前页面实例（用于 select canvas）
 * @param {Object} opts { canvasId, className, intro, code, qrSrc }
 * @returns {Promise<string>} 生成的本地图片临时路径
 */
async function buildClassCard(page, opts) {
  const o = opts || {};
  const canvas = await queryCanvas(page, o.canvasId || 'posterCanvas');
  const dpr = getDpr();

  canvas.width = CARD_W * dpr;
  canvas.height = CARD_H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // ---- 背景 ----
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, '#F2F4FF');
  bg.addColorStop(1, '#FCFCFF');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // 右上角柔光
  const blob = ctx.createRadialGradient(320, 30, 6, 320, 30, 230);
  blob.addColorStop(0, 'rgba(124, 92, 255, 0.26)');
  blob.addColorStop(1, 'rgba(124, 92, 255, 0)');
  ctx.fillStyle = blob;
  ctx.fillRect(0, 0, CARD_W, 300);

  // 左下角淡蓝光
  const blob2 = ctx.createRadialGradient(40, 500, 6, 40, 500, 200);
  blob2.addColorStop(0, 'rgba(59, 91, 255, 0.14)');
  blob2.addColorStop(1, 'rgba(59, 91, 255, 0)');
  ctx.fillStyle = blob2;
  ctx.fillRect(0, 300, CARD_W, CARD_H - 300);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // ---- 标题区（固定版式，保证不会被长简介挤出画布） ----
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8A8A99';
  ctx.font = '13px sans-serif';
  ctx.fillText('邀请你加入班级', CARD_W / 2, 56);

  ctx.font = 'bold 25px sans-serif';
  const nameLines = wrapText(ctx, o.className || '班级', 300, 2);
  ctx.fillStyle = '#101018';
  if (nameLines.length > 1) {
    ctx.fillText(nameLines[0], CARD_W / 2, 96);
    ctx.fillText(nameLines[1], CARD_W / 2, 128);
  } else {
    ctx.fillText(nameLines[0], CARD_W / 2, 110);
  }

  if (o.intro) {
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#6B6B7A';
    const introLines = wrapText(ctx, o.intro, 300, 1);
    if (introLines.length) ctx.fillText(introLines[0], CARD_W / 2, 156);
  }

  // ---- 白色卡片 ----
  const cardW = 279;
  const cardX = (CARD_W - cardW) / 2;
  const cardY = 176;
  const cardH = 300;

  ctx.save();
  ctx.shadowColor = 'rgba(30, 42, 90, 0.10)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 22);
  ctx.fill();
  ctx.restore();

  // 卡片描边（内高光感）
  ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
  ctx.lineWidth = 1;
  roundRect(ctx, cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1, 22);
  ctx.stroke();

  // ---- 小程序码 ----
  const qrSize = 168;
  const qrX = (CARD_W - qrSize) / 2;
  const qrY = cardY + 26;
  const img = await loadImage(canvas, o.qrSrc);
  if (img) {
    ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
  } else {
    ctx.fillStyle = '#F4F5FA';
    roundRect(ctx, qrX, qrY, qrSize, qrSize, 16);
    ctx.fill();
    ctx.fillStyle = '#9A9AA6';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('用下方邀请码加入', CARD_W / 2, qrY + qrSize / 2 + 4);
  }

  // ---- 邀请码 ----
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9A9AA6';
  ctx.font = '12px sans-serif';
  ctx.fillText('班级邀请码', CARD_W / 2, cardY + 232);

  ctx.fillStyle = '#3B5BFF';
  ctx.font = 'bold 27px sans-serif';
  drawSpacedText(ctx, o.code || '------', CARD_W / 2, cardY + 272, 5);

  // ---- 底部指引 ----
  ctx.fillStyle = '#9A9AA6';
  ctx.font = '11px sans-serif';
  ctx.fillText('小程序 · 我的 → 我的班级 → 加入班级', CARD_W / 2, cardY + cardH + 32);

  // ---- 导出图片 ----
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      destWidth: CARD_W * 2,
      destHeight: CARD_H * 2,
      fileType: 'png',
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(err)
    });
  });
}

/**
 * 把生成好的图片交给微信「分享图片」面板
 * 支持时：直接弹出「发送给朋友」，可选中班级群
 * 不支持时：打开大图预览，长按也能转发
 */
function shareImage(path) {
  if (!path) return Promise.reject(new Error('no image'));
  return new Promise((resolve, reject) => {
    if (typeof wx.showShareImageMenu === 'function') {
      wx.showShareImageMenu({
        path,
        success: resolve,
        fail: () => {
          wx.previewImage({
            urls: [path],
            success: resolve,
            fail: reject
          });
        }
      });
      return;
    }
    wx.previewImage({ urls: [path], success: resolve, fail: reject });
  });
}

module.exports = {
  buildClassCard,
  shareImage
};
