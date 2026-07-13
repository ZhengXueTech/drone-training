// ============================================================
// gamepad.js — exp_new 共用手把設定
// 控制器: Xbox 360 (XInput) / Xbox One (HID) / STARTRC / PS2 USB
// ============================================================
'use strict';

const GP_STORE_KEY = 'droneSimGpMap';

// ── 控制器 config ─────────────────────────────────────────────

// Xbox 360 USB / 無線  (ID 含 xinput)
const _XBOX_360_CFG = {
  axes:{yaw:{i:0,inv:true,rest:0},throttle:{i:1,inv:true,rest:0},
        roll:{i:2,inv:true,rest:0},pitch:{i:3,inv:true,rest:0}},
  buttons:{confirm:0,back:1,camCycle:9,pilotCycle:8},
  menuNav:'stick',deadzone:0.12,expo:0
};

// Xbox One USB有線 / 藍牙  (ID 含 hid-compliant)
const _XBOX_ONE_HID_CFG = {
  axes:{yaw:{i:0,inv:true,rest:0},throttle:{i:1,inv:true,rest:0},
        roll:{i:2,inv:true,rest:0},pitch:{i:3,inv:true,rest:0}},
  buttons:{confirm:0,back:1,camCycle:9,pilotCycle:8},
  menuNav:'stick',deadzone:0.12,expo:0
};

// STARTRC  (ID 含 startrc)
const _STARTRC_CFG = {
  axes:{yaw:{i:3,inv:true,rest:0},throttle:{i:2,inv:false,rest:0},
        roll:{i:0,inv:true,rest:0},pitch:{i:1,inv:false,rest:0}},
  buttons:{confirm:1,back:1,camCycle:0,pilotCycle:0},
  axBtns:[{ax:4,type:'3pos',fn:'camCycle'},{ax:5,type:'2pos',fn:'back'},
          {ax:6,type:'3pos',fn:'pilotCycle'},{ax:7,type:'2pos',fn:'confirm'}],
  menuNav:'stick',deadzone:0.12,expo:0
};

// PS2 USB (Vendor: 0810 Product: 0001)  (ID 含 0810)
// 注意: roll=axes[5], pitch=axes[2]，與 Xbox 不同
// ignoreAxes: axes[9] 是 D-pad 編碼軸，靜止值接近 1.0，強制忽略避免干擾
const _PS2_USB_CFG = {
  axes:{yaw:{i:0,inv:true,rest:0},throttle:{i:1,inv:true,rest:0},
        roll:{i:5,inv:true,rest:0},pitch:{i:2,inv:true,rest:0}},
  buttons:{confirm:2,back:1,camCycle:9,pilotCycle:8},
  ignoreAxes:[9],
  menuNav:'stick',deadzone:0.12,expo:0
};

// ── loadCfg：未知控制器從 localStorage 讀取 ──────────────────
function _gpLoadCfg(gpId){
  try{return JSON.parse(localStorage.getItem(GP_STORE_KEY)||'{}')[gpId]||null;}
  catch{return null;}
}

// ── gpCfgRead：依 ID 回傳對應 config ─────────────────────────
// 優先順序：內建 config > localStorage（避免舊設定覆蓋內建）
window.gpCfgRead = function(gp){
  if(!gp) return null;
  const id = gp.id.toLowerCase();
  if(id.includes('startrc'))                                          return _STARTRC_CFG;
  if(id.includes('xinput'))                                           return _XBOX_360_CFG;
  if(id.includes('hid-compliant')||id.includes('standard gamepad'))   return _XBOX_ONE_HID_CFG;
  if(id.includes('0810'))                                             return _PS2_USB_CFG;
  return _gpLoadCfg(gp.id);  // 未知：用 gamepad-test 儲存的設定
};

// ── applyExpo（內部用） ───────────────────────────────────────
function _applyExpo(v,e){return e>0?v*(1-e)+v*v*v*e:v;}

// ── gpAxis：讀取軸值（含 deadzone / invert / expo） ───────────
window.gpAxis = function(gp, name, cfg){
  const mode = localStorage.getItem('droneSimFlightMode')||'2';
  const def  = mode==='1'
    ? {yaw:0,throttle:3,roll:2,pitch:1}
    : {yaw:0,throttle:1,roll:2,pitch:3};
  const defInv = {throttle:true,roll:true,pitch:true};
  let idx,invert,dz,expo,rest;
  if(cfg&&cfg.axes&&cfg.axes[name]!=null){
    const ax=cfg.axes[name];
    idx    = ax.i??ax.index??def[name]??0;
    invert = ax.inv??ax.invert??defInv[name]??false;
    rest   = ax.rest??0;
    dz     = cfg.deadzone??0.12;
    expo   = cfg.expo??0;
  } else {
    idx=def[name]??0; invert=defInv[name]??false; rest=0; dz=0.12; expo=0;
  }
  // ignoreAxes：強制忽略特定軸（如 PS2 axes[9] D-pad 干擾軸）
  if(cfg?.ignoreAxes?.includes(idx)) return 0;
  const raw = gp.axes[idx]??0;
  const halfRange = 1.0+Math.abs(rest);
  let v = (raw-rest)/halfRange;
  if(Math.abs(v)<dz) v=0; else v=(v-Math.sign(v)*dz)/(1-dz);
  if(invert) v=-v;
  return _applyExpo(v,expo);
};

// ── gpBtn：讀取按鈕（含撥段開關 axBtns） ─────────────────────
const _gpAxPrev = {};
window.gpBtn = function(gp, name, cfg){
  const def = {confirm:0,back:1,camCycle:9,pilotCycle:8};
  if(cfg&&cfg.axBtns){
    const ab = cfg.axBtns.find(b=>b.fn===name);
    if(ab!=null){
      const key = gp.id+'_'+ab.ax;
      const cur  = gp.axes[ab.ax]??0;
      const prev = _gpAxPrev[key]??cur;
      _gpAxPrev[key]=cur;
      if(ab.type==='2pos') return prev>0.5&&cur<-0.5;
      if(ab.type==='3pos'){const pz=Math.abs(prev)<0.3,cz=Math.abs(cur)<0.3;return !cz&&pz;}
      return false;
    }
  }
  const bi = cfg?.buttons?.[name]??def[name]??0;
  return !!gp.buttons[bi]?.pressed;
};
