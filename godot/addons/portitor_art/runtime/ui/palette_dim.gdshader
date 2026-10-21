shader_type canvas_item;
render_mode unshaded;

// ui.js card.remap(..., PB.DIM): exact palette replacements, no grey blend.
uniform int dim_steps = 1;
varying vec4 item_color;
const int DIM[33] = int[33](0,6,5,22,32,6,7,26,7,8,1,2,11,14,15,16,26,25,17,18,21,22,23,24,25,26,26,8,7,28,29,32,5);
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

void vertex() { item_color = COLOR; }

void fragment() {
 vec4 pixel = texture(TEXTURE, UV) * item_color;
 ivec3 rgb = ivec3(round(pixel.rgb * 255.0));
 int index = -1;
 for (int i=1; i<33; i++) {
  if (all(equal(rgb, ivec3(round(PAL[i].rgb * 255.0))))) { index=i; break; }
 }
 if (index>=0 && pixel.a>0.0) {
  for (int step=0; step<dim_steps; step++) index=DIM[index];
  pixel.rgb=PAL[index].rgb;
 }
 COLOR=pixel;
}
