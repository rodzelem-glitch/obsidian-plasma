import{c as w,j as M}from"./index-BWq0k-zA.js";import{N as Z,b as l,r as m}from"./vendor-react-DrgKKUoP.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const te=w("CircleAlert",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const re=w("CircleCheck",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const le=w("LayoutDashboard",[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ie=w("Receipt",[["path",{d:"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z",key:"q3az6g"}],["path",{d:"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8",key:"1h4pet"}],["path",{d:"M12 17.5v-11",key:"1jc1ny"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oe=w("Settings",[["path",{d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",key:"1qme2f"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]),se=({isAllowed:e,redirectPath:t="/login",children:s})=>e?M.jsx(M.Fragment,{children:s}):M.jsx(Z,{to:t,replace:!0});var y;(function(e){e[e.UP=-1]="UP",e[e.DOWN=1]="DOWN"})(y||(y={}));function $(e){var t=getComputedStyle(e).overflowY;return e===document.scrollingElement&&t==="visible"?!0:!(t!=="scroll"&&t!=="auto")}function G(e,t){if(!$(e))return!1;if(t===y.DOWN){var s=e.scrollTop+e.clientHeight;return s<e.scrollHeight}if(t===y.UP)return e.scrollTop>0;throw new Error("unsupported direction")}function B(e,t){return G(e,t)?!0:e.parentElement==null?!1:B(e.parentElement,t)}function q(e,t){t===void 0&&(t={});var s=t.insertAt;if(!(!e||typeof document>"u")){var a=document.head||document.getElementsByTagName("head")[0],i=document.createElement("style");i.type="text/css",s==="top"&&a.firstChild?a.insertBefore(i,a.firstChild):a.appendChild(i),i.styleSheet?i.styleSheet.cssText=e:i.appendChild(document.createTextNode(e))}}var J=`.lds-ellipsis {
  display: inline-block;
  position: relative;
  width: 64px;
  height: 64px;
}

.lds-ellipsis div {
  position: absolute;
  top: 27px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: rgb(54, 54, 54);
  animation-timing-function: cubic-bezier(0, 1, 1, 0);
}

.lds-ellipsis div:nth-child(1) {
  left: 6px;
  animation: lds-ellipsis1 0.6s infinite;
}

.lds-ellipsis div:nth-child(2) {
  left: 6px;
  animation: lds-ellipsis2 0.6s infinite;
}

.lds-ellipsis div:nth-child(3) {
  left: 26px;
  animation: lds-ellipsis2 0.6s infinite;
}

.lds-ellipsis div:nth-child(4) {
  left: 45px;
  animation: lds-ellipsis3 0.6s infinite;
}

@keyframes lds-ellipsis1 {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes lds-ellipsis3 {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(0);
  }
}
@keyframes lds-ellipsis2 {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(19px, 0);
  }
}`;q(J);var K=function(){return l.createElement("div",{className:"lds-ellipsis"},l.createElement("div",null),l.createElement("div",null),l.createElement("div",null),l.createElement("div",null))},Q=function(){return l.createElement("div",null,l.createElement("p",null,"↧  pull to refresh  ↧"))},I=`.ptr,
.ptr__children {
  height: 100%;
  width: 100%;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

.ptr.ptr--fetch-more-treshold-breached .ptr__fetch-more {
  display: block;
}

.ptr__fetch-more {
  display: none;
}

/**
  * Pull down transition 
  */
.ptr__children,
.ptr__pull-down {
  transition: transform 0.2s cubic-bezier(0, 0, 0.31, 1);
}

.ptr__pull-down {
  position: absolute;
  overflow: hidden;
  left: 0;
  right: 0;
  top: 0;
  visibility: hidden;
}
.ptr__pull-down > div {
  display: none;
}

.ptr--dragging {
  /**
    * Hide PullMore content is treshold breached
    */
}
.ptr--dragging.ptr--pull-down-treshold-breached .ptr__pull-down--pull-more {
  display: none;
}
.ptr--dragging {
  /**
    * Otherwize, display content
    */
}
.ptr--dragging .ptr__pull-down--pull-more {
  display: block;
}

.ptr--pull-down-treshold-breached {
  /**
    * Force opacity to 1 is pull down trashold breached
    */
}
.ptr--pull-down-treshold-breached .ptr__pull-down {
  opacity: 1 !important;
}
.ptr--pull-down-treshold-breached {
  /**
    * And display loader
    */
}
.ptr--pull-down-treshold-breached .ptr__pull-down--loading {
  display: block;
}

.ptr__loader {
  margin: 0 auto;
  text-align: center;
}`;q(I);var ae=function(e){var t=e.isPullable,s=t===void 0?!0:t,a=e.canFetchMore,i=a===void 0?!1:a,R=e.onRefresh,b=e.onFetchMore,N=e.refreshingContent,P=N===void 0?l.createElement(K,null):N,A=e.pullingContent,U=A===void 0?l.createElement(Q,null):A,k=e.children,D=e.pullDownThreshold,L=D===void 0?67:D,S=e.fetchMoreThreshold,C=S===void 0?100:S,Y=e.maxPullDownDistance,T=Y===void 0?95:Y,F=e.resistance,V=F===void 0?1:F,O=e.backgroundColor,j=e.className,W=j===void 0?"":j,o=m.useRef(null),r=m.useRef(null),d=m.useRef(null),X=m.useRef(null),E=!1,g=!1,h=!1,p=0,f=0;m.useEffect(function(){if(!(!s||!r||!r.current)){var n=r.current;return n.addEventListener("touchstart",x,{passive:!0}),n.addEventListener("mousedown",x),n.addEventListener("touchmove",_,{passive:!1}),n.addEventListener("mousemove",_),window.addEventListener("scroll",H),n.addEventListener("touchend",v),n.addEventListener("mouseup",v),document.body.addEventListener("mouseleave",v),function(){n.removeEventListener("touchstart",x),n.removeEventListener("mousedown",x),n.removeEventListener("touchmove",_),n.removeEventListener("mousemove",_),window.removeEventListener("scroll",H),n.removeEventListener("touchend",v),n.removeEventListener("mouseup",v),document.body.removeEventListener("mouseleave",v)}}},[k,s,R,L,T,i,C]),m.useEffect(function(){var n;if(!((n=o)===null||n===void 0)&&n.current){var c=o.current.classList.contains("ptr--fetch-more-treshold-breached");c||i&&z()<C&&b&&(o.current.classList.add("ptr--fetch-more-treshold-breached"),g=!0,b().then(u).catch(u))}},[i,k]);var z=function(){if(!r||!r.current)return-1;var n=window.scrollY,c=r.current.scrollHeight;return c-n-window.innerHeight},u=function(){requestAnimationFrame(function(){r.current&&(r.current.style.overflowX="hidden",r.current.style.overflowY="auto",r.current.style.transform="unset"),d.current&&(d.current.style.opacity="0"),o.current&&(o.current.classList.remove("ptr--pull-down-treshold-breached"),o.current.classList.remove("ptr--dragging"),o.current.classList.remove("ptr--fetch-more-treshold-breached")),E&&(E=!1),g&&(g=!1)})},x=function(n){h=!1,n instanceof MouseEvent&&(p=n.pageY),window.TouchEvent&&n instanceof TouchEvent&&(p=n.touches[0].pageY),f=p,!(n.type==="touchstart"&&B(n.target,y.UP))&&(r.current.getBoundingClientRect().top<0||(h=!0))},_=function(n){if(h){if(window.TouchEvent&&n instanceof TouchEvent?f=n.touches[0].pageY:f=n.pageY,o.current.classList.add("ptr--dragging"),f<p){h=!1;return}n.cancelable&&n.preventDefault();var c=Math.min((f-p)/V,T);c>=L&&(h=!0,E=!0,o.current.classList.remove("ptr--dragging"),o.current.classList.add("ptr--pull-down-treshold-breached")),!(c>=T)&&(d.current.style.opacity=(c/65).toString(),r.current.style.overflow="visible",r.current.style.transform="translate(0px, "+c+"px)",d.current.style.visibility="visible")}},H=function(n){g||i&&z()<C&&b&&(g=!0,o.current.classList.add("ptr--fetch-more-treshold-breached"),b().then(u).catch(u))},v=function(){if(h=!1,p=0,f=0,!E){d.current&&(d.current.style.visibility="hidden"),u();return}r.current&&(r.current.style.overflow="visible",r.current.style.transform="translate(0px, "+L+"px)"),R().then(u).catch(u)};return l.createElement("div",{className:"ptr "+W,style:{backgroundColor:O},ref:o},l.createElement("div",{className:"ptr__pull-down",ref:d},l.createElement("div",{className:"ptr__loader ptr__pull-down--loading"},P),l.createElement("div",{className:"ptr__pull-down--pull-more"},U)),l.createElement("div",{className:"ptr__children",ref:r},k,l.createElement("div",{className:"ptr__fetch-more",ref:X},l.createElement("div",{className:"ptr__loader ptr__fetch-more--loading"},P))))};export{re as C,le as L,ae as P,ie as R,oe as S,te as a,se as b};
