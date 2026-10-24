# -*- coding: utf-8 -*-
"""生成计科创新中心小程序 tabBar 图标（81x81 PNG）"""
import os
from PIL import Image, ImageDraw

BASE = r"E:\移通工作\26-27上\微信小程序-三纲\demo\jk\miniprogram\assets\icons"
S = 4           # 超采样倍数
SIZE = 81
C_NORMAL = (157, 152, 142, 255)   # 莫兰迪暖灰（未选中）
C_ACTIVE = (107, 140, 163, 255)   # 莫兰迪雾蓝（选中）

os.makedirs(BASE, exist_ok=True)


def new_canvas():
    img = Image.new("RGBA", (SIZE * S, SIZE * S), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def finish(img, name):
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    img.save(os.path.join(BASE, name), "PNG")
    print("saved", name)


def sc(v):
    return v * S


def draw_home(d, color):
    w = sc(3)
    # 屋顶三角
    d.polygon([(sc(40), sc(16)), (sc(13), sc(38)), (sc(67), sc(38))],
              outline=color, fill=None, width=w)
    # 屋身
    d.rounded_rectangle([sc(20), sc(38), sc(60), sc(66)], radius=sc(2),
                        outline=color, width=w)
    # 门
    d.rounded_rectangle([sc(34), sc(48), sc(46), sc(66)], radius=sc(1),
                        outline=color, width=w)


def draw_learn(d, color):
    w = sc(3)
    # 打开的书：两页
    d.polygon([(sc(40), sc(24)), (sc(14), sc(30)), (sc(14), sc(60)),
               (sc(40), sc(65))], outline=color, width=w)
    d.polygon([(sc(40), sc(24)), (sc(66), sc(30)), (sc(66), sc(60)),
               (sc(40), sc(65))], outline=color, width=w)
    d.line([(sc(40), sc(24)), (sc(40), sc(65))], fill=color, width=w)


def draw_contest(d, color):
    w = sc(3)
    # 奖杯杯身（梯形）
    d.polygon([(sc(26), sc(18)), (sc(54), sc(18)), (sc(50), sc(44)),
               (sc(30), sc(44))], outline=color, width=w)
    # 两侧耳
    d.arc([sc(18), sc(20), sc(34), sc(38)], start=90, end=270, fill=color, width=w)
    d.arc([sc(46), sc(20), sc(62), sc(38)], start=270, end=90, fill=color, width=w)
    # 杯柄与底座
    d.line([(sc(40), sc(44)), (sc(40), sc(56))], fill=color, width=w)
    d.rounded_rectangle([sc(30), sc(56), sc(50), sc(63)], radius=sc(2),
                        outline=color, width=w)
    d.rounded_rectangle([sc(24), sc(63), sc(56), sc(69)], radius=sc(2),
                        outline=color, width=w)


def draw_project(d, color):
    w = sc(3)
    # 文件夹：上沿突出 tab
    d.line([(sc(16), sc(26)), (sc(16), sc(60))], fill=color, width=w)
    d.line([(sc(64), sc(26)), (sc(64), sc(60))], fill=color, width=w)
    d.line([(sc(16), sc(60)), (sc(64), sc(60))], fill=color, width=w)
    # tab 突出与顶边
    d.line([(sc(16), sc(26)), (sc(32), sc(26))], fill=color, width=w)
    d.line([(sc(32), sc(26)), (sc(38), sc(20))], fill=color, width=w)
    d.line([(sc(38), sc(20)), (sc(52), sc(20))], fill=color, width=w)
    d.line([(sc(52), sc(20)), (sc(58), sc(26))], fill=color, width=w)
    d.line([(sc(58), sc(26)), (sc(64), sc(26))], fill=color, width=w)
    # 内容横线（文档示意）
    d.line([(sc(26), sc(42)), (sc(54), sc(42))], fill=color, width=sc(2))
    d.line([(sc(26), sc(50)), (sc(46), sc(50))], fill=color, width=sc(2))


def draw_mine(d, color):
    w = sc(3)
    # 头
    d.ellipse([sc(31), sc(18), sc(49), sc(36)], outline=color, width=w)
    # 肩
    d.arc([sc(18), sc(40), sc(62), sc(74)], start=180, end=360, fill=color, width=w)


ICONS = {
    "home": draw_home,
    "learn": draw_learn,
    "contest": draw_contest,
    "project": draw_project,
    "mine": draw_mine,
}

for key, fn in ICONS.items():
    for suffix, color in (("", C_NORMAL), ("-active", C_ACTIVE)):
        img, d = new_canvas()
        fn(d, color)
        finish(img, f"{key}{suffix}.png")

print("done")
