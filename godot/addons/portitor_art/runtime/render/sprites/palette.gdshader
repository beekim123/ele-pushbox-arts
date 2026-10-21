// Source: game/presentation/render/sprites/palette.gdshader.
// Embedded palette/remap values are retained; section license inventory follows in T7.
shader_type canvas_item;
render_mode unshaded;
uniform int vignette_width = 0;
uniform int background_dim_steps = 0;
const int DIM[33] = int[33](0,6,5,22,32,6,7,26,7,8,1,2,11,14,15,16,26,25,17,18,21,22,23,24,25,26,26,8,7,28,29,32,5);
const int BAYER[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
// R8 indices from PortitorArtPaletteRaster. Index zero is transparent even though R8's
// implicit alpha is one; decoding here preserves exact opaque palette colours.
const vec4 PAL[33] = vec4[33](
 vec4(0.0), vec4(190,74,47,255)/255.0, vec4(215,118,67,255)/255.0,
 vec4(234,212,170,255)/255.0, vec4(228,166,114,255)/255.0,
 vec4(184,111,80,255)/255.0, vec4(115,62,57,255)/255.0, vec4(62,39,49,255)/255.0,
 vec4(162,38,51,255)/255.0, vec4(228,59,68,255)/255.0, vec4(247,118,34,255)/255.0,
 vec4(254,174,52,255)/255.0, vec4(254,231,97,255)/255.0, vec4(99,199,77,255)/255.0,
 vec4(62,137,72,255)/255.0, vec4(38,92,66,255)/255.0, vec4(25,60,62,255)/255.0,
 vec4(18,78,137,255)/255.0, vec4(0,153,219,255)/255.0, vec4(44,232,245,255)/255.0,
 vec4(255,255,255,255)/255.0, vec4(192,203,220,255)/255.0,
 vec4(139,155,180,255)/255.0, vec4(90,105,136,255)/255.0,
 vec4(58,68,102,255)/255.0, vec4(38,43,68,255)/255.0, vec4(24,20,37,255)/255.0,
 vec4(255,0,68,255)/255.0, vec4(104,56,108,255)/255.0,
 vec4(181,80,136,255)/255.0, vec4(246,117,122,255)/255.0,
 vec4(232,183,150,255)/255.0, vec4(194,133,105,255)/255.0);

void fragment() {
 int index=int(round(texture(TEXTURE,UV).r*255.0));
 ivec2 p=ivec2(floor(UV/TEXTURE_PIXEL_SIZE));
 int distance=min(min(p.x,p.y-20),min(319-p.x,179-p.y));
 if (index!=0 && vignette_width>0 && p.y>=20 && distance<vignette_width && BAYER[(p.y&3)*4+(p.x&3)]*vignette_width>=distance*16) index=DIM[index];
 for (int step=0; step<background_dim_steps; step++) index=DIM[index];
 COLOR=PAL[clamp(index,0,32)];
}
