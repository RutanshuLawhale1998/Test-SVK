const PI = Math.PI;
const clamp = (v,a,b)=>v<a?a:v>b?b:v;
const clamp01 = v=>clamp(v,0,1);
const lerp = (a,b,t)=>a+(b-a)*t;
const smoothstep = (e0,e1,x)=>{ const t=clamp01((x-e0)/(e1-e0)); return t*t*(3-2*t); };

function mulberry(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed>>>15, 1 | seed);
    t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t;
    return ((t ^ t>>>14)>>>0) / 4294967296;
  };
}

/* ---------------- OKLab ---------------- */
const s2l = c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
const l2s = c=>c<=0.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-0.055;
function rgbToLab(r,g,b){
  r=s2l(r/255); g=s2l(g/255); b=s2l(b/255);
  const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b);
  const m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b);
  const s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
  return [0.2104542553*l+0.7936177850*m-0.0040720468*s,
          1.9779984951*l-2.4285922050*m+0.4505937099*s,
          0.0259040371*l+0.7827717662*m-0.8086757660*s];
}
const hexToLab = h=>{ const n=parseInt(h.slice(1),16); return rgbToLab((n>>16)&255,(n>>8)&255,n&255); };
function labToRgb(L,A,B){
  const l=Math.pow(L+0.3963377774*A+0.2158037573*B,3);
  const m=Math.pow(L-0.1055613458*A-0.0638541728*B,3);
  const s=Math.pow(L-0.0894841775*A-1.2914855480*B,3);
  const q=v=>clamp(Math.round(l2s(v)*255),0,255);
  return [q( 4.0767416621*l-3.3077115913*m+0.2309699292*s),
          q(-1.2684380046*l+2.6097574011*m-0.3413193965*s),
          q(-0.0041960863*l-0.7034186147*m+1.7076147010*s)];
}
const rgbStr = a=>`rgb(${a[0]} ${a[1]} ${a[2]})`;
const rgbaStr = (a,al)=>`rgba(${a[0]},${a[1]},${a[2]},${al})`;
const mixLab = (a,b,k)=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)];

/* ================= the figure =================
   A traced silhouette rather than a width-profile, because a profile
   cannot produce an armpit, a crotch or a hand. The outline runs down the
   right side from crown to crotch — head, jaw, neck, shoulder slope, down
   the outside of the arm, round the hand, back up the inside of the arm to
   the armpit, down the flank, over the hip, down the outside of the leg,
   round the foot and back up the inside of the leg — then mirrors.

   Landmarks are placed on canonical proportions: chin .133H, acromion
   .20H, armpit .245H, elbow .365H, wrist .442H, fingertip .468H, crotch
   .500H (the true midpoint of a human figure is the pubis, not the navel),
   knee .727H, ankle .959H. */
const BODY_H = 7400;
const OUTLINE_R = [
  // cranium and jaw
  [   0,   0],[ 128,  38],[ 240, 140],[ 306, 320],[ 326, 466],
  [ 316, 632],[ 282, 772],[ 224, 878],[ 150, 948],[  92, 984],
  // neck
  [ 186,1046],[ 202,1150],[ 208,1224],
  // trapezius into the shoulder
  [ 336,1288],[ 524,1358],[ 702,1438],[ 830,1512],
  // outside of the arm, down to the fingertips
  [ 876,1618],[ 898,1778],[ 910,1978],[ 917,2238],[ 923,2478],
  [ 931,2700],[ 951,2858],[ 947,3038],[ 935,3208],[ 929,3268],
  [ 967,3348],[ 951,3428],[ 905,3460],
  // back up the inside of the arm to the armpit
  [ 871,3400],[ 863,3278],[ 857,3178],[ 851,3018],[ 845,2858],
  [ 839,2700],[ 825,2438],[ 811,2158],[ 795,1928],[ 781,1814],
  // flank, waist, hip
  [ 766,1900],[ 740,2078],[ 688,2288],[ 622,2498],[ 584,2678],
  [ 576,2758],[ 604,2878],[ 666,2978],[ 700,3068],[ 710,3198],
  // outside of the leg, down to the foot
  [ 720,3378],[ 724,3558],[ 698,3758],[ 658,3998],[ 628,4298],
  [ 598,4598],[ 538,4998],[ 488,5238],[ 460,5378],[ 468,5598],
  [ 474,5858],[ 438,6198],[ 384,6558],[ 328,6898],[ 298,7098],
  [ 316,7278],[ 370,7378],
  // sole
  [ 354,7400],[ 152,7400],
  // back up the inside of the leg to the crotch
  [ 144,7298],[ 158,7098],[ 148,6798],[ 140,6498],[ 126,6098],
  [ 122,5858],[ 128,5598],[ 134,5378],[ 122,5098],[ 108,4798],
  [  90,4448],[  68,4098],[  38,3848],
  [   0,3700]
];
// mirror into one closed polygon; crown and crotch are shared, not repeated
const OUTLINE = OUTLINE_R.slice();
for (let i=OUTLINE_R.length-2;i>0;i--) OUTLINE.push([-OUTLINE_R[i][0], OUTLINE_R[i][1]]);

/* Containment is now a point-in-polygon test against that one silhouette,
   instead of a union of a circle, a profile and some capsules. */
function insideBody(x,y){
  let inside = false;
  for (let i=0,j=OUTLINE.length-1;i<OUTLINE.length;j=i++){
    const xi=OUTLINE[i][0], yi=OUTLINE[i][1];
    const xj=OUTLINE[j][0], yj=OUTLINE[j][1];
    if (((yi>y) !== (yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi) + xi)) inside = !inside;
  }
  return inside;
}

/* How far a branch can travel sideways from the midline before leaving the
   body. Marching outward and stopping at the first exit gives the trunk or
   neck width at that height and ignores the arm beyond the gap — which a
   fixed torso table cannot do, since it clamps at the chest and sent the
   neck-level nerve roots hundreds of units into empty space. */
function reachAt(y){
  let x = 0;
  const step = 14;
  while (x < 1300 && insideBody(x+step, y)) x += step;
  return x;
}

// torso half-width, for the ribcage only
const TORSO_W = [[1814,781],[2078,740],[2288,688],[2498,622],[2678,584],[2758,576]];
function torsoHalf(y){
  if (y<=TORSO_W[0][0]) return TORSO_W[0][1];
  if (y>=TORSO_W[TORSO_W.length-1][0]) return TORSO_W[TORSO_W.length-1][1];
  let lo=0,hi=TORSO_W.length-1;
  while (hi-lo>1){ const m=(lo+hi)>>1; if (y<TORSO_W[m][0]) hi=m; else lo=m; }
  const a=TORSO_W[lo], b=TORSO_W[hi];
  return lerp(a[1],b[1],(y-a[0])/(b[0]-a[0]));
}

// limb centre-lines, derived as the midline between the outer and inner edges
const ARM_AXIS = [[830,1560],[864,1900],[884,2300],[886,2700],[894,3020],
                  [897,3268],[900,3430]];
const LEG_AXIS = [[363,3998],[353,4598],[320,5000],[297,5378],[298,5858],
                  [255,6498],[228,7098],[240,7340]];

/* ================= the tract =================
   Points in body units with lumen radius. This can wander upward — the
   ascending colon genuinely does — because the camera is driven separately. */
const TRACT = [
  [   0, 870,  30, 'mukha'],
  [   0, 960,  26, 'mukha'],
  [   0,1100,  24, 'grasanī'],
  [ -10,1400,  24, 'grasanī'],
  [ -20,1750,  25, 'grasanī'],
  [ -32,2050,  26, 'grasanī'],
  [ -52,2230,  32, 'grasanī'],
  [-190,2280,  80, 'āmāśaya'],
  [-280,2380, 116, 'āmāśaya'],
  [-286,2500, 124, 'āmāśaya'],
  [-230,2610, 104, 'āmāśaya'],
  [-110,2660,  72, 'āmāśaya'],
  [  20,2632,  28, 'āmāśaya'],
  [ 150,2700,  28, 'grahaṇī'],
  [ 182,2830,  28, 'grahaṇī'],
  [ 100,2910,  28, 'grahaṇī'],
  [ -40,2890,  26, 'grahaṇī'],
  [-160,2970,  26, 'grahaṇī'],
  [ 105,3030,  25, 'grahaṇī'],
  [-180,3090,  25, 'grahaṇī'],
  [ 140,3150,  24, 'grahaṇī'],
  [-150,3200,  24, 'grahaṇī'],
  [  95,3255,  23, 'grahaṇī'],
  [ -55,3305,  23, 'grahaṇī'],
  [ 120,3355,  24, 'grahaṇī'],
  [ 240,3400,  25, 'grahaṇī'],
  [ 300,3460,  44, 'pakvāśaya'],
  [ 322,3330,  42, 'pakvāśaya'],
  [ 332,3140,  41, 'pakvāśaya'],
  [ 318,2980,  40, 'pakvāśaya'],
  [ 280,2900,  40, 'pakvāśaya'],
  [ 100,2862,  39, 'pakvāśaya'],
  [-130,2878,  39, 'pakvāśaya'],
  [-282,2920,  38, 'pakvāśaya'],
  [-322,3080,  37, 'pakvāśaya'],
  [-330,3260,  36, 'pakvāśaya'],
  [-250,3400,  35, 'pakvāśaya'],
  [-110,3490,  35, 'guda'],
  [   0,3560,  36, 'guda'],
  [   0,3650,  30, 'guda'],
  [   0,3700,  20, 'guda'],
  [   0,3768,  15, 'guda']
];
;

// cumulative arc length, so particles move at a real speed along the path
const ARC = [0];
for (let i=1;i<TRACT.length;i++){
  const a=TRACT[i-1], b=TRACT[i];
  ARC.push(ARC[i-1] + Math.hypot(b[0]-a[0], b[1]-a[1]));
}
const TRACT_LEN = ARC[ARC.length-1];

function tractAt(s){
  s = clamp(s, 0, TRACT_LEN);
  let lo=0, hi=ARC.length-1;
  while (hi-lo > 1){ const m=(lo+hi)>>1; if (s < ARC[m]) hi=m; else lo=m; }
  const seg = ARC[hi]-ARC[lo];
  const k = seg<=0 ? 0 : (s-ARC[lo])/seg;
  const a=TRACT[lo], b=TRACT[hi];
  return { x:lerp(a[0],b[0],k), y:lerp(a[1],b[1],k), r:lerp(a[2],b[2],k),
           organ: k<0.5 ? a[3] : b[3] };
}

/* ---------------- the channel network ----------------
   The nourishing part of the food leaves the gut at the small intestine,
   passes through the liver, then spreads through the body as a branching
   network. Grown procedurally from a seed so it looks like vasculature
   rather than a fan of straight lines, and kept inside the figure. */
const LIVER = { x:300, y:2420, r:130 };
const HRDAYA = { x:-60, y:2050, r:100 };
const ABSORB = [0.44, 0.52, 0.60, 0.68];      // fractions of tract length


/* ---------------- the nervous system ----------------
   Built to the real topology: brain and brainstem, spinal cord ending at
   the conus medullaris around L1, a cauda equina below it, 31 pairs of
   spinal roots at their proper levels, and the four plexuses feeding named
   peripheral nerves down the limbs.

   Note this is the nervous system, drawn because it is the branching map
   people recognise. The channels Ayurveda describes carrying nourishment
   are not nerves; the copy says so. */
const BRAIN = { cx:0, cy:404, rx:266, ry:238 };
const CORD_TOP = 900;
const CONUS = 2620;          // cord ends about here, near L1
const SACRUM = 3300;

/* The cord is not a uniform tube. It has two enlargements — cervical
   (C5-T1, where the arm nerves arise) and lumbosacral (L1-S3, the legs) —
   and those two bulges are the most recognisable thing about it. */
const CORD_W = [
  [ 900, 44],[1080, 40],[1250, 54],[1400, 60],[1520, 56],[1660, 44],
  [1820, 34],[2060, 34],[2200, 46],[2330, 54],[2440, 50],[2540, 32],
  [2620, 13]
];
function cordHalf(y){
  if (y <= CORD_W[0][0]) return CORD_W[0][1];
  if (y >= CORD_W[CORD_W.length-1][0]) return 0;
  let lo=0, hi=CORD_W.length-1;
  while (hi-lo>1){ const m=(lo+hi)>>1; if (y<CORD_W[m][0]) hi=m; else lo=m; }
  const a=CORD_W[lo], b=CORD_W[hi];
  return lerp(a[1], b[1], smoothstep(0,1,(y-a[0])/(b[0]-a[0])));
}

/* Roots leave the cord at an angle that steepens all the way down: nearly
   horizontal in the neck, about 45 degrees in the thorax, nearly vertical at
   the sacrum. Uniform angles are a large part of why a drawn spine reads
   wrong. */
const ROOT_ANGLE = { C:[8,26], T:[32,62], L:[70,78], S:[80,86], Co:[88,88] };

const NET = [];
const NODES = [];

(function layoutNervous(){
  const rng = mulberry(90210);

  function bow(a,b,amount,n){
    const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
    const dx=b[0]-a[0], dy=b[1]-a[1];
    const cx=mx-dy*amount, cy=my+dx*amount;
    const pts=[];
    for (let i=0;i<=n;i++){
      const t=i/n,u=1-t;
      pts.push([u*u*a[0]+2*u*t*cx+t*t*b[0], u*u*a[1]+2*u*t*cy+t*t*b[1]]);
    }
    return pts;
  }
  const contained = pts => {
    for (let i=0;i<pts.length;i++) if (!insideBody(pts[i][0],pts[i][1])) return false;
    return true;
  };
  function safeBow(a,b,amount,n){
    for (let i=0;i<5;i++){
      const p = bow(a,b,amount*Math.pow(0.45,i),n);
      if (contained(p)) return p;
    }
    for (let s=0.85;s>=0.3;s-=0.15){
      const p = bow(a,[lerp(a[0],b[0],s),lerp(a[1],b[1],s)],0,n);
      if (contained(p)) return p;
    }
    return null;
  }
  function add(pts, level, d0, w){
    if (NET.length > 2600) return d0;        // hard cap, just in case
    let len=0; const cum=[0];
    for (let i=1;i<pts.length;i++){
      len += Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
      cum.push(len);
    }
    NET.push({ pts, level, d0, cum, len, w });
    return d0+len;
  }

  /* Peripheral nerves end in a fine mesh, not in tidy single branches.
     This sprouts a fan at a tip and recurses once or twice more, each
     generation shorter and thinner, which is what gives the drawing its
     density without hand-placing hundreds of lines. */
  function sprout(from, baseAng, level, d0, count, len, spread){
    if (level > 4 || len < 26) return;
    for (let i=0;i<count;i++){
      const off = count>1 ? (i-(count-1)/2)*spread : 0;
      const ang = baseAng + off + (rng()-0.5)*0.32;
      const L = len*(0.72+rng()*0.55);
      let to = [from[0]+Math.cos(ang)*L, from[1]+Math.sin(ang)*L];
      let seg = safeBow(from, to, (rng()-0.5)*0.24, 3);
      if (!seg) continue;
      const dEnd = add(seg, level, d0);
      const tip = seg[seg.length-1];
      if (level < 4 && rng() < 0.93)
        sprout(tip, ang, level+1, dEnd, 2 + (rng()<0.6?1:0), L*0.58, 0.52);
    }
  }
  // a run of points, e.g. a named nerve down a limb
  function run(points, level, d0, bowAmt, n, w){
    let d=d0;
    for (let i=1;i<points.length;i++){
      const seg = safeBow(points[i-1], points[i], bowAmt, n||4);
      if (!seg) break;
      d = add(seg, level, d, w);
    }
    return d;
  }
  // distance from the brainstem down the cord to a given level
  const dCord = y => Math.max(0, y - CORD_TOP);

  /* --- spinal cord, conus, cauda equina --- */
  // the cord is rendered as a tapered ribbon from CORD_W, not as a line
  NODES.push([0,CORD_TOP],[0,CONUS]);
  // the cauda equina: loose strands of root continuing below the cord
  for (let i=0;i<9;i++){
    const f = (i-4)/4;
    run([[0,CONUS],[f*60, CONUS+240],[f*118, SACRUM]], 3, dCord(CONUS), f*0.05, 3);
  }

  /* --- 31 pairs of spinal roots at their proper levels --- */
  // 8 cervical, 12 thoracic, 5 lumbar, 5 sacral, 1 coccygeal
  const LEVELS = [];
  for (let i=0;i<8;i++)  LEVELS.push({ y: 960 + i*63,  kind:'C' });
  for (let i=0;i<12;i++) LEVELS.push({ y: 1500 + i*96, kind:'T' });
  /* Lumbar and sacral roots must exit at or below the conus: they arise
     from cord segments higher up and descend as the cauda equina to reach
     their own vertebral levels. Placing them above the conus would make
     the cauda equina pointless. */
  for (let i=0;i<5;i++)  LEVELS.push({ y: 2680 + i*58,  kind:'L' });
  for (let i=0;i<5;i++)  LEVELS.push({ y: 2990 + i*58,  kind:'S' });
  LEVELS.push({ y: 3290, kind:'Co' });

  // index each level within its own group, so the angle can progress
  const groupCount = {};
  LEVELS.forEach(lv => { groupCount[lv.kind] = (groupCount[lv.kind]||0)+1; });
  const groupSeen = {};

  for (const lv of LEVELS){
    const n = groupSeen[lv.kind] = (groupSeen[lv.kind]||0);
    groupSeen[lv.kind]++;
    const span = Math.max(1, groupCount[lv.kind]-1);
    const [a0,a1] = ROOT_ANGLE[lv.kind];
    const angDeg = lerp(a0, a1, n/span);       // steepens down the spine
    const ang = angDeg*PI/180;

    // roots leave the edge of the cord, or the cauda equina below the conus
    const onCord = lv.y <= CONUS;
    const originX = onCord ? cordHalf(lv.y)*0.9
                           : clamp((lv.y-CONUS)/(SACRUM-CONUS),0,1)*58;
    const d0 = dCord(Math.min(lv.y, CONUS));

    for (const side of [-1,1]){
      // walk outward along the angle until the body edge stops us
      let L = lv.kind==='T' ? 620 : (lv.kind==='C' ? 420 : 300);
      let from = [side*originX, lv.y];
      let to;
      for (let g=0; g<10; g++){
        to = [from[0] + side*Math.cos(ang)*L, from[1] + Math.sin(ang)*L];
        if (insideBody(to[0], to[1])) break;
        L *= 0.78;
      }
      const root = safeBow(from, to, side*0.10, 4);
      if (!root) continue;
      const w = lv.kind==='T' ? 9 : 11;
      const d2 = add(root, 2, d0, w);
      const tip = root[root.length-1];
      const prev = root[root.length-2];
      const tAng = Math.atan2(tip[1]-prev[1], tip[0]-prev[0]);
      sprout(tip, tAng, 3, d2, lv.kind==='T' ? 4 : 3,
             lv.kind==='T' ? 180 : 140, 0.58);
    }
  }

  /* --- brachial plexus: roots -> trunks -> divisions -> cords ---
     Drawn as an actual braid. A single converging line is the main reason a
     shoulder reads as a fan of wires instead of a plexus. */
  for (const side of [-1,1]){
    const dPlex = dCord(1270);
    // the five contributing roots, C5 through T1
    const roots = [1250, 1313, 1376, 1439, 1500].map(y => [side*cordHalf(y)*0.9, y]);
    // three trunks: upper (C5-6), middle (C7), lower (C8-T1)
    const trunks = [[side*250,1330],[side*265,1400],[side*280,1470]];
    // divisions converge into three cords behind the clavicle
    const cords  = [[side*430,1400],[side*450,1455],[side*465,1510]];
    const exit   = [side*600, 1520];

    roots.forEach((r,i) => {
      const t = trunks[Math.min(2, i>>1)];
      const seg = safeBow(r, t, side*0.05, 3);
      if (seg) add(seg, 2, dPlex, 12);
    });
    trunks.forEach((t,i) => {
      // each trunk splits, and the splits cross to different cords
      [cords[i], cords[(i+1)%3]].forEach((c,k) => {
        const seg = safeBow(t, c, side*(k? 0.10 : -0.06), 3);
        if (seg) add(seg, 2, dPlex+180, k ? 9 : 11);
      });
      NODES.push(t);
    });
    cords.forEach(c => {
      const seg = safeBow(c, exit, side*0.04, 3);
      if (seg) add(seg, 2, dPlex+380, 13);
      NODES.push(c);
    });
    NODES.push(exit);
    const dArm = dCord(1270) + 660;
    // median, ulnar and radial, offset either side of the limb axis
    const OFFS = [ -34, 44, 92 ];
    for (let n=0;n<OFFS.length;n++){
      const pts = ARM_AXIS.map(p=>[side*(p[0]+OFFS[n]*0.42), p[1]]);
      pts.unshift([side*600,1520]);
      const dEnd = run(pts, 2, dArm, side*0.03, 4, [13,12,11][n]);  // median, ulnar, radial
      // branches leaving the nerve along the limb
      for (let q=2;q<pts.length;q++){
        if (rng()<0.18) continue;
        sprout(pts[q], (side>0?0.5:PI-0.5)+(rng()-0.5)*0.7, 3,
               dArm+q*260, 3, 140, 0.66);
      }
      // the hand: five digital branches, then their fine tips
      const tip = pts[pts.length-1];
      for (let f=0;f<5;f++)
        sprout(tip, PI*0.5 + side*(f-2)*0.20, 3, dEnd, 1, 150, 0);
    }
  }

  /* --- lumbar plexus: femoral nerve down the front of the thigh --- */
  for (const side of [-1,1]){
    const dL = dCord(2560);
    const femoral = [[side*40,2560],[side*180,3120],[side*330,3900],
                     [side*358,4600],[side*330,5200]];
    const dEnd = run(femoral, 2, dL, side*0.05, 4, 17);       // femoral nerve
    for (let q=1;q<femoral.length;q++)
      sprout(femoral[q], PI*0.5 + side*0.55 + (rng()-0.5)*0.5, 3,
             dL+q*520, 2, 165, 0.6);
    sprout(femoral[femoral.length-1], PI*0.5, 3, dEnd, 3, 180, 0.4);
  }

  /* --- sacral plexus: sciatic, then tibial and common peroneal --- */
  for (const side of [-1,1]){
    const dS = dCord(CONUS) + 380;
    const knee = [side*297, 5378];
    /* lumbosacral plexus braid, then the sciatic — the thickest nerve in the
       body, and drawn that way. */
    const lsRoots = [2680,2738,2796,2854,2912,2970].map(y =>
      [side*(y>CONUS ? clamp((y-CONUS)/(SACRUM-CONUS),0,1)*58 : cordHalf(y)*0.9), y]);
    const lsHub = [side*150, 3020];
    lsRoots.forEach(r => { const s2 = safeBow(r, lsHub, side*0.05, 3); if (s2) add(s2, 2, dS-260, 11); });
    NODES.push(lsHub);
    run([lsHub,[side*300,3900],[side*340,4600],knee], 1, dS, side*0.05, 5, 27);
    NODES.push(knee);
    const dKnee = dS + 2400;
    run([knee,[side*280,6300],[side*245,7060]], 2, dKnee, side*0.03, 4, 17); // tibial
    run([knee,[side*350,6100],[side*312,6820]], 2, dKnee, side*0.05, 4, 13); // peroneal
    // the foot, and branches down the calf
    for (let f=0;f<5;f++)
      sprout([side*245,7060], PI*0.5 + side*(f-2)*0.22, 3, dKnee+1500, 1, 95, 0);
    for (const q of [[side*340,4600],[side*280,6300],[side*350,6100]])
      sprout(q, PI*0.5 + side*0.6 + (rng()-0.5)*0.6, 3, dKnee, 2, 150, 0.6);
  }

  /* --- cranial nerves, and the vagus running down to the gut --- */
  for (const side of [-1,1]){
    sprout([side*26,860], side>0 ? -0.5 : PI+0.5, 3, 0, 4, 165, 0.5);
    sprout([side*26,910], side>0 ? 0.45 : PI-0.45, 3, 40, 3, 145, 0.45);
    // the vagus: the one cranial nerve that reaches the stomach
    run([[side*40,920],[side*70,1300],[side*55,1750],[side*30,2130],[-130,2400]],
        2, 40, side*0.04, 4, 8);   // vagus
  }
})();

const NET_MAX_D = NET.reduce((m,b)=>Math.max(m, b.d0+b.len), 1);


/* stages, resolved along the tract by arc fraction */
const STAGES = [
  { at:0.00, sa:'mukha',      en:'the mouth',                   col:'#E0C89A' },
  { at:0.055,sa:'grasanī',    en:'food pipe',                   col:'#CBB894' },
  { at:0.20, sa:'āmāśaya',    en:'stomach · sweet stage',       col:'#8FB8C4' },
  { at:0.36, sa:'grahaṇī',    en:'small intestine · it splits', col:'#FF9A3C' },
  { at:0.62, sa:'pakvāśaya',  en:'large intestine',             col:'#B9A6D8' },
  { at:0.90, sa:'guda',       en:'the way out',                 col:'#A8916E' }
].map(s=>{ s.lab = hexToLab(s.col); return s; });
function stageAtFrac(f){
  let out = STAGES[0];
  for (let i=0;i<STAGES.length;i++) if (f >= STAGES[i].at) out = STAGES[i];
  return out;
}

/* ================= camera =================
   Focus follows the food, low-passed over arc length and then made
   monotonic, so the view never jerks backward when the tract climbs.
   Zoom pulls back at both ends to show the whole figure. */
const CAM_N = 240;
const CAM_FOCUS = new Float64Array(CAM_N+1);
(function buildCamera(){
  const raw = new Float64Array(CAM_N+1);
  for (let i=0;i<=CAM_N;i++) raw[i] = tractAt(i/CAM_N*TRACT_LEN).y;
  const span = Math.round(CAM_N*0.10);
  for (let i=0;i<=CAM_N;i++){
    let sum=0, n=0;
    for (let j=i-span;j<=i+span;j++){
      const k = clamp(j,0,CAM_N);
      sum += raw[k]; n++;
    }
    CAM_FOCUS[i] = sum/n;
  }
  for (let i=1;i<=CAM_N;i++)                  // enforce monotonic descent
    if (CAM_FOCUS[i] < CAM_FOCUS[i-1]) CAM_FOCUS[i] = CAM_FOCUS[i-1];
})();
function focusAt(t){
  const x = clamp01(t)*CAM_N;
  const i = Math.min(CAM_N-1, Math.floor(x));
  const tracked = lerp(CAM_FOCUS[i], CAM_FOCUS[i+1], x-i);
  return lerp(tracked, BODY_CENTRE, pullAt(t));
}
const ZOOM = [[0,7900],[0.10,2600],[0.22,1500],[0.58,1500],[0.72,2050],
              [0.86,1700],[0.94,5200],[1,7900]];
/* At the extremes the camera stops tracking the food and centres the body,
   so "standing back to see whose body this is" is literally true rather
   than merely zoomed out around the mouth. */
const BODY_CENTRE = 3700;
const PULL = [[0,1],[0.10,0],[0.90,0],[1,1]];
function pullAt(t){
  t = clamp01(t);
  let i=1; while (i<PULL.length-1 && t>PULL[i][0]) i++;
  const a=PULL[i-1], b=PULL[i];
  const k = (b[0]-a[0])<=0 ? 0 : smoothstep(0,1,(t-a[0])/(b[0]-a[0]));
  return lerp(a[1], b[1], k);
}
function zoomAt(t){
  t = clamp01(t);
  let i=1; while (i<ZOOM.length-1 && t>ZOOM[i][0]) i++;
  const a=ZOOM[i-1], b=ZOOM[i];
  const k = (b[0]-a[0])<=0 ? 0 : smoothstep(0,1,(t-a[0])/(b[0]-a[0]));
  return lerp(a[1], b[1], k);
}

/* ================= agni ================= */
function agniModel(agni){
  const ama  = clamp01(1-agni)*0.62;
  const burn = clamp01(agni-1)*0.52;
  const yld  = clamp01((1-ama)*(1-burn));
  // what leaves as purīṣa: the inherently unconvertible share plus failures
  const waste = clamp01(0.28 + ama*0.55 + burn*0.10);
  return { ama, burn, yield:yld, waste };
}

/* ================= particles ================= */
const COUNT = 620;
const AMA_LAB = hexToLab('#4A4136');
const RASA_LABS = ['#E8D9B0','#E0A24E','#D96F52','#E4553C','#7E86B8','#8C9A7A'].map(hexToLab);
const OJAS_LAB = hexToLab('#FFF3CF');

function createFlow(canvas){
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return null;
  let w=0,h=0,dpr=1;
  const rng = mulberry(70719);
  const ps = new Array(COUNT);

  function spawn(p, first){
    p.s = first ? rng()*TRACT_LEN : -rng()*260;
    p.off = (rng()*2-1)*0.72;              // lateral position in the lumen
    p.rs = rng();
    p.ph = rng()*PI*2;
    p.sp = 0.72+rng()*0.7;
    p.rasa = (rng()*6)|0;
    p.q = rng();                            // decides āma / burn outcome
    p.abs = rng();                          // decides absorption
    p.bs = 0;                               // progress along the branch
    p.absorbed = false;
    p.absAt = ABSORB[(rng()*ABSORB.length)|0]*TRACT_LEN;
    p.gone = false;
  }
  for (let i=0;i<COUNT;i++){ ps[i]={}; spawn(ps[i], true); }

  function resize(){
    dpr = clamp(window.devicePixelRatio||1,1,2);
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1,Math.round(rect.width));
    h = Math.max(1,Math.round(rect.height));
    canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function failAt(p, M){ return p.q < M.ama ? p.absAt*0.55 : Infinity; }
  function burnAt(p, M){ return p.q > 1-M.burn ? p.absAt*0.8 : Infinity; }

  function step(M, dt, motion){
    if (!motion) return;
    for (let i=0;i<COUNT;i++){
      const p = ps[i];
      if (p.absorbed){
        p.bs += dt*0.55*(0.7+p.rs*0.6);
        if (p.bs >= 1) spawn(p, false);
        continue;
      }
      const stuck = p.s > failAt(p, M);
      // slow: about 110 body-units a second, so the descent is watchable
      p.s += (stuck ? 15 : 110) * p.sp * dt;
      // prasāda leaves the tract; kiṭṭa stays in it
      if (!stuck && p.s > p.absAt && p.abs < (1-M.waste)){
        p.absorbed = true; p.bs = 0;
      }
      if (p.s > TRACT_LEN + 220) spawn(p, false);
    }
  }

  /* ---- projection ---- */
  let cx0=0, cy0=0, sc=1;
  function setCamera(focusY, windowUnits){
    // one scale for both axes, and never so wide that the figure overflows
    sc = Math.min(h/windowUnits, (w*0.94)/2600);
    cx0 = w*0.5; cy0 = focusY;
  }
  const PX = x => cx0 + x*sc;
  const PY = y => h*0.5 + (y-cy0)*sc;


  function drawFigure(st, M){
    const tissue = labToRgb(st.lab[0]*0.30, st.lab[1]*0.45, st.lab[2]*0.45);
    const edge   = labToRgb(st.lab[0], st.lab[1], st.lab[2]);

    // the silhouette, as one closed path
    ctx.beginPath();
    ctx.moveTo(PX(OUTLINE[0][0]), PY(OUTLINE[0][1]));
    for (let i=1;i<OUTLINE.length;i++) ctx.lineTo(PX(OUTLINE[i][0]), PY(OUTLINE[i][1]));
    ctx.closePath();
    ctx.fillStyle = rgbaStr(tissue, 0.30);
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = rgbaStr(edge, 0.20);
    ctx.lineWidth = Math.max(1, 8*sc);
    ctx.stroke();

    // ribcage, following the flank width
    ctx.strokeStyle = rgbaStr(edge, 0.085);
    ctx.lineWidth = Math.max(0.6, 6*sc);
    for (let ry=1700; ry<2620; ry+=150){
      const hw = torsoHalf(ry)*0.86;
      ctx.beginPath();
      ctx.moveTo(PX(-hw), PY(ry));
      ctx.quadraticCurveTo(PX(0), PY(ry+110), PX(hw), PY(ry));
      ctx.stroke();
    }
    // clavicles
    ctx.beginPath();
    ctx.moveTo(PX(-660), PY(1440));
    ctx.quadraticCurveTo(PX(0), PY(1530), PX(660), PY(1440));
    ctx.stroke();
    // pelvic brim
    ctx.beginPath();
    ctx.moveTo(PX(-560), PY(2980));
    ctx.quadraticCurveTo(PX(0), PY(3320), PX(560), PY(2980));
    ctx.stroke();
  }

  /* The flow is shown by colour moving along the lines, not by dots
     travelling them. Each segment knows its distance from the liver, so a
     slow band of brighter colour sweeps outward through the whole network
     at once — and the colour shifts from warm near the gut to pale at the
     far tips, which is the direction the transformation runs. */
  const LEVEL_W = { 1:27, 2:13, 3:6, 4:3 };
  const MAX_LEVEL = 4;
  /* Branches carry an explicit width where anatomy demands one (the sciatic
     is the thickest nerve in the body, the vagus is slender), so grouping is
     by quantised width rather than by level. */
  const W_LADDER = [3, 5, 7, 9, 11, 13, 17, 22, 27];
  function wIndex(w){
    let best = 0, bd = Infinity;
    for (let i=0;i<W_LADDER.length;i++){
      const d = Math.abs(W_LADDER[i]-w);
      if (d < bd){ bd = d; best = i; }
    }
    return best;
  }
  for (let i=0;i<NET.length;i++){
    const b = NET[i];
    b.wi = wIndex(b.w != null ? b.w : LEVEL_W[b.level]);
  }
  /* Tuned by how long a crest takes to cross the screen rather than by
     units per second: at the close zoom (1500 units tall) one crest
     traverses the view in about six seconds, which reads as a slow drift
     instead of either a flicker or a freeze. */
  const WAVE_LEN = 1300;
  const WAVE_SPEED = 205;
  const NEAR_LAB = hexToLab('#E8A652');
  const FAR_LAB  = hexToLab('#FFF6DC');

  /* The nervous system has far more segments than the old fan did, so the
     per-segment colour is quantised into buckets and each bucket strokes as
     one path. Visually the same gradient; a few dozen stroke calls instead
     of many hundreds. */
  const WBUCKETS = 7, ZONES = 3;
  const GROUPS = [];
  for (let i=0;i<W_LADDER.length*WBUCKETS*ZONES;i++) GROUPS.push([]);
  const gIndex = (wi,wb,z) => (wi*WBUCKETS + wb)*ZONES + z;

  function drawSrotas(M, time, motion){
    const bright = 0.14 + M.yield*0.42;
    ctx.lineCap='round'; ctx.lineJoin='round';
    for (let i=0;i<GROUPS.length;i++) GROUPS[i].length = 0;

    const phase = motion ? (time*0.001)*WAVE_SPEED : 0;
    const k = (PI*2)/WAVE_LEN;
    for (let i=0;i<NET.length;i++){
      const b = NET[i], p = b.pts;
      for (let j=1;j<p.length;j++){
        const ay = PY(p[j-1][1]), by = PY(p[j][1]);
        if ((ay<-24 && by<-24) || (ay>h+24 && by>h+24)) continue;
        const ax = PX(p[j-1][0]), bx = PX(p[j][0]);
        if ((ax<-24 && bx<-24) || (ax>w+24 && bx>w+24)) continue;
        const d = b.d0 + (b.cum[j-1]+b.cum[j])*0.5;
        const wave = 0.5 + 0.5*Math.sin((d-phase)*k);
        const wb = Math.min(WBUCKETS-1, (wave*WBUCKETS)|0);
        const z  = Math.min(ZONES-1, (clamp01(d/NET_MAX_D)*ZONES)|0);
        GROUPS[gIndex(b.wi, wb, z)].push(ax,ay,bx,by);
      }
    }

    // soft bloom first, from the brightest buckets only
    ctx.globalCompositeOperation = 'lighter';
    for (let wi=0;wi<W_LADDER.length;wi++){
      for (let wb=WBUCKETS-2;wb<WBUCKETS;wb++){
        for (let z=0;z<ZONES;z++){
          const g = GROUPS[gIndex(wi,wb,z)];
          if (!g.length) continue;
          ctx.beginPath();
          for (let q=0;q<g.length;q+=4){ ctx.moveTo(g[q],g[q+1]); ctx.lineTo(g[q+2],g[q+3]); }
          ctx.lineWidth = Math.max(2, W_LADDER[wi]*sc*2.6);
          ctx.strokeStyle = rgbaStr(labToRgb(FAR_LAB[0],FAR_LAB[1],FAR_LAB[2]), (bright*0.06).toFixed(3));
          ctx.stroke();
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // the nerves themselves, at their own weights
    for (let wi=0;wi<W_LADDER.length;wi++){
      const lw = Math.max(0.5, W_LADDER[wi]*sc);
      for (let wb=0;wb<WBUCKETS;wb++){
        const wave = (wb+0.5)/WBUCKETS;
        for (let z=0;z<ZONES;z++){
          const g = GROUPS[gIndex(wi,wb,z)];
          if (!g.length) continue;
          const lab = mixLab(NEAR_LAB, FAR_LAB, (z+0.5)/ZONES);
          const amp = bright*(0.24 + Math.pow(wave,2.2)*1.2);
          ctx.beginPath();
          for (let q=0;q<g.length;q+=4){ ctx.moveTo(g[q],g[q+1]); ctx.lineTo(g[q+2],g[q+3]); }
          ctx.lineWidth = lw*(0.82+wave*0.4);
          ctx.strokeStyle = rgbaStr(labToRgb(lab[0],lab[1],lab[2]), Math.min(0.95,amp).toFixed(3));
          ctx.stroke();
        }
      }
    }

    // the cord itself: a tapered ribbon with its two enlargements
    ctx.beginPath();
    for (let y=CORD_TOP; y<=CONUS; y+=14) ctx.lineTo(PX(-cordHalf(y)), PY(y));
    for (let y=CONUS; y>=CORD_TOP; y-=14) ctx.lineTo(PX(cordHalf(y)), PY(y));
    ctx.closePath();
    ctx.fillStyle = rgbaStr(labToRgb(FAR_LAB[0],FAR_LAB[1],FAR_LAB[2]), (bright*0.9).toFixed(3));
    ctx.fill();

    /* Brain: two hemispheres with a longitudinal fissure and sinuous gyri.
       Concentric arcs inside an ellipse read as a shell; gyri have to
       wander back on themselves to read as cortex. */
    const bl = labToRgb(FAR_LAB[0],FAR_LAB[1],FAR_LAB[2]);
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // cerebrum outline: wide parietal, narrowing to the temporal lobes
    const cerebrum = [];
    for (let a=0;a<=48;a++){
      const t = a/48*PI*2;
      const wob = 1 + Math.sin(t*7)*0.022;                 // faint lobing
      const rx = BRAIN.rx*wob;
      const ry = BRAIN.ry*(t>PI ? 0.94 : 1)*wob;
      cerebrum.push([Math.cos(t)*rx*(Math.sin(t)<0?1:0.97),
                     BRAIN.cy + Math.sin(t)*ry]);
    }
    ctx.beginPath();
    ctx.moveTo(PX(cerebrum[0][0]), PY(cerebrum[0][1]));
    for (let a=1;a<cerebrum.length;a++) ctx.lineTo(PX(cerebrum[a][0]), PY(cerebrum[a][1]));
    ctx.closePath();
    ctx.fillStyle = rgbaStr(bl, (bright*0.16).toFixed(3));
    ctx.fill();
    ctx.strokeStyle = rgbaStr(bl, (bright*0.9).toFixed(3));
    ctx.lineWidth = Math.max(1, 11*sc);
    ctx.stroke();

    // longitudinal fissure, separating the hemispheres
    ctx.lineWidth = Math.max(0.8, 9*sc);
    ctx.strokeStyle = rgbaStr(bl, (bright*0.75).toFixed(3));
    ctx.beginPath();
    ctx.moveTo(PX(0), PY(BRAIN.cy-BRAIN.ry*0.98));
    ctx.lineTo(PX(0), PY(BRAIN.cy+BRAIN.ry*0.55));
    ctx.stroke();

    // gyri: each one wanders out and doubles back, per hemisphere
    ctx.lineWidth = Math.max(0.6, 6*sc);
    ctx.strokeStyle = rgbaStr(bl, (bright*0.52).toFixed(3));
    for (const side of [-1,1]){
      for (let g=0; g<5; g++){
        const t0 = -0.72 + g*0.34;
        ctx.beginPath();
        for (let s=0; s<=16; s++){
          const u = s/16;
          const r = BRAIN.rx*(0.20 + u*0.74);
          const ang = t0 + Math.sin(u*PI*2.4 + g)*0.30;
          const x = side*Math.cos(ang)*r*0.95;
          const y = BRAIN.cy + Math.sin(ang)*BRAIN.ry*0.9;
          if (s===0) ctx.moveTo(PX(x), PY(y)); else ctx.lineTo(PX(x), PY(y));
        }
        ctx.stroke();
      }
    }

    // cerebellum, with its horizontal folia
    const ccy = BRAIN.cy + BRAIN.ry*0.88, crx = BRAIN.rx*0.52, cry = BRAIN.ry*0.30;
    ctx.beginPath();
    ctx.ellipse(PX(0), PY(ccy), crx*sc, cry*sc, 0, 0, PI*2);
    ctx.fillStyle = rgbaStr(bl, (bright*0.22).toFixed(3)); ctx.fill();
    ctx.strokeStyle = rgbaStr(bl, (bright*0.8).toFixed(3));
    ctx.lineWidth = Math.max(0.8, 9*sc); ctx.stroke();
    ctx.lineWidth = Math.max(0.5, 4.5*sc);
    ctx.strokeStyle = rgbaStr(bl, (bright*0.55).toFixed(3));
    for (let f=-2; f<=2; f++){
      const yy = ccy + f*cry*0.34;
      const half = crx*Math.sqrt(Math.max(0, 1-(f*0.34)*(f*0.34)))*0.9;
      ctx.beginPath();
      ctx.moveTo(PX(-half), PY(yy)); ctx.lineTo(PX(half), PY(yy));
      ctx.stroke();
    }

    // brainstem: widens as it leaves the cerebrum, then meets the cord
    ctx.beginPath();
    ctx.moveTo(PX(-58), PY(BRAIN.cy+BRAIN.ry*0.45));
    ctx.lineTo(PX(-cordHalf(CORD_TOP)), PY(CORD_TOP));
    ctx.lineTo(PX(cordHalf(CORD_TOP)), PY(CORD_TOP));
    ctx.lineTo(PX(58), PY(BRAIN.cy+BRAIN.ry*0.45));
    ctx.closePath();
    ctx.fillStyle = rgbaStr(bl, (bright*0.85).toFixed(3));
    ctx.fill();
    ctx.restore();

    // junctions: plexuses, conus, knee
    ctx.fillStyle = rgbaStr(bl, (bright*0.8).toFixed(3));
    const nr = Math.max(0.8, 15*sc);
    for (let i=0;i<NODES.length;i++){
      const sy = PY(NODES[i][1]);
      if (sy<-10 || sy>h+10) continue;
      ctx.beginPath(); ctx.arc(PX(NODES[i][0]), sy, nr, 0, PI*2); ctx.fill();
    }

    // liver
    ctx.beginPath(); ctx.arc(PX(LIVER.x), PY(LIVER.y), LIVER.r*sc, 0, PI*2);
    ctx.fillStyle = rgbaStr([255,184,112], 0.16); ctx.fill();
    ctx.strokeStyle = rgbaStr([255,184,112], 0.34); ctx.lineWidth=1; ctx.stroke();

    // the heart, breathing slowly
    const pulse = motion ? 1 + Math.sin(time*0.00055)*0.08 : 1;
    const R = HRDAYA.r*sc*3.1*pulse;
    const og = ctx.createRadialGradient(PX(HRDAYA.x),PY(HRDAYA.y),0,PX(HRDAYA.x),PY(HRDAYA.y),R);
    og.addColorStop(0, rgbaStr([255,243,207], (0.12+M.yield*0.34).toFixed(3)));
    og.addColorStop(0.4, rgbaStr([255,243,207], (0.05+M.yield*0.12).toFixed(3)));
    og.addColorStop(1, 'rgba(255,243,207,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(PX(HRDAYA.x),PY(HRDAYA.y),R,0,PI*2); ctx.fill();
  }

  function drawTract(st){
    // lumen wall: segments stroked at the local radius
    for (let i=1;i<TRACT.length;i++){
      const a=TRACT[i-1], b=TRACT[i];
      const rr=(a[2]+b[2]);
      ctx.beginPath();
      ctx.moveTo(PX(a[0]),PY(a[1])); ctx.lineTo(PX(b[0]),PY(b[1]));
      ctx.lineWidth = Math.max(1.2, rr*sc);
      ctx.lineCap='round';
      ctx.strokeStyle = rgbaStr(labToRgb(st.lab[0]*0.42, st.lab[1]*0.6, st.lab[2]*0.6), 0.46);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, rr*sc*0.72);
      ctx.strokeStyle = rgbaStr(labToRgb(st.lab[0]*0.24, st.lab[1]*0.4, st.lab[2]*0.4), 0.5);
      ctx.stroke();
    }
  }

  const LABELS = [
    [0,404,'brain','right'],[0,1900,'spinal cord','left'],
    [-120,1380,'brachial plexus','left'],[0,2900,'cauda equina','right'],
    [340,4600,'sciatic nerve','right'],[-286,2500,'stomach','left'],
    [180,3100,'small intestine','right'],[332,3140,'large intestine','right'],
    [300,2420,'liver','right'],[0,3720,'the way out','right']
  ];
  function drawLabels(st){
    const px = clamp(Math.round(h*0.014), 9, 13);
    ctx.font = '500 '+px+'px Archivo, sans-serif';
    ctx.textBaseline='middle';
    ctx.fillStyle = rgbaStr(labToRgb(Math.max(0.74,st.lab[0]),st.lab[1],st.lab[2]), 0.5);
    for (const [lx,ly,txt,side] of LABELS){
      const sx = PX(lx), sy = PY(ly);
      if (sy < -20 || sy > h+20) continue;
      ctx.textAlign = side==='right' ? 'left' : 'right';
      ctx.fillText(txt, sx + (side==='right' ? 26 : -26), sy);
    }
    ctx.textAlign='left';
  }

  function draw(M, st, time, motion){
    ctx.clearRect(0,0,w,h);
    drawFigure(st, M);
    drawSrotas(M, time, motion);
    drawTract(st);
    drawLabels(st);

    for (let i=0;i<COUNT;i++){
      const p = ps[i];
      let x,y,rad,lab,a=0.9;
      const isAma = !p.absorbed && p.s > failAt(p, M);
      const burnt = p.s > burnAt(p, M);

      if (p.absorbed){
        /* Absorbed food is not drawn travelling the network: the lines
           themselves carry the flow. It just eases out of the gut wall
           and fades, handing over to them. */
        const t0 = tractAt(p.absAt);
        const dir = t0.x >= 0 ? 1 : -1;
        x = t0.x + dir*p.bs*130;
        y = t0.y - p.bs*90;
        rad = lerp(10, 2, p.bs);
        lab = mixLab(RASA_LABS[p.rasa], OJAS_LAB, 0.4+0.6*p.bs);
        a = (0.4 + M.yield*0.5) * (1 - smoothstep(0.15, 1, p.bs));
      } else {
        const t = tractAt(p.s);
        const wob = motion ? Math.sin(time*0.0006*p.sp+p.ph)*0.16 : 0;
        // lateral offset is perpendicular-ish; the tract is mostly vertical
        x = t.x + (p.off+wob)*t.r*0.7;
        y = t.y;
        rad = lerp(7, 15, p.rs);
        lab = mixLab(RASA_LABS[p.rasa], stageAtFrac(p.s/TRACT_LEN).lab,
                     smoothstep(0, TRACT_LEN*0.22, p.s));
        if (isAma){ lab = mixLab(lab, AMA_LAB, 0.86); rad *= 1.8; }
        if (burnt){ rad *= 0.45; a *= 0.45; }
      }
      const sx = PX(x), sy = PY(y);
      const sr = rad*sc;
      if (sy < -30 || sy > h+30 || sr < 0.35 || a <= 0.02) continue;
      const col = labToRgb(lab[0],lab[1],lab[2]);
      if (p.absorbed){
        const g = ctx.createRadialGradient(sx,sy,0,sx,sy,sr*3);
        g.addColorStop(0, rgbaStr(col, a.toFixed(3)));
        g.addColorStop(1, rgbaStr(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx,sy,sr*3,0,PI*2); ctx.fill();
      }
      ctx.fillStyle = rgbaStr(col, a.toFixed(3));
      ctx.beginPath(); ctx.arc(sx,sy,Math.max(0.6,sr),0,PI*2); ctx.fill();
    }
  }

  return {
    resize,
    render(M, st, t, time, dt, motion){
      if (!w) resize();
      setCamera(focusAt(t), zoomAt(t));
      step(M, dt, motion);
      draw(M, st, time, motion);
    },
    clear(){ ctx.clearRect(0,0,w,h); }
  };
}

export {
  BODY_H, OUTLINE, OUTLINE_R, insideBody,
  TRACT, TRACT_LEN, tractAt,
  NET, NODES, NET_MAX_D,
  BRAIN, LIVER, HRDAYA, CORD_TOP, CONUS, SACRUM, CORD_W, cordHalf,
  STAGES, stageAtFrac,
  focusAt, zoomAt, agniModel,
  createFlow,
  labToRgb, rgbStr, rgbaStr, mixLab, hexToLab, clamp, clamp01, lerp, smoothstep
};
