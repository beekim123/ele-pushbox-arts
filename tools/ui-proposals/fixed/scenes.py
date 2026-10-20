"""Backdrops for the fixed-screen proposals (built from read-only reference renders)."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
from kit import *
import bg as _bg

def level(name):
    c = load_ref('level.' + name)
    c.rect(0, 0, 320, 20, 'z')
    return c

def level_done():
    """M05 end state: crate in the plate pit, door open, Portitor at the flag (win pose)."""
    c = level('M05')
    src = load_ref('level.M05')
    copy_from(c, src, 152, 100, 16, 16, 128, 100)      # erase crate (brick period 24)
    copy_from(c, src, 144, 98, 16, 18, 96, 98)         # erase Portitor
    # door: open frame (mech.door frame 4) + link symbol, wall shows through
    copy_from(c, src, 144, 100, 16, 16, 192, 100)
    c.blit(sprite('mech.door', 4), 192, 100)
    c.blit(sprite('mech.link_symbol', 0), 197, 101)
    c.blit(sprite('obj.crate_wood'), 160, 116)
    f = sprite('char.portitor', 19)
    c.blit(f, 212, 100)
    return c

def room():
    c = load_ref('delivery_hud.zh-Hans')
    c.rect(0, 0, 320, 20, 'z')
    return c

def lobby(theme, with_props=True):
    c = Canvas()
    if not with_props:
        keep = _bg.props
        _bg.props = lambda *a, **k: None
        try: draw_bg(c, theme)
        finally: _bg.props = keep
    else: draw_bg(c, theme)
    return c
