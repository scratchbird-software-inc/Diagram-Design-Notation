/* SPDX-License-Identifier: GPL-2.0-or-later. Fixed theme-aware semantic palette.
 * Dark/night variants retain the registered colour's hue association, with
 * deterministic lighter tints. Measured contrast is not full WCAG certification.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DDNPalette=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const themes={default:{background:'#F6F8FC',surface:'#FFFFFF',ink:'#17263D',muted:'#52647B',rule:'#D8E1EB',accent:'#244CB4'},base:{background:'#FFFFFF',surface:'#FFFFFF',ink:'#17263D',muted:'#52647B',rule:'#D8E1EB',accent:'#244CB4'},neutral:{background:'#FFFFFF',surface:'#FFFFFF',ink:'#222222',muted:'#555555',rule:'#BBBBBB',accent:'#303030'},dark:{background:'#202C3E',surface:'#2A3A50',ink:'#EDF3FC',muted:'#CBD8EA',rule:'#7389A5',accent:'#ABCBFF',lowLight:true},night:{background:'#2D3B50',surface:'#394B63',ink:'#F1F5FC',muted:'#D1DCEB',rule:'#93A8C1',accent:'#C3DAFF',lowLight:true},forest:{background:'#F2F6EF',surface:'#FBFDF9',ink:'#20342B',muted:'#526557',rule:'#D6E0D0',accent:'#375A42'}};
function rgb(hex){const h=hex.replace('#','');return[h.slice(0,2),h.slice(2,4),h.slice(4,6)].map(v=>parseInt(v,16));}
function mix(a,b,t){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v*(1-t)+y[i]*t).toString(16).padStart(2,'0')).join('').toUpperCase();}
function luminance(hex){const [r,g,b]=rgb(hex).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const cache=new Map();
function semantic(colour,theme){if(typeof theme==='string')theme=themes[theme];if(!theme.lowLight)return colour;const key=colour+theme.background+theme.surface;if(cache.has(key))return cache.get(key);let out;for(let i=65;i<=100;i++){out=mix(colour,'#EEF4FC',i/100);if(contrast(out,theme.background)>=4.5&&contrast(out,theme.surface)>=4.5)break;}cache.set(key,out);return out;}
function node(kind,theme){return theme.lowLight?{ink:semantic(kind.colour,theme),fill:mix(theme.surface,kind.colour,.06),text:theme.ink}:{ink:kind.colour,fill:kind.fill,text:'#26364D'};}
return{themes,semantic,node,contrast,mix};
});
