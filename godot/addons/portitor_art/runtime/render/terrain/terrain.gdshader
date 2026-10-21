shader_type canvas_item;
render_mode unshaded;

// Continuous visual_cells/1 only. No simulation IDs, source blocks or wire flags.
uniform sampler2D visual_cells : filter_nearest, repeat_disable;
uniform ivec2 cells_size = ivec2(1);
uniform ivec2 cells_origin = ivec2(0);
uniform ivec4 cells_visible = ivec4(0,0,1,1);
uniform bool particle_recipe = true;
uniform ivec2 grid_size = ivec2(20,10);
uniform bool matter_approved = false;
uniform sampler2D fire_sheet : filter_nearest, repeat_disable;
uniform bool fire_approved = false;
uniform int fire_frame = 0;
uniform int rock_pattern = 0; // brick/block/rough/grass/marble/cloud/panel
uniform bool hazard_trim = false;
uniform int colors[37];
uniform int visual_tick = 0;
uniform int vignette_width = 0;
uniform ivec2 screen_origin = ivec2(0);
uniform bool observe = false;
uniform int background_dim_steps = 0;

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
const int DIM[33] = int[33](0,6,5,22,32,6,7,26,7,8,1,2,11,14,15,16,26,25,17,18,21,22,23,24,25,26,26,8,7,28,29,32,5);
const int BAYER[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
const int PEBBLE[12] = int[12](23,22,23,24,22,23,32,24,22,23,24,22);

uint h32(int x, int y, int seed) {
 uint n = uint(x)*374761393u + uint(y)*668265263u + uint(seed)*2147483647u;
 n = (n ^ (n >> 13u))*1274126177u;
 return n ^ (n >> 16u);
}

ivec2 cell_at(ivec2 p) {
 ivec2 local=p-cells_origin;
 if (local.x<cells_visible.x || local.y<cells_visible.y || local.x>=cells_visible.x+cells_visible.z || local.y>=cells_visible.y+cells_visible.w || local.x<0 || local.y<0 || local.x>=cells_size.x || local.y>=cells_size.y) return ivec2(0);
 return ivec2(round(texelFetch(visual_cells,local,0).rg*255.0));
}
int mat_at(ivec2 p) { return cell_at(p).x; }
int adjacent_class(int m) { return m==15?14:m; }

int block_frame(int c, ivec2 p, ivec4 n, int self, int frame, int bevel) {
 if (frame==0) return c;
 if ((p.x==0 && n.z!=self)||(p.x==15 && n.w!=self)||(p.y==0 && n.x!=self)||(p.y==15 && n.y!=self)) return frame;
 if (bevel!=0 && ((p.x==1 && n.z!=self)||(p.y==1 && n.x!=self))) return bevel;
 return c;
}

bool matter_open(int m) { return m==0 || m==12 || m==13; }
bool matter_liquid(int m) { return m==5 || m==8; }

float puff(ivec2 w, int seed) {
 ivec2 centre=ivec2(floor(vec2(w)/8.0));
 float value=0.0;
 for (int gy=-1; gy<=1; gy++) for (int gx=-1; gx<=1; gx++) {
  ivec2 cell=centre+ivec2(gx,gy);
  uint hash=h32(cell.x,cell.y,seed);
  ivec2 blob=cell*8+ivec2(int(hash&7u),int((hash>>3u)&7u));
  int radius=4+int((hash>>6u)%4u), d2=(w.x-blob.x)*(w.x-blob.x)+(w.y-blob.y)*(w.y-blob.y);
  if (d2<radius*radius) value=max(value,1.0-float(d2)/float(radius*radius));
 }
 return value;
}

// Exact palette/texture rules ported from the confirmed material drawing rules.
int matter_shade(int m, ivec2 w, ivec2 p, ivec4 n) {
 if (m==18) return 0; // Approved device decks are drawn above visual geometry.
 if (!matter_approved) return ((p.x+p.y)%6<3)?27:26;
 int c=0;
 if (m==6) {
  int row=w.y/4, off=(row&1)*3, col=(w.x+off)/5, lx=(w.x+off)%5, ly=w.y&3;
  uint hash=h32(col,row,601);
  bool corner=(lx==0||lx==4)&&(ly==0||ly==3);
  if ((lx==4&&ly!=1&&ly!=2)||(ly==3&&lx!=1&&lx!=2)||corner) {
   if ((matter_open(n.x)||matter_liquid(n.x))&&p.y<3) return 0;
   return (hash&2u)!=0u?25:26;
  }
  int body=PEBBLE[hash%12u]; c=body;
  if (ly==0||(lx==0&&ly==1)) c=body==32?4:body==24?23:21;
  else if (ly==3||(lx==3&&ly==2)) c=body==32?5:24;
  return c;
 }
 if (m==7) {
  c=h32(w.x,w.y,611)%11u==0u?11:((w.x+w.y)&1)!=0?7:6;
  if (p.y>=5&&p.y<=10) {
   int twist=(w.x+(p.y-5)*2)%6;
   c=p.y==5||p.y==10?26:twist<2?2:twist<4?1:8;
   if (p.y==6&&twist==0) c=11;
  }
  return block_frame(c,p,n,7,26,0);
 }
 if (m==8) {
  bool top=n.x!=8&&!matter_liquid(n.x); c=13;
  if (!top||p.y>3) {
   int deep=n.y==8?4:max(0,p.y-9);
   if (BAYER[(w.y&3)*4+(w.x&3)]<deep*2) c=14;
  }
  if (top) {
   int wave=((w.x+(visual_tick>>1))%12)<6?0:1;
   if (p.y<wave) return 0;
   if (p.y==wave) c=12;
   else if (p.y==wave+1&&(w.x+visual_tick)%7==0) c=20;
  }
  int bx=(w.x>>3)*8+3+int(h32(w.x>>3,0,613)&1u);
  int by=15-((visual_tick+int(h32(w.x>>3,1,613)%16u))%16);
  if (!(top&&p.y<3)&&abs((w.x&15)-(bx&15))+abs(p.y-by)==1) c=12;
  return c;
 }
 if (m==9||m==10) {
  bool carved=abs(p.x-8)+abs(p.y-8)==3||(p.x==8&&p.y==8);
  if (m==9) {
   c=3;
   if ((w.y+int(h32(w.x>>3,0,621)%3u))%5==0) c=31;
   if (h32(w.x,w.y,623)%31u==0u) c=4;
   if (carved) c=32;
   return block_frame(c,p,n,9,32,20);
  }
  c=(w.y+int(h32(w.x>>2,1,625)%2u))%4==0?22:21;
  if (carved) c=23;
  return block_frame(c,p,n,10,23,20);
 }
 if (m==11) {
  int col=(w.x+((w.y>>3)&1)*4)&7;
  c=col==0?23:col==7?26:24;
  if (h32(w.x,w.y,631)%37u==0u) c=22;
  return block_frame(c,p,n,11,26,23);
 }
 if (m==12||m==13) {
  float value=puff(m==12?w+ivec2(0,visual_tick):w+ivec2(visual_tick>>1,0),m==12?641:643);
  int b=BAYER[(w.y&3)*4+(w.x&3)];
  if (m==12) {
   if (value*12.0>float(b+6)) return value>0.8?20:21;
   return b<2&&value>0.0?22:0;
  }
  if (value*16.0>float(b+4)) return value>0.6?29:28;
  return b<3?28:0;
 }
 if (m==14||m==15) {
  int cx=(w.x>>2)*4+1+int(h32(w.x>>2,w.y>>2,651)&1u);
  int cy=(w.y>>2)*4+1+int(h32(w.x>>2,w.y>>2,653)&1u); c=29;
  if (h32(w.x>>2,w.y>>2,655)%3u==0u&&abs(w.x-cx)+abs(w.y-cy)<=1) c=w.x==cx&&w.y==cy?31:30;
  return block_frame(c,p,n,14,28,30);
 }
 if (m==16) {
  int lx=w.x&3, stake=w.x>>2;
  c=(h32(stake,0,661)&1u)!=0u?5:2;
  if (lx==3) c=6; else if (lx==0) c=32;
  else if (lx==2&&h32(stake,w.y>>1,663)%5u==0u) c=6;
  if (p.y==4||p.y==11) c=(p.x&7)==2?7:6;
  if (p.y==3||p.y==10) c=32;
  if (matter_open(n.x)||matter_liquid(n.x)) {
   if (p.y==0&&lx!=1&&lx!=2) return 0;
   if (p.y==0) c=4;
  }
  if ((p.x==0&&n.z!=16)||(p.x==15&&n.w!=16)) c=7;
  return c;
 }
 if (m==17) {
  c=p.y<3&&n.x!=17?19:18;
  int glint=(w.x-w.y+64)&15;
  if (glint<2&&((w.x+w.y)&15)<6&&p.x>1&&p.y>1) c=glint!=0?19:20;
  if (h32(w.x,w.y,671)%53u==0u) c=21;
  return block_frame(c,p,n,17,17,20);
 }
 return 0;
}

bool crack(ivec2 tile, int px, int py) {
 if (px<0 || px>15) return false;
 uint a=h32(tile.x,tile.y,91);
 int x0=3+int(a%6u), x1=6+int((a>>4u)%6u), x2=4+int((a>>8u)%8u);
 if (py>=0 && py<=8 && px==int(floor(float(x0)+float((x1-x0)*py)/8.0+0.5))) return true;
 if (py>=8 && py<=15 && px==int(floor(float(x1)+float((x2-x1)*(py-8))/7.0+0.5))) return true;
 return py>=8 && py<=11 && px==x1+(((a>>12u)%2u)!=0u?1:-1)*(py-8);
}

bool empty_cloud(int m) { return m==0 || m==5; }
int cloud(ivec2 w, ivec2 p, ivec4 n) {
 bool u=n.x==0, d=n.y==0, l=n.z==0, r=n.w==0;
 if ((u&&l&&p.x+p.y<4)||(u&&r&&15-p.x+p.y<4)||(d&&l&&p.x+15-p.y<4)||(d&&r&&30-p.x-p.y<4)) return 0;
 int top=int(h32(w.x>>2,0,33)%2u), bottom=1+int(h32(w.x>>2,1,33)%3u);
 if (empty_cloud(n.x)&&p.y<top) return 0;
 if (empty_cloud(n.y)&&p.y>15-bottom) return 0;
 if (empty_cloud(n.z)&&p.x<int(h32(0,w.y>>2,35)%2u)) return 0;
 if (empty_cloud(n.w)&&p.x>15-int(h32(1,w.y>>2,35)%2u)) return 0;
 int c=colors[0], layer=w.y>>3, scallop=6-int(h32(w.x>>2,layer,39)%3u);
 if ((w.y&7)>=scallop && (w.y&7)<=scallop+1 && h32(w.x>>3,layer,41)%4u!=0u) c=colors[1];
 if (empty_cloud(n.y)) { int from_bottom=15-bottom-p.y; if (from_bottom<=0) c=colors[6]; else if (from_bottom<=3) c=colors[1]; }
 if (empty_cloud(n.w)&&p.x>=14) c=c==colors[6]?colors[6]:colors[1];
 if (empty_cloud(n.x)&&p.y==top) c=colors[4];
 return c;
}

// terrain-diyu.js: wild natural ground. Existing patterns use their original path.
uniform int wild_colors[8]; // grass[3], stone[3], root, soil
const int WILD_WIGGLE[12] = int[12](0,0,1,1,1,0,-1,-1,0,0,1,0);

int wild_noise(int x, int y, int cw, int ch, int seed) {
 int gx=int(floor(float(x)/float(cw))), gy=int(floor(float(y)/float(ch)));
 int fx=x-gx*cw, fy=y-gy*ch;
 int a=int(h32(gx,gy,seed)&255u), b=int(h32(gx+1,gy,seed)&255u);
 int c=int(h32(gx,gy+1,seed)&255u), d=int(h32(gx+1,gy+1,seed)&255u);
 return ((a*(cw-fx)+b*fx)*(ch-fy)+(c*(cw-fx)+d*fx)*fy)/(cw*ch);
}
int wild_at(ivec2 p) {
 ivec2 limit=cells_size+cells_origin;
 if (p.x<cells_origin.x||p.y<cells_origin.y||p.x>=limit.x||p.y>=limit.y) return 1;
 return mat_at(p);
}
bool wild_ellipse(ivec2 d, ivec2 r) {
 return d.x*d.x*r.y*r.y+d.y*d.y*r.x*r.x<=r.x*r.x*r.y*r.y;
}
ivec4 wild_stone(ivec2 w) {
 ivec2 grid=w>>3;
 for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++) {
  ivec2 cell=grid+ivec2(i,j); uint hs=h32(cell.x,cell.y,631);
  if (hs%100u>=24u) continue;
  int rx=2+int((hs>>16u)%3u), ry=rx>3?2:1+int((hs>>19u)&1u);
  ivec2 centre=cell*8+ivec2(2+int((hs>>8u)%4u),2+int((hs>>12u)%4u));
  if (wild_ellipse(w-centre,ivec2(rx,ry))) return ivec4(centre,rx,ry);
 }
 return ivec4(0);
}
bool wild_root(ivec2 tile, ivec2 p) {
 uint hr=h32(tile.x,tile.y,641);
 for (int i=0;i<int(hr%3u);i++) {
  int rx=2+int((hr>>uint(3+i*9))%12u), len=3+int((hr>>uint(7+i*9))%7u);
  if (p.y>=2&&p.y-2<len&&p.x==rx+WILD_WIGGLE[(p.y-2+i*5)%12]) return true;
 }
 return false;
}
int wild_rock(ivec2 w, ivec2 p, ivec4 n) {
 bool grassy=n.x==0, ol=n.z==0, oright=n.w==0, od=n.y==0;
 bool open_up=grassy||n.x==4||n.x==5;
 if (ol&&((grassy&&p.x+p.y<2)||(od&&p.x+15-p.y<2))) return 0;
 if (oright&&((grassy&&15-p.x+p.y<2)||(od&&30-p.x-p.y<2))) return 0;
 int b=BAYER[(w.y&3)*4+(w.x&3)]<<1;
 int c=wild_noise(w.x,w.y,16,6,621)+b>160?colors[1]:colors[0];
 if (wild_colors[7]!=0&&wild_noise(w.x+5,w.y,20,7,622)+b>236) c=wild_colors[7];
 if (h32(w.x,w.y,623)%53u==0u) c=colors[3];
 ivec4 stone=wild_stone(w);
 if (stone.z>0) {
  bool under=!wild_ellipse(w+ivec2(0,1)-stone.xy,stone.zw)||(!wild_ellipse(w+ivec2(1,0)-stone.xy,stone.zw)&&w.y>stone.y);
  bool top=stone.z>2&&!wild_ellipse(w+ivec2(0,-1)-stone.xy,stone.zw)&&!wild_ellipse(w+ivec2(1,-1)-stone.xy,stone.zw);
  c=wild_colors[under?5:top?4:3];
 }
 if (grassy&&wild_root(w/16,p)) c=wild_colors[6];
 if (open_up) {
  if (!grassy) { if (p.y==0) c=colors[4]; }
  else if (p.y==0) c=wild_colors[h32(w.x,w.y,651)%4u==0u?1:0];
  else if (p.y==1) c=wild_colors[h32(w.x,w.y,652)%3u==0u?0:2];
  else if (p.y==2&&h32(w.x,w.y,653)%3u==0u) c=wild_colors[2];
 }
 if (od&&(p.y==15||(p.y==14&&h32(w.x,w.y,661)%3u==0u))) c=colors[6];
 bool side=p.y>=(grassy?2:1)&&p.y<=(od?13:15);
 int x0=w.x-p.x;
 bool bite_l=side&&ol&&h32(x0,w.y>>1,671)%5u==0u;
 bool bite_r=side&&oright&&h32(x0+15,w.y>>1,671)%5u==0u;
 if (p.x==0&&side&&ol) c=bite_l?0:colors[7];
 else if (p.x==15&&side&&oright) c=bite_r?0:colors[7];
 else if ((p.x==1&&side&&ol&&(bite_l||h32(w.x,w.y>>1,672)%4u==0u))||(p.x==14&&side&&oright&&(bite_r||h32(w.x,w.y>>1,672)%4u==0u))) c=colors[7];
 return c;
}
// Grass/roots extend into an empty neighbouring cell. Sample their source tile,
// preserving the workbench's left-to-right tile/column paint order.
int wild_fringe(ivec2 w, ivec2 p) {
 int c=0;
 if (p.y>=13) for (int source=w.x-1;source<=w.x+1;source++) {
  ivec2 tile=ivec2(int(floor(float(source)/16.0)),w.y/16+1);
  ivec2 centre=tile*16+ivec2(8);
  if (wild_at(centre)!=1||wild_at(centre-ivec2(0,16))!=0) continue;
  int local=source-tile.x*16, k=16-p.y;
  bool ol=wild_at(centre-ivec2(16,0))==0, oright=wild_at(centre+ivec2(16,0))==0;
  if (local<(ol?2:0)||local>=(oright?14:16)) continue;
  int clump=wild_noise(source,tile.y,6,1,655); if (clump<100) continue;
  uint hb=h32(source,tile.y,656);
  int height=clump<150?1:1+int(hb%3u);
  if ((hb>>4u)%3u==0u) height=max(0,height-2);
  int bend=k==3&&local>0&&local<15?((hb>>6u)&1u)!=0u?1:-1:0;
  if (k<=height&&source+bend==w.x) c=wild_colors[k==height?1:0];
 }
 if (p.y<=3) for (int source=w.x-1;source<=w.x;source++) {
  ivec2 tile=ivec2(int(floor(float(source)/16.0)),w.y/16-1);
  ivec2 centre=tile*16+ivec2(8);
  if (wild_at(centre)!=1||wild_at(centre+ivec2(0,16))!=0) continue;
  int local=source-tile.x*16;
  bool ol=wild_at(centre-ivec2(16,0))==0, oright=wild_at(centre+ivec2(16,0))==0;
  if (local<(ol?2:0)||local>=(oright?14:16)) continue;
  uint hr=h32(source,tile.y,662); if (hr%13u!=0u) continue;
  if (p.y<1+int((hr>>5u)%4u)&&source+(p.y==3&&local<15?1:0)==w.x) c=wild_colors[6];
 }
 return c;
}

int rock(ivec2 w, ivec2 p, ivec4 n, uint hash) {
 if (rock_pattern==7) return wild_rock(w,p,n);
 bool open_up=n.x==0 || n.x==5 || n.x==4;
 bool seam=false;
 int c=colors[0];
 if (rock_pattern==1) {
  int row=w.y/8, off=(row&1)*8, col=(w.x+off)/16;
  seam=w.y%8==7 || (w.x+off)%16==15;
  c=seam?colors[2]:colors[h32(col,row,7)%3u==0u?1:0];
  int gx=(w.x+off)%16, gy=w.y%8;
  if (!seam && h32(col,row,9)%5u==0u && gy>=2&&gy<=4 && (gx==5||gx==9||(gy==3&&gx>5&&gx<9))) c=colors[2];
  if (!seam && hash%37u==0u) c=colors[3];
 } else if (rock_pattern==2) {
  int band=(w.y+int(h32(w.x>>3,0,11)%4u))>>2;
  c=colors[h32(w.x>>4,band,13)%3u==0u?1:0];
  if (h32(w.x>>2,band,17)%11u==0u && (w.y&3)==0) c=colors[2];
  if (hash%97u==0u) c=colors[3];
 } else if (rock_pattern==3) {
  c=colors[h32(w.x>>1,w.y>>2,13)%4u==0u?1:0];
  if (h32(w.x,w.y>>1,19)%23u==0u) c=colors[2];
  if (hash%41u==0u) c=colors[3];
 } else if (rock_pattern==4) {
  int row=w.y>>3, col=(w.x+(row&1)*8)>>4;
  c=colors[0];
  if ((w.y&7)==7 || ((w.x+(row&1)*8)&15)==15) c=colors[1];
  else if (h32(col,row,15)%3u==0u && (w.x+w.y*2+int(h32(col,row,16)%9u))%17==0) c=colors[2];
 } else if (rock_pattern==5) {
  return cloud(w,p,n);
 } else if (rock_pattern==6) {
  seam=p.x==0||p.x==15||p.y==0||p.y==15;
  c=seam?colors[2]:colors[p.y<8?0:1];
  if ((p.x==2||p.x==13)&&(p.y==2||p.y==13)) c=colors[3];
  if (!seam&&p.x>3&&p.x<12&&p.y==7) c=colors[2];
 } else {
  int row=w.y/6, off=(row&1)*5, col=(w.x+off)/10;
  seam=w.y%6==5||(w.x+off)%10==9;
  c=seam?colors[2]:colors[h32(col,row,7)%4u==0u?1:0];
  if (!seam&&hash%29u==0u) c=colors[3];
 }
 if (open_up) {
  if (rock_pattern==3) {
   int blade=int(h32(w.x,0,21)%4u);
   if (p.y==0) c=blade==0?colors[5]:colors[8];
   else if (p.y==1) c=colors[8];
   else if (p.y==2 && blade<2) c=colors[5];
   else if (p.y==3 && blade==0) c=colors[5];
  } else if (rock_pattern==6) {
   if (hazard_trim) { if (p.y<=2) c=(((w.x+p.y)>>2)&1)!=0?colors[8]:26; }
   else if (p.y==0) c=colors[4]; else if (p.y==1) c=(w.x&7)==3?colors[8]:colors[5];
  } else if (rock_pattern==4||rock_pattern==1) {
   if (p.y==0) c=colors[8]; else if (p.y==1) c=colors[4];
  } else if (rock_pattern==2) {
   if (p.y==0) c=h32(w.x,1,23)%3u!=0u?colors[8]:colors[4];
   else if (p.y==1 && h32(w.x,1,23)%3u==0u) c=colors[8];
  } else {
   if (p.y==0) c=colors[4]; else if (p.y==1&&!seam) c=colors[5];
  }
 }
 if (n.y==0) {
  if (rock_pattern==4 && colors[9]!=0) { int bump=13-int(h32(w.x>>2,0,29)%3u); if (p.y>=bump) c=p.y==15?colors[6]:colors[9]; }
  else if (rock_pattern==2) { if (p.y==15 || (p.y==14&&h32(w.x,2,31)%4u==0u)) c=colors[6]; }
  else if (p.y==15) c=colors[6];
 }
 if ((p.x==0&&n.z==0&&p.y>0)||(p.x==15&&n.w==0&&p.y>0)) c=colors[7];
 return c;
}

int shade(int m, ivec2 w, ivec2 p, ivec2 tile, ivec4 n) {
 if (m>=6) return matter_shade(m,w,p,n);
 int seed=m==1?11:m==2?23:m==3?37:m==4?41:53;
 uint hash=h32(w.x,w.y,seed);
 if (m==1) return rock(w,p,n,hash);
 if (m==3) {
  int c=colors[10+(((hash>>3u)%5u==0u)?1:0)];
  if (h32(w.x>>2,w.y>>2,5)%9u==0u) c=colors[12];
  if (hash%37u==0u) c=colors[13]; else if (h32(w.x,w.y-1,seed)%37u==0u) c=colors[14];
  if (n.x!=3&&n.x!=1) { if (p.y==0) c=colors[15]; else if(p.y==1&&hash%3u!=0u) c=colors[16]; }
  if (p.y==15&&n.y==0) c=colors[17];
  if ((p.x==0&&n.z==0)||(p.x==15&&n.w==0)) c=colors[17];
  return block_frame(c,p,n,3,colors[18],colors[19]);
 }
 if (m==2) {
  int c=colors[20+(hash%7u==0u?1:0)];
  if(crack(tile,p.x,p.y)) c=colors[22]; else if(crack(tile,p.x-1,p.y)) c=colors[23];
  if(p.y==0&&n.x==0) c=colors[24];
  if(p.y==15&&n.y==0) c=colors[25];
  return block_frame(c,p,n,2,colors[26],colors[27]);
 }
 if (m==4) {
  int variant=particle_recipe?(cell_at(w).y%4):int(hash%3u);
  int c=colors[28+variant%3];
  if (!particle_recipe&&hash%17u==0u) c=colors[31];
  if (particle_recipe ? mat_at(w+ivec2(0,-1))!=4 : p.y==0&&n.x!=4) c=colors[32];
  return c;
 }
 if (m==5) {
  if (particle_recipe) {
   int above=mat_at(w+ivec2(0,-1));
   if (above!=5&&above!=4) return colors[35];
   return (cell_at(w).y%4)==3?colors[36]:(cell_at(w).y%4)==0?colors[34]:colors[33];
  }
  int c=p.y<4&&n.x==5?colors[33]:p.y<6?colors[34]:colors[33];
  if(n.x!=5&&n.x!=4) {
   if(p.y==0) c=colors[35];
   else if(p.y==1&&((w.x+visual_tick)%7==0||(w.x+visual_tick*2)%11==0)) c=colors[36];
   else if(p.y<4) c=colors[34];
  }
  if(n.x==5&&h32(w.x,w.y,3+(visual_tick>>1))%97u==0u) c=colors[36];
  return c;
 }
 return 0;
}

void fragment() {
 ivec2 w=ivec2(floor(UV*vec2(grid_size*16)));
 ivec2 tile=w/16, p=w%16;
 ivec2 middle=tile*16+ivec2(8);
 ivec4 n=ivec4(adjacent_class(mat_at(middle+ivec2(0,-16))),adjacent_class(mat_at(middle+ivec2(0,16))),adjacent_class(mat_at(middle+ivec2(-16,0))),adjacent_class(mat_at(middle+ivec2(16,0))));
 if (rock_pattern==7) n=ivec4(adjacent_class(wild_at(middle+ivec2(0,-16))),adjacent_class(wild_at(middle+ivec2(0,16))),adjacent_class(wild_at(middle+ivec2(-16,0))),adjacent_class(wild_at(middle+ivec2(16,0))));
 int c=shade(mat_at(w),w,p,tile,n);
 if (rock_pattern==7&&mat_at(w)==0) { int fringe=wild_fringe(w,p); if (fringe!=0) c=fringe; }
 // G=4..7 is a public visual overlay enum, including class zero.
 if (cell_at(w).y>=4 && fire_approved) {
  vec4 flame=texelFetch(fire_sheet,ivec2(fire_frame*16+p.x,p.y),0);
  if (flame.a>0.5) for (int i=1; i<33; i++) if (length(flame.rgb-PAL[i].rgb)<0.001) c=i;
 }
 ivec2 screen=w+screen_origin;
 int distance=min(min(screen.x,screen.y-20),min(319-screen.x,179-screen.y));
 if(c!=0 && vignette_width>0 && screen.y>=20 && distance<vignette_width && BAYER[(screen.y&3)*4+(screen.x&3)]*vignette_width>=distance*16) c=DIM[c];
 if(c!=0&&observe) c=DIM[c];
 for (int step=0; step<background_dim_steps; step++) c=DIM[c];
 COLOR=PAL[c];
}
