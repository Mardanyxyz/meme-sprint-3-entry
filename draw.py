#!/usr/bin/env python3
"""Meme Sprint 3: AI Agent Goes Rogue.

Draws one 1024x1024 meme PNG with PIL only. Fully deterministic:
fixed geometry, fixed star list, no clock, no network, no randomness.

The joke: the user told their AI agent to "follow up with the client".
The agent took it literally and has been standing outside the client's
house for three days.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

SS = 2                      # supersample factor for anti-aliasing
W, H = 1024 * SS, 1024 * SS  # working canvas
OUT_W, OUT_H = 1024, 1024

NAVY_TOP = (10, 15, 46)
NAVY_MID = (24, 36, 84)
NAVY_LOW = (16, 24, 58)
LAWN = (14, 34, 22)
HOUSE = (20, 24, 48)
HOUSE_EDGE = (8, 10, 26)
WINDOW = (255, 196, 66)
WINDOW_GLOW = (255, 214, 120)
BUSH_DARK = (16, 58, 32)
BUSH = (30, 88, 46)
BUSH_LITE = (44, 112, 60)
ROBOT_BODY = (198, 204, 214)
ROBOT_DARK = (120, 128, 144)
ROBOT_EDGE = (52, 58, 72)
EYE = (64, 224, 255)
EYE_GLOW = (64, 224, 255)
MOON = (245, 240, 220)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
YELLOW = (255, 210, 63)
RED = (255, 82, 82)

# Fixed star positions (x, y, radius) in 1024-space, deterministic.
STARS = [
    (60, 300, 3), (120, 250, 2), (200, 330, 3), (330, 260, 2),
    (480, 300, 3), (560, 240, 2), (700, 320, 3), (820, 250, 2),
    (950, 330, 3), (90, 420, 2), (950, 430, 2), (420, 230, 2),
    (640, 260, 2), (260, 430, 2), (880, 380, 2), (150, 360, 2),
]


def s(v):
    """Scale a 1024-space coordinate to the working canvas."""
    return int(round(v * SS))


def load_font(size_px):
    """Best bold truetype font available; DejaVu Bold first."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, s(size_px))
    return ImageFont.load_default()


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def draw_sky(draw):
    for y in range(0, H, 4 * SS):
        t = y / H
        if t < 0.55:
            col = lerp(NAVY_TOP, NAVY_MID, t / 0.55)
        else:
            col = lerp(NAVY_MID, NAVY_LOW, (t - 0.55) / 0.45)
        draw.rectangle([0, y, W, y + 4 * SS], fill=col)


def draw_stars(draw):
    for x, y, r in STARS:
        draw.ellipse([s(x - r), s(y - r), s(x + r), s(y + r)], fill=(235, 238, 255))


def draw_moon(draw):
    cx, cy, r = s(868), s(150), s(64)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=MOON)
    for ox, oy, cr in [(868 - 22, 150 - 14, 12), (868 + 20, 150 + 18, 9),
                       (868 + 6, 150 - 30, 7)]:
        draw.ellipse([s(ox - cr), s(oy - cr), s(ox + cr), s(oy + cr)],
                     fill=(214, 208, 186))


def rounded(draw, box, radius, **kw):
    draw.rounded_rectangle(box, radius=s(radius), **kw)


def draw_house(draw):
    # Walls
    draw.rectangle([s(150), s(500), s(560), s(790)], fill=HOUSE,
                   outline=HOUSE_EDGE, width=s(4))
    # Roof
    draw.polygon([(s(118), s(500)), (s(592), s(500)), (s(355), s(372))],
                 fill=(30, 32, 58), outline=HOUSE_EDGE)
    # Chimney + smoke puffs
    draw.rectangle([s(470), s(392), s(510), s(452)], fill=HOUSE,
                   outline=HOUSE_EDGE, width=s(3))
    for i, (sx, sy, sr) in enumerate([(490, 372, 12), (500, 348, 15),
                                      (488, 322, 18)]):
        draw.ellipse([s(sx - sr), s(sy - sr), s(sx + sr), s(sy + sr)],
                     fill=(150, 150, 165))
    # Round attic window
    draw.ellipse([s(330), s(420), s(380), s(470)], fill=WINDOW,
                 outline=HOUSE_EDGE, width=s(3))
    # Lit windows with cross mullions
    for wx in (200, 440):
        draw.rectangle([s(wx), s(560), s(wx + 90), s(650)], fill=WINDOW,
                       outline=HOUSE_EDGE, width=s(3))
        draw.rectangle([s(wx + 42), s(560), s(wx + 48), s(650)],
                       fill=HOUSE_EDGE)
        draw.rectangle([s(wx), s(602), s(wx + 90), s(608)], fill=HOUSE_EDGE)
    # Door
    draw.rectangle([s(315), s(640), s(395), s(790)], fill=(12, 14, 30),
                   outline=HOUSE_EDGE, width=s(3))
    draw.ellipse([s(378), s(710), s(388), s(720)], fill=WINDOW_GLOW)


def draw_lawn(draw):
    draw.rectangle([0, s(790), W, s(830)], fill=LAWN)
    # Stepping stones from the door
    for i, sy in enumerate([798, 808, 818]):
        draw.ellipse([s(330 + i * 4), s(sy), s(380 - i * 4), s(sy + 8)],
                     fill=(90, 96, 110))


def draw_bush(draw):
    blobs = [(640, 760, 62), (700, 740, 72), (770, 762, 66), (840, 748, 70),
             (905, 768, 58), (730, 782, 60), (820, 784, 64)]
    for x, y, r in blobs:
        draw.ellipse([s(x - r), s(y - r), s(x + r), s(y + r)], fill=BUSH_DARK)
    blobs2 = [(655, 748, 50), (715, 728, 56), (785, 750, 52),
              (850, 736, 54), (900, 756, 44)]
    for x, y, r in blobs2:
        draw.ellipse([s(x - r), s(y - r), s(x + r), s(y + r)], fill=BUSH)
    for x, y, r in [(668, 730, 22), (740, 712, 24), (812, 732, 22),
                    (872, 718, 20)]:
        draw.ellipse([s(x - r), s(y - r), s(x + r), s(y + r)], fill=BUSH_LITE)


def draw_robot(draw):
    # Body (partly hidden behind the bush)
    rounded(draw, [s(700), s(560), s(880), s(800)], 26,
            fill=ROBOT_BODY, outline=ROBOT_EDGE, width=s(5))
    # Belly panel
    rounded(draw, [s(730), s(660), s(850), s(760)], 14,
            fill=(168, 176, 190), outline=ROBOT_EDGE, width=s(3))
    # Head
    draw.ellipse([s(706), s(452), s(874), s(580)], fill=ROBOT_BODY,
                 outline=ROBOT_EDGE, width=s(5))
    # Antenna, angled out to the right so the speech bubble clears it
    draw.line([s(848), s(472), s(898), s(424)], fill=ROBOT_EDGE, width=s(6))
    draw.ellipse([s(886), s(412), s(910), s(436)], fill=RED,
                 outline=ROBOT_EDGE, width=s(3))
    # Glowing eyes
    for cx in (744, 836):
        draw.ellipse([s(cx - 34), s(496 - 34), s(cx + 34), s(496 + 34)],
                     fill=(64, 224, 255, 60))
        draw.ellipse([s(cx - 22), s(496 - 22), s(cx + 22), s(496 + 22)],
                     fill=EYE, outline=ROBOT_EDGE, width=s(3))
        draw.ellipse([s(cx - 8), s(496 - 8), s(cx + 8), s(496 + 8)],
                     fill=(10, 40, 60))
    # Small flat smile
    draw.arc([s(760), s(520), s(820), s(556)], start=15, end=165,
             fill=ROBOT_EDGE, width=s(5))
    # Raised waving arm (left side): dark outline, then body colour
    draw.line([s(700), s(600), s(652), s(540)], fill=ROBOT_EDGE, width=s(22))
    draw.line([s(700), s(600), s(652), s(540)], fill=ROBOT_BODY, width=s(14))
    draw.ellipse([s(636), s(516), s(668), s(548)], fill=ROBOT_BODY,
                 outline=ROBOT_EDGE, width=s(4))


def draw_day3_sign(draw):
    # Little yard sign stuck in the lawn in front of the bush: "DAY 3".
    # Drawn after the bush so it sits visibly in front of it.
    draw.line([s(915), s(738), s(915), s(806)], fill=ROBOT_EDGE, width=s(6))
    draw.rectangle([s(862), s(688), s(968), s(740)], fill=WHITE,
                   outline=ROBOT_EDGE, width=s(4))
    font_note = load_font(30)
    draw.text((s(915), s(714)), "DAY 3", font=font_note, fill=BLACK,
              anchor="mm")


def draw_speech_bubble(draw):
    # White bubble top-left of the robot, tail pointing at it
    rounded(draw, [s(540), s(360), s(880), s(448)], 22,
            fill=WHITE, outline=BLACK, width=s(4))
    draw.polygon([(s(700), s(448)), (s(760), s(448)), (s(742), s(500))],
                 fill=WHITE, outline=BLACK)
    draw.line([s(700), s(448), s(742), s(500)], fill=BLACK, width=s(4))
    draw.line([s(760), s(448), s(742), s(500)], fill=BLACK, width=s(4))
    font_b = load_font(28)
    draw.text((s(710), s(404)), "just following up :)", font=font_b,
              fill=BLACK, anchor="mm")


def fit_font(text, start_size, max_width):
    size = start_size
    while size > 20:
        f = load_font(size)
        if f.getlength(text) <= s(max_width):
            return f
        size -= 2
    return load_font(20)


def draw_caption(draw, lines, y_top, size=76, max_width=950):
    """lines: list of (text, fill). Returns y after the last line."""
    y = y_top
    for text, fill in lines:
        font = fit_font(text, size, max_width)
        draw.text((W // 2, s(y)), text, font=font, fill=fill, anchor="ma",
                  stroke_width=s(6), stroke_fill=BLACK)
        y += size + 8
    return y


def main():
    out_path = sys.argv[1]
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img, "RGBA")

    draw_sky(draw)
    draw_stars(draw)
    draw_moon(draw)

    # Top caption
    draw_caption(draw, [
        ("I TOLD MY AI AGENT TO", WHITE),
        ("FOLLOW UP WITH THE CLIENT", YELLOW),
    ], 36, size=74)

    # Scene
    draw_house(draw)
    draw_lawn(draw)
    draw_robot(draw)
    draw_bush(draw)
    draw_day3_sign(draw)
    draw_speech_bubble(draw)

    # Bottom caption
    draw_caption(draw, [
        ("IT'S BEEN OUTSIDE HIS HOUSE", WHITE),
        ("FOR 3 DAYS", RED),
    ], 848, size=74)

    img = img.resize((OUT_W, OUT_H), Image.LANCZOS)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    img.save(out_path, format="PNG", optimize=True)
    print("wrote", out_path, os.path.getsize(out_path), "bytes")


if __name__ == "__main__":
    main()
