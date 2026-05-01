var rd={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lp=function(n){const e=[];let t=0;for(let r=0;r<n.length;r++){let i=n.charCodeAt(r);i<128?e[t++]=i:i<2048?(e[t++]=i>>6|192,e[t++]=i&63|128):(i&64512)===55296&&r+1<n.length&&(n.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(n.charCodeAt(++r)&1023),e[t++]=i>>18|240,e[t++]=i>>12&63|128,e[t++]=i>>6&63|128,e[t++]=i&63|128):(e[t++]=i>>12|224,e[t++]=i>>6&63|128,e[t++]=i&63|128)}return e},cI=function(n){const e=[];let t=0,r=0;for(;t<n.length;){const i=n[t++];if(i<128)e[r++]=String.fromCharCode(i);else if(i>191&&i<224){const s=n[t++];e[r++]=String.fromCharCode((i&31)<<6|s&63)}else if(i>239&&i<365){const s=n[t++],o=n[t++],c=n[t++],u=((i&7)<<18|(s&63)<<12|(o&63)<<6|c&63)-65536;e[r++]=String.fromCharCode(55296+(u>>10)),e[r++]=String.fromCharCode(56320+(u&1023))}else{const s=n[t++],o=n[t++];e[r++]=String.fromCharCode((i&15)<<12|(s&63)<<6|o&63)}}return e.join("")},hp={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(n,e){if(!Array.isArray(n))throw Error("encodeByteArray takes an array as a parameter");this.init_();const t=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<n.length;i+=3){const s=n[i],o=i+1<n.length,c=o?n[i+1]:0,u=i+2<n.length,h=u?n[i+2]:0,f=s>>2,p=(s&3)<<4|c>>4;let g=(c&15)<<2|h>>6,T=h&63;u||(T=64,o||(g=64)),r.push(t[f],t[p],t[g],t[T])}return r.join("")},encodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(n):this.encodeByteArray(lp(n),e)},decodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(n):cI(this.decodeStringToByteArray(n,e))},decodeStringToByteArray(n,e){this.init_();const t=e?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<n.length;){const s=t[n.charAt(i++)],c=i<n.length?t[n.charAt(i)]:0;++i;const h=i<n.length?t[n.charAt(i)]:64;++i;const p=i<n.length?t[n.charAt(i)]:64;if(++i,s==null||c==null||h==null||p==null)throw new uI;const g=s<<2|c>>4;if(r.push(g),h!==64){const T=c<<4&240|h>>2;if(r.push(T),p!==64){const C=h<<6&192|p;r.push(C)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let n=0;n<this.ENCODED_VALS.length;n++)this.byteToCharMap_[n]=this.ENCODED_VALS.charAt(n),this.charToByteMap_[this.byteToCharMap_[n]]=n,this.byteToCharMapWebSafe_[n]=this.ENCODED_VALS_WEBSAFE.charAt(n),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[n]]=n,n>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(n)]=n,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(n)]=n)}}};class uI extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const lI=function(n){const e=lp(n);return hp.encodeByteArray(e,!0)},Lo=function(n){return lI(n).replace(/\./g,"")},dp=function(n){try{return hp.decodeString(n,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};function Mo(n,e){if(!(e instanceof Object))return e;switch(e.constructor){case Date:const t=e;return new Date(t.getTime());case Object:n===void 0&&(n={});break;case Array:n=[];break;default:return e}for(const t in e)!e.hasOwnProperty(t)||!hI(t)||(n[t]=Mo(n[t],e[t]));return n}function hI(n){return n!=="__proto__"}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function fp(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dI=()=>fp().__FIREBASE_DEFAULTS__,fI=()=>{if(typeof process>"u"||typeof rd>"u")return;const n=rd.__FIREBASE_DEFAULTS__;if(n)return JSON.parse(n)},pI=()=>{if(typeof document>"u")return;let n;try{n=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=n&&dp(n[1]);return e&&JSON.parse(e)},sa=()=>{try{return dI()||fI()||pI()}catch(n){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${n}`);return}},mI=n=>{var e,t;return(t=(e=sa())===null||e===void 0?void 0:e.emulatorHosts)===null||t===void 0?void 0:t[n]},gI=n=>{const e=mI(n);if(!e)return;const t=e.lastIndexOf(":");if(t<=0||t+1===e.length)throw new Error(`Invalid host ${e} with no separate hostname and port!`);const r=parseInt(e.substring(t+1),10);return e[0]==="["?[e.substring(1,t-1),r]:[e.substring(0,t),r]},pp=()=>{var n;return(n=sa())===null||n===void 0?void 0:n.config},_I=n=>{var e;return(e=sa())===null||e===void 0?void 0:e[`_${n}`]};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class yI{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}wrapCallback(e){return(t,r)=>{t?this.reject(t):this.resolve(r),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(t):e(t,r))}}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function mp(n,e){if(n.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const t={alg:"none",type:"JWT"},r=e||"demo-project",i=n.iat||0,s=n.sub||n.user_id;if(!s)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const o=Object.assign({iss:`https://securetoken.google.com/${r}`,aud:r,iat:i,exp:i+3600,auth_time:i,sub:s,user_id:s,firebase:{sign_in_provider:"custom",identities:{}}},n);return[Lo(JSON.stringify(t)),Lo(JSON.stringify(o)),""].join(".")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function pe(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function II(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(pe())}function Iu(){var n;const e=(n=sa())===null||n===void 0?void 0:n.forceEnvironment;if(e==="node")return!0;if(e==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function vI(){return typeof window<"u"||gp()}function gp(){return typeof WorkerGlobalScope<"u"&&typeof self<"u"&&self instanceof WorkerGlobalScope}function wI(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function _p(){const n=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof n=="object"&&n.id!==void 0}function vu(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function yp(){const n=pe();return n.indexOf("MSIE ")>=0||n.indexOf("Trident/")>=0}function Ip(){return!Iu()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function ss(){try{return typeof indexedDB=="object"}catch{return!1}}function TI(){return new Promise((n,e)=>{try{let t=!0;const r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),t||self.indexedDB.deleteDatabase(r),n(!0)},i.onupgradeneeded=()=>{t=!1},i.onerror=()=>{var s;e(((s=i.error)===null||s===void 0?void 0:s.message)||"")}}catch(t){e(t)}})}function ak(){return!(typeof navigator>"u"||!navigator.cookieEnabled)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const EI="FirebaseError";class Pe extends Error{constructor(e,t,r){super(t),this.code=e,this.customData=r,this.name=EI,Object.setPrototypeOf(this,Pe.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,lr.prototype.create)}}class lr{constructor(e,t,r){this.service=e,this.serviceName=t,this.errors=r}create(e,...t){const r=t[0]||{},i=`${this.service}/${e}`,s=this.errors[e],o=s?AI(s,r):"Error",c=`${this.serviceName}: ${o} (${i}).`;return new Pe(i,c,r)}}function AI(n,e){return n.replace(bI,(t,r)=>{const i=e[r];return i!=null?String(i):`<${r}?>`})}const bI=/\{\$([^}]+)}/g;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function id(n,e){return Object.prototype.hasOwnProperty.call(n,e)}function RI(n){for(const e in n)if(Object.prototype.hasOwnProperty.call(n,e))return!1;return!0}function os(n,e){if(n===e)return!0;const t=Object.keys(n),r=Object.keys(e);for(const i of t){if(!r.includes(i))return!1;const s=n[i],o=e[i];if(sd(s)&&sd(o)){if(!os(s,o))return!1}else if(s!==o)return!1}for(const i of r)if(!t.includes(i))return!1;return!0}function sd(n){return n!==null&&typeof n=="object"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ii(n){const e=[];for(const[t,r]of Object.entries(n))Array.isArray(r)?r.forEach(i=>{e.push(encodeURIComponent(t)+"="+encodeURIComponent(i))}):e.push(encodeURIComponent(t)+"="+encodeURIComponent(r));return e.length?"&"+e.join("&"):""}function Nr(n){const e={};return n.replace(/^\?/,"").split("&").forEach(r=>{if(r){const[i,s]=r.split("=");e[decodeURIComponent(i)]=decodeURIComponent(s)}}),e}function $i(n){const e=n.indexOf("?");if(!e)return"";const t=n.indexOf("#",e);return n.substring(e,t>0?t:void 0)}function vp(n,e){const t=new PI(n,e);return t.subscribe.bind(t)}class PI{constructor(e,t){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=t,this.task.then(()=>{e(this)}).catch(r=>{this.error(r)})}next(e){this.forEachObserver(t=>{t.next(e)})}error(e){this.forEachObserver(t=>{t.error(e)}),this.close(e)}complete(){this.forEachObserver(e=>{e.complete()}),this.close()}subscribe(e,t,r){let i;if(e===void 0&&t===void 0&&r===void 0)throw new Error("Missing Observer.");SI(e,["next","error","complete"])?i=e:i={next:e,error:t,complete:r},i.next===void 0&&(i.next=pc),i.error===void 0&&(i.error=pc),i.complete===void 0&&(i.complete=pc);const s=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?i.error(this.finalError):i.complete()}catch{}}),this.observers.push(i),s}unsubscribeOne(e){this.observers===void 0||this.observers[e]===void 0||(delete this.observers[e],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(e){if(!this.finalized)for(let t=0;t<this.observers.length;t++)this.sendOne(t,e)}sendOne(e,t){this.task.then(()=>{if(this.observers!==void 0&&this.observers[e]!==void 0)try{t(this.observers[e])}catch(r){typeof console<"u"&&console.error&&console.error(r)}})}close(e){this.finalized||(this.finalized=!0,e!==void 0&&(this.finalError=e),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function SI(n,e){if(typeof n!="object"||n===null)return!1;for(const t of e)if(t in n&&typeof n[t]=="function")return!0;return!1}function pc(){}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function B(n){return n&&n._delegate?n._delegate:n}class ot{constructor(e,t,r){this.name=e,this.instanceFactory=t,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Mn="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class CI{constructor(e,t){this.name=e,this.container=t,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const t=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(t)){const r=new yI;if(this.instancesDeferred.set(t,r),this.isInitialized(t)||this.shouldAutoInitialize())try{const i=this.getOrInitializeService({instanceIdentifier:t});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(t).promise}getImmediate(e){var t;const r=this.normalizeInstanceIdentifier(e==null?void 0:e.identifier),i=(t=e==null?void 0:e.optional)!==null&&t!==void 0?t:!1;if(this.isInitialized(r)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:r})}catch(s){if(i)return null;throw s}else{if(i)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(DI(e))try{this.getOrInitializeService({instanceIdentifier:Mn})}catch{}for(const[t,r]of this.instancesDeferred.entries()){const i=this.normalizeInstanceIdentifier(t);try{const s=this.getOrInitializeService({instanceIdentifier:i});r.resolve(s)}catch{}}}}clearInstance(e=Mn){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(t=>"INTERNAL"in t).map(t=>t.INTERNAL.delete()),...e.filter(t=>"_delete"in t).map(t=>t._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=Mn){return this.instances.has(e)}getOptions(e=Mn){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:t={}}=e,r=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const i=this.getOrInitializeService({instanceIdentifier:r,options:t});for(const[s,o]of this.instancesDeferred.entries()){const c=this.normalizeInstanceIdentifier(s);r===c&&o.resolve(i)}return i}onInit(e,t){var r;const i=this.normalizeInstanceIdentifier(t),s=(r=this.onInitCallbacks.get(i))!==null&&r!==void 0?r:new Set;s.add(e),this.onInitCallbacks.set(i,s);const o=this.instances.get(i);return o&&e(o,i),()=>{s.delete(e)}}invokeOnInitCallbacks(e,t){const r=this.onInitCallbacks.get(t);if(r)for(const i of r)try{i(e,t)}catch{}}getOrInitializeService({instanceIdentifier:e,options:t={}}){let r=this.instances.get(e);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:kI(e),options:t}),this.instances.set(e,r),this.instancesOptions.set(e,t),this.invokeOnInitCallbacks(r,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,r)}catch{}return r||null}normalizeInstanceIdentifier(e=Mn){return this.component?this.component.multipleInstances?e:Mn:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function kI(n){return n===Mn?void 0:n}function DI(n){return n.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wp{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const t=this.getProvider(e.name);if(t.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);t.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const t=new CI(e,this);return this.providers.set(e,t),t}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const wu=[];var Q;(function(n){n[n.DEBUG=0]="DEBUG",n[n.VERBOSE=1]="VERBOSE",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.SILENT=5]="SILENT"})(Q||(Q={}));const Tp={debug:Q.DEBUG,verbose:Q.VERBOSE,info:Q.INFO,warn:Q.WARN,error:Q.ERROR,silent:Q.SILENT},NI=Q.INFO,VI={[Q.DEBUG]:"log",[Q.VERBOSE]:"log",[Q.INFO]:"info",[Q.WARN]:"warn",[Q.ERROR]:"error"},OI=(n,e,...t)=>{if(e<n.logLevel)return;const r=new Date().toISOString(),i=VI[e];if(i)console[i](`[${r}]  ${n.name}:`,...t);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class oa{constructor(e){this.name=e,this._logLevel=NI,this._logHandler=OI,this._userLogHandler=null,wu.push(this)}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in Q))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?Tp[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,Q.DEBUG,...e),this._logHandler(this,Q.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,Q.VERBOSE,...e),this._logHandler(this,Q.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,Q.INFO,...e),this._logHandler(this,Q.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,Q.WARN,...e),this._logHandler(this,Q.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,Q.ERROR,...e),this._logHandler(this,Q.ERROR,...e)}}function xI(n){wu.forEach(e=>{e.setLogLevel(n)})}function LI(n,e){for(const t of wu){let r=null;e&&e.level&&(r=Tp[e.level]),n===null?t.userLogHandler=null:t.userLogHandler=(i,s,...o)=>{const c=o.map(u=>{if(u==null)return null;if(typeof u=="string")return u;if(typeof u=="number"||typeof u=="boolean")return u.toString();if(u instanceof Error)return u.message;try{return JSON.stringify(u)}catch{return null}}).filter(u=>u).join(" ");s>=(r??i.logLevel)&&n({level:Q[s].toLowerCase(),message:c,args:o,type:i.name})}}}const MI=(n,e)=>e.some(t=>n instanceof t);let od,ad;function FI(){return od||(od=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function UI(){return ad||(ad=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Ep=new WeakMap,Vc=new WeakMap,Ap=new WeakMap,mc=new WeakMap,Tu=new WeakMap;function BI(n){const e=new Promise((t,r)=>{const i=()=>{n.removeEventListener("success",s),n.removeEventListener("error",o)},s=()=>{t(qt(n.result)),i()},o=()=>{r(n.error),i()};n.addEventListener("success",s),n.addEventListener("error",o)});return e.then(t=>{t instanceof IDBCursor&&Ep.set(t,n)}).catch(()=>{}),Tu.set(e,n),e}function qI(n){if(Vc.has(n))return;const e=new Promise((t,r)=>{const i=()=>{n.removeEventListener("complete",s),n.removeEventListener("error",o),n.removeEventListener("abort",o)},s=()=>{t(),i()},o=()=>{r(n.error||new DOMException("AbortError","AbortError")),i()};n.addEventListener("complete",s),n.addEventListener("error",o),n.addEventListener("abort",o)});Vc.set(n,e)}let Oc={get(n,e,t){if(n instanceof IDBTransaction){if(e==="done")return Vc.get(n);if(e==="objectStoreNames")return n.objectStoreNames||Ap.get(n);if(e==="store")return t.objectStoreNames[1]?void 0:t.objectStore(t.objectStoreNames[0])}return qt(n[e])},set(n,e,t){return n[e]=t,!0},has(n,e){return n instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in n}};function jI(n){Oc=n(Oc)}function $I(n){return n===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...t){const r=n.call(gc(this),e,...t);return Ap.set(r,e.sort?e.sort():[e]),qt(r)}:UI().includes(n)?function(...e){return n.apply(gc(this),e),qt(Ep.get(this))}:function(...e){return qt(n.apply(gc(this),e))}}function zI(n){return typeof n=="function"?$I(n):(n instanceof IDBTransaction&&qI(n),MI(n,FI())?new Proxy(n,Oc):n)}function qt(n){if(n instanceof IDBRequest)return BI(n);if(mc.has(n))return mc.get(n);const e=zI(n);return e!==n&&(mc.set(n,e),Tu.set(e,n)),e}const gc=n=>Tu.get(n);function GI(n,e,{blocked:t,upgrade:r,blocking:i,terminated:s}={}){const o=indexedDB.open(n,e),c=qt(o);return r&&o.addEventListener("upgradeneeded",u=>{r(qt(o.result),u.oldVersion,u.newVersion,qt(o.transaction),u)}),t&&o.addEventListener("blocked",u=>t(u.oldVersion,u.newVersion,u)),c.then(u=>{s&&u.addEventListener("close",()=>s()),i&&u.addEventListener("versionchange",h=>i(h.oldVersion,h.newVersion,h))}).catch(()=>{}),c}function ck(n,{blocked:e}={}){const t=indexedDB.deleteDatabase(n);return e&&t.addEventListener("blocked",r=>e(r.oldVersion,r)),qt(t).then(()=>{})}const KI=["get","getKey","getAll","getAllKeys","count"],WI=["put","add","delete","clear"],_c=new Map;function cd(n,e){if(!(n instanceof IDBDatabase&&!(e in n)&&typeof e=="string"))return;if(_c.get(e))return _c.get(e);const t=e.replace(/FromIndex$/,""),r=e!==t,i=WI.includes(t);if(!(t in(r?IDBIndex:IDBObjectStore).prototype)||!(i||KI.includes(t)))return;const s=async function(o,...c){const u=this.transaction(o,i?"readwrite":"readonly");let h=u.store;return r&&(h=h.index(c.shift())),(await Promise.all([h[t](...c),i&&u.done]))[0]};return _c.set(e,s),s}jI(n=>({...n,get:(e,t,r)=>cd(e,t)||n.get(e,t,r),has:(e,t)=>!!cd(e,t)||n.has(e,t)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class HI{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(t=>{if(QI(t)){const r=t.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(t=>t).join(" ")}}function QI(n){const e=n.getComponent();return(e==null?void 0:e.type)==="VERSION"}const Fo="@firebase/app",xc="0.10.13";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const zt=new oa("@firebase/app"),JI="@firebase/app-compat",YI="@firebase/analytics-compat",XI="@firebase/analytics",ZI="@firebase/app-check-compat",ev="@firebase/app-check",tv="@firebase/auth",nv="@firebase/auth-compat",rv="@firebase/database",iv="@firebase/data-connect",sv="@firebase/database-compat",ov="@firebase/functions",av="@firebase/functions-compat",cv="@firebase/installations",uv="@firebase/installations-compat",lv="@firebase/messaging",hv="@firebase/messaging-compat",dv="@firebase/performance",fv="@firebase/performance-compat",pv="@firebase/remote-config",mv="@firebase/remote-config-compat",gv="@firebase/storage",_v="@firebase/storage-compat",yv="@firebase/firestore",Iv="@firebase/vertexai-preview",vv="@firebase/firestore-compat",wv="firebase",Tv="10.14.1";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const mn="[DEFAULT]",Ev={[Fo]:"fire-core",[JI]:"fire-core-compat",[XI]:"fire-analytics",[YI]:"fire-analytics-compat",[ev]:"fire-app-check",[ZI]:"fire-app-check-compat",[tv]:"fire-auth",[nv]:"fire-auth-compat",[rv]:"fire-rtdb",[iv]:"fire-data-connect",[sv]:"fire-rtdb-compat",[ov]:"fire-fn",[av]:"fire-fn-compat",[cv]:"fire-iid",[uv]:"fire-iid-compat",[lv]:"fire-fcm",[hv]:"fire-fcm-compat",[dv]:"fire-perf",[fv]:"fire-perf-compat",[pv]:"fire-rc",[mv]:"fire-rc-compat",[gv]:"fire-gcs",[_v]:"fire-gcs-compat",[yv]:"fire-fst",[vv]:"fire-fst-compat",[Iv]:"fire-vertex","fire-js":"fire-js",[wv]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gn=new Map,qr=new Map,jr=new Map;function as(n,e){try{n.container.addComponent(e)}catch(t){zt.debug(`Component ${e.name} failed to register with FirebaseApp ${n.name}`,t)}}function bp(n,e){n.container.addOrOverwriteComponent(e)}function St(n){const e=n.name;if(jr.has(e))return zt.debug(`There were multiple attempts to register component ${e}.`),!1;jr.set(e,n);for(const t of gn.values())as(t,n);for(const t of qr.values())as(t,n);return!0}function Eu(n,e){const t=n.container.getProvider("heartbeat").getImmediate({optional:!0});return t&&t.triggerHeartbeat(),n.container.getProvider(e)}function Av(n,e,t=mn){Eu(n,e).clearInstance(t)}function Rp(n){return n.options!==void 0}function _e(n){return n.settings!==void 0}function bv(){jr.clear()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rv={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},ft=new lr("app","Firebase",Rv);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Pp=class{constructor(e,t,r){this._isDeleted=!1,this._options=Object.assign({},e),this._config=Object.assign({},t),this._name=t.name,this._automaticDataCollectionEnabled=t.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new ot("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw ft.create("app-deleted",{appName:this._name})}};/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pv extends Pp{constructor(e,t,r,i){const s=t.automaticDataCollectionEnabled!==void 0?t.automaticDataCollectionEnabled:!1,o={name:r,automaticDataCollectionEnabled:s};if(e.apiKey!==void 0)super(e,o,i);else{const c=e;super(c.options,o,i)}this._serverConfig=Object.assign({automaticDataCollectionEnabled:s},t),this._finalizationRegistry=null,typeof FinalizationRegistry<"u"&&(this._finalizationRegistry=new FinalizationRegistry(()=>{this.automaticCleanup()})),this._refCount=0,this.incRefCount(this._serverConfig.releaseOnDeref),this._serverConfig.releaseOnDeref=void 0,t.releaseOnDeref=void 0,Ye(Fo,xc,"serverapp")}toJSON(){}get refCount(){return this._refCount}incRefCount(e){this.isDeleted||(this._refCount++,e!==void 0&&this._finalizationRegistry!==null&&this._finalizationRegistry.register(e,this))}decRefCount(){return this.isDeleted?0:--this._refCount}automaticCleanup(){bu(this)}get settings(){return this.checkDestroyed(),this._serverConfig}checkDestroyed(){if(this.isDeleted)throw ft.create("server-app-deleted")}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ht=Tv;function Au(n,e={}){let t=n;typeof e!="object"&&(e={name:e});const r=Object.assign({name:mn,automaticDataCollectionEnabled:!1},e),i=r.name;if(typeof i!="string"||!i)throw ft.create("bad-app-name",{appName:String(i)});if(t||(t=pp()),!t)throw ft.create("no-options");const s=gn.get(i);if(s){if(os(t,s.options)&&os(r,s.config))return s;throw ft.create("duplicate-app",{appName:i})}const o=new wp(i);for(const u of jr.values())o.addComponent(u);const c=new Pp(t,r,o);return gn.set(i,c),c}function Sv(n,e){if(vI()&&!gp())throw ft.create("invalid-server-app-environment");e.automaticDataCollectionEnabled===void 0&&(e.automaticDataCollectionEnabled=!1);let t;Rp(n)?t=n.options:t=n;const r=Object.assign(Object.assign({},e),t);r.releaseOnDeref!==void 0&&delete r.releaseOnDeref;const i=h=>[...h].reduce((f,p)=>Math.imul(31,f)+p.charCodeAt(0)|0,0);if(e.releaseOnDeref!==void 0&&typeof FinalizationRegistry>"u")throw ft.create("finalization-registry-not-supported",{});const s=""+i(JSON.stringify(r)),o=qr.get(s);if(o)return o.incRefCount(e.releaseOnDeref),o;const c=new wp(s);for(const h of jr.values())c.addComponent(h);const u=new Pv(t,e,s,c);return qr.set(s,u),u}function Sp(n=mn){const e=gn.get(n);if(!e&&n===mn&&pp())return Au();if(!e)throw ft.create("no-app",{appName:n});return e}function Cv(){return Array.from(gn.values())}async function bu(n){let e=!1;const t=n.name;gn.has(t)?(e=!0,gn.delete(t)):qr.has(t)&&n.decRefCount()<=0&&(qr.delete(t),e=!0),e&&(await Promise.all(n.container.getProviders().map(r=>r.delete())),n.isDeleted=!0)}function Ye(n,e,t){var r;let i=(r=Ev[n])!==null&&r!==void 0?r:n;t&&(i+=`-${t}`);const s=i.match(/\s|\//),o=e.match(/\s|\//);if(s||o){const c=[`Unable to register library "${i}" with version "${e}":`];s&&c.push(`library name "${i}" contains illegal characters (whitespace or "/")`),s&&o&&c.push("and"),o&&c.push(`version name "${e}" contains illegal characters (whitespace or "/")`),zt.warn(c.join(" "));return}St(new ot(`${i}-version`,()=>({library:i,version:e}),"VERSION"))}function Cp(n,e){if(n!==null&&typeof n!="function")throw ft.create("invalid-log-argument");LI(n,e)}function kp(n){xI(n)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const kv="firebase-heartbeat-database",Dv=1,cs="firebase-heartbeat-store";let yc=null;function Dp(){return yc||(yc=GI(kv,Dv,{upgrade:(n,e)=>{switch(e){case 0:try{n.createObjectStore(cs)}catch(t){console.warn(t)}}}}).catch(n=>{throw ft.create("idb-open",{originalErrorMessage:n.message})})),yc}async function Nv(n){try{const t=(await Dp()).transaction(cs),r=await t.objectStore(cs).get(Np(n));return await t.done,r}catch(e){if(e instanceof Pe)zt.warn(e.message);else{const t=ft.create("idb-get",{originalErrorMessage:e==null?void 0:e.message});zt.warn(t.message)}}}async function ud(n,e){try{const r=(await Dp()).transaction(cs,"readwrite");await r.objectStore(cs).put(e,Np(n)),await r.done}catch(t){if(t instanceof Pe)zt.warn(t.message);else{const r=ft.create("idb-set",{originalErrorMessage:t==null?void 0:t.message});zt.warn(r.message)}}}function Np(n){return`${n.name}!${n.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Vv=1024,Ov=720*60*60*1e3;class xv{constructor(e){this.container=e,this._heartbeatsCache=null;const t=this.container.getProvider("app").getImmediate();this._storage=new Mv(t),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var e,t;try{const i=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),s=ld();return((e=this._heartbeatsCache)===null||e===void 0?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===s||this._heartbeatsCache.heartbeats.some(o=>o.date===s)?void 0:(this._heartbeatsCache.heartbeats.push({date:s,agent:i}),this._heartbeatsCache.heartbeats=this._heartbeatsCache.heartbeats.filter(o=>{const c=new Date(o.date).valueOf();return Date.now()-c<=Ov}),this._storage.overwrite(this._heartbeatsCache))}catch(r){zt.warn(r)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)===null||e===void 0?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const t=ld(),{heartbeatsToSend:r,unsentEntries:i}=Lv(this._heartbeatsCache.heartbeats),s=Lo(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=t,i.length>0?(this._heartbeatsCache.heartbeats=i,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),s}catch(t){return zt.warn(t),""}}}function ld(){return new Date().toISOString().substring(0,10)}function Lv(n,e=Vv){const t=[];let r=n.slice();for(const i of n){const s=t.find(o=>o.agent===i.agent);if(s){if(s.dates.push(i.date),hd(t)>e){s.dates.pop();break}}else if(t.push({agent:i.agent,dates:[i.date]}),hd(t)>e){t.pop();break}r=r.slice(1)}return{heartbeatsToSend:t,unsentEntries:r}}class Mv{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return ss()?TI().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const t=await Nv(this.app);return t!=null&&t.heartbeats?t:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){var t;if(await this._canUseIndexedDBPromise){const i=await this.read();return ud(this.app,{lastSentHeartbeatDate:(t=e.lastSentHeartbeatDate)!==null&&t!==void 0?t:i.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){var t;if(await this._canUseIndexedDBPromise){const i=await this.read();return ud(this.app,{lastSentHeartbeatDate:(t=e.lastSentHeartbeatDate)!==null&&t!==void 0?t:i.lastSentHeartbeatDate,heartbeats:[...i.heartbeats,...e.heartbeats]})}else return}}function hd(n){return Lo(JSON.stringify({version:2,heartbeats:n})).length}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Fv(n){St(new ot("platform-logger",e=>new HI(e),"PRIVATE")),St(new ot("heartbeat",e=>new xv(e),"PRIVATE")),Ye(Fo,xc,n),Ye(Fo,xc,"esm2017"),Ye("fire-js","")}Fv("");const Uv=Object.freeze(Object.defineProperty({__proto__:null,FirebaseError:Pe,SDK_VERSION:Ht,_DEFAULT_ENTRY_NAME:mn,_addComponent:as,_addOrOverwriteComponent:bp,_apps:gn,_clearComponents:bv,_components:jr,_getProvider:Eu,_isFirebaseApp:Rp,_isFirebaseServerApp:_e,_registerComponent:St,_removeServiceInstance:Av,_serverApps:qr,deleteApp:bu,getApp:Sp,getApps:Cv,initializeApp:Au,initializeServerApp:Sv,onLog:Cp,registerVersion:Ye,setLogLevel:kp},Symbol.toStringTag,{value:"Module"}));/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Bv{constructor(e,t){this._delegate=e,this.firebase=t,as(e,new ot("app-compat",()=>this,"PUBLIC")),this.container=e.container}get automaticDataCollectionEnabled(){return this._delegate.automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this._delegate.automaticDataCollectionEnabled=e}get name(){return this._delegate.name}get options(){return this._delegate.options}delete(){return new Promise(e=>{this._delegate.checkDestroyed(),e()}).then(()=>(this.firebase.INTERNAL.removeApp(this.name),bu(this._delegate)))}_getService(e,t=mn){var r;this._delegate.checkDestroyed();const i=this._delegate.container.getProvider(e);return!i.isInitialized()&&((r=i.getComponent())===null||r===void 0?void 0:r.instantiationMode)==="EXPLICIT"&&i.initialize(),i.getImmediate({identifier:t})}_removeServiceInstance(e,t=mn){this._delegate.container.getProvider(e).clearInstance(t)}_addComponent(e){as(this._delegate,e)}_addOrOverwriteComponent(e){bp(this._delegate,e)}toJSON(){return{name:this.name,automaticDataCollectionEnabled:this.automaticDataCollectionEnabled,options:this.options}}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qv={"no-app":"No Firebase App '{$appName}' has been created - call Firebase App.initializeApp()","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance."},dd=new lr("app-compat","Firebase",qv);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function jv(n){const e={},t={__esModule:!0,initializeApp:s,app:i,registerVersion:Ye,setLogLevel:kp,onLog:Cp,apps:null,SDK_VERSION:Ht,INTERNAL:{registerComponent:c,removeApp:r,useAsService:u,modularAPIs:Uv}};t.default=t,Object.defineProperty(t,"apps",{get:o});function r(h){delete e[h]}function i(h){if(h=h||mn,!id(e,h))throw dd.create("no-app",{appName:h});return e[h]}i.App=n;function s(h,f={}){const p=Au(h,f);if(id(e,p.name))return e[p.name];const g=new n(p,t);return e[p.name]=g,g}function o(){return Object.keys(e).map(h=>e[h])}function c(h){const f=h.name,p=f.replace("-compat","");if(St(h)&&h.type==="PUBLIC"){const g=(T=i())=>{if(typeof T[p]!="function")throw dd.create("invalid-app-argument",{appName:f});return T[p]()};h.serviceProps!==void 0&&Mo(g,h.serviceProps),t[p]=g,n.prototype[p]=function(...T){return this._getService.bind(this,f).apply(this,h.multipleInstances?T:[])}}return h.type==="PUBLIC"?t[p]:null}function u(h,f){return f==="serverAuth"?null:f}return t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Vp(){const n=jv(Bv);n.INTERNAL=Object.assign(Object.assign({},n.INTERNAL),{createFirebaseNamespace:Vp,extendNamespace:e,createSubscribe:vp,ErrorFactory:lr,deepExtend:Mo});function e(t){Mo(n,t)}return n}const $v=Vp();/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const fd=new oa("@firebase/app-compat"),zv="@firebase/app-compat",Gv="0.2.43";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Kv(n){Ye(zv,Gv,n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */try{const n=fp();if(n.firebase!==void 0){fd.warn(`
      Warning: Firebase is already defined in the global scope. Please make sure
      Firebase library is only loaded once.
    `);const e=n.firebase.SDK_VERSION;e&&e.indexOf("LITE")>=0&&fd.warn(`
        Warning: You are trying to load Firebase while using Firebase Performance standalone script.
        You should load Firebase Performance with this instance of Firebase to avoid loading duplicate code.
        `)}}catch{}const bn=$v;Kv();var Wv="firebase",Hv="10.14.1";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */bn.registerVersion(Wv,Hv,"app-compat");var pd=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var Wn,Op;(function(){var n;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function e(v,_){function y(){}y.prototype=_.prototype,v.D=_.prototype,v.prototype=new y,v.prototype.constructor=v,v.C=function(w,E,R){for(var I=Array(arguments.length-2),Vt=2;Vt<arguments.length;Vt++)I[Vt-2]=arguments[Vt];return _.prototype[E].apply(w,I)}}function t(){this.blockSize=-1}function r(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.B=Array(this.blockSize),this.o=this.h=0,this.s()}e(r,t),r.prototype.s=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function i(v,_,y){y||(y=0);var w=Array(16);if(typeof _=="string")for(var E=0;16>E;++E)w[E]=_.charCodeAt(y++)|_.charCodeAt(y++)<<8|_.charCodeAt(y++)<<16|_.charCodeAt(y++)<<24;else for(E=0;16>E;++E)w[E]=_[y++]|_[y++]<<8|_[y++]<<16|_[y++]<<24;_=v.g[0],y=v.g[1],E=v.g[2];var R=v.g[3],I=_+(R^y&(E^R))+w[0]+3614090360&4294967295;_=y+(I<<7&4294967295|I>>>25),I=R+(E^_&(y^E))+w[1]+3905402710&4294967295,R=_+(I<<12&4294967295|I>>>20),I=E+(y^R&(_^y))+w[2]+606105819&4294967295,E=R+(I<<17&4294967295|I>>>15),I=y+(_^E&(R^_))+w[3]+3250441966&4294967295,y=E+(I<<22&4294967295|I>>>10),I=_+(R^y&(E^R))+w[4]+4118548399&4294967295,_=y+(I<<7&4294967295|I>>>25),I=R+(E^_&(y^E))+w[5]+1200080426&4294967295,R=_+(I<<12&4294967295|I>>>20),I=E+(y^R&(_^y))+w[6]+2821735955&4294967295,E=R+(I<<17&4294967295|I>>>15),I=y+(_^E&(R^_))+w[7]+4249261313&4294967295,y=E+(I<<22&4294967295|I>>>10),I=_+(R^y&(E^R))+w[8]+1770035416&4294967295,_=y+(I<<7&4294967295|I>>>25),I=R+(E^_&(y^E))+w[9]+2336552879&4294967295,R=_+(I<<12&4294967295|I>>>20),I=E+(y^R&(_^y))+w[10]+4294925233&4294967295,E=R+(I<<17&4294967295|I>>>15),I=y+(_^E&(R^_))+w[11]+2304563134&4294967295,y=E+(I<<22&4294967295|I>>>10),I=_+(R^y&(E^R))+w[12]+1804603682&4294967295,_=y+(I<<7&4294967295|I>>>25),I=R+(E^_&(y^E))+w[13]+4254626195&4294967295,R=_+(I<<12&4294967295|I>>>20),I=E+(y^R&(_^y))+w[14]+2792965006&4294967295,E=R+(I<<17&4294967295|I>>>15),I=y+(_^E&(R^_))+w[15]+1236535329&4294967295,y=E+(I<<22&4294967295|I>>>10),I=_+(E^R&(y^E))+w[1]+4129170786&4294967295,_=y+(I<<5&4294967295|I>>>27),I=R+(y^E&(_^y))+w[6]+3225465664&4294967295,R=_+(I<<9&4294967295|I>>>23),I=E+(_^y&(R^_))+w[11]+643717713&4294967295,E=R+(I<<14&4294967295|I>>>18),I=y+(R^_&(E^R))+w[0]+3921069994&4294967295,y=E+(I<<20&4294967295|I>>>12),I=_+(E^R&(y^E))+w[5]+3593408605&4294967295,_=y+(I<<5&4294967295|I>>>27),I=R+(y^E&(_^y))+w[10]+38016083&4294967295,R=_+(I<<9&4294967295|I>>>23),I=E+(_^y&(R^_))+w[15]+3634488961&4294967295,E=R+(I<<14&4294967295|I>>>18),I=y+(R^_&(E^R))+w[4]+3889429448&4294967295,y=E+(I<<20&4294967295|I>>>12),I=_+(E^R&(y^E))+w[9]+568446438&4294967295,_=y+(I<<5&4294967295|I>>>27),I=R+(y^E&(_^y))+w[14]+3275163606&4294967295,R=_+(I<<9&4294967295|I>>>23),I=E+(_^y&(R^_))+w[3]+4107603335&4294967295,E=R+(I<<14&4294967295|I>>>18),I=y+(R^_&(E^R))+w[8]+1163531501&4294967295,y=E+(I<<20&4294967295|I>>>12),I=_+(E^R&(y^E))+w[13]+2850285829&4294967295,_=y+(I<<5&4294967295|I>>>27),I=R+(y^E&(_^y))+w[2]+4243563512&4294967295,R=_+(I<<9&4294967295|I>>>23),I=E+(_^y&(R^_))+w[7]+1735328473&4294967295,E=R+(I<<14&4294967295|I>>>18),I=y+(R^_&(E^R))+w[12]+2368359562&4294967295,y=E+(I<<20&4294967295|I>>>12),I=_+(y^E^R)+w[5]+4294588738&4294967295,_=y+(I<<4&4294967295|I>>>28),I=R+(_^y^E)+w[8]+2272392833&4294967295,R=_+(I<<11&4294967295|I>>>21),I=E+(R^_^y)+w[11]+1839030562&4294967295,E=R+(I<<16&4294967295|I>>>16),I=y+(E^R^_)+w[14]+4259657740&4294967295,y=E+(I<<23&4294967295|I>>>9),I=_+(y^E^R)+w[1]+2763975236&4294967295,_=y+(I<<4&4294967295|I>>>28),I=R+(_^y^E)+w[4]+1272893353&4294967295,R=_+(I<<11&4294967295|I>>>21),I=E+(R^_^y)+w[7]+4139469664&4294967295,E=R+(I<<16&4294967295|I>>>16),I=y+(E^R^_)+w[10]+3200236656&4294967295,y=E+(I<<23&4294967295|I>>>9),I=_+(y^E^R)+w[13]+681279174&4294967295,_=y+(I<<4&4294967295|I>>>28),I=R+(_^y^E)+w[0]+3936430074&4294967295,R=_+(I<<11&4294967295|I>>>21),I=E+(R^_^y)+w[3]+3572445317&4294967295,E=R+(I<<16&4294967295|I>>>16),I=y+(E^R^_)+w[6]+76029189&4294967295,y=E+(I<<23&4294967295|I>>>9),I=_+(y^E^R)+w[9]+3654602809&4294967295,_=y+(I<<4&4294967295|I>>>28),I=R+(_^y^E)+w[12]+3873151461&4294967295,R=_+(I<<11&4294967295|I>>>21),I=E+(R^_^y)+w[15]+530742520&4294967295,E=R+(I<<16&4294967295|I>>>16),I=y+(E^R^_)+w[2]+3299628645&4294967295,y=E+(I<<23&4294967295|I>>>9),I=_+(E^(y|~R))+w[0]+4096336452&4294967295,_=y+(I<<6&4294967295|I>>>26),I=R+(y^(_|~E))+w[7]+1126891415&4294967295,R=_+(I<<10&4294967295|I>>>22),I=E+(_^(R|~y))+w[14]+2878612391&4294967295,E=R+(I<<15&4294967295|I>>>17),I=y+(R^(E|~_))+w[5]+4237533241&4294967295,y=E+(I<<21&4294967295|I>>>11),I=_+(E^(y|~R))+w[12]+1700485571&4294967295,_=y+(I<<6&4294967295|I>>>26),I=R+(y^(_|~E))+w[3]+2399980690&4294967295,R=_+(I<<10&4294967295|I>>>22),I=E+(_^(R|~y))+w[10]+4293915773&4294967295,E=R+(I<<15&4294967295|I>>>17),I=y+(R^(E|~_))+w[1]+2240044497&4294967295,y=E+(I<<21&4294967295|I>>>11),I=_+(E^(y|~R))+w[8]+1873313359&4294967295,_=y+(I<<6&4294967295|I>>>26),I=R+(y^(_|~E))+w[15]+4264355552&4294967295,R=_+(I<<10&4294967295|I>>>22),I=E+(_^(R|~y))+w[6]+2734768916&4294967295,E=R+(I<<15&4294967295|I>>>17),I=y+(R^(E|~_))+w[13]+1309151649&4294967295,y=E+(I<<21&4294967295|I>>>11),I=_+(E^(y|~R))+w[4]+4149444226&4294967295,_=y+(I<<6&4294967295|I>>>26),I=R+(y^(_|~E))+w[11]+3174756917&4294967295,R=_+(I<<10&4294967295|I>>>22),I=E+(_^(R|~y))+w[2]+718787259&4294967295,E=R+(I<<15&4294967295|I>>>17),I=y+(R^(E|~_))+w[9]+3951481745&4294967295,v.g[0]=v.g[0]+_&4294967295,v.g[1]=v.g[1]+(E+(I<<21&4294967295|I>>>11))&4294967295,v.g[2]=v.g[2]+E&4294967295,v.g[3]=v.g[3]+R&4294967295}r.prototype.u=function(v,_){_===void 0&&(_=v.length);for(var y=_-this.blockSize,w=this.B,E=this.h,R=0;R<_;){if(E==0)for(;R<=y;)i(this,v,R),R+=this.blockSize;if(typeof v=="string"){for(;R<_;)if(w[E++]=v.charCodeAt(R++),E==this.blockSize){i(this,w),E=0;break}}else for(;R<_;)if(w[E++]=v[R++],E==this.blockSize){i(this,w),E=0;break}}this.h=E,this.o+=_},r.prototype.v=function(){var v=Array((56>this.h?this.blockSize:2*this.blockSize)-this.h);v[0]=128;for(var _=1;_<v.length-8;++_)v[_]=0;var y=8*this.o;for(_=v.length-8;_<v.length;++_)v[_]=y&255,y/=256;for(this.u(v),v=Array(16),_=y=0;4>_;++_)for(var w=0;32>w;w+=8)v[y++]=this.g[_]>>>w&255;return v};function s(v,_){var y=c;return Object.prototype.hasOwnProperty.call(y,v)?y[v]:y[v]=_(v)}function o(v,_){this.h=_;for(var y=[],w=!0,E=v.length-1;0<=E;E--){var R=v[E]|0;w&&R==_||(y[E]=R,w=!1)}this.g=y}var c={};function u(v){return-128<=v&&128>v?s(v,function(_){return new o([_|0],0>_?-1:0)}):new o([v|0],0>v?-1:0)}function h(v){if(isNaN(v)||!isFinite(v))return p;if(0>v)return k(h(-v));for(var _=[],y=1,w=0;v>=y;w++)_[w]=v/y|0,y*=4294967296;return new o(_,0)}function f(v,_){if(v.length==0)throw Error("number format error: empty string");if(_=_||10,2>_||36<_)throw Error("radix out of range: "+_);if(v.charAt(0)=="-")return k(f(v.substring(1),_));if(0<=v.indexOf("-"))throw Error('number format error: interior "-" character');for(var y=h(Math.pow(_,8)),w=p,E=0;E<v.length;E+=8){var R=Math.min(8,v.length-E),I=parseInt(v.substring(E,E+R),_);8>R?(R=h(Math.pow(_,R)),w=w.j(R).add(h(I))):(w=w.j(y),w=w.add(h(I)))}return w}var p=u(0),g=u(1),T=u(16777216);n=o.prototype,n.m=function(){if(D(this))return-k(this).m();for(var v=0,_=1,y=0;y<this.g.length;y++){var w=this.i(y);v+=(0<=w?w:4294967296+w)*_,_*=4294967296}return v},n.toString=function(v){if(v=v||10,2>v||36<v)throw Error("radix out of range: "+v);if(C(this))return"0";if(D(this))return"-"+k(this).toString(v);for(var _=h(Math.pow(v,6)),y=this,w="";;){var E=G(y,_).g;y=j(y,E.j(_));var R=((0<y.g.length?y.g[0]:y.h)>>>0).toString(v);if(y=E,C(y))return R+w;for(;6>R.length;)R="0"+R;w=R+w}},n.i=function(v){return 0>v?0:v<this.g.length?this.g[v]:this.h};function C(v){if(v.h!=0)return!1;for(var _=0;_<v.g.length;_++)if(v.g[_]!=0)return!1;return!0}function D(v){return v.h==-1}n.l=function(v){return v=j(this,v),D(v)?-1:C(v)?0:1};function k(v){for(var _=v.g.length,y=[],w=0;w<_;w++)y[w]=~v.g[w];return new o(y,~v.h).add(g)}n.abs=function(){return D(this)?k(this):this},n.add=function(v){for(var _=Math.max(this.g.length,v.g.length),y=[],w=0,E=0;E<=_;E++){var R=w+(this.i(E)&65535)+(v.i(E)&65535),I=(R>>>16)+(this.i(E)>>>16)+(v.i(E)>>>16);w=I>>>16,R&=65535,I&=65535,y[E]=I<<16|R}return new o(y,y[y.length-1]&-2147483648?-1:0)};function j(v,_){return v.add(k(_))}n.j=function(v){if(C(this)||C(v))return p;if(D(this))return D(v)?k(this).j(k(v)):k(k(this).j(v));if(D(v))return k(this.j(k(v)));if(0>this.l(T)&&0>v.l(T))return h(this.m()*v.m());for(var _=this.g.length+v.g.length,y=[],w=0;w<2*_;w++)y[w]=0;for(w=0;w<this.g.length;w++)for(var E=0;E<v.g.length;E++){var R=this.i(w)>>>16,I=this.i(w)&65535,Vt=v.i(E)>>>16,_i=v.i(E)&65535;y[2*w+2*E]+=I*_i,z(y,2*w+2*E),y[2*w+2*E+1]+=R*_i,z(y,2*w+2*E+1),y[2*w+2*E+1]+=I*Vt,z(y,2*w+2*E+1),y[2*w+2*E+2]+=R*Vt,z(y,2*w+2*E+2)}for(w=0;w<_;w++)y[w]=y[2*w+1]<<16|y[2*w];for(w=_;w<2*_;w++)y[w]=0;return new o(y,0)};function z(v,_){for(;(v[_]&65535)!=v[_];)v[_+1]+=v[_]>>>16,v[_]&=65535,_++}function F(v,_){this.g=v,this.h=_}function G(v,_){if(C(_))throw Error("division by zero");if(C(v))return new F(p,p);if(D(v))return _=G(k(v),_),new F(k(_.g),k(_.h));if(D(_))return _=G(v,k(_)),new F(k(_.g),_.h);if(30<v.g.length){if(D(v)||D(_))throw Error("slowDivide_ only works with positive integers.");for(var y=g,w=_;0>=w.l(v);)y=J(y),w=J(w);var E=K(y,1),R=K(w,1);for(w=K(w,2),y=K(y,2);!C(w);){var I=R.add(w);0>=I.l(v)&&(E=E.add(y),R=I),w=K(w,1),y=K(y,1)}return _=j(v,E.j(_)),new F(E,_)}for(E=p;0<=v.l(_);){for(y=Math.max(1,Math.floor(v.m()/_.m())),w=Math.ceil(Math.log(y)/Math.LN2),w=48>=w?1:Math.pow(2,w-48),R=h(y),I=R.j(_);D(I)||0<I.l(v);)y-=w,R=h(y),I=R.j(_);C(R)&&(R=g),E=E.add(R),v=j(v,I)}return new F(E,v)}n.A=function(v){return G(this,v).h},n.and=function(v){for(var _=Math.max(this.g.length,v.g.length),y=[],w=0;w<_;w++)y[w]=this.i(w)&v.i(w);return new o(y,this.h&v.h)},n.or=function(v){for(var _=Math.max(this.g.length,v.g.length),y=[],w=0;w<_;w++)y[w]=this.i(w)|v.i(w);return new o(y,this.h|v.h)},n.xor=function(v){for(var _=Math.max(this.g.length,v.g.length),y=[],w=0;w<_;w++)y[w]=this.i(w)^v.i(w);return new o(y,this.h^v.h)};function J(v){for(var _=v.g.length+1,y=[],w=0;w<_;w++)y[w]=v.i(w)<<1|v.i(w-1)>>>31;return new o(y,v.h)}function K(v,_){var y=_>>5;_%=32;for(var w=v.g.length-y,E=[],R=0;R<w;R++)E[R]=0<_?v.i(R+y)>>>_|v.i(R+y+1)<<32-_:v.i(R+y);return new o(E,v.h)}r.prototype.digest=r.prototype.v,r.prototype.reset=r.prototype.s,r.prototype.update=r.prototype.u,Op=r,o.prototype.add=o.prototype.add,o.prototype.multiply=o.prototype.j,o.prototype.modulo=o.prototype.A,o.prototype.compare=o.prototype.l,o.prototype.toNumber=o.prototype.m,o.prototype.toString=o.prototype.toString,o.prototype.getBits=o.prototype.i,o.fromNumber=h,o.fromString=f,Wn=o}).apply(typeof pd<"u"?pd:typeof self<"u"?self:typeof window<"u"?window:{});var po=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var xp,zi,Lp,Ao,Lc,Mp,Fp,Up;(function(){var n,e=typeof Object.defineProperties=="function"?Object.defineProperty:function(a,l,d){return a==Array.prototype||a==Object.prototype||(a[l]=d.value),a};function t(a){a=[typeof globalThis=="object"&&globalThis,a,typeof window=="object"&&window,typeof self=="object"&&self,typeof po=="object"&&po];for(var l=0;l<a.length;++l){var d=a[l];if(d&&d.Math==Math)return d}throw Error("Cannot find global object")}var r=t(this);function i(a,l){if(l)e:{var d=r;a=a.split(".");for(var m=0;m<a.length-1;m++){var A=a[m];if(!(A in d))break e;d=d[A]}a=a[a.length-1],m=d[a],l=l(m),l!=m&&l!=null&&e(d,a,{configurable:!0,writable:!0,value:l})}}function s(a,l){a instanceof String&&(a+="");var d=0,m=!1,A={next:function(){if(!m&&d<a.length){var S=d++;return{value:l(S,a[S]),done:!1}}return m=!0,{done:!0,value:void 0}}};return A[Symbol.iterator]=function(){return A},A}i("Array.prototype.values",function(a){return a||function(){return s(this,function(l,d){return d})}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var o=o||{},c=this||self;function u(a){var l=typeof a;return l=l!="object"?l:a?Array.isArray(a)?"array":l:"null",l=="array"||l=="object"&&typeof a.length=="number"}function h(a){var l=typeof a;return l=="object"&&a!=null||l=="function"}function f(a,l,d){return a.call.apply(a.bind,arguments)}function p(a,l,d){if(!a)throw Error();if(2<arguments.length){var m=Array.prototype.slice.call(arguments,2);return function(){var A=Array.prototype.slice.call(arguments);return Array.prototype.unshift.apply(A,m),a.apply(l,A)}}return function(){return a.apply(l,arguments)}}function g(a,l,d){return g=Function.prototype.bind&&Function.prototype.bind.toString().indexOf("native code")!=-1?f:p,g.apply(null,arguments)}function T(a,l){var d=Array.prototype.slice.call(arguments,1);return function(){var m=d.slice();return m.push.apply(m,arguments),a.apply(this,m)}}function C(a,l){function d(){}d.prototype=l.prototype,a.aa=l.prototype,a.prototype=new d,a.prototype.constructor=a,a.Qb=function(m,A,S){for(var x=Array(arguments.length-2),ie=2;ie<arguments.length;ie++)x[ie-2]=arguments[ie];return l.prototype[A].apply(m,x)}}function D(a){const l=a.length;if(0<l){const d=Array(l);for(let m=0;m<l;m++)d[m]=a[m];return d}return[]}function k(a,l){for(let d=1;d<arguments.length;d++){const m=arguments[d];if(u(m)){const A=a.length||0,S=m.length||0;a.length=A+S;for(let x=0;x<S;x++)a[A+x]=m[x]}else a.push(m)}}class j{constructor(l,d){this.i=l,this.j=d,this.h=0,this.g=null}get(){let l;return 0<this.h?(this.h--,l=this.g,this.g=l.next,l.next=null):l=this.i(),l}}function z(a){return/^[\s\xa0]*$/.test(a)}function F(){var a=c.navigator;return a&&(a=a.userAgent)?a:""}function G(a){return G[" "](a),a}G[" "]=function(){};var J=F().indexOf("Gecko")!=-1&&!(F().toLowerCase().indexOf("webkit")!=-1&&F().indexOf("Edge")==-1)&&!(F().indexOf("Trident")!=-1||F().indexOf("MSIE")!=-1)&&F().indexOf("Edge")==-1;function K(a,l,d){for(const m in a)l.call(d,a[m],m,a)}function v(a,l){for(const d in a)l.call(void 0,a[d],d,a)}function _(a){const l={};for(const d in a)l[d]=a[d];return l}const y="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function w(a,l){let d,m;for(let A=1;A<arguments.length;A++){m=arguments[A];for(d in m)a[d]=m[d];for(let S=0;S<y.length;S++)d=y[S],Object.prototype.hasOwnProperty.call(m,d)&&(a[d]=m[d])}}function E(a){var l=1;a=a.split(":");const d=[];for(;0<l&&a.length;)d.push(a.shift()),l--;return a.length&&d.push(a.join(":")),d}function R(a){c.setTimeout(()=>{throw a},0)}function I(){var a=za;let l=null;return a.g&&(l=a.g,a.g=a.g.next,a.g||(a.h=null),l.next=null),l}class Vt{constructor(){this.h=this.g=null}add(l,d){const m=_i.get();m.set(l,d),this.h?this.h.next=m:this.g=m,this.h=m}}var _i=new j(()=>new Py,a=>a.reset());class Py{constructor(){this.next=this.g=this.h=null}set(l,d){this.h=l,this.g=d,this.next=null}reset(){this.next=this.g=this.h=null}}let yi,Ii=!1,za=new Vt,rh=()=>{const a=c.Promise.resolve(void 0);yi=()=>{a.then(Sy)}};var Sy=()=>{for(var a;a=I();){try{a.h.call(a.g)}catch(d){R(d)}var l=_i;l.j(a),100>l.h&&(l.h++,a.next=l.g,l.g=a)}Ii=!1};function tn(){this.s=this.s,this.C=this.C}tn.prototype.s=!1,tn.prototype.ma=function(){this.s||(this.s=!0,this.N())},tn.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function Fe(a,l){this.type=a,this.g=this.target=l,this.defaultPrevented=!1}Fe.prototype.h=function(){this.defaultPrevented=!0};var Cy=(function(){if(!c.addEventListener||!Object.defineProperty)return!1;var a=!1,l=Object.defineProperty({},"passive",{get:function(){a=!0}});try{const d=()=>{};c.addEventListener("test",d,l),c.removeEventListener("test",d,l)}catch{}return a})();function vi(a,l){if(Fe.call(this,a?a.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,a){var d=this.type=a.type,m=a.changedTouches&&a.changedTouches.length?a.changedTouches[0]:null;if(this.target=a.target||a.srcElement,this.g=l,l=a.relatedTarget){if(J){e:{try{G(l.nodeName);var A=!0;break e}catch{}A=!1}A||(l=null)}}else d=="mouseover"?l=a.fromElement:d=="mouseout"&&(l=a.toElement);this.relatedTarget=l,m?(this.clientX=m.clientX!==void 0?m.clientX:m.pageX,this.clientY=m.clientY!==void 0?m.clientY:m.pageY,this.screenX=m.screenX||0,this.screenY=m.screenY||0):(this.clientX=a.clientX!==void 0?a.clientX:a.pageX,this.clientY=a.clientY!==void 0?a.clientY:a.pageY,this.screenX=a.screenX||0,this.screenY=a.screenY||0),this.button=a.button,this.key=a.key||"",this.ctrlKey=a.ctrlKey,this.altKey=a.altKey,this.shiftKey=a.shiftKey,this.metaKey=a.metaKey,this.pointerId=a.pointerId||0,this.pointerType=typeof a.pointerType=="string"?a.pointerType:ky[a.pointerType]||"",this.state=a.state,this.i=a,a.defaultPrevented&&vi.aa.h.call(this)}}C(vi,Fe);var ky={2:"touch",3:"pen",4:"mouse"};vi.prototype.h=function(){vi.aa.h.call(this);var a=this.i;a.preventDefault?a.preventDefault():a.returnValue=!1};var Hs="closure_listenable_"+(1e6*Math.random()|0),Dy=0;function Ny(a,l,d,m,A){this.listener=a,this.proxy=null,this.src=l,this.type=d,this.capture=!!m,this.ha=A,this.key=++Dy,this.da=this.fa=!1}function Qs(a){a.da=!0,a.listener=null,a.proxy=null,a.src=null,a.ha=null}function Js(a){this.src=a,this.g={},this.h=0}Js.prototype.add=function(a,l,d,m,A){var S=a.toString();a=this.g[S],a||(a=this.g[S]=[],this.h++);var x=Ka(a,l,m,A);return-1<x?(l=a[x],d||(l.fa=!1)):(l=new Ny(l,this.src,S,!!m,A),l.fa=d,a.push(l)),l};function Ga(a,l){var d=l.type;if(d in a.g){var m=a.g[d],A=Array.prototype.indexOf.call(m,l,void 0),S;(S=0<=A)&&Array.prototype.splice.call(m,A,1),S&&(Qs(l),a.g[d].length==0&&(delete a.g[d],a.h--))}}function Ka(a,l,d,m){for(var A=0;A<a.length;++A){var S=a[A];if(!S.da&&S.listener==l&&S.capture==!!d&&S.ha==m)return A}return-1}var Wa="closure_lm_"+(1e6*Math.random()|0),Ha={};function ih(a,l,d,m,A){if(Array.isArray(l)){for(var S=0;S<l.length;S++)ih(a,l[S],d,m,A);return null}return d=ah(d),a&&a[Hs]?a.K(l,d,h(m)?!!m.capture:!1,A):Vy(a,l,d,!1,m,A)}function Vy(a,l,d,m,A,S){if(!l)throw Error("Invalid event type");var x=h(A)?!!A.capture:!!A,ie=Ja(a);if(ie||(a[Wa]=ie=new Js(a)),d=ie.add(l,d,m,x,S),d.proxy)return d;if(m=Oy(),d.proxy=m,m.src=a,m.listener=d,a.addEventListener)Cy||(A=x),A===void 0&&(A=!1),a.addEventListener(l.toString(),m,A);else if(a.attachEvent)a.attachEvent(oh(l.toString()),m);else if(a.addListener&&a.removeListener)a.addListener(m);else throw Error("addEventListener and attachEvent are unavailable.");return d}function Oy(){function a(d){return l.call(a.src,a.listener,d)}const l=xy;return a}function sh(a,l,d,m,A){if(Array.isArray(l))for(var S=0;S<l.length;S++)sh(a,l[S],d,m,A);else m=h(m)?!!m.capture:!!m,d=ah(d),a&&a[Hs]?(a=a.i,l=String(l).toString(),l in a.g&&(S=a.g[l],d=Ka(S,d,m,A),-1<d&&(Qs(S[d]),Array.prototype.splice.call(S,d,1),S.length==0&&(delete a.g[l],a.h--)))):a&&(a=Ja(a))&&(l=a.g[l.toString()],a=-1,l&&(a=Ka(l,d,m,A)),(d=-1<a?l[a]:null)&&Qa(d))}function Qa(a){if(typeof a!="number"&&a&&!a.da){var l=a.src;if(l&&l[Hs])Ga(l.i,a);else{var d=a.type,m=a.proxy;l.removeEventListener?l.removeEventListener(d,m,a.capture):l.detachEvent?l.detachEvent(oh(d),m):l.addListener&&l.removeListener&&l.removeListener(m),(d=Ja(l))?(Ga(d,a),d.h==0&&(d.src=null,l[Wa]=null)):Qs(a)}}}function oh(a){return a in Ha?Ha[a]:Ha[a]="on"+a}function xy(a,l){if(a.da)a=!0;else{l=new vi(l,this);var d=a.listener,m=a.ha||a.src;a.fa&&Qa(a),a=d.call(m,l)}return a}function Ja(a){return a=a[Wa],a instanceof Js?a:null}var Ya="__closure_events_fn_"+(1e9*Math.random()>>>0);function ah(a){return typeof a=="function"?a:(a[Ya]||(a[Ya]=function(l){return a.handleEvent(l)}),a[Ya])}function Ue(){tn.call(this),this.i=new Js(this),this.M=this,this.F=null}C(Ue,tn),Ue.prototype[Hs]=!0,Ue.prototype.removeEventListener=function(a,l,d,m){sh(this,a,l,d,m)};function Ge(a,l){var d,m=a.F;if(m)for(d=[];m;m=m.F)d.push(m);if(a=a.M,m=l.type||l,typeof l=="string")l=new Fe(l,a);else if(l instanceof Fe)l.target=l.target||a;else{var A=l;l=new Fe(m,a),w(l,A)}if(A=!0,d)for(var S=d.length-1;0<=S;S--){var x=l.g=d[S];A=Ys(x,m,!0,l)&&A}if(x=l.g=a,A=Ys(x,m,!0,l)&&A,A=Ys(x,m,!1,l)&&A,d)for(S=0;S<d.length;S++)x=l.g=d[S],A=Ys(x,m,!1,l)&&A}Ue.prototype.N=function(){if(Ue.aa.N.call(this),this.i){var a=this.i,l;for(l in a.g){for(var d=a.g[l],m=0;m<d.length;m++)Qs(d[m]);delete a.g[l],a.h--}}this.F=null},Ue.prototype.K=function(a,l,d,m){return this.i.add(String(a),l,!1,d,m)},Ue.prototype.L=function(a,l,d,m){return this.i.add(String(a),l,!0,d,m)};function Ys(a,l,d,m){if(l=a.i.g[String(l)],!l)return!0;l=l.concat();for(var A=!0,S=0;S<l.length;++S){var x=l[S];if(x&&!x.da&&x.capture==d){var ie=x.listener,Ve=x.ha||x.src;x.fa&&Ga(a.i,x),A=ie.call(Ve,m)!==!1&&A}}return A&&!m.defaultPrevented}function ch(a,l,d){if(typeof a=="function")d&&(a=g(a,d));else if(a&&typeof a.handleEvent=="function")a=g(a.handleEvent,a);else throw Error("Invalid listener argument");return 2147483647<Number(l)?-1:c.setTimeout(a,l||0)}function uh(a){a.g=ch(()=>{a.g=null,a.i&&(a.i=!1,uh(a))},a.l);const l=a.h;a.h=null,a.m.apply(null,l)}class Ly extends tn{constructor(l,d){super(),this.m=l,this.l=d,this.h=null,this.i=!1,this.g=null}j(l){this.h=arguments,this.g?this.i=!0:uh(this)}N(){super.N(),this.g&&(c.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function wi(a){tn.call(this),this.h=a,this.g={}}C(wi,tn);var lh=[];function hh(a){K(a.g,function(l,d){this.g.hasOwnProperty(d)&&Qa(l)},a),a.g={}}wi.prototype.N=function(){wi.aa.N.call(this),hh(this)},wi.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var Xa=c.JSON.stringify,My=c.JSON.parse,Fy=class{stringify(a){return c.JSON.stringify(a,void 0)}parse(a){return c.JSON.parse(a,void 0)}};function Za(){}Za.prototype.h=null;function dh(a){return a.h||(a.h=a.i())}function fh(){}var Ti={OPEN:"a",kb:"b",Ja:"c",wb:"d"};function ec(){Fe.call(this,"d")}C(ec,Fe);function tc(){Fe.call(this,"c")}C(tc,Fe);var Nn={},ph=null;function Xs(){return ph=ph||new Ue}Nn.La="serverreachability";function mh(a){Fe.call(this,Nn.La,a)}C(mh,Fe);function Ei(a){const l=Xs();Ge(l,new mh(l))}Nn.STAT_EVENT="statevent";function gh(a,l){Fe.call(this,Nn.STAT_EVENT,a),this.stat=l}C(gh,Fe);function Ke(a){const l=Xs();Ge(l,new gh(l,a))}Nn.Ma="timingevent";function _h(a,l){Fe.call(this,Nn.Ma,a),this.size=l}C(_h,Fe);function Ai(a,l){if(typeof a!="function")throw Error("Fn must not be null and must be a function");return c.setTimeout(function(){a()},l)}function bi(){this.g=!0}bi.prototype.xa=function(){this.g=!1};function Uy(a,l,d,m,A,S){a.info(function(){if(a.g)if(S)for(var x="",ie=S.split("&"),Ve=0;Ve<ie.length;Ve++){var ee=ie[Ve].split("=");if(1<ee.length){var Be=ee[0];ee=ee[1];var qe=Be.split("_");x=2<=qe.length&&qe[1]=="type"?x+(Be+"="+ee+"&"):x+(Be+"=redacted&")}}else x=null;else x=S;return"XMLHTTP REQ ("+m+") [attempt "+A+"]: "+l+`
`+d+`
`+x})}function By(a,l,d,m,A,S,x){a.info(function(){return"XMLHTTP RESP ("+m+") [ attempt "+A+"]: "+l+`
`+d+`
`+S+" "+x})}function _r(a,l,d,m){a.info(function(){return"XMLHTTP TEXT ("+l+"): "+jy(a,d)+(m?" "+m:"")})}function qy(a,l){a.info(function(){return"TIMEOUT: "+l})}bi.prototype.info=function(){};function jy(a,l){if(!a.g)return l;if(!l)return null;try{var d=JSON.parse(l);if(d){for(a=0;a<d.length;a++)if(Array.isArray(d[a])){var m=d[a];if(!(2>m.length)){var A=m[1];if(Array.isArray(A)&&!(1>A.length)){var S=A[0];if(S!="noop"&&S!="stop"&&S!="close")for(var x=1;x<A.length;x++)A[x]=""}}}}return Xa(d)}catch{return l}}var Zs={NO_ERROR:0,gb:1,tb:2,sb:3,nb:4,rb:5,ub:6,Ia:7,TIMEOUT:8,xb:9},yh={lb:"complete",Hb:"success",Ja:"error",Ia:"abort",zb:"ready",Ab:"readystatechange",TIMEOUT:"timeout",vb:"incrementaldata",yb:"progress",ob:"downloadprogress",Pb:"uploadprogress"},nc;function eo(){}C(eo,Za),eo.prototype.g=function(){return new XMLHttpRequest},eo.prototype.i=function(){return{}},nc=new eo;function nn(a,l,d,m){this.j=a,this.i=l,this.l=d,this.R=m||1,this.U=new wi(this),this.I=45e3,this.H=null,this.o=!1,this.m=this.A=this.v=this.L=this.F=this.S=this.B=null,this.D=[],this.g=null,this.C=0,this.s=this.u=null,this.X=-1,this.J=!1,this.O=0,this.M=null,this.W=this.K=this.T=this.P=!1,this.h=new Ih}function Ih(){this.i=null,this.g="",this.h=!1}var vh={},rc={};function ic(a,l,d){a.L=1,a.v=io(Ot(l)),a.m=d,a.P=!0,wh(a,null)}function wh(a,l){a.F=Date.now(),to(a),a.A=Ot(a.v);var d=a.A,m=a.R;Array.isArray(m)||(m=[String(m)]),xh(d.i,"t",m),a.C=0,d=a.j.J,a.h=new Ih,a.g=Zh(a.j,d?l:null,!a.m),0<a.O&&(a.M=new Ly(g(a.Y,a,a.g),a.O)),l=a.U,d=a.g,m=a.ca;var A="readystatechange";Array.isArray(A)||(A&&(lh[0]=A.toString()),A=lh);for(var S=0;S<A.length;S++){var x=ih(d,A[S],m||l.handleEvent,!1,l.h||l);if(!x)break;l.g[x.key]=x}l=a.H?_(a.H):{},a.m?(a.u||(a.u="POST"),l["Content-Type"]="application/x-www-form-urlencoded",a.g.ea(a.A,a.u,a.m,l)):(a.u="GET",a.g.ea(a.A,a.u,null,l)),Ei(),Uy(a.i,a.u,a.A,a.l,a.R,a.m)}nn.prototype.ca=function(a){a=a.target;const l=this.M;l&&xt(a)==3?l.j():this.Y(a)},nn.prototype.Y=function(a){try{if(a==this.g)e:{const qe=xt(this.g);var l=this.g.Ba();const vr=this.g.Z();if(!(3>qe)&&(qe!=3||this.g&&(this.h.h||this.g.oa()||jh(this.g)))){this.J||qe!=4||l==7||(l==8||0>=vr?Ei(3):Ei(2)),sc(this);var d=this.g.Z();this.X=d;t:if(Th(this)){var m=jh(this.g);a="";var A=m.length,S=xt(this.g)==4;if(!this.h.i){if(typeof TextDecoder>"u"){Vn(this),Ri(this);var x="";break t}this.h.i=new c.TextDecoder}for(l=0;l<A;l++)this.h.h=!0,a+=this.h.i.decode(m[l],{stream:!(S&&l==A-1)});m.length=0,this.h.g+=a,this.C=0,x=this.h.g}else x=this.g.oa();if(this.o=d==200,By(this.i,this.u,this.A,this.l,this.R,qe,d),this.o){if(this.T&&!this.K){t:{if(this.g){var ie,Ve=this.g;if((ie=Ve.g?Ve.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!z(ie)){var ee=ie;break t}}ee=null}if(d=ee)_r(this.i,this.l,d,"Initial handshake response via X-HTTP-Initial-Response"),this.K=!0,oc(this,d);else{this.o=!1,this.s=3,Ke(12),Vn(this),Ri(this);break e}}if(this.P){d=!0;let mt;for(;!this.J&&this.C<x.length;)if(mt=$y(this,x),mt==rc){qe==4&&(this.s=4,Ke(14),d=!1),_r(this.i,this.l,null,"[Incomplete Response]");break}else if(mt==vh){this.s=4,Ke(15),_r(this.i,this.l,x,"[Invalid Chunk]"),d=!1;break}else _r(this.i,this.l,mt,null),oc(this,mt);if(Th(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),qe!=4||x.length!=0||this.h.h||(this.s=1,Ke(16),d=!1),this.o=this.o&&d,!d)_r(this.i,this.l,x,"[Invalid Chunked Response]"),Vn(this),Ri(this);else if(0<x.length&&!this.W){this.W=!0;var Be=this.j;Be.g==this&&Be.ba&&!Be.M&&(Be.j.info("Great, no buffering proxy detected. Bytes received: "+x.length),dc(Be),Be.M=!0,Ke(11))}}else _r(this.i,this.l,x,null),oc(this,x);qe==4&&Vn(this),this.o&&!this.J&&(qe==4?Qh(this.j,this):(this.o=!1,to(this)))}else oI(this.g),d==400&&0<x.indexOf("Unknown SID")?(this.s=3,Ke(12)):(this.s=0,Ke(13)),Vn(this),Ri(this)}}}catch{}finally{}};function Th(a){return a.g?a.u=="GET"&&a.L!=2&&a.j.Ca:!1}function $y(a,l){var d=a.C,m=l.indexOf(`
`,d);return m==-1?rc:(d=Number(l.substring(d,m)),isNaN(d)?vh:(m+=1,m+d>l.length?rc:(l=l.slice(m,m+d),a.C=m+d,l)))}nn.prototype.cancel=function(){this.J=!0,Vn(this)};function to(a){a.S=Date.now()+a.I,Eh(a,a.I)}function Eh(a,l){if(a.B!=null)throw Error("WatchDog timer not null");a.B=Ai(g(a.ba,a),l)}function sc(a){a.B&&(c.clearTimeout(a.B),a.B=null)}nn.prototype.ba=function(){this.B=null;const a=Date.now();0<=a-this.S?(qy(this.i,this.A),this.L!=2&&(Ei(),Ke(17)),Vn(this),this.s=2,Ri(this)):Eh(this,this.S-a)};function Ri(a){a.j.G==0||a.J||Qh(a.j,a)}function Vn(a){sc(a);var l=a.M;l&&typeof l.ma=="function"&&l.ma(),a.M=null,hh(a.U),a.g&&(l=a.g,a.g=null,l.abort(),l.ma())}function oc(a,l){try{var d=a.j;if(d.G!=0&&(d.g==a||ac(d.h,a))){if(!a.K&&ac(d.h,a)&&d.G==3){try{var m=d.Da.g.parse(l)}catch{m=null}if(Array.isArray(m)&&m.length==3){var A=m;if(A[0]==0){e:if(!d.u){if(d.g)if(d.g.F+3e3<a.F)lo(d),co(d);else break e;hc(d),Ke(18)}}else d.za=A[1],0<d.za-d.T&&37500>A[2]&&d.F&&d.v==0&&!d.C&&(d.C=Ai(g(d.Za,d),6e3));if(1>=Rh(d.h)&&d.ca){try{d.ca()}catch{}d.ca=void 0}}else xn(d,11)}else if((a.K||d.g==a)&&lo(d),!z(l))for(A=d.Da.g.parse(l),l=0;l<A.length;l++){let ee=A[l];if(d.T=ee[0],ee=ee[1],d.G==2)if(ee[0]=="c"){d.K=ee[1],d.ia=ee[2];const Be=ee[3];Be!=null&&(d.la=Be,d.j.info("VER="+d.la));const qe=ee[4];qe!=null&&(d.Aa=qe,d.j.info("SVER="+d.Aa));const vr=ee[5];vr!=null&&typeof vr=="number"&&0<vr&&(m=1.5*vr,d.L=m,d.j.info("backChannelRequestTimeoutMs_="+m)),m=d;const mt=a.g;if(mt){const fo=mt.g?mt.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(fo){var S=m.h;S.g||fo.indexOf("spdy")==-1&&fo.indexOf("quic")==-1&&fo.indexOf("h2")==-1||(S.j=S.l,S.g=new Set,S.h&&(cc(S,S.h),S.h=null))}if(m.D){const fc=mt.g?mt.g.getResponseHeader("X-HTTP-Session-Id"):null;fc&&(m.ya=fc,oe(m.I,m.D,fc))}}d.G=3,d.l&&d.l.ua(),d.ba&&(d.R=Date.now()-a.F,d.j.info("Handshake RTT: "+d.R+"ms")),m=d;var x=a;if(m.qa=Xh(m,m.J?m.ia:null,m.W),x.K){Ph(m.h,x);var ie=x,Ve=m.L;Ve&&(ie.I=Ve),ie.B&&(sc(ie),to(ie)),m.g=x}else Wh(m);0<d.i.length&&uo(d)}else ee[0]!="stop"&&ee[0]!="close"||xn(d,7);else d.G==3&&(ee[0]=="stop"||ee[0]=="close"?ee[0]=="stop"?xn(d,7):lc(d):ee[0]!="noop"&&d.l&&d.l.ta(ee),d.v=0)}}Ei(4)}catch{}}var zy=class{constructor(a,l){this.g=a,this.map=l}};function Ah(a){this.l=a||10,c.PerformanceNavigationTiming?(a=c.performance.getEntriesByType("navigation"),a=0<a.length&&(a[0].nextHopProtocol=="hq"||a[0].nextHopProtocol=="h2")):a=!!(c.chrome&&c.chrome.loadTimes&&c.chrome.loadTimes()&&c.chrome.loadTimes().wasFetchedViaSpdy),this.j=a?this.l:1,this.g=null,1<this.j&&(this.g=new Set),this.h=null,this.i=[]}function bh(a){return a.h?!0:a.g?a.g.size>=a.j:!1}function Rh(a){return a.h?1:a.g?a.g.size:0}function ac(a,l){return a.h?a.h==l:a.g?a.g.has(l):!1}function cc(a,l){a.g?a.g.add(l):a.h=l}function Ph(a,l){a.h&&a.h==l?a.h=null:a.g&&a.g.has(l)&&a.g.delete(l)}Ah.prototype.cancel=function(){if(this.i=Sh(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const a of this.g.values())a.cancel();this.g.clear()}};function Sh(a){if(a.h!=null)return a.i.concat(a.h.D);if(a.g!=null&&a.g.size!==0){let l=a.i;for(const d of a.g.values())l=l.concat(d.D);return l}return D(a.i)}function Gy(a){if(a.V&&typeof a.V=="function")return a.V();if(typeof Map<"u"&&a instanceof Map||typeof Set<"u"&&a instanceof Set)return Array.from(a.values());if(typeof a=="string")return a.split("");if(u(a)){for(var l=[],d=a.length,m=0;m<d;m++)l.push(a[m]);return l}l=[],d=0;for(m in a)l[d++]=a[m];return l}function Ky(a){if(a.na&&typeof a.na=="function")return a.na();if(!a.V||typeof a.V!="function"){if(typeof Map<"u"&&a instanceof Map)return Array.from(a.keys());if(!(typeof Set<"u"&&a instanceof Set)){if(u(a)||typeof a=="string"){var l=[];a=a.length;for(var d=0;d<a;d++)l.push(d);return l}l=[],d=0;for(const m in a)l[d++]=m;return l}}}function Ch(a,l){if(a.forEach&&typeof a.forEach=="function")a.forEach(l,void 0);else if(u(a)||typeof a=="string")Array.prototype.forEach.call(a,l,void 0);else for(var d=Ky(a),m=Gy(a),A=m.length,S=0;S<A;S++)l.call(void 0,m[S],d&&d[S],a)}var kh=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function Wy(a,l){if(a){a=a.split("&");for(var d=0;d<a.length;d++){var m=a[d].indexOf("="),A=null;if(0<=m){var S=a[d].substring(0,m);A=a[d].substring(m+1)}else S=a[d];l(S,A?decodeURIComponent(A.replace(/\+/g," ")):"")}}}function On(a){if(this.g=this.o=this.j="",this.s=null,this.m=this.l="",this.h=!1,a instanceof On){this.h=a.h,no(this,a.j),this.o=a.o,this.g=a.g,ro(this,a.s),this.l=a.l;var l=a.i,d=new Ci;d.i=l.i,l.g&&(d.g=new Map(l.g),d.h=l.h),Dh(this,d),this.m=a.m}else a&&(l=String(a).match(kh))?(this.h=!1,no(this,l[1]||"",!0),this.o=Pi(l[2]||""),this.g=Pi(l[3]||"",!0),ro(this,l[4]),this.l=Pi(l[5]||"",!0),Dh(this,l[6]||"",!0),this.m=Pi(l[7]||"")):(this.h=!1,this.i=new Ci(null,this.h))}On.prototype.toString=function(){var a=[],l=this.j;l&&a.push(Si(l,Nh,!0),":");var d=this.g;return(d||l=="file")&&(a.push("//"),(l=this.o)&&a.push(Si(l,Nh,!0),"@"),a.push(encodeURIComponent(String(d)).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),d=this.s,d!=null&&a.push(":",String(d))),(d=this.l)&&(this.g&&d.charAt(0)!="/"&&a.push("/"),a.push(Si(d,d.charAt(0)=="/"?Jy:Qy,!0))),(d=this.i.toString())&&a.push("?",d),(d=this.m)&&a.push("#",Si(d,Xy)),a.join("")};function Ot(a){return new On(a)}function no(a,l,d){a.j=d?Pi(l,!0):l,a.j&&(a.j=a.j.replace(/:$/,""))}function ro(a,l){if(l){if(l=Number(l),isNaN(l)||0>l)throw Error("Bad port number "+l);a.s=l}else a.s=null}function Dh(a,l,d){l instanceof Ci?(a.i=l,Zy(a.i,a.h)):(d||(l=Si(l,Yy)),a.i=new Ci(l,a.h))}function oe(a,l,d){a.i.set(l,d)}function io(a){return oe(a,"zx",Math.floor(2147483648*Math.random()).toString(36)+Math.abs(Math.floor(2147483648*Math.random())^Date.now()).toString(36)),a}function Pi(a,l){return a?l?decodeURI(a.replace(/%25/g,"%2525")):decodeURIComponent(a):""}function Si(a,l,d){return typeof a=="string"?(a=encodeURI(a).replace(l,Hy),d&&(a=a.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),a):null}function Hy(a){return a=a.charCodeAt(0),"%"+(a>>4&15).toString(16)+(a&15).toString(16)}var Nh=/[#\/\?@]/g,Qy=/[#\?:]/g,Jy=/[#\?]/g,Yy=/[#\?@]/g,Xy=/#/g;function Ci(a,l){this.h=this.g=null,this.i=a||null,this.j=!!l}function rn(a){a.g||(a.g=new Map,a.h=0,a.i&&Wy(a.i,function(l,d){a.add(decodeURIComponent(l.replace(/\+/g," ")),d)}))}n=Ci.prototype,n.add=function(a,l){rn(this),this.i=null,a=yr(this,a);var d=this.g.get(a);return d||this.g.set(a,d=[]),d.push(l),this.h+=1,this};function Vh(a,l){rn(a),l=yr(a,l),a.g.has(l)&&(a.i=null,a.h-=a.g.get(l).length,a.g.delete(l))}function Oh(a,l){return rn(a),l=yr(a,l),a.g.has(l)}n.forEach=function(a,l){rn(this),this.g.forEach(function(d,m){d.forEach(function(A){a.call(l,A,m,this)},this)},this)},n.na=function(){rn(this);const a=Array.from(this.g.values()),l=Array.from(this.g.keys()),d=[];for(let m=0;m<l.length;m++){const A=a[m];for(let S=0;S<A.length;S++)d.push(l[m])}return d},n.V=function(a){rn(this);let l=[];if(typeof a=="string")Oh(this,a)&&(l=l.concat(this.g.get(yr(this,a))));else{a=Array.from(this.g.values());for(let d=0;d<a.length;d++)l=l.concat(a[d])}return l},n.set=function(a,l){return rn(this),this.i=null,a=yr(this,a),Oh(this,a)&&(this.h-=this.g.get(a).length),this.g.set(a,[l]),this.h+=1,this},n.get=function(a,l){return a?(a=this.V(a),0<a.length?String(a[0]):l):l};function xh(a,l,d){Vh(a,l),0<d.length&&(a.i=null,a.g.set(yr(a,l),D(d)),a.h+=d.length)}n.toString=function(){if(this.i)return this.i;if(!this.g)return"";const a=[],l=Array.from(this.g.keys());for(var d=0;d<l.length;d++){var m=l[d];const S=encodeURIComponent(String(m)),x=this.V(m);for(m=0;m<x.length;m++){var A=S;x[m]!==""&&(A+="="+encodeURIComponent(String(x[m]))),a.push(A)}}return this.i=a.join("&")};function yr(a,l){return l=String(l),a.j&&(l=l.toLowerCase()),l}function Zy(a,l){l&&!a.j&&(rn(a),a.i=null,a.g.forEach(function(d,m){var A=m.toLowerCase();m!=A&&(Vh(this,m),xh(this,A,d))},a)),a.j=l}function eI(a,l){const d=new bi;if(c.Image){const m=new Image;m.onload=T(sn,d,"TestLoadImage: loaded",!0,l,m),m.onerror=T(sn,d,"TestLoadImage: error",!1,l,m),m.onabort=T(sn,d,"TestLoadImage: abort",!1,l,m),m.ontimeout=T(sn,d,"TestLoadImage: timeout",!1,l,m),c.setTimeout(function(){m.ontimeout&&m.ontimeout()},1e4),m.src=a}else l(!1)}function tI(a,l){const d=new bi,m=new AbortController,A=setTimeout(()=>{m.abort(),sn(d,"TestPingServer: timeout",!1,l)},1e4);fetch(a,{signal:m.signal}).then(S=>{clearTimeout(A),S.ok?sn(d,"TestPingServer: ok",!0,l):sn(d,"TestPingServer: server error",!1,l)}).catch(()=>{clearTimeout(A),sn(d,"TestPingServer: error",!1,l)})}function sn(a,l,d,m,A){try{A&&(A.onload=null,A.onerror=null,A.onabort=null,A.ontimeout=null),m(d)}catch{}}function nI(){this.g=new Fy}function rI(a,l,d){const m=d||"";try{Ch(a,function(A,S){let x=A;h(A)&&(x=Xa(A)),l.push(m+S+"="+encodeURIComponent(x))})}catch(A){throw l.push(m+"type="+encodeURIComponent("_badmap")),A}}function so(a){this.l=a.Ub||null,this.j=a.eb||!1}C(so,Za),so.prototype.g=function(){return new oo(this.l,this.j)},so.prototype.i=(function(a){return function(){return a}})({});function oo(a,l){Ue.call(this),this.D=a,this.o=l,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.u=new Headers,this.h=null,this.B="GET",this.A="",this.g=!1,this.v=this.j=this.l=null}C(oo,Ue),n=oo.prototype,n.open=function(a,l){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.B=a,this.A=l,this.readyState=1,Di(this)},n.send=function(a){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");this.g=!0;const l={headers:this.u,method:this.B,credentials:this.m,cache:void 0};a&&(l.body=a),(this.D||c).fetch(new Request(this.A,l)).then(this.Sa.bind(this),this.ga.bind(this))},n.abort=function(){this.response=this.responseText="",this.u=new Headers,this.status=0,this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),1<=this.readyState&&this.g&&this.readyState!=4&&(this.g=!1,ki(this)),this.readyState=0},n.Sa=function(a){if(this.g&&(this.l=a,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=a.headers,this.readyState=2,Di(this)),this.g&&(this.readyState=3,Di(this),this.g)))if(this.responseType==="arraybuffer")a.arrayBuffer().then(this.Qa.bind(this),this.ga.bind(this));else if(typeof c.ReadableStream<"u"&&"body"in a){if(this.j=a.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.v=new TextDecoder;Lh(this)}else a.text().then(this.Ra.bind(this),this.ga.bind(this))};function Lh(a){a.j.read().then(a.Pa.bind(a)).catch(a.ga.bind(a))}n.Pa=function(a){if(this.g){if(this.o&&a.value)this.response.push(a.value);else if(!this.o){var l=a.value?a.value:new Uint8Array(0);(l=this.v.decode(l,{stream:!a.done}))&&(this.response=this.responseText+=l)}a.done?ki(this):Di(this),this.readyState==3&&Lh(this)}},n.Ra=function(a){this.g&&(this.response=this.responseText=a,ki(this))},n.Qa=function(a){this.g&&(this.response=a,ki(this))},n.ga=function(){this.g&&ki(this)};function ki(a){a.readyState=4,a.l=null,a.j=null,a.v=null,Di(a)}n.setRequestHeader=function(a,l){this.u.append(a,l)},n.getResponseHeader=function(a){return this.h&&this.h.get(a.toLowerCase())||""},n.getAllResponseHeaders=function(){if(!this.h)return"";const a=[],l=this.h.entries();for(var d=l.next();!d.done;)d=d.value,a.push(d[0]+": "+d[1]),d=l.next();return a.join(`\r
`)};function Di(a){a.onreadystatechange&&a.onreadystatechange.call(a)}Object.defineProperty(oo.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(a){this.m=a?"include":"same-origin"}});function Mh(a){let l="";return K(a,function(d,m){l+=m,l+=":",l+=d,l+=`\r
`}),l}function uc(a,l,d){e:{for(m in d){var m=!1;break e}m=!0}m||(d=Mh(d),typeof a=="string"?d!=null&&encodeURIComponent(String(d)):oe(a,l,d))}function ge(a){Ue.call(this),this.headers=new Map,this.o=a||null,this.h=!1,this.v=this.g=null,this.D="",this.m=0,this.l="",this.j=this.B=this.u=this.A=!1,this.I=null,this.H="",this.J=!1}C(ge,Ue);var iI=/^https?$/i,sI=["POST","PUT"];n=ge.prototype,n.Ha=function(a){this.J=a},n.ea=function(a,l,d,m){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+a);l=l?l.toUpperCase():"GET",this.D=a,this.l="",this.m=0,this.A=!1,this.h=!0,this.g=this.o?this.o.g():nc.g(),this.v=this.o?dh(this.o):dh(nc),this.g.onreadystatechange=g(this.Ea,this);try{this.B=!0,this.g.open(l,String(a),!0),this.B=!1}catch(S){Fh(this,S);return}if(a=d||"",d=new Map(this.headers),m)if(Object.getPrototypeOf(m)===Object.prototype)for(var A in m)d.set(A,m[A]);else if(typeof m.keys=="function"&&typeof m.get=="function")for(const S of m.keys())d.set(S,m.get(S));else throw Error("Unknown input type for opt_headers: "+String(m));m=Array.from(d.keys()).find(S=>S.toLowerCase()=="content-type"),A=c.FormData&&a instanceof c.FormData,!(0<=Array.prototype.indexOf.call(sI,l,void 0))||m||A||d.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[S,x]of d)this.g.setRequestHeader(S,x);this.H&&(this.g.responseType=this.H),"withCredentials"in this.g&&this.g.withCredentials!==this.J&&(this.g.withCredentials=this.J);try{qh(this),this.u=!0,this.g.send(a),this.u=!1}catch(S){Fh(this,S)}};function Fh(a,l){a.h=!1,a.g&&(a.j=!0,a.g.abort(),a.j=!1),a.l=l,a.m=5,Uh(a),ao(a)}function Uh(a){a.A||(a.A=!0,Ge(a,"complete"),Ge(a,"error"))}n.abort=function(a){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.m=a||7,Ge(this,"complete"),Ge(this,"abort"),ao(this))},n.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),ao(this,!0)),ge.aa.N.call(this)},n.Ea=function(){this.s||(this.B||this.u||this.j?Bh(this):this.bb())},n.bb=function(){Bh(this)};function Bh(a){if(a.h&&typeof o<"u"&&(!a.v[1]||xt(a)!=4||a.Z()!=2)){if(a.u&&xt(a)==4)ch(a.Ea,0,a);else if(Ge(a,"readystatechange"),xt(a)==4){a.h=!1;try{const x=a.Z();e:switch(x){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var l=!0;break e;default:l=!1}var d;if(!(d=l)){var m;if(m=x===0){var A=String(a.D).match(kh)[1]||null;!A&&c.self&&c.self.location&&(A=c.self.location.protocol.slice(0,-1)),m=!iI.test(A?A.toLowerCase():"")}d=m}if(d)Ge(a,"complete"),Ge(a,"success");else{a.m=6;try{var S=2<xt(a)?a.g.statusText:""}catch{S=""}a.l=S+" ["+a.Z()+"]",Uh(a)}}finally{ao(a)}}}}function ao(a,l){if(a.g){qh(a);const d=a.g,m=a.v[0]?()=>{}:null;a.g=null,a.v=null,l||Ge(a,"ready");try{d.onreadystatechange=m}catch{}}}function qh(a){a.I&&(c.clearTimeout(a.I),a.I=null)}n.isActive=function(){return!!this.g};function xt(a){return a.g?a.g.readyState:0}n.Z=function(){try{return 2<xt(this)?this.g.status:-1}catch{return-1}},n.oa=function(){try{return this.g?this.g.responseText:""}catch{return""}},n.Oa=function(a){if(this.g){var l=this.g.responseText;return a&&l.indexOf(a)==0&&(l=l.substring(a.length)),My(l)}};function jh(a){try{if(!a.g)return null;if("response"in a.g)return a.g.response;switch(a.H){case"":case"text":return a.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in a.g)return a.g.mozResponseArrayBuffer}return null}catch{return null}}function oI(a){const l={};a=(a.g&&2<=xt(a)&&a.g.getAllResponseHeaders()||"").split(`\r
`);for(let m=0;m<a.length;m++){if(z(a[m]))continue;var d=E(a[m]);const A=d[0];if(d=d[1],typeof d!="string")continue;d=d.trim();const S=l[A]||[];l[A]=S,S.push(d)}v(l,function(m){return m.join(", ")})}n.Ba=function(){return this.m},n.Ka=function(){return typeof this.l=="string"?this.l:String(this.l)};function Ni(a,l,d){return d&&d.internalChannelParams&&d.internalChannelParams[a]||l}function $h(a){this.Aa=0,this.i=[],this.j=new bi,this.ia=this.qa=this.I=this.W=this.g=this.ya=this.D=this.H=this.m=this.S=this.o=null,this.Ya=this.U=0,this.Va=Ni("failFast",!1,a),this.F=this.C=this.u=this.s=this.l=null,this.X=!0,this.za=this.T=-1,this.Y=this.v=this.B=0,this.Ta=Ni("baseRetryDelayMs",5e3,a),this.cb=Ni("retryDelaySeedMs",1e4,a),this.Wa=Ni("forwardChannelMaxRetries",2,a),this.wa=Ni("forwardChannelRequestTimeoutMs",2e4,a),this.pa=a&&a.xmlHttpFactory||void 0,this.Xa=a&&a.Tb||void 0,this.Ca=a&&a.useFetchStreams||!1,this.L=void 0,this.J=a&&a.supportsCrossDomainXhr||!1,this.K="",this.h=new Ah(a&&a.concurrentRequestLimit),this.Da=new nI,this.P=a&&a.fastHandshake||!1,this.O=a&&a.encodeInitMessageHeaders||!1,this.P&&this.O&&(this.O=!1),this.Ua=a&&a.Rb||!1,a&&a.xa&&this.j.xa(),a&&a.forceLongPolling&&(this.X=!1),this.ba=!this.P&&this.X&&a&&a.detectBufferingProxy||!1,this.ja=void 0,a&&a.longPollingTimeout&&0<a.longPollingTimeout&&(this.ja=a.longPollingTimeout),this.ca=void 0,this.R=0,this.M=!1,this.ka=this.A=null}n=$h.prototype,n.la=8,n.G=1,n.connect=function(a,l,d,m){Ke(0),this.W=a,this.H=l||{},d&&m!==void 0&&(this.H.OSID=d,this.H.OAID=m),this.F=this.X,this.I=Xh(this,null,this.W),uo(this)};function lc(a){if(zh(a),a.G==3){var l=a.U++,d=Ot(a.I);if(oe(d,"SID",a.K),oe(d,"RID",l),oe(d,"TYPE","terminate"),Vi(a,d),l=new nn(a,a.j,l),l.L=2,l.v=io(Ot(d)),d=!1,c.navigator&&c.navigator.sendBeacon)try{d=c.navigator.sendBeacon(l.v.toString(),"")}catch{}!d&&c.Image&&(new Image().src=l.v,d=!0),d||(l.g=Zh(l.j,null),l.g.ea(l.v)),l.F=Date.now(),to(l)}Yh(a)}function co(a){a.g&&(dc(a),a.g.cancel(),a.g=null)}function zh(a){co(a),a.u&&(c.clearTimeout(a.u),a.u=null),lo(a),a.h.cancel(),a.s&&(typeof a.s=="number"&&c.clearTimeout(a.s),a.s=null)}function uo(a){if(!bh(a.h)&&!a.s){a.s=!0;var l=a.Ga;yi||rh(),Ii||(yi(),Ii=!0),za.add(l,a),a.B=0}}function aI(a,l){return Rh(a.h)>=a.h.j-(a.s?1:0)?!1:a.s?(a.i=l.D.concat(a.i),!0):a.G==1||a.G==2||a.B>=(a.Va?0:a.Wa)?!1:(a.s=Ai(g(a.Ga,a,l),Jh(a,a.B)),a.B++,!0)}n.Ga=function(a){if(this.s)if(this.s=null,this.G==1){if(!a){this.U=Math.floor(1e5*Math.random()),a=this.U++;const A=new nn(this,this.j,a);let S=this.o;if(this.S&&(S?(S=_(S),w(S,this.S)):S=this.S),this.m!==null||this.O||(A.H=S,S=null),this.P)e:{for(var l=0,d=0;d<this.i.length;d++){t:{var m=this.i[d];if("__data__"in m.map&&(m=m.map.__data__,typeof m=="string")){m=m.length;break t}m=void 0}if(m===void 0)break;if(l+=m,4096<l){l=d;break e}if(l===4096||d===this.i.length-1){l=d+1;break e}}l=1e3}else l=1e3;l=Kh(this,A,l),d=Ot(this.I),oe(d,"RID",a),oe(d,"CVER",22),this.D&&oe(d,"X-HTTP-Session-Id",this.D),Vi(this,d),S&&(this.O?l="headers="+encodeURIComponent(String(Mh(S)))+"&"+l:this.m&&uc(d,this.m,S)),cc(this.h,A),this.Ua&&oe(d,"TYPE","init"),this.P?(oe(d,"$req",l),oe(d,"SID","null"),A.T=!0,ic(A,d,null)):ic(A,d,l),this.G=2}}else this.G==3&&(a?Gh(this,a):this.i.length==0||bh(this.h)||Gh(this))};function Gh(a,l){var d;l?d=l.l:d=a.U++;const m=Ot(a.I);oe(m,"SID",a.K),oe(m,"RID",d),oe(m,"AID",a.T),Vi(a,m),a.m&&a.o&&uc(m,a.m,a.o),d=new nn(a,a.j,d,a.B+1),a.m===null&&(d.H=a.o),l&&(a.i=l.D.concat(a.i)),l=Kh(a,d,1e3),d.I=Math.round(.5*a.wa)+Math.round(.5*a.wa*Math.random()),cc(a.h,d),ic(d,m,l)}function Vi(a,l){a.H&&K(a.H,function(d,m){oe(l,m,d)}),a.l&&Ch({},function(d,m){oe(l,m,d)})}function Kh(a,l,d){d=Math.min(a.i.length,d);var m=a.l?g(a.l.Na,a.l,a):null;e:{var A=a.i;let S=-1;for(;;){const x=["count="+d];S==-1?0<d?(S=A[0].g,x.push("ofs="+S)):S=0:x.push("ofs="+S);let ie=!0;for(let Ve=0;Ve<d;Ve++){let ee=A[Ve].g;const Be=A[Ve].map;if(ee-=S,0>ee)S=Math.max(0,A[Ve].g-100),ie=!1;else try{rI(Be,x,"req"+ee+"_")}catch{m&&m(Be)}}if(ie){m=x.join("&");break e}}}return a=a.i.splice(0,d),l.D=a,m}function Wh(a){if(!a.g&&!a.u){a.Y=1;var l=a.Fa;yi||rh(),Ii||(yi(),Ii=!0),za.add(l,a),a.v=0}}function hc(a){return a.g||a.u||3<=a.v?!1:(a.Y++,a.u=Ai(g(a.Fa,a),Jh(a,a.v)),a.v++,!0)}n.Fa=function(){if(this.u=null,Hh(this),this.ba&&!(this.M||this.g==null||0>=this.R)){var a=2*this.R;this.j.info("BP detection timer enabled: "+a),this.A=Ai(g(this.ab,this),a)}},n.ab=function(){this.A&&(this.A=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.M=!0,Ke(10),co(this),Hh(this))};function dc(a){a.A!=null&&(c.clearTimeout(a.A),a.A=null)}function Hh(a){a.g=new nn(a,a.j,"rpc",a.Y),a.m===null&&(a.g.H=a.o),a.g.O=0;var l=Ot(a.qa);oe(l,"RID","rpc"),oe(l,"SID",a.K),oe(l,"AID",a.T),oe(l,"CI",a.F?"0":"1"),!a.F&&a.ja&&oe(l,"TO",a.ja),oe(l,"TYPE","xmlhttp"),Vi(a,l),a.m&&a.o&&uc(l,a.m,a.o),a.L&&(a.g.I=a.L);var d=a.g;a=a.ia,d.L=1,d.v=io(Ot(l)),d.m=null,d.P=!0,wh(d,a)}n.Za=function(){this.C!=null&&(this.C=null,co(this),hc(this),Ke(19))};function lo(a){a.C!=null&&(c.clearTimeout(a.C),a.C=null)}function Qh(a,l){var d=null;if(a.g==l){lo(a),dc(a),a.g=null;var m=2}else if(ac(a.h,l))d=l.D,Ph(a.h,l),m=1;else return;if(a.G!=0){if(l.o)if(m==1){d=l.m?l.m.length:0,l=Date.now()-l.F;var A=a.B;m=Xs(),Ge(m,new _h(m,d)),uo(a)}else Wh(a);else if(A=l.s,A==3||A==0&&0<l.X||!(m==1&&aI(a,l)||m==2&&hc(a)))switch(d&&0<d.length&&(l=a.h,l.i=l.i.concat(d)),A){case 1:xn(a,5);break;case 4:xn(a,10);break;case 3:xn(a,6);break;default:xn(a,2)}}}function Jh(a,l){let d=a.Ta+Math.floor(Math.random()*a.cb);return a.isActive()||(d*=2),d*l}function xn(a,l){if(a.j.info("Error code "+l),l==2){var d=g(a.fb,a),m=a.Xa;const A=!m;m=new On(m||"//www.google.com/images/cleardot.gif"),c.location&&c.location.protocol=="http"||no(m,"https"),io(m),A?eI(m.toString(),d):tI(m.toString(),d)}else Ke(2);a.G=0,a.l&&a.l.sa(l),Yh(a),zh(a)}n.fb=function(a){a?(this.j.info("Successfully pinged google.com"),Ke(2)):(this.j.info("Failed to ping google.com"),Ke(1))};function Yh(a){if(a.G=0,a.ka=[],a.l){const l=Sh(a.h);(l.length!=0||a.i.length!=0)&&(k(a.ka,l),k(a.ka,a.i),a.h.i.length=0,D(a.i),a.i.length=0),a.l.ra()}}function Xh(a,l,d){var m=d instanceof On?Ot(d):new On(d);if(m.g!="")l&&(m.g=l+"."+m.g),ro(m,m.s);else{var A=c.location;m=A.protocol,l=l?l+"."+A.hostname:A.hostname,A=+A.port;var S=new On(null);m&&no(S,m),l&&(S.g=l),A&&ro(S,A),d&&(S.l=d),m=S}return d=a.D,l=a.ya,d&&l&&oe(m,d,l),oe(m,"VER",a.la),Vi(a,m),m}function Zh(a,l,d){if(l&&!a.J)throw Error("Can't create secondary domain capable XhrIo object.");return l=a.Ca&&!a.pa?new ge(new so({eb:d})):new ge(a.pa),l.Ha(a.J),l}n.isActive=function(){return!!this.l&&this.l.isActive(this)};function ed(){}n=ed.prototype,n.ua=function(){},n.ta=function(){},n.sa=function(){},n.ra=function(){},n.isActive=function(){return!0},n.Na=function(){};function ho(){}ho.prototype.g=function(a,l){return new at(a,l)};function at(a,l){Ue.call(this),this.g=new $h(l),this.l=a,this.h=l&&l.messageUrlParams||null,a=l&&l.messageHeaders||null,l&&l.clientProtocolHeaderRequired&&(a?a["X-Client-Protocol"]="webchannel":a={"X-Client-Protocol":"webchannel"}),this.g.o=a,a=l&&l.initMessageHeaders||null,l&&l.messageContentType&&(a?a["X-WebChannel-Content-Type"]=l.messageContentType:a={"X-WebChannel-Content-Type":l.messageContentType}),l&&l.va&&(a?a["X-WebChannel-Client-Profile"]=l.va:a={"X-WebChannel-Client-Profile":l.va}),this.g.S=a,(a=l&&l.Sb)&&!z(a)&&(this.g.m=a),this.v=l&&l.supportsCrossDomainXhr||!1,this.u=l&&l.sendRawJson||!1,(l=l&&l.httpSessionIdParam)&&!z(l)&&(this.g.D=l,a=this.h,a!==null&&l in a&&(a=this.h,l in a&&delete a[l])),this.j=new Ir(this)}C(at,Ue),at.prototype.m=function(){this.g.l=this.j,this.v&&(this.g.J=!0),this.g.connect(this.l,this.h||void 0)},at.prototype.close=function(){lc(this.g)},at.prototype.o=function(a){var l=this.g;if(typeof a=="string"){var d={};d.__data__=a,a=d}else this.u&&(d={},d.__data__=Xa(a),a=d);l.i.push(new zy(l.Ya++,a)),l.G==3&&uo(l)},at.prototype.N=function(){this.g.l=null,delete this.j,lc(this.g),delete this.g,at.aa.N.call(this)};function td(a){ec.call(this),a.__headers__&&(this.headers=a.__headers__,this.statusCode=a.__status__,delete a.__headers__,delete a.__status__);var l=a.__sm__;if(l){e:{for(const d in l){a=d;break e}a=void 0}(this.i=a)&&(a=this.i,l=l!==null&&a in l?l[a]:void 0),this.data=l}else this.data=a}C(td,ec);function nd(){tc.call(this),this.status=1}C(nd,tc);function Ir(a){this.g=a}C(Ir,ed),Ir.prototype.ua=function(){Ge(this.g,"a")},Ir.prototype.ta=function(a){Ge(this.g,new td(a))},Ir.prototype.sa=function(a){Ge(this.g,new nd)},Ir.prototype.ra=function(){Ge(this.g,"b")},ho.prototype.createWebChannel=ho.prototype.g,at.prototype.send=at.prototype.o,at.prototype.open=at.prototype.m,at.prototype.close=at.prototype.close,Up=function(){return new ho},Fp=function(){return Xs()},Mp=Nn,Lc={mb:0,pb:1,qb:2,Jb:3,Ob:4,Lb:5,Mb:6,Kb:7,Ib:8,Nb:9,PROXY:10,NOPROXY:11,Gb:12,Cb:13,Db:14,Bb:15,Eb:16,Fb:17,ib:18,hb:19,jb:20},Zs.NO_ERROR=0,Zs.TIMEOUT=8,Zs.HTTP_ERROR=6,Ao=Zs,yh.COMPLETE="complete",Lp=yh,fh.EventType=Ti,Ti.OPEN="a",Ti.CLOSE="b",Ti.ERROR="c",Ti.MESSAGE="d",Ue.prototype.listen=Ue.prototype.K,zi=fh,ge.prototype.listenOnce=ge.prototype.L,ge.prototype.getLastError=ge.prototype.Ka,ge.prototype.getLastErrorCode=ge.prototype.Ba,ge.prototype.getStatus=ge.prototype.Z,ge.prototype.getResponseJson=ge.prototype.Oa,ge.prototype.getResponseText=ge.prototype.oa,ge.prototype.send=ge.prototype.ea,ge.prototype.setWithCredentials=ge.prototype.Ha,xp=ge}).apply(typeof po<"u"?po:typeof self<"u"?self:typeof window<"u"?window:{});const md="@firebase/firestore";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let De=class{constructor(e){this.uid=e}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(e){return e.uid===this.uid}};De.UNAUTHENTICATED=new De(null),De.GOOGLE_CREDENTIALS=new De("google-credentials-uid"),De.FIRST_PARTY=new De("first-party-uid"),De.MOCK_USER=new De("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let si="10.14.0";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const _n=new oa("@firebase/firestore");function Pr(){return _n.logLevel}function Qv(n){_n.setLogLevel(n)}function V(n,...e){if(_n.logLevel<=Q.DEBUG){const t=e.map(Ru);_n.debug(`Firestore (${si}): ${n}`,...t)}}function Te(n,...e){if(_n.logLevel<=Q.ERROR){const t=e.map(Ru);_n.error(`Firestore (${si}): ${n}`,...t)}}function Ct(n,...e){if(_n.logLevel<=Q.WARN){const t=e.map(Ru);_n.warn(`Firestore (${si}): ${n}`,...t)}}function Ru(n){if(typeof n=="string")return n;try{/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/return(function(t){return JSON.stringify(t)})(n)}catch{return n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function U(n="Unexpected state"){const e=`FIRESTORE (${si}) INTERNAL ASSERTION FAILED: `+n;throw Te(e),new Error(e)}function q(n,e){n||U()}function Jv(n,e){n||U()}function M(n,e){return n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const P={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class N extends Pe{constructor(e,t){super(e,t),this.code=e,this.message=t,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Le{constructor(){this.promise=new Promise(((e,t)=>{this.resolve=e,this.reject=t}))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Bp{constructor(e,t){this.user=t,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${e}`)}}class Yv{getToken(){return Promise.resolve(null)}invalidateToken(){}start(e,t){e.enqueueRetryable((()=>t(De.UNAUTHENTICATED)))}shutdown(){}}class Xv{constructor(e){this.token=e,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(e,t){this.changeListener=t,e.enqueueRetryable((()=>t(this.token.user)))}shutdown(){this.changeListener=null}}class Zv{constructor(e){this.t=e,this.currentUser=De.UNAUTHENTICATED,this.i=0,this.forceRefresh=!1,this.auth=null}start(e,t){q(this.o===void 0);let r=this.i;const i=u=>this.i!==r?(r=this.i,t(u)):Promise.resolve();let s=new Le;this.o=()=>{this.i++,this.currentUser=this.u(),s.resolve(),s=new Le,e.enqueueRetryable((()=>i(this.currentUser)))};const o=()=>{const u=s;e.enqueueRetryable((async()=>{await u.promise,await i(this.currentUser)}))},c=u=>{V("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=u,this.o&&(this.auth.addAuthTokenListener(this.o),o())};this.t.onInit((u=>c(u))),setTimeout((()=>{if(!this.auth){const u=this.t.getImmediate({optional:!0});u?c(u):(V("FirebaseAuthCredentialsProvider","Auth not yet detected"),s.resolve(),s=new Le)}}),0),o()}getToken(){const e=this.i,t=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(t).then((r=>this.i!==e?(V("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):r?(q(typeof r.accessToken=="string"),new Bp(r.accessToken,this.currentUser)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.o&&this.auth.removeAuthTokenListener(this.o),this.o=void 0}u(){const e=this.auth&&this.auth.getUid();return q(e===null||typeof e=="string"),new De(e)}}class ew{constructor(e,t,r){this.l=e,this.h=t,this.P=r,this.type="FirstParty",this.user=De.FIRST_PARTY,this.I=new Map}T(){return this.P?this.P():null}get headers(){this.I.set("X-Goog-AuthUser",this.l);const e=this.T();return e&&this.I.set("Authorization",e),this.h&&this.I.set("X-Goog-Iam-Authorization-Token",this.h),this.I}}class tw{constructor(e,t,r){this.l=e,this.h=t,this.P=r}getToken(){return Promise.resolve(new ew(this.l,this.h,this.P))}start(e,t){e.enqueueRetryable((()=>t(De.FIRST_PARTY)))}shutdown(){}invalidateToken(){}}class nw{constructor(e){this.value=e,this.type="AppCheck",this.headers=new Map,e&&e.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class rw{constructor(e){this.A=e,this.forceRefresh=!1,this.appCheck=null,this.R=null}start(e,t){q(this.o===void 0);const r=s=>{s.error!=null&&V("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${s.error.message}`);const o=s.token!==this.R;return this.R=s.token,V("FirebaseAppCheckTokenProvider",`Received ${o?"new":"existing"} token.`),o?t(s.token):Promise.resolve()};this.o=s=>{e.enqueueRetryable((()=>r(s)))};const i=s=>{V("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=s,this.o&&this.appCheck.addTokenListener(this.o)};this.A.onInit((s=>i(s))),setTimeout((()=>{if(!this.appCheck){const s=this.A.getImmediate({optional:!0});s?i(s):V("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}}),0)}getToken(){const e=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(e).then((t=>t?(q(typeof t.token=="string"),this.R=t.token,new nw(t.token)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.o&&this.appCheck.removeTokenListener(this.o),this.o=void 0}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function iw(n){const e=typeof self<"u"&&(self.crypto||self.msCrypto),t=new Uint8Array(n);if(e&&typeof e.getRandomValues=="function")e.getRandomValues(t);else for(let r=0;r<n;r++)t[r]=Math.floor(256*Math.random());return t}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qp{static newId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",t=Math.floor(256/e.length)*e.length;let r="";for(;r.length<20;){const i=iw(40);for(let s=0;s<i.length;++s)r.length<20&&i[s]<t&&(r+=e.charAt(i[s]%e.length))}return r}}function W(n,e){return n<e?-1:n>e?1:0}function $r(n,e,t){return n.length===e.length&&n.every(((r,i)=>t(r,e[i])))}function jp(n){return n+"\0"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class de{constructor(e,t){if(this.seconds=e,this.nanoseconds=t,t<0)throw new N(P.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(t>=1e9)throw new N(P.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(e<-62135596800)throw new N(P.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e);if(e>=253402300800)throw new N(P.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e)}static now(){return de.fromMillis(Date.now())}static fromDate(e){return de.fromMillis(e.getTime())}static fromMillis(e){const t=Math.floor(e/1e3),r=Math.floor(1e6*(e-1e3*t));return new de(t,r)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/1e6}_compareTo(e){return this.seconds===e.seconds?W(this.nanoseconds,e.nanoseconds):W(this.seconds,e.seconds)}isEqual(e){return e.seconds===this.seconds&&e.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{seconds:this.seconds,nanoseconds:this.nanoseconds}}valueOf(){const e=this.seconds- -62135596800;return String(e).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ${constructor(e){this.timestamp=e}static fromTimestamp(e){return new $(e)}static min(){return new $(new de(0,0))}static max(){return new $(new de(253402300799,999999999))}compareTo(e){return this.timestamp._compareTo(e.timestamp)}isEqual(e){return this.timestamp.isEqual(e.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class us{constructor(e,t,r){t===void 0?t=0:t>e.length&&U(),r===void 0?r=e.length-t:r>e.length-t&&U(),this.segments=e,this.offset=t,this.len=r}get length(){return this.len}isEqual(e){return us.comparator(this,e)===0}child(e){const t=this.segments.slice(this.offset,this.limit());return e instanceof us?e.forEach((r=>{t.push(r)})):t.push(e),this.construct(t)}limit(){return this.offset+this.length}popFirst(e){return e=e===void 0?1:e,this.construct(this.segments,this.offset+e,this.length-e)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(e){return this.segments[this.offset+e]}isEmpty(){return this.length===0}isPrefixOf(e){if(e.length<this.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}isImmediateParentOf(e){if(this.length+1!==e.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}forEach(e){for(let t=this.offset,r=this.limit();t<r;t++)e(this.segments[t])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(e,t){const r=Math.min(e.length,t.length);for(let i=0;i<r;i++){const s=e.get(i),o=t.get(i);if(s<o)return-1;if(s>o)return 1}return e.length<t.length?-1:e.length>t.length?1:0}}class Y extends us{construct(e,t,r){return new Y(e,t,r)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...e){const t=[];for(const r of e){if(r.indexOf("//")>=0)throw new N(P.INVALID_ARGUMENT,`Invalid segment (${r}). Paths must not contain // in them.`);t.push(...r.split("/").filter((i=>i.length>0)))}return new Y(t)}static emptyPath(){return new Y([])}}const sw=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class le extends us{construct(e,t,r){return new le(e,t,r)}static isValidIdentifier(e){return sw.test(e)}canonicalString(){return this.toArray().map((e=>(e=e.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),le.isValidIdentifier(e)||(e="`"+e+"`"),e))).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)==="__name__"}static keyField(){return new le(["__name__"])}static fromServerFormat(e){const t=[];let r="",i=0;const s=()=>{if(r.length===0)throw new N(P.INVALID_ARGUMENT,`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);t.push(r),r=""};let o=!1;for(;i<e.length;){const c=e[i];if(c==="\\"){if(i+1===e.length)throw new N(P.INVALID_ARGUMENT,"Path has trailing escape character: "+e);const u=e[i+1];if(u!=="\\"&&u!=="."&&u!=="`")throw new N(P.INVALID_ARGUMENT,"Path has invalid escape sequence: "+e);r+=u,i+=2}else c==="`"?(o=!o,i++):c!=="."||o?(r+=c,i++):(s(),i++)}if(s(),o)throw new N(P.INVALID_ARGUMENT,"Unterminated ` in path: "+e);return new le(t)}static emptyPath(){return new le([])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class L{constructor(e){this.path=e}static fromPath(e){return new L(Y.fromString(e))}static fromName(e){return new L(Y.fromString(e).popFirst(5))}static empty(){return new L(Y.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(e){return this.path.length>=2&&this.path.get(this.path.length-2)===e}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(e){return e!==null&&Y.comparator(this.path,e.path)===0}toString(){return this.path.toString()}static comparator(e,t){return Y.comparator(e.path,t.path)}static isDocumentKey(e){return e.length%2==0}static fromSegments(e){return new L(new Y(e.slice()))}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Uo{constructor(e,t,r,i){this.indexId=e,this.collectionGroup=t,this.fields=r,this.indexState=i}}function Mc(n){return n.fields.find((e=>e.kind===2))}function Fn(n){return n.fields.filter((e=>e.kind!==2))}Uo.UNKNOWN_ID=-1;class bo{constructor(e,t){this.fieldPath=e,this.kind=t}}class ls{constructor(e,t){this.sequenceNumber=e,this.offset=t}static empty(){return new ls(0,lt.min())}}function $p(n,e){const t=n.toTimestamp().seconds,r=n.toTimestamp().nanoseconds+1,i=$.fromTimestamp(r===1e9?new de(t+1,0):new de(t,r));return new lt(i,L.empty(),e)}function zp(n){return new lt(n.readTime,n.key,-1)}class lt{constructor(e,t,r){this.readTime=e,this.documentKey=t,this.largestBatchId=r}static min(){return new lt($.min(),L.empty(),-1)}static max(){return new lt($.max(),L.empty(),-1)}}function Pu(n,e){let t=n.readTime.compareTo(e.readTime);return t!==0?t:(t=L.comparator(n.documentKey,e.documentKey),t!==0?t:W(n.largestBatchId,e.largestBatchId))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Gp="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";class Kp{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(e){this.onCommittedListeners.push(e)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach((e=>e()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Rn(n){if(n.code!==P.FAILED_PRECONDITION||n.message!==Gp)throw n;V("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class b{constructor(e){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,e((t=>{this.isDone=!0,this.result=t,this.nextCallback&&this.nextCallback(t)}),(t=>{this.isDone=!0,this.error=t,this.catchCallback&&this.catchCallback(t)}))}catch(e){return this.next(void 0,e)}next(e,t){return this.callbackAttached&&U(),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(t,this.error):this.wrapSuccess(e,this.result):new b(((r,i)=>{this.nextCallback=s=>{this.wrapSuccess(e,s).next(r,i)},this.catchCallback=s=>{this.wrapFailure(t,s).next(r,i)}}))}toPromise(){return new Promise(((e,t)=>{this.next(e,t)}))}wrapUserFunction(e){try{const t=e();return t instanceof b?t:b.resolve(t)}catch(t){return b.reject(t)}}wrapSuccess(e,t){return e?this.wrapUserFunction((()=>e(t))):b.resolve(t)}wrapFailure(e,t){return e?this.wrapUserFunction((()=>e(t))):b.reject(t)}static resolve(e){return new b(((t,r)=>{t(e)}))}static reject(e){return new b(((t,r)=>{r(e)}))}static waitFor(e){return new b(((t,r)=>{let i=0,s=0,o=!1;e.forEach((c=>{++i,c.next((()=>{++s,o&&s===i&&t()}),(u=>r(u)))})),o=!0,s===i&&t()}))}static or(e){let t=b.resolve(!1);for(const r of e)t=t.next((i=>i?b.resolve(i):r()));return t}static forEach(e,t){const r=[];return e.forEach(((i,s)=>{r.push(t.call(this,i,s))})),this.waitFor(r)}static mapArray(e,t){return new b(((r,i)=>{const s=e.length,o=new Array(s);let c=0;for(let u=0;u<s;u++){const h=u;t(e[h]).next((f=>{o[h]=f,++c,c===s&&r(o)}),(f=>i(f)))}}))}static doWhile(e,t){return new b(((r,i)=>{const s=()=>{e()===!0?t().next((()=>{s()}),i):r()};s()}))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class aa{constructor(e,t){this.action=e,this.transaction=t,this.aborted=!1,this.V=new Le,this.transaction.oncomplete=()=>{this.V.resolve()},this.transaction.onabort=()=>{t.error?this.V.reject(new Qi(e,t.error)):this.V.resolve()},this.transaction.onerror=r=>{const i=Su(r.target.error);this.V.reject(new Qi(e,i))}}static open(e,t,r,i){try{return new aa(t,e.transaction(i,r))}catch(s){throw new Qi(t,s)}}get m(){return this.V.promise}abort(e){e&&this.V.reject(e),this.aborted||(V("SimpleDb","Aborting transaction:",e?e.message:"Client-initiated abort"),this.aborted=!0,this.transaction.abort())}g(){const e=this.transaction;this.aborted||typeof e.commit!="function"||e.commit()}store(e){const t=this.transaction.objectStore(e);return new aw(t)}}class bt{constructor(e,t,r){this.name=e,this.version=t,this.p=r,bt.S(pe())===12.2&&Te("Firestore persistence suffers from a bug in iOS 12.2 Safari that may cause your app to stop working. See https://stackoverflow.com/q/56496296/110915 for details and a potential workaround.")}static delete(e){return V("SimpleDb","Removing database:",e),Un(window.indexedDB.deleteDatabase(e)).toPromise()}static D(){if(!ss())return!1;if(bt.v())return!0;const e=pe(),t=bt.S(e),r=0<t&&t<10,i=Wp(e),s=0<i&&i<4.5;return!(e.indexOf("MSIE ")>0||e.indexOf("Trident/")>0||e.indexOf("Edge/")>0||r||s)}static v(){var e;return typeof process<"u"&&((e=process.__PRIVATE_env)===null||e===void 0?void 0:e.C)==="YES"}static F(e,t){return e.store(t)}static S(e){const t=e.match(/i(?:phone|pad|pod) os ([\d_]+)/i),r=t?t[1].split("_").slice(0,2).join("."):"-1";return Number(r)}async M(e){return this.db||(V("SimpleDb","Opening database:",this.name),this.db=await new Promise(((t,r)=>{const i=indexedDB.open(this.name,this.version);i.onsuccess=s=>{const o=s.target.result;t(o)},i.onblocked=()=>{r(new Qi(e,"Cannot upgrade IndexedDB schema while another tab is open. Close all tabs that access Firestore and reload this page to proceed."))},i.onerror=s=>{const o=s.target.error;o.name==="VersionError"?r(new N(P.FAILED_PRECONDITION,"A newer version of the Firestore SDK was previously used and so the persisted data is not compatible with the version of the SDK you are now using. The SDK will operate with persistence disabled. If you need persistence, please re-upgrade to a newer version of the SDK or else clear the persisted IndexedDB data for your app to start fresh.")):o.name==="InvalidStateError"?r(new N(P.FAILED_PRECONDITION,"Unable to open an IndexedDB connection. This could be due to running in a private browsing session on a browser whose private browsing sessions do not support IndexedDB: "+o)):r(new Qi(e,o))},i.onupgradeneeded=s=>{V("SimpleDb",'Database "'+this.name+'" requires upgrade from version:',s.oldVersion);const o=s.target.result;this.p.O(o,i.transaction,s.oldVersion,this.version).next((()=>{V("SimpleDb","Database upgrade to version "+this.version+" complete")}))}}))),this.N&&(this.db.onversionchange=t=>this.N(t)),this.db}L(e){this.N=e,this.db&&(this.db.onversionchange=t=>e(t))}async runTransaction(e,t,r,i){const s=t==="readonly";let o=0;for(;;){++o;try{this.db=await this.M(e);const c=aa.open(this.db,e,s?"readonly":"readwrite",r),u=i(c).next((h=>(c.g(),h))).catch((h=>(c.abort(h),b.reject(h)))).toPromise();return u.catch((()=>{})),await c.m,u}catch(c){const u=c,h=u.name!=="FirebaseError"&&o<3;if(V("SimpleDb","Transaction failed with error:",u.message,"Retrying:",h),this.close(),!h)return Promise.reject(u)}}}close(){this.db&&this.db.close(),this.db=void 0}}function Wp(n){const e=n.match(/Android ([\d.]+)/i),t=e?e[1].split(".").slice(0,2).join("."):"-1";return Number(t)}class ow{constructor(e){this.B=e,this.k=!1,this.q=null}get isDone(){return this.k}get K(){return this.q}set cursor(e){this.B=e}done(){this.k=!0}$(e){this.q=e}delete(){return Un(this.B.delete())}}class Qi extends N{constructor(e,t){super(P.UNAVAILABLE,`IndexedDB transaction '${e}' failed: ${t}`),this.name="IndexedDbTransactionError"}}function Pn(n){return n.name==="IndexedDbTransactionError"}class aw{constructor(e){this.store=e}put(e,t){let r;return t!==void 0?(V("SimpleDb","PUT",this.store.name,e,t),r=this.store.put(t,e)):(V("SimpleDb","PUT",this.store.name,"<auto-key>",e),r=this.store.put(e)),Un(r)}add(e){return V("SimpleDb","ADD",this.store.name,e,e),Un(this.store.add(e))}get(e){return Un(this.store.get(e)).next((t=>(t===void 0&&(t=null),V("SimpleDb","GET",this.store.name,e,t),t)))}delete(e){return V("SimpleDb","DELETE",this.store.name,e),Un(this.store.delete(e))}count(){return V("SimpleDb","COUNT",this.store.name),Un(this.store.count())}U(e,t){const r=this.options(e,t),i=r.index?this.store.index(r.index):this.store;if(typeof i.getAll=="function"){const s=i.getAll(r.range);return new b(((o,c)=>{s.onerror=u=>{c(u.target.error)},s.onsuccess=u=>{o(u.target.result)}}))}{const s=this.cursor(r),o=[];return this.W(s,((c,u)=>{o.push(u)})).next((()=>o))}}G(e,t){const r=this.store.getAll(e,t===null?void 0:t);return new b(((i,s)=>{r.onerror=o=>{s(o.target.error)},r.onsuccess=o=>{i(o.target.result)}}))}j(e,t){V("SimpleDb","DELETE ALL",this.store.name);const r=this.options(e,t);r.H=!1;const i=this.cursor(r);return this.W(i,((s,o,c)=>c.delete()))}J(e,t){let r;t?r=e:(r={},t=e);const i=this.cursor(r);return this.W(i,t)}Y(e){const t=this.cursor({});return new b(((r,i)=>{t.onerror=s=>{const o=Su(s.target.error);i(o)},t.onsuccess=s=>{const o=s.target.result;o?e(o.primaryKey,o.value).next((c=>{c?o.continue():r()})):r()}}))}W(e,t){const r=[];return new b(((i,s)=>{e.onerror=o=>{s(o.target.error)},e.onsuccess=o=>{const c=o.target.result;if(!c)return void i();const u=new ow(c),h=t(c.primaryKey,c.value,u);if(h instanceof b){const f=h.catch((p=>(u.done(),b.reject(p))));r.push(f)}u.isDone?i():u.K===null?c.continue():c.continue(u.K)}})).next((()=>b.waitFor(r)))}options(e,t){let r;return e!==void 0&&(typeof e=="string"?r=e:t=e),{index:r,range:t}}cursor(e){let t="next";if(e.reverse&&(t="prev"),e.index){const r=this.store.index(e.index);return e.H?r.openKeyCursor(e.range,t):r.openCursor(e.range,t)}return this.store.openCursor(e.range,t)}}function Un(n){return new b(((e,t)=>{n.onsuccess=r=>{const i=r.target.result;e(i)},n.onerror=r=>{const i=Su(r.target.error);t(i)}}))}let gd=!1;function Su(n){const e=bt.S(pe());if(e>=12.2&&e<13){const t="An internal error was encountered in the Indexed Database server";if(n.message.indexOf(t)>=0){const r=new N("internal",`IOS_INDEXEDDB_BUG1: IndexedDb has thrown '${t}'. This is likely due to an unavoidable bug in iOS. See https://stackoverflow.com/q/56496296/110915 for details and a potential workaround.`);return gd||(gd=!0,setTimeout((()=>{throw r}),0)),r}}return n}class cw{constructor(e,t){this.asyncQueue=e,this.Z=t,this.task=null}start(){this.X(15e3)}stop(){this.task&&(this.task.cancel(),this.task=null)}get started(){return this.task!==null}X(e){V("IndexBackfiller",`Scheduled in ${e}ms`),this.task=this.asyncQueue.enqueueAfterDelay("index_backfill",e,(async()=>{this.task=null;try{V("IndexBackfiller",`Documents written: ${await this.Z.ee()}`)}catch(t){Pn(t)?V("IndexBackfiller","Ignoring IndexedDB error during index backfill: ",t):await Rn(t)}await this.X(6e4)}))}}class uw{constructor(e,t){this.localStore=e,this.persistence=t}async ee(e=50){return this.persistence.runTransaction("Backfill Indexes","readwrite-primary",(t=>this.te(t,e)))}te(e,t){const r=new Set;let i=t,s=!0;return b.doWhile((()=>s===!0&&i>0),(()=>this.localStore.indexManager.getNextCollectionGroupToUpdate(e).next((o=>{if(o!==null&&!r.has(o))return V("IndexBackfiller",`Processing collection: ${o}`),this.ne(e,o,i).next((c=>{i-=c,r.add(o)}));s=!1})))).next((()=>t-i))}ne(e,t,r){return this.localStore.indexManager.getMinOffsetFromCollectionGroup(e,t).next((i=>this.localStore.localDocuments.getNextDocuments(e,t,i,r).next((s=>{const o=s.changes;return this.localStore.indexManager.updateIndexEntries(e,o).next((()=>this.re(i,s))).next((c=>(V("IndexBackfiller",`Updating offset: ${c}`),this.localStore.indexManager.updateCollectionGroup(e,t,c)))).next((()=>o.size))}))))}re(e,t){let r=e;return t.changes.forEach(((i,s)=>{const o=zp(s);Pu(o,r)>0&&(r=o)})),new lt(r.readTime,r.documentKey,Math.max(t.batchId,e.largestBatchId))}}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rt{constructor(e,t){this.previousValue=e,t&&(t.sequenceNumberHandler=r=>this.ie(r),this.se=r=>t.writeSequenceNumber(r))}ie(e){return this.previousValue=Math.max(e,this.previousValue),this.previousValue}next(){const e=++this.previousValue;return this.se&&this.se(e),e}}rt.oe=-1;function Ss(n){return n==null}function hs(n){return n===0&&1/n==-1/0}function Hp(n){return typeof n=="number"&&Number.isInteger(n)&&!hs(n)&&n<=Number.MAX_SAFE_INTEGER&&n>=Number.MIN_SAFE_INTEGER}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xe(n){let e="";for(let t=0;t<n.length;t++)e.length>0&&(e=_d(e)),e=lw(n.get(t),e);return _d(e)}function lw(n,e){let t=e;const r=n.length;for(let i=0;i<r;i++){const s=n.charAt(i);switch(s){case"\0":t+="";break;case"":t+="";break;default:t+=s}}return t}function _d(n){return n+""}function Tt(n){const e=n.length;if(q(e>=2),e===2)return q(n.charAt(0)===""&&n.charAt(1)===""),Y.emptyPath();const t=e-2,r=[];let i="";for(let s=0;s<e;){const o=n.indexOf("",s);switch((o<0||o>t)&&U(),n.charAt(o+1)){case"":const c=n.substring(s,o);let u;i.length===0?u=c:(i+=c,u=i,i=""),r.push(u);break;case"":i+=n.substring(s,o),i+="\0";break;case"":i+=n.substring(s,o+1);break;default:U()}s=o+2}return new Y(r)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yd=["userId","batchId"];/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ro(n,e){return[n,Xe(e)]}function Qp(n,e,t){return[n,Xe(e),t]}const hw={},dw=["prefixPath","collectionGroup","readTime","documentId"],fw=["prefixPath","collectionGroup","documentId"],pw=["collectionGroup","readTime","prefixPath","documentId"],mw=["canonicalId","targetId"],gw=["targetId","path"],_w=["path","targetId"],yw=["collectionId","parent"],Iw=["indexId","uid"],vw=["uid","sequenceNumber"],ww=["indexId","uid","arrayValue","directionalValue","orderedDocumentKey","documentKey"],Tw=["indexId","uid","orderedDocumentKey"],Ew=["userId","collectionPath","documentId"],Aw=["userId","collectionPath","largestBatchId"],bw=["userId","collectionGroup","largestBatchId"],Jp=["mutationQueues","mutations","documentMutations","remoteDocuments","targets","owner","targetGlobal","targetDocuments","clientMetadata","remoteDocumentGlobal","collectionParents","bundles","namedQueries"],Rw=[...Jp,"documentOverlays"],Yp=["mutationQueues","mutations","documentMutations","remoteDocumentsV14","targets","owner","targetGlobal","targetDocuments","clientMetadata","remoteDocumentGlobal","collectionParents","bundles","namedQueries","documentOverlays"],Xp=Yp,Cu=[...Xp,"indexConfiguration","indexState","indexEntries"],Pw=Cu,Sw=[...Cu,"globals"];/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Fc extends Kp{constructor(e,t){super(),this._e=e,this.currentSequenceNumber=t}}function Ce(n,e){const t=M(n);return bt.F(t._e,e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Id(n){let e=0;for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e++;return e}function hr(n,e){for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e(t,n[t])}function Zp(n){for(const e in n)if(Object.prototype.hasOwnProperty.call(n,e))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class se{constructor(e,t){this.comparator=e,this.root=t||Oe.EMPTY}insert(e,t){return new se(this.comparator,this.root.insert(e,t,this.comparator).copy(null,null,Oe.BLACK,null,null))}remove(e){return new se(this.comparator,this.root.remove(e,this.comparator).copy(null,null,Oe.BLACK,null,null))}get(e){let t=this.root;for(;!t.isEmpty();){const r=this.comparator(e,t.key);if(r===0)return t.value;r<0?t=t.left:r>0&&(t=t.right)}return null}indexOf(e){let t=0,r=this.root;for(;!r.isEmpty();){const i=this.comparator(e,r.key);if(i===0)return t+r.left.size;i<0?r=r.left:(t+=r.left.size+1,r=r.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(e){return this.root.inorderTraversal(e)}forEach(e){this.inorderTraversal(((t,r)=>(e(t,r),!1)))}toString(){const e=[];return this.inorderTraversal(((t,r)=>(e.push(`${t}:${r}`),!1))),`{${e.join(", ")}}`}reverseTraversal(e){return this.root.reverseTraversal(e)}getIterator(){return new mo(this.root,null,this.comparator,!1)}getIteratorFrom(e){return new mo(this.root,e,this.comparator,!1)}getReverseIterator(){return new mo(this.root,null,this.comparator,!0)}getReverseIteratorFrom(e){return new mo(this.root,e,this.comparator,!0)}}class mo{constructor(e,t,r,i){this.isReverse=i,this.nodeStack=[];let s=1;for(;!e.isEmpty();)if(s=t?r(e.key,t):1,t&&i&&(s*=-1),s<0)e=this.isReverse?e.left:e.right;else{if(s===0){this.nodeStack.push(e);break}this.nodeStack.push(e),e=this.isReverse?e.right:e.left}}getNext(){let e=this.nodeStack.pop();const t={key:e.key,value:e.value};if(this.isReverse)for(e=e.left;!e.isEmpty();)this.nodeStack.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack.push(e),e=e.left;return t}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const e=this.nodeStack[this.nodeStack.length-1];return{key:e.key,value:e.value}}}class Oe{constructor(e,t,r,i,s){this.key=e,this.value=t,this.color=r??Oe.RED,this.left=i??Oe.EMPTY,this.right=s??Oe.EMPTY,this.size=this.left.size+1+this.right.size}copy(e,t,r,i,s){return new Oe(e??this.key,t??this.value,r??this.color,i??this.left,s??this.right)}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,r){let i=this;const s=r(e,i.key);return i=s<0?i.copy(null,null,null,i.left.insert(e,t,r),null):s===0?i.copy(null,t,null,null,null):i.copy(null,null,null,null,i.right.insert(e,t,r)),i.fixUp()}removeMin(){if(this.left.isEmpty())return Oe.EMPTY;let e=this;return e.left.isRed()||e.left.left.isRed()||(e=e.moveRedLeft()),e=e.copy(null,null,null,e.left.removeMin(),null),e.fixUp()}remove(e,t){let r,i=this;if(t(e,i.key)<0)i.left.isEmpty()||i.left.isRed()||i.left.left.isRed()||(i=i.moveRedLeft()),i=i.copy(null,null,null,i.left.remove(e,t),null);else{if(i.left.isRed()&&(i=i.rotateRight()),i.right.isEmpty()||i.right.isRed()||i.right.left.isRed()||(i=i.moveRedRight()),t(e,i.key)===0){if(i.right.isEmpty())return Oe.EMPTY;r=i.right.min(),i=i.copy(r.key,r.value,null,null,i.right.removeMin())}i=i.copy(null,null,null,null,i.right.remove(e,t))}return i.fixUp()}isRed(){return this.color}fixUp(){let e=this;return e.right.isRed()&&!e.left.isRed()&&(e=e.rotateLeft()),e.left.isRed()&&e.left.left.isRed()&&(e=e.rotateRight()),e.left.isRed()&&e.right.isRed()&&(e=e.colorFlip()),e}moveRedLeft(){let e=this.colorFlip();return e.right.left.isRed()&&(e=e.copy(null,null,null,null,e.right.rotateRight()),e=e.rotateLeft(),e=e.colorFlip()),e}moveRedRight(){let e=this.colorFlip();return e.left.left.isRed()&&(e=e.rotateRight(),e=e.colorFlip()),e}rotateLeft(){const e=this.copy(null,null,Oe.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight(){const e=this.copy(null,null,Oe.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip(){const e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth(){const e=this.check();return Math.pow(2,e)<=this.size+1}check(){if(this.isRed()&&this.left.isRed()||this.right.isRed())throw U();const e=this.left.check();if(e!==this.right.check())throw U();return e+(this.isRed()?0:1)}}Oe.EMPTY=null,Oe.RED=!0,Oe.BLACK=!1;Oe.EMPTY=new class{constructor(){this.size=0}get key(){throw U()}get value(){throw U()}get color(){throw U()}get left(){throw U()}get right(){throw U()}copy(e,t,r,i,s){return this}insert(e,t,r){return new Oe(e,t)}remove(e,t){return this}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class re{constructor(e){this.comparator=e,this.data=new se(this.comparator)}has(e){return this.data.get(e)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(e){return this.data.indexOf(e)}forEach(e){this.data.inorderTraversal(((t,r)=>(e(t),!1)))}forEachInRange(e,t){const r=this.data.getIteratorFrom(e[0]);for(;r.hasNext();){const i=r.getNext();if(this.comparator(i.key,e[1])>=0)return;t(i.key)}}forEachWhile(e,t){let r;for(r=t!==void 0?this.data.getIteratorFrom(t):this.data.getIterator();r.hasNext();)if(!e(r.getNext().key))return}firstAfterOrEqual(e){const t=this.data.getIteratorFrom(e);return t.hasNext()?t.getNext().key:null}getIterator(){return new vd(this.data.getIterator())}getIteratorFrom(e){return new vd(this.data.getIteratorFrom(e))}add(e){return this.copy(this.data.remove(e).insert(e,!0))}delete(e){return this.has(e)?this.copy(this.data.remove(e)):this}isEmpty(){return this.data.isEmpty()}unionWith(e){let t=this;return t.size<e.size&&(t=e,e=this),e.forEach((r=>{t=t.add(r)})),t}isEqual(e){if(!(e instanceof re)||this.size!==e.size)return!1;const t=this.data.getIterator(),r=e.data.getIterator();for(;t.hasNext();){const i=t.getNext().key,s=r.getNext().key;if(this.comparator(i,s)!==0)return!1}return!0}toArray(){const e=[];return this.forEach((t=>{e.push(t)})),e}toString(){const e=[];return this.forEach((t=>e.push(t))),"SortedSet("+e.toString()+")"}copy(e){const t=new re(this.comparator);return t.data=e,t}}class vd{constructor(e){this.iter=e}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}function wr(n){return n.hasNext()?n.getNext():void 0}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class it{constructor(e){this.fields=e,e.sort(le.comparator)}static empty(){return new it([])}unionWith(e){let t=new re(le.comparator);for(const r of this.fields)t=t.add(r);for(const r of e)t=t.add(r);return new it(t.toArray())}covers(e){for(const t of this.fields)if(t.isPrefixOf(e))return!0;return!1}isEqual(e){return $r(this.fields,e.fields,((t,r)=>t.isEqual(r)))}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class em extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Cw(){return typeof atob<"u"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ye{constructor(e){this.binaryString=e}static fromBase64String(e){const t=(function(i){try{return atob(i)}catch(s){throw typeof DOMException<"u"&&s instanceof DOMException?new em("Invalid base64 string: "+s):s}})(e);return new ye(t)}static fromUint8Array(e){const t=(function(i){let s="";for(let o=0;o<i.length;++o)s+=String.fromCharCode(i[o]);return s})(e);return new ye(t)}[Symbol.iterator](){let e=0;return{next:()=>e<this.binaryString.length?{value:this.binaryString.charCodeAt(e++),done:!1}:{value:void 0,done:!0}}}toBase64(){return(function(t){return btoa(t)})(this.binaryString)}toUint8Array(){return(function(t){const r=new Uint8Array(t.length);for(let i=0;i<t.length;i++)r[i]=t.charCodeAt(i);return r})(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(e){return W(this.binaryString,e.binaryString)}isEqual(e){return this.binaryString===e.binaryString}}ye.EMPTY_BYTE_STRING=new ye("");const kw=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function Gt(n){if(q(!!n),typeof n=="string"){let e=0;const t=kw.exec(n);if(q(!!t),t[1]){let i=t[1];i=(i+"000000000").substr(0,9),e=Number(i)}const r=new Date(n);return{seconds:Math.floor(r.getTime()/1e3),nanos:e}}return{seconds:ue(n.seconds),nanos:ue(n.nanos)}}function ue(n){return typeof n=="number"?n:typeof n=="string"?Number(n):0}function yn(n){return typeof n=="string"?ye.fromBase64String(n):ye.fromUint8Array(n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ca(n){var e,t;return((t=(((e=n==null?void 0:n.mapValue)===null||e===void 0?void 0:e.fields)||{}).__type__)===null||t===void 0?void 0:t.stringValue)==="server_timestamp"}function ku(n){const e=n.mapValue.fields.__previous_value__;return ca(e)?ku(e):e}function ds(n){const e=Gt(n.mapValue.fields.__local_write_time__.timestampValue);return new de(e.seconds,e.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Dw{constructor(e,t,r,i,s,o,c,u,h){this.databaseId=e,this.appId=t,this.persistenceKey=r,this.host=i,this.ssl=s,this.forceLongPolling=o,this.autoDetectLongPolling=c,this.longPollingOptions=u,this.useFetchStreams=h}}class In{constructor(e,t){this.projectId=e,this.database=t||"(default)"}static empty(){return new In("","")}get isDefaultDatabase(){return this.database==="(default)"}isEqual(e){return e instanceof In&&e.projectId===this.projectId&&e.database===this.database}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dn={mapValue:{fields:{__type__:{stringValue:"__max__"}}}},Po={nullValue:"NULL_VALUE"};function Yn(n){return"nullValue"in n?0:"booleanValue"in n?1:"integerValue"in n||"doubleValue"in n?2:"timestampValue"in n?3:"stringValue"in n?5:"bytesValue"in n?6:"referenceValue"in n?7:"geoPointValue"in n?8:"arrayValue"in n?9:"mapValue"in n?ca(n)?4:tm(n)?9007199254740991:ua(n)?10:11:U()}function kt(n,e){if(n===e)return!0;const t=Yn(n);if(t!==Yn(e))return!1;switch(t){case 0:case 9007199254740991:return!0;case 1:return n.booleanValue===e.booleanValue;case 4:return ds(n).isEqual(ds(e));case 3:return(function(i,s){if(typeof i.timestampValue=="string"&&typeof s.timestampValue=="string"&&i.timestampValue.length===s.timestampValue.length)return i.timestampValue===s.timestampValue;const o=Gt(i.timestampValue),c=Gt(s.timestampValue);return o.seconds===c.seconds&&o.nanos===c.nanos})(n,e);case 5:return n.stringValue===e.stringValue;case 6:return(function(i,s){return yn(i.bytesValue).isEqual(yn(s.bytesValue))})(n,e);case 7:return n.referenceValue===e.referenceValue;case 8:return(function(i,s){return ue(i.geoPointValue.latitude)===ue(s.geoPointValue.latitude)&&ue(i.geoPointValue.longitude)===ue(s.geoPointValue.longitude)})(n,e);case 2:return(function(i,s){if("integerValue"in i&&"integerValue"in s)return ue(i.integerValue)===ue(s.integerValue);if("doubleValue"in i&&"doubleValue"in s){const o=ue(i.doubleValue),c=ue(s.doubleValue);return o===c?hs(o)===hs(c):isNaN(o)&&isNaN(c)}return!1})(n,e);case 9:return $r(n.arrayValue.values||[],e.arrayValue.values||[],kt);case 10:case 11:return(function(i,s){const o=i.mapValue.fields||{},c=s.mapValue.fields||{};if(Id(o)!==Id(c))return!1;for(const u in o)if(o.hasOwnProperty(u)&&(c[u]===void 0||!kt(o[u],c[u])))return!1;return!0})(n,e);default:return U()}}function fs(n,e){return(n.values||[]).find((t=>kt(t,e)))!==void 0}function vn(n,e){if(n===e)return 0;const t=Yn(n),r=Yn(e);if(t!==r)return W(t,r);switch(t){case 0:case 9007199254740991:return 0;case 1:return W(n.booleanValue,e.booleanValue);case 2:return(function(s,o){const c=ue(s.integerValue||s.doubleValue),u=ue(o.integerValue||o.doubleValue);return c<u?-1:c>u?1:c===u?0:isNaN(c)?isNaN(u)?0:-1:1})(n,e);case 3:return wd(n.timestampValue,e.timestampValue);case 4:return wd(ds(n),ds(e));case 5:return W(n.stringValue,e.stringValue);case 6:return(function(s,o){const c=yn(s),u=yn(o);return c.compareTo(u)})(n.bytesValue,e.bytesValue);case 7:return(function(s,o){const c=s.split("/"),u=o.split("/");for(let h=0;h<c.length&&h<u.length;h++){const f=W(c[h],u[h]);if(f!==0)return f}return W(c.length,u.length)})(n.referenceValue,e.referenceValue);case 8:return(function(s,o){const c=W(ue(s.latitude),ue(o.latitude));return c!==0?c:W(ue(s.longitude),ue(o.longitude))})(n.geoPointValue,e.geoPointValue);case 9:return Td(n.arrayValue,e.arrayValue);case 10:return(function(s,o){var c,u,h,f;const p=s.fields||{},g=o.fields||{},T=(c=p.value)===null||c===void 0?void 0:c.arrayValue,C=(u=g.value)===null||u===void 0?void 0:u.arrayValue,D=W(((h=T==null?void 0:T.values)===null||h===void 0?void 0:h.length)||0,((f=C==null?void 0:C.values)===null||f===void 0?void 0:f.length)||0);return D!==0?D:Td(T,C)})(n.mapValue,e.mapValue);case 11:return(function(s,o){if(s===dn.mapValue&&o===dn.mapValue)return 0;if(s===dn.mapValue)return 1;if(o===dn.mapValue)return-1;const c=s.fields||{},u=Object.keys(c),h=o.fields||{},f=Object.keys(h);u.sort(),f.sort();for(let p=0;p<u.length&&p<f.length;++p){const g=W(u[p],f[p]);if(g!==0)return g;const T=vn(c[u[p]],h[f[p]]);if(T!==0)return T}return W(u.length,f.length)})(n.mapValue,e.mapValue);default:throw U()}}function wd(n,e){if(typeof n=="string"&&typeof e=="string"&&n.length===e.length)return W(n,e);const t=Gt(n),r=Gt(e),i=W(t.seconds,r.seconds);return i!==0?i:W(t.nanos,r.nanos)}function Td(n,e){const t=n.values||[],r=e.values||[];for(let i=0;i<t.length&&i<r.length;++i){const s=vn(t[i],r[i]);if(s)return s}return W(t.length,r.length)}function zr(n){return Uc(n)}function Uc(n){return"nullValue"in n?"null":"booleanValue"in n?""+n.booleanValue:"integerValue"in n?""+n.integerValue:"doubleValue"in n?""+n.doubleValue:"timestampValue"in n?(function(t){const r=Gt(t);return`time(${r.seconds},${r.nanos})`})(n.timestampValue):"stringValue"in n?n.stringValue:"bytesValue"in n?(function(t){return yn(t).toBase64()})(n.bytesValue):"referenceValue"in n?(function(t){return L.fromName(t).toString()})(n.referenceValue):"geoPointValue"in n?(function(t){return`geo(${t.latitude},${t.longitude})`})(n.geoPointValue):"arrayValue"in n?(function(t){let r="[",i=!0;for(const s of t.values||[])i?i=!1:r+=",",r+=Uc(s);return r+"]"})(n.arrayValue):"mapValue"in n?(function(t){const r=Object.keys(t.fields||{}).sort();let i="{",s=!0;for(const o of r)s?s=!1:i+=",",i+=`${o}:${Uc(t.fields[o])}`;return i+"}"})(n.mapValue):U()}function Xn(n,e){return{referenceValue:`projects/${n.projectId}/databases/${n.database}/documents/${e.path.canonicalString()}`}}function Bc(n){return!!n&&"integerValue"in n}function ps(n){return!!n&&"arrayValue"in n}function Ed(n){return!!n&&"nullValue"in n}function Ad(n){return!!n&&"doubleValue"in n&&isNaN(Number(n.doubleValue))}function So(n){return!!n&&"mapValue"in n}function ua(n){var e,t;return((t=(((e=n==null?void 0:n.mapValue)===null||e===void 0?void 0:e.fields)||{}).__type__)===null||t===void 0?void 0:t.stringValue)==="__vector__"}function Ji(n){if(n.geoPointValue)return{geoPointValue:Object.assign({},n.geoPointValue)};if(n.timestampValue&&typeof n.timestampValue=="object")return{timestampValue:Object.assign({},n.timestampValue)};if(n.mapValue){const e={mapValue:{fields:{}}};return hr(n.mapValue.fields,((t,r)=>e.mapValue.fields[t]=Ji(r))),e}if(n.arrayValue){const e={arrayValue:{values:[]}};for(let t=0;t<(n.arrayValue.values||[]).length;++t)e.arrayValue.values[t]=Ji(n.arrayValue.values[t]);return e}return Object.assign({},n)}function tm(n){return(((n.mapValue||{}).fields||{}).__type__||{}).stringValue==="__max__"}const nm={mapValue:{fields:{__type__:{stringValue:"__vector__"},value:{arrayValue:{}}}}};function Nw(n){return"nullValue"in n?Po:"booleanValue"in n?{booleanValue:!1}:"integerValue"in n||"doubleValue"in n?{doubleValue:NaN}:"timestampValue"in n?{timestampValue:{seconds:Number.MIN_SAFE_INTEGER}}:"stringValue"in n?{stringValue:""}:"bytesValue"in n?{bytesValue:""}:"referenceValue"in n?Xn(In.empty(),L.empty()):"geoPointValue"in n?{geoPointValue:{latitude:-90,longitude:-180}}:"arrayValue"in n?{arrayValue:{}}:"mapValue"in n?ua(n)?nm:{mapValue:{}}:U()}function Vw(n){return"nullValue"in n?{booleanValue:!1}:"booleanValue"in n?{doubleValue:NaN}:"integerValue"in n||"doubleValue"in n?{timestampValue:{seconds:Number.MIN_SAFE_INTEGER}}:"timestampValue"in n?{stringValue:""}:"stringValue"in n?{bytesValue:""}:"bytesValue"in n?Xn(In.empty(),L.empty()):"referenceValue"in n?{geoPointValue:{latitude:-90,longitude:-180}}:"geoPointValue"in n?{arrayValue:{}}:"arrayValue"in n?nm:"mapValue"in n?ua(n)?{mapValue:{}}:dn:U()}function bd(n,e){const t=vn(n.value,e.value);return t!==0?t:n.inclusive&&!e.inclusive?-1:!n.inclusive&&e.inclusive?1:0}function Rd(n,e){const t=vn(n.value,e.value);return t!==0?t:n.inclusive&&!e.inclusive?1:!n.inclusive&&e.inclusive?-1:0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xe{constructor(e){this.value=e}static empty(){return new xe({mapValue:{}})}field(e){if(e.isEmpty())return this.value;{let t=this.value;for(let r=0;r<e.length-1;++r)if(t=(t.mapValue.fields||{})[e.get(r)],!So(t))return null;return t=(t.mapValue.fields||{})[e.lastSegment()],t||null}}set(e,t){this.getFieldsMap(e.popLast())[e.lastSegment()]=Ji(t)}setAll(e){let t=le.emptyPath(),r={},i=[];e.forEach(((o,c)=>{if(!t.isImmediateParentOf(c)){const u=this.getFieldsMap(t);this.applyChanges(u,r,i),r={},i=[],t=c.popLast()}o?r[c.lastSegment()]=Ji(o):i.push(c.lastSegment())}));const s=this.getFieldsMap(t);this.applyChanges(s,r,i)}delete(e){const t=this.field(e.popLast());So(t)&&t.mapValue.fields&&delete t.mapValue.fields[e.lastSegment()]}isEqual(e){return kt(this.value,e.value)}getFieldsMap(e){let t=this.value;t.mapValue.fields||(t.mapValue={fields:{}});for(let r=0;r<e.length;++r){let i=t.mapValue.fields[e.get(r)];So(i)&&i.mapValue.fields||(i={mapValue:{fields:{}}},t.mapValue.fields[e.get(r)]=i),t=i}return t.mapValue.fields}applyChanges(e,t,r){hr(t,((i,s)=>e[i]=s));for(const i of r)delete e[i]}clone(){return new xe(Ji(this.value))}}function rm(n){const e=[];return hr(n.fields,((t,r)=>{const i=new le([t]);if(So(r)){const s=rm(r.mapValue).fields;if(s.length===0)e.push(i);else for(const o of s)e.push(i.child(o))}else e.push(i)})),new it(e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ae{constructor(e,t,r,i,s,o,c){this.key=e,this.documentType=t,this.version=r,this.readTime=i,this.createTime=s,this.data=o,this.documentState=c}static newInvalidDocument(e){return new ae(e,0,$.min(),$.min(),$.min(),xe.empty(),0)}static newFoundDocument(e,t,r,i){return new ae(e,1,t,$.min(),r,i,0)}static newNoDocument(e,t){return new ae(e,2,t,$.min(),$.min(),xe.empty(),0)}static newUnknownDocument(e,t){return new ae(e,3,t,$.min(),$.min(),xe.empty(),2)}convertToFoundDocument(e,t){return!this.createTime.isEqual($.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=e),this.version=e,this.documentType=1,this.data=t,this.documentState=0,this}convertToNoDocument(e){return this.version=e,this.documentType=2,this.data=xe.empty(),this.documentState=0,this}convertToUnknownDocument(e){return this.version=e,this.documentType=3,this.data=xe.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=$.min(),this}setReadTime(e){return this.readTime=e,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(e){return e instanceof ae&&this.key.isEqual(e.key)&&this.version.isEqual(e.version)&&this.documentType===e.documentType&&this.documentState===e.documentState&&this.data.isEqual(e.data)}mutableCopy(){return new ae(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wn{constructor(e,t){this.position=e,this.inclusive=t}}function Pd(n,e,t){let r=0;for(let i=0;i<n.position.length;i++){const s=e[i],o=n.position[i];if(s.field.isKeyField()?r=L.comparator(L.fromName(o.referenceValue),t.key):r=vn(o,t.data.field(s.field)),s.dir==="desc"&&(r*=-1),r!==0)break}return r}function Sd(n,e){if(n===null)return e===null;if(e===null||n.inclusive!==e.inclusive||n.position.length!==e.position.length)return!1;for(let t=0;t<n.position.length;t++)if(!kt(n.position[t],e.position[t]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ms{constructor(e,t="asc"){this.field=e,this.dir=t}}function Ow(n,e){return n.dir===e.dir&&n.field.isEqual(e.field)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class im{}class X extends im{constructor(e,t,r){super(),this.field=e,this.op=t,this.value=r}static create(e,t,r){return e.isKeyField()?t==="in"||t==="not-in"?this.createKeyFieldInFilter(e,t,r):new xw(e,t,r):t==="array-contains"?new Fw(e,r):t==="in"?new lm(e,r):t==="not-in"?new Uw(e,r):t==="array-contains-any"?new Bw(e,r):new X(e,t,r)}static createKeyFieldInFilter(e,t,r){return t==="in"?new Lw(e,r):new Mw(e,r)}matches(e){const t=e.data.field(this.field);return this.op==="!="?t!==null&&this.matchesComparison(vn(t,this.value)):t!==null&&Yn(this.value)===Yn(t)&&this.matchesComparison(vn(t,this.value))}matchesComparison(e){switch(this.op){case"<":return e<0;case"<=":return e<=0;case"==":return e===0;case"!=":return e!==0;case">":return e>0;case">=":return e>=0;default:return U()}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class ne extends im{constructor(e,t){super(),this.filters=e,this.op=t,this.ae=null}static create(e,t){return new ne(e,t)}matches(e){return Gr(this)?this.filters.find((t=>!t.matches(e)))===void 0:this.filters.find((t=>t.matches(e)))!==void 0}getFlattenedFilters(){return this.ae!==null||(this.ae=this.filters.reduce(((e,t)=>e.concat(t.getFlattenedFilters())),[])),this.ae}getFilters(){return Object.assign([],this.filters)}}function Gr(n){return n.op==="and"}function qc(n){return n.op==="or"}function Du(n){return sm(n)&&Gr(n)}function sm(n){for(const e of n.filters)if(e instanceof ne)return!1;return!0}function jc(n){if(n instanceof X)return n.field.canonicalString()+n.op.toString()+zr(n.value);if(Du(n))return n.filters.map((e=>jc(e))).join(",");{const e=n.filters.map((t=>jc(t))).join(",");return`${n.op}(${e})`}}function om(n,e){return n instanceof X?(function(r,i){return i instanceof X&&r.op===i.op&&r.field.isEqual(i.field)&&kt(r.value,i.value)})(n,e):n instanceof ne?(function(r,i){return i instanceof ne&&r.op===i.op&&r.filters.length===i.filters.length?r.filters.reduce(((s,o,c)=>s&&om(o,i.filters[c])),!0):!1})(n,e):void U()}function am(n,e){const t=n.filters.concat(e);return ne.create(t,n.op)}function cm(n){return n instanceof X?(function(t){return`${t.field.canonicalString()} ${t.op} ${zr(t.value)}`})(n):n instanceof ne?(function(t){return t.op.toString()+" {"+t.getFilters().map(cm).join(" ,")+"}"})(n):"Filter"}class xw extends X{constructor(e,t,r){super(e,t,r),this.key=L.fromName(r.referenceValue)}matches(e){const t=L.comparator(e.key,this.key);return this.matchesComparison(t)}}class Lw extends X{constructor(e,t){super(e,"in",t),this.keys=um("in",t)}matches(e){return this.keys.some((t=>t.isEqual(e.key)))}}class Mw extends X{constructor(e,t){super(e,"not-in",t),this.keys=um("not-in",t)}matches(e){return!this.keys.some((t=>t.isEqual(e.key)))}}function um(n,e){var t;return(((t=e.arrayValue)===null||t===void 0?void 0:t.values)||[]).map((r=>L.fromName(r.referenceValue)))}class Fw extends X{constructor(e,t){super(e,"array-contains",t)}matches(e){const t=e.data.field(this.field);return ps(t)&&fs(t.arrayValue,this.value)}}class lm extends X{constructor(e,t){super(e,"in",t)}matches(e){const t=e.data.field(this.field);return t!==null&&fs(this.value.arrayValue,t)}}class Uw extends X{constructor(e,t){super(e,"not-in",t)}matches(e){if(fs(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const t=e.data.field(this.field);return t!==null&&!fs(this.value.arrayValue,t)}}class Bw extends X{constructor(e,t){super(e,"array-contains-any",t)}matches(e){const t=e.data.field(this.field);return!(!ps(t)||!t.arrayValue.values)&&t.arrayValue.values.some((r=>fs(this.value.arrayValue,r)))}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qw{constructor(e,t=null,r=[],i=[],s=null,o=null,c=null){this.path=e,this.collectionGroup=t,this.orderBy=r,this.filters=i,this.limit=s,this.startAt=o,this.endAt=c,this.ue=null}}function $c(n,e=null,t=[],r=[],i=null,s=null,o=null){return new qw(n,e,t,r,i,s,o)}function Zn(n){const e=M(n);if(e.ue===null){let t=e.path.canonicalString();e.collectionGroup!==null&&(t+="|cg:"+e.collectionGroup),t+="|f:",t+=e.filters.map((r=>jc(r))).join(","),t+="|ob:",t+=e.orderBy.map((r=>(function(s){return s.field.canonicalString()+s.dir})(r))).join(","),Ss(e.limit)||(t+="|l:",t+=e.limit),e.startAt&&(t+="|lb:",t+=e.startAt.inclusive?"b:":"a:",t+=e.startAt.position.map((r=>zr(r))).join(",")),e.endAt&&(t+="|ub:",t+=e.endAt.inclusive?"a:":"b:",t+=e.endAt.position.map((r=>zr(r))).join(",")),e.ue=t}return e.ue}function Cs(n,e){if(n.limit!==e.limit||n.orderBy.length!==e.orderBy.length)return!1;for(let t=0;t<n.orderBy.length;t++)if(!Ow(n.orderBy[t],e.orderBy[t]))return!1;if(n.filters.length!==e.filters.length)return!1;for(let t=0;t<n.filters.length;t++)if(!om(n.filters[t],e.filters[t]))return!1;return n.collectionGroup===e.collectionGroup&&!!n.path.isEqual(e.path)&&!!Sd(n.startAt,e.startAt)&&Sd(n.endAt,e.endAt)}function Bo(n){return L.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}function qo(n,e){return n.filters.filter((t=>t instanceof X&&t.field.isEqual(e)))}function Cd(n,e,t){let r=Po,i=!0;for(const s of qo(n,e)){let o=Po,c=!0;switch(s.op){case"<":case"<=":o=Nw(s.value);break;case"==":case"in":case">=":o=s.value;break;case">":o=s.value,c=!1;break;case"!=":case"not-in":o=Po}bd({value:r,inclusive:i},{value:o,inclusive:c})<0&&(r=o,i=c)}if(t!==null){for(let s=0;s<n.orderBy.length;++s)if(n.orderBy[s].field.isEqual(e)){const o=t.position[s];bd({value:r,inclusive:i},{value:o,inclusive:t.inclusive})<0&&(r=o,i=t.inclusive);break}}return{value:r,inclusive:i}}function kd(n,e,t){let r=dn,i=!0;for(const s of qo(n,e)){let o=dn,c=!0;switch(s.op){case">=":case">":o=Vw(s.value),c=!1;break;case"==":case"in":case"<=":o=s.value;break;case"<":o=s.value,c=!1;break;case"!=":case"not-in":o=dn}Rd({value:r,inclusive:i},{value:o,inclusive:c})>0&&(r=o,i=c)}if(t!==null){for(let s=0;s<n.orderBy.length;++s)if(n.orderBy[s].field.isEqual(e)){const o=t.position[s];Rd({value:r,inclusive:i},{value:o,inclusive:t.inclusive})>0&&(r=o,i=t.inclusive);break}}return{value:r,inclusive:i}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qt{constructor(e,t=null,r=[],i=[],s=null,o="F",c=null,u=null){this.path=e,this.collectionGroup=t,this.explicitOrderBy=r,this.filters=i,this.limit=s,this.limitType=o,this.startAt=c,this.endAt=u,this.ce=null,this.le=null,this.he=null,this.startAt,this.endAt}}function hm(n,e,t,r,i,s,o,c){return new Qt(n,e,t,r,i,s,o,c)}function oi(n){return new Qt(n)}function Dd(n){return n.filters.length===0&&n.limit===null&&n.startAt==null&&n.endAt==null&&(n.explicitOrderBy.length===0||n.explicitOrderBy.length===1&&n.explicitOrderBy[0].field.isKeyField())}function Nu(n){return n.collectionGroup!==null}function Vr(n){const e=M(n);if(e.ce===null){e.ce=[];const t=new Set;for(const s of e.explicitOrderBy)e.ce.push(s),t.add(s.field.canonicalString());const r=e.explicitOrderBy.length>0?e.explicitOrderBy[e.explicitOrderBy.length-1].dir:"asc";(function(o){let c=new re(le.comparator);return o.filters.forEach((u=>{u.getFlattenedFilters().forEach((h=>{h.isInequality()&&(c=c.add(h.field))}))})),c})(e).forEach((s=>{t.has(s.canonicalString())||s.isKeyField()||e.ce.push(new ms(s,r))})),t.has(le.keyField().canonicalString())||e.ce.push(new ms(le.keyField(),r))}return e.ce}function Ze(n){const e=M(n);return e.le||(e.le=jw(e,Vr(n))),e.le}function jw(n,e){if(n.limitType==="F")return $c(n.path,n.collectionGroup,e,n.filters,n.limit,n.startAt,n.endAt);{e=e.map((i=>{const s=i.dir==="desc"?"asc":"desc";return new ms(i.field,s)}));const t=n.endAt?new wn(n.endAt.position,n.endAt.inclusive):null,r=n.startAt?new wn(n.startAt.position,n.startAt.inclusive):null;return $c(n.path,n.collectionGroup,e,n.filters,n.limit,t,r)}}function zc(n,e){const t=n.filters.concat([e]);return new Qt(n.path,n.collectionGroup,n.explicitOrderBy.slice(),t,n.limit,n.limitType,n.startAt,n.endAt)}function jo(n,e,t){return new Qt(n.path,n.collectionGroup,n.explicitOrderBy.slice(),n.filters.slice(),e,t,n.startAt,n.endAt)}function ks(n,e){return Cs(Ze(n),Ze(e))&&n.limitType===e.limitType}function dm(n){return`${Zn(Ze(n))}|lt:${n.limitType}`}function Sr(n){return`Query(target=${(function(t){let r=t.path.canonicalString();return t.collectionGroup!==null&&(r+=" collectionGroup="+t.collectionGroup),t.filters.length>0&&(r+=`, filters: [${t.filters.map((i=>cm(i))).join(", ")}]`),Ss(t.limit)||(r+=", limit: "+t.limit),t.orderBy.length>0&&(r+=`, orderBy: [${t.orderBy.map((i=>(function(o){return`${o.field.canonicalString()} (${o.dir})`})(i))).join(", ")}]`),t.startAt&&(r+=", startAt: ",r+=t.startAt.inclusive?"b:":"a:",r+=t.startAt.position.map((i=>zr(i))).join(",")),t.endAt&&(r+=", endAt: ",r+=t.endAt.inclusive?"a:":"b:",r+=t.endAt.position.map((i=>zr(i))).join(",")),`Target(${r})`})(Ze(n))}; limitType=${n.limitType})`}function Ds(n,e){return e.isFoundDocument()&&(function(r,i){const s=i.key.path;return r.collectionGroup!==null?i.key.hasCollectionId(r.collectionGroup)&&r.path.isPrefixOf(s):L.isDocumentKey(r.path)?r.path.isEqual(s):r.path.isImmediateParentOf(s)})(n,e)&&(function(r,i){for(const s of Vr(r))if(!s.field.isKeyField()&&i.data.field(s.field)===null)return!1;return!0})(n,e)&&(function(r,i){for(const s of r.filters)if(!s.matches(i))return!1;return!0})(n,e)&&(function(r,i){return!(r.startAt&&!(function(o,c,u){const h=Pd(o,c,u);return o.inclusive?h<=0:h<0})(r.startAt,Vr(r),i)||r.endAt&&!(function(o,c,u){const h=Pd(o,c,u);return o.inclusive?h>=0:h>0})(r.endAt,Vr(r),i))})(n,e)}function fm(n){return n.collectionGroup||(n.path.length%2==1?n.path.lastSegment():n.path.get(n.path.length-2))}function pm(n){return(e,t)=>{let r=!1;for(const i of Vr(n)){const s=$w(i,e,t);if(s!==0)return s;r=r||i.field.isKeyField()}return 0}}function $w(n,e,t){const r=n.field.isKeyField()?L.comparator(e.key,t.key):(function(s,o,c){const u=o.data.field(s),h=c.data.field(s);return u!==null&&h!==null?vn(u,h):U()})(n.field,e,t);switch(n.dir){case"asc":return r;case"desc":return-1*r;default:return U()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sn{constructor(e,t){this.mapKeyFn=e,this.equalsFn=t,this.inner={},this.innerSize=0}get(e){const t=this.mapKeyFn(e),r=this.inner[t];if(r!==void 0){for(const[i,s]of r)if(this.equalsFn(i,e))return s}}has(e){return this.get(e)!==void 0}set(e,t){const r=this.mapKeyFn(e),i=this.inner[r];if(i===void 0)return this.inner[r]=[[e,t]],void this.innerSize++;for(let s=0;s<i.length;s++)if(this.equalsFn(i[s][0],e))return void(i[s]=[e,t]);i.push([e,t]),this.innerSize++}delete(e){const t=this.mapKeyFn(e),r=this.inner[t];if(r===void 0)return!1;for(let i=0;i<r.length;i++)if(this.equalsFn(r[i][0],e))return r.length===1?delete this.inner[t]:r.splice(i,1),this.innerSize--,!0;return!1}forEach(e){hr(this.inner,((t,r)=>{for(const[i,s]of r)e(i,s)}))}isEmpty(){return Zp(this.inner)}size(){return this.innerSize}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const zw=new se(L.comparator);function st(){return zw}const mm=new se(L.comparator);function Gi(...n){let e=mm;for(const t of n)e=e.insert(t.key,t);return e}function gm(n){let e=mm;return n.forEach(((t,r)=>e=e.insert(t,r.overlayedDocument))),e}function Et(){return Yi()}function _m(){return Yi()}function Yi(){return new Sn((n=>n.toString()),((n,e)=>n.isEqual(e)))}const Gw=new se(L.comparator),Kw=new re(L.comparator);function H(...n){let e=Kw;for(const t of n)e=e.add(t);return e}const Ww=new re(W);function Vu(){return Ww}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ou(n,e){if(n.useProto3Json){if(isNaN(e))return{doubleValue:"NaN"};if(e===1/0)return{doubleValue:"Infinity"};if(e===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:hs(e)?"-0":e}}function ym(n){return{integerValue:""+n}}function Im(n,e){return Hp(e)?ym(e):Ou(n,e)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class la{constructor(){this._=void 0}}function Hw(n,e,t){return n instanceof Kr?(function(i,s){const o={fields:{__type__:{stringValue:"server_timestamp"},__local_write_time__:{timestampValue:{seconds:i.seconds,nanos:i.nanoseconds}}}};return s&&ca(s)&&(s=ku(s)),s&&(o.fields.__previous_value__=s),{mapValue:o}})(t,e):n instanceof er?wm(n,e):n instanceof tr?Tm(n,e):(function(i,s){const o=vm(i,s),c=Nd(o)+Nd(i.Pe);return Bc(o)&&Bc(i.Pe)?ym(c):Ou(i.serializer,c)})(n,e)}function Qw(n,e,t){return n instanceof er?wm(n,e):n instanceof tr?Tm(n,e):t}function vm(n,e){return n instanceof Wr?(function(r){return Bc(r)||(function(s){return!!s&&"doubleValue"in s})(r)})(e)?e:{integerValue:0}:null}class Kr extends la{}class er extends la{constructor(e){super(),this.elements=e}}function wm(n,e){const t=Em(e);for(const r of n.elements)t.some((i=>kt(i,r)))||t.push(r);return{arrayValue:{values:t}}}class tr extends la{constructor(e){super(),this.elements=e}}function Tm(n,e){let t=Em(e);for(const r of n.elements)t=t.filter((i=>!kt(i,r)));return{arrayValue:{values:t}}}class Wr extends la{constructor(e,t){super(),this.serializer=e,this.Pe=t}}function Nd(n){return ue(n.integerValue||n.doubleValue)}function Em(n){return ps(n)&&n.arrayValue.values?n.arrayValue.values.slice():[]}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ns{constructor(e,t){this.field=e,this.transform=t}}function Jw(n,e){return n.field.isEqual(e.field)&&(function(r,i){return r instanceof er&&i instanceof er||r instanceof tr&&i instanceof tr?$r(r.elements,i.elements,kt):r instanceof Wr&&i instanceof Wr?kt(r.Pe,i.Pe):r instanceof Kr&&i instanceof Kr})(n.transform,e.transform)}class Yw{constructor(e,t){this.version=e,this.transformResults=t}}class he{constructor(e,t){this.updateTime=e,this.exists=t}static none(){return new he}static exists(e){return new he(void 0,e)}static updateTime(e){return new he(e)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(e){return this.exists===e.exists&&(this.updateTime?!!e.updateTime&&this.updateTime.isEqual(e.updateTime):!e.updateTime)}}function Co(n,e){return n.updateTime!==void 0?e.isFoundDocument()&&e.version.isEqual(n.updateTime):n.exists===void 0||n.exists===e.isFoundDocument()}class ha{}function Am(n,e){if(!n.hasLocalMutations||e&&e.fields.length===0)return null;if(e===null)return n.isNoDocument()?new ci(n.key,he.none()):new ai(n.key,n.data,he.none());{const t=n.data,r=xe.empty();let i=new re(le.comparator);for(let s of e.fields)if(!i.has(s)){let o=t.field(s);o===null&&s.length>1&&(s=s.popLast(),o=t.field(s)),o===null?r.delete(s):r.set(s,o),i=i.add(s)}return new Jt(n.key,r,new it(i.toArray()),he.none())}}function Xw(n,e,t){n instanceof ai?(function(i,s,o){const c=i.value.clone(),u=Od(i.fieldTransforms,s,o.transformResults);c.setAll(u),s.convertToFoundDocument(o.version,c).setHasCommittedMutations()})(n,e,t):n instanceof Jt?(function(i,s,o){if(!Co(i.precondition,s))return void s.convertToUnknownDocument(o.version);const c=Od(i.fieldTransforms,s,o.transformResults),u=s.data;u.setAll(bm(i)),u.setAll(c),s.convertToFoundDocument(o.version,u).setHasCommittedMutations()})(n,e,t):(function(i,s,o){s.convertToNoDocument(o.version).setHasCommittedMutations()})(0,e,t)}function Xi(n,e,t,r){return n instanceof ai?(function(s,o,c,u){if(!Co(s.precondition,o))return c;const h=s.value.clone(),f=xd(s.fieldTransforms,u,o);return h.setAll(f),o.convertToFoundDocument(o.version,h).setHasLocalMutations(),null})(n,e,t,r):n instanceof Jt?(function(s,o,c,u){if(!Co(s.precondition,o))return c;const h=xd(s.fieldTransforms,u,o),f=o.data;return f.setAll(bm(s)),f.setAll(h),o.convertToFoundDocument(o.version,f).setHasLocalMutations(),c===null?null:c.unionWith(s.fieldMask.fields).unionWith(s.fieldTransforms.map((p=>p.field)))})(n,e,t,r):(function(s,o,c){return Co(s.precondition,o)?(o.convertToNoDocument(o.version).setHasLocalMutations(),null):c})(n,e,t)}function Zw(n,e){let t=null;for(const r of n.fieldTransforms){const i=e.data.field(r.field),s=vm(r.transform,i||null);s!=null&&(t===null&&(t=xe.empty()),t.set(r.field,s))}return t||null}function Vd(n,e){return n.type===e.type&&!!n.key.isEqual(e.key)&&!!n.precondition.isEqual(e.precondition)&&!!(function(r,i){return r===void 0&&i===void 0||!(!r||!i)&&$r(r,i,((s,o)=>Jw(s,o)))})(n.fieldTransforms,e.fieldTransforms)&&(n.type===0?n.value.isEqual(e.value):n.type!==1||n.data.isEqual(e.data)&&n.fieldMask.isEqual(e.fieldMask))}class ai extends ha{constructor(e,t,r,i=[]){super(),this.key=e,this.value=t,this.precondition=r,this.fieldTransforms=i,this.type=0}getFieldMask(){return null}}class Jt extends ha{constructor(e,t,r,i,s=[]){super(),this.key=e,this.data=t,this.fieldMask=r,this.precondition=i,this.fieldTransforms=s,this.type=1}getFieldMask(){return this.fieldMask}}function bm(n){const e=new Map;return n.fieldMask.fields.forEach((t=>{if(!t.isEmpty()){const r=n.data.field(t);e.set(t,r)}})),e}function Od(n,e,t){const r=new Map;q(n.length===t.length);for(let i=0;i<t.length;i++){const s=n[i],o=s.transform,c=e.data.field(s.field);r.set(s.field,Qw(o,c,t[i]))}return r}function xd(n,e,t){const r=new Map;for(const i of n){const s=i.transform,o=t.data.field(i.field);r.set(i.field,Hw(s,o,e))}return r}class ci extends ha{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}class xu extends ha{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=3,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Lu{constructor(e,t,r,i){this.batchId=e,this.localWriteTime=t,this.baseMutations=r,this.mutations=i}applyToRemoteDocument(e,t){const r=t.mutationResults;for(let i=0;i<this.mutations.length;i++){const s=this.mutations[i];s.key.isEqual(e.key)&&Xw(s,e,r[i])}}applyToLocalView(e,t){for(const r of this.baseMutations)r.key.isEqual(e.key)&&(t=Xi(r,e,t,this.localWriteTime));for(const r of this.mutations)r.key.isEqual(e.key)&&(t=Xi(r,e,t,this.localWriteTime));return t}applyToLocalDocumentSet(e,t){const r=_m();return this.mutations.forEach((i=>{const s=e.get(i.key),o=s.overlayedDocument;let c=this.applyToLocalView(o,s.mutatedFields);c=t.has(i.key)?null:c;const u=Am(o,c);u!==null&&r.set(i.key,u),o.isValidDocument()||o.convertToNoDocument($.min())})),r}keys(){return this.mutations.reduce(((e,t)=>e.add(t.key)),H())}isEqual(e){return this.batchId===e.batchId&&$r(this.mutations,e.mutations,((t,r)=>Vd(t,r)))&&$r(this.baseMutations,e.baseMutations,((t,r)=>Vd(t,r)))}}class Mu{constructor(e,t,r,i){this.batch=e,this.commitVersion=t,this.mutationResults=r,this.docVersions=i}static from(e,t,r){q(e.mutations.length===r.length);let i=(function(){return Gw})();const s=e.mutations;for(let o=0;o<s.length;o++)i=i.insert(s[o].key,r[o].version);return new Mu(e,t,r,i)}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Fu{constructor(e,t){this.largestBatchId=e,this.mutation=t}getKey(){return this.mutation.key}isEqual(e){return e!==null&&this.mutation===e.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class eT{constructor(e,t){this.count=e,this.unchangedNames=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var be,Z;function Rm(n){switch(n){default:return U();case P.CANCELLED:case P.UNKNOWN:case P.DEADLINE_EXCEEDED:case P.RESOURCE_EXHAUSTED:case P.INTERNAL:case P.UNAVAILABLE:case P.UNAUTHENTICATED:return!1;case P.INVALID_ARGUMENT:case P.NOT_FOUND:case P.ALREADY_EXISTS:case P.PERMISSION_DENIED:case P.FAILED_PRECONDITION:case P.ABORTED:case P.OUT_OF_RANGE:case P.UNIMPLEMENTED:case P.DATA_LOSS:return!0}}function Pm(n){if(n===void 0)return Te("GRPC error has no .code"),P.UNKNOWN;switch(n){case be.OK:return P.OK;case be.CANCELLED:return P.CANCELLED;case be.UNKNOWN:return P.UNKNOWN;case be.DEADLINE_EXCEEDED:return P.DEADLINE_EXCEEDED;case be.RESOURCE_EXHAUSTED:return P.RESOURCE_EXHAUSTED;case be.INTERNAL:return P.INTERNAL;case be.UNAVAILABLE:return P.UNAVAILABLE;case be.UNAUTHENTICATED:return P.UNAUTHENTICATED;case be.INVALID_ARGUMENT:return P.INVALID_ARGUMENT;case be.NOT_FOUND:return P.NOT_FOUND;case be.ALREADY_EXISTS:return P.ALREADY_EXISTS;case be.PERMISSION_DENIED:return P.PERMISSION_DENIED;case be.FAILED_PRECONDITION:return P.FAILED_PRECONDITION;case be.ABORTED:return P.ABORTED;case be.OUT_OF_RANGE:return P.OUT_OF_RANGE;case be.UNIMPLEMENTED:return P.UNIMPLEMENTED;case be.DATA_LOSS:return P.DATA_LOSS;default:return U()}}(Z=be||(be={}))[Z.OK=0]="OK",Z[Z.CANCELLED=1]="CANCELLED",Z[Z.UNKNOWN=2]="UNKNOWN",Z[Z.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",Z[Z.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",Z[Z.NOT_FOUND=5]="NOT_FOUND",Z[Z.ALREADY_EXISTS=6]="ALREADY_EXISTS",Z[Z.PERMISSION_DENIED=7]="PERMISSION_DENIED",Z[Z.UNAUTHENTICATED=16]="UNAUTHENTICATED",Z[Z.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",Z[Z.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",Z[Z.ABORTED=10]="ABORTED",Z[Z.OUT_OF_RANGE=11]="OUT_OF_RANGE",Z[Z.UNIMPLEMENTED=12]="UNIMPLEMENTED",Z[Z.INTERNAL=13]="INTERNAL",Z[Z.UNAVAILABLE=14]="UNAVAILABLE",Z[Z.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Sm(){return new TextEncoder}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const tT=new Wn([4294967295,4294967295],0);function Ld(n){const e=Sm().encode(n),t=new Op;return t.update(e),new Uint8Array(t.digest())}function Md(n){const e=new DataView(n.buffer),t=e.getUint32(0,!0),r=e.getUint32(4,!0),i=e.getUint32(8,!0),s=e.getUint32(12,!0);return[new Wn([t,r],0),new Wn([i,s],0)]}class Uu{constructor(e,t,r){if(this.bitmap=e,this.padding=t,this.hashCount=r,t<0||t>=8)throw new Ki(`Invalid padding: ${t}`);if(r<0)throw new Ki(`Invalid hash count: ${r}`);if(e.length>0&&this.hashCount===0)throw new Ki(`Invalid hash count: ${r}`);if(e.length===0&&t!==0)throw new Ki(`Invalid padding when bitmap length is 0: ${t}`);this.Ie=8*e.length-t,this.Te=Wn.fromNumber(this.Ie)}Ee(e,t,r){let i=e.add(t.multiply(Wn.fromNumber(r)));return i.compare(tT)===1&&(i=new Wn([i.getBits(0),i.getBits(1)],0)),i.modulo(this.Te).toNumber()}de(e){return(this.bitmap[Math.floor(e/8)]&1<<e%8)!=0}mightContain(e){if(this.Ie===0)return!1;const t=Ld(e),[r,i]=Md(t);for(let s=0;s<this.hashCount;s++){const o=this.Ee(r,i,s);if(!this.de(o))return!1}return!0}static create(e,t,r){const i=e%8==0?0:8-e%8,s=new Uint8Array(Math.ceil(e/8)),o=new Uu(s,i,t);return r.forEach((c=>o.insert(c))),o}insert(e){if(this.Ie===0)return;const t=Ld(e),[r,i]=Md(t);for(let s=0;s<this.hashCount;s++){const o=this.Ee(r,i,s);this.Ae(o)}}Ae(e){const t=Math.floor(e/8),r=e%8;this.bitmap[t]|=1<<r}}class Ki extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vs{constructor(e,t,r,i,s){this.snapshotVersion=e,this.targetChanges=t,this.targetMismatches=r,this.documentUpdates=i,this.resolvedLimboDocuments=s}static createSynthesizedRemoteEventForCurrentChange(e,t,r){const i=new Map;return i.set(e,Os.createSynthesizedTargetChangeForCurrentChange(e,t,r)),new Vs($.min(),i,new se(W),st(),H())}}class Os{constructor(e,t,r,i,s){this.resumeToken=e,this.current=t,this.addedDocuments=r,this.modifiedDocuments=i,this.removedDocuments=s}static createSynthesizedTargetChangeForCurrentChange(e,t,r){return new Os(r,t,H(),H(),H())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ko{constructor(e,t,r,i){this.Re=e,this.removedTargetIds=t,this.key=r,this.Ve=i}}class Cm{constructor(e,t){this.targetId=e,this.me=t}}class km{constructor(e,t,r=ye.EMPTY_BYTE_STRING,i=null){this.state=e,this.targetIds=t,this.resumeToken=r,this.cause=i}}class Fd{constructor(){this.fe=0,this.ge=Bd(),this.pe=ye.EMPTY_BYTE_STRING,this.ye=!1,this.we=!0}get current(){return this.ye}get resumeToken(){return this.pe}get Se(){return this.fe!==0}get be(){return this.we}De(e){e.approximateByteSize()>0&&(this.we=!0,this.pe=e)}ve(){let e=H(),t=H(),r=H();return this.ge.forEach(((i,s)=>{switch(s){case 0:e=e.add(i);break;case 2:t=t.add(i);break;case 1:r=r.add(i);break;default:U()}})),new Os(this.pe,this.ye,e,t,r)}Ce(){this.we=!1,this.ge=Bd()}Fe(e,t){this.we=!0,this.ge=this.ge.insert(e,t)}Me(e){this.we=!0,this.ge=this.ge.remove(e)}xe(){this.fe+=1}Oe(){this.fe-=1,q(this.fe>=0)}Ne(){this.we=!0,this.ye=!0}}class nT{constructor(e){this.Le=e,this.Be=new Map,this.ke=st(),this.qe=Ud(),this.Qe=new se(W)}Ke(e){for(const t of e.Re)e.Ve&&e.Ve.isFoundDocument()?this.$e(t,e.Ve):this.Ue(t,e.key,e.Ve);for(const t of e.removedTargetIds)this.Ue(t,e.key,e.Ve)}We(e){this.forEachTarget(e,(t=>{const r=this.Ge(t);switch(e.state){case 0:this.ze(t)&&r.De(e.resumeToken);break;case 1:r.Oe(),r.Se||r.Ce(),r.De(e.resumeToken);break;case 2:r.Oe(),r.Se||this.removeTarget(t);break;case 3:this.ze(t)&&(r.Ne(),r.De(e.resumeToken));break;case 4:this.ze(t)&&(this.je(t),r.De(e.resumeToken));break;default:U()}}))}forEachTarget(e,t){e.targetIds.length>0?e.targetIds.forEach(t):this.Be.forEach(((r,i)=>{this.ze(i)&&t(i)}))}He(e){const t=e.targetId,r=e.me.count,i=this.Je(t);if(i){const s=i.target;if(Bo(s))if(r===0){const o=new L(s.path);this.Ue(t,o,ae.newNoDocument(o,$.min()))}else q(r===1);else{const o=this.Ye(t);if(o!==r){const c=this.Ze(e),u=c?this.Xe(c,e,o):1;if(u!==0){this.je(t);const h=u===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.Qe=this.Qe.insert(t,h)}}}}}Ze(e){const t=e.me.unchangedNames;if(!t||!t.bits)return null;const{bits:{bitmap:r="",padding:i=0},hashCount:s=0}=t;let o,c;try{o=yn(r).toUint8Array()}catch(u){if(u instanceof em)return Ct("Decoding the base64 bloom filter in existence filter failed ("+u.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw u}try{c=new Uu(o,i,s)}catch(u){return Ct(u instanceof Ki?"BloomFilter error: ":"Applying bloom filter failed: ",u),null}return c.Ie===0?null:c}Xe(e,t,r){return t.me.count===r-this.nt(e,t.targetId)?0:2}nt(e,t){const r=this.Le.getRemoteKeysForTarget(t);let i=0;return r.forEach((s=>{const o=this.Le.tt(),c=`projects/${o.projectId}/databases/${o.database}/documents/${s.path.canonicalString()}`;e.mightContain(c)||(this.Ue(t,s,null),i++)})),i}rt(e){const t=new Map;this.Be.forEach(((s,o)=>{const c=this.Je(o);if(c){if(s.current&&Bo(c.target)){const u=new L(c.target.path);this.ke.get(u)!==null||this.it(o,u)||this.Ue(o,u,ae.newNoDocument(u,e))}s.be&&(t.set(o,s.ve()),s.Ce())}}));let r=H();this.qe.forEach(((s,o)=>{let c=!0;o.forEachWhile((u=>{const h=this.Je(u);return!h||h.purpose==="TargetPurposeLimboResolution"||(c=!1,!1)})),c&&(r=r.add(s))})),this.ke.forEach(((s,o)=>o.setReadTime(e)));const i=new Vs(e,t,this.Qe,this.ke,r);return this.ke=st(),this.qe=Ud(),this.Qe=new se(W),i}$e(e,t){if(!this.ze(e))return;const r=this.it(e,t.key)?2:0;this.Ge(e).Fe(t.key,r),this.ke=this.ke.insert(t.key,t),this.qe=this.qe.insert(t.key,this.st(t.key).add(e))}Ue(e,t,r){if(!this.ze(e))return;const i=this.Ge(e);this.it(e,t)?i.Fe(t,1):i.Me(t),this.qe=this.qe.insert(t,this.st(t).delete(e)),r&&(this.ke=this.ke.insert(t,r))}removeTarget(e){this.Be.delete(e)}Ye(e){const t=this.Ge(e).ve();return this.Le.getRemoteKeysForTarget(e).size+t.addedDocuments.size-t.removedDocuments.size}xe(e){this.Ge(e).xe()}Ge(e){let t=this.Be.get(e);return t||(t=new Fd,this.Be.set(e,t)),t}st(e){let t=this.qe.get(e);return t||(t=new re(W),this.qe=this.qe.insert(e,t)),t}ze(e){const t=this.Je(e)!==null;return t||V("WatchChangeAggregator","Detected inactive target",e),t}Je(e){const t=this.Be.get(e);return t&&t.Se?null:this.Le.ot(e)}je(e){this.Be.set(e,new Fd),this.Le.getRemoteKeysForTarget(e).forEach((t=>{this.Ue(e,t,null)}))}it(e,t){return this.Le.getRemoteKeysForTarget(e).has(t)}}function Ud(){return new se(L.comparator)}function Bd(){return new se(L.comparator)}const rT={asc:"ASCENDING",desc:"DESCENDING"},iT={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},sT={and:"AND",or:"OR"};class oT{constructor(e,t){this.databaseId=e,this.useProto3Json=t}}function Gc(n,e){return n.useProto3Json||Ss(e)?e:{value:e}}function Hr(n,e){return n.useProto3Json?`${new Date(1e3*e.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+e.nanoseconds).slice(-9)}Z`:{seconds:""+e.seconds,nanos:e.nanoseconds}}function Dm(n,e){return n.useProto3Json?e.toBase64():e.toUint8Array()}function aT(n,e){return Hr(n,e.toTimestamp())}function Ee(n){return q(!!n),$.fromTimestamp((function(t){const r=Gt(t);return new de(r.seconds,r.nanos)})(n))}function Bu(n,e){return Kc(n,e).canonicalString()}function Kc(n,e){const t=(function(i){return new Y(["projects",i.projectId,"databases",i.database])})(n).child("documents");return e===void 0?t:t.child(e)}function Nm(n){const e=Y.fromString(n);return q(jm(e)),e}function gs(n,e){return Bu(n.databaseId,e.path)}function Rt(n,e){const t=Nm(e);if(t.get(1)!==n.databaseId.projectId)throw new N(P.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+t.get(1)+" vs "+n.databaseId.projectId);if(t.get(3)!==n.databaseId.database)throw new N(P.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+t.get(3)+" vs "+n.databaseId.database);return new L(xm(t))}function Vm(n,e){return Bu(n.databaseId,e)}function Om(n){const e=Nm(n);return e.length===4?Y.emptyPath():xm(e)}function Wc(n){return new Y(["projects",n.databaseId.projectId,"databases",n.databaseId.database]).canonicalString()}function xm(n){return q(n.length>4&&n.get(4)==="documents"),n.popFirst(5)}function qd(n,e,t){return{name:gs(n,e),fields:t.value.mapValue.fields}}function Lm(n,e,t){const r=Rt(n,e.name),i=Ee(e.updateTime),s=e.createTime?Ee(e.createTime):$.min(),o=new xe({mapValue:{fields:e.fields}}),c=ae.newFoundDocument(r,i,s,o);return t&&c.setHasCommittedMutations(),t?c.setHasCommittedMutations():c}function cT(n,e){return"found"in e?(function(r,i){q(!!i.found),i.found.name,i.found.updateTime;const s=Rt(r,i.found.name),o=Ee(i.found.updateTime),c=i.found.createTime?Ee(i.found.createTime):$.min(),u=new xe({mapValue:{fields:i.found.fields}});return ae.newFoundDocument(s,o,c,u)})(n,e):"missing"in e?(function(r,i){q(!!i.missing),q(!!i.readTime);const s=Rt(r,i.missing),o=Ee(i.readTime);return ae.newNoDocument(s,o)})(n,e):U()}function uT(n,e){let t;if("targetChange"in e){e.targetChange;const r=(function(h){return h==="NO_CHANGE"?0:h==="ADD"?1:h==="REMOVE"?2:h==="CURRENT"?3:h==="RESET"?4:U()})(e.targetChange.targetChangeType||"NO_CHANGE"),i=e.targetChange.targetIds||[],s=(function(h,f){return h.useProto3Json?(q(f===void 0||typeof f=="string"),ye.fromBase64String(f||"")):(q(f===void 0||f instanceof Buffer||f instanceof Uint8Array),ye.fromUint8Array(f||new Uint8Array))})(n,e.targetChange.resumeToken),o=e.targetChange.cause,c=o&&(function(h){const f=h.code===void 0?P.UNKNOWN:Pm(h.code);return new N(f,h.message||"")})(o);t=new km(r,i,s,c||null)}else if("documentChange"in e){e.documentChange;const r=e.documentChange;r.document,r.document.name,r.document.updateTime;const i=Rt(n,r.document.name),s=Ee(r.document.updateTime),o=r.document.createTime?Ee(r.document.createTime):$.min(),c=new xe({mapValue:{fields:r.document.fields}}),u=ae.newFoundDocument(i,s,o,c),h=r.targetIds||[],f=r.removedTargetIds||[];t=new ko(h,f,u.key,u)}else if("documentDelete"in e){e.documentDelete;const r=e.documentDelete;r.document;const i=Rt(n,r.document),s=r.readTime?Ee(r.readTime):$.min(),o=ae.newNoDocument(i,s),c=r.removedTargetIds||[];t=new ko([],c,o.key,o)}else if("documentRemove"in e){e.documentRemove;const r=e.documentRemove;r.document;const i=Rt(n,r.document),s=r.removedTargetIds||[];t=new ko([],s,i,null)}else{if(!("filter"in e))return U();{e.filter;const r=e.filter;r.targetId;const{count:i=0,unchangedNames:s}=r,o=new eT(i,s),c=r.targetId;t=new Cm(c,o)}}return t}function _s(n,e){let t;if(e instanceof ai)t={update:qd(n,e.key,e.value)};else if(e instanceof ci)t={delete:gs(n,e.key)};else if(e instanceof Jt)t={update:qd(n,e.key,e.data),updateMask:mT(e.fieldMask)};else{if(!(e instanceof xu))return U();t={verify:gs(n,e.key)}}return e.fieldTransforms.length>0&&(t.updateTransforms=e.fieldTransforms.map((r=>(function(s,o){const c=o.transform;if(c instanceof Kr)return{fieldPath:o.field.canonicalString(),setToServerValue:"REQUEST_TIME"};if(c instanceof er)return{fieldPath:o.field.canonicalString(),appendMissingElements:{values:c.elements}};if(c instanceof tr)return{fieldPath:o.field.canonicalString(),removeAllFromArray:{values:c.elements}};if(c instanceof Wr)return{fieldPath:o.field.canonicalString(),increment:c.Pe};throw U()})(0,r)))),e.precondition.isNone||(t.currentDocument=(function(i,s){return s.updateTime!==void 0?{updateTime:aT(i,s.updateTime)}:s.exists!==void 0?{exists:s.exists}:U()})(n,e.precondition)),t}function Hc(n,e){const t=e.currentDocument?(function(s){return s.updateTime!==void 0?he.updateTime(Ee(s.updateTime)):s.exists!==void 0?he.exists(s.exists):he.none()})(e.currentDocument):he.none(),r=e.updateTransforms?e.updateTransforms.map((i=>(function(o,c){let u=null;if("setToServerValue"in c)q(c.setToServerValue==="REQUEST_TIME"),u=new Kr;else if("appendMissingElements"in c){const f=c.appendMissingElements.values||[];u=new er(f)}else if("removeAllFromArray"in c){const f=c.removeAllFromArray.values||[];u=new tr(f)}else"increment"in c?u=new Wr(o,c.increment):U();const h=le.fromServerFormat(c.fieldPath);return new Ns(h,u)})(n,i))):[];if(e.update){e.update.name;const i=Rt(n,e.update.name),s=new xe({mapValue:{fields:e.update.fields}});if(e.updateMask){const o=(function(u){const h=u.fieldPaths||[];return new it(h.map((f=>le.fromServerFormat(f))))})(e.updateMask);return new Jt(i,s,o,t,r)}return new ai(i,s,t,r)}if(e.delete){const i=Rt(n,e.delete);return new ci(i,t)}if(e.verify){const i=Rt(n,e.verify);return new xu(i,t)}return U()}function lT(n,e){return n&&n.length>0?(q(e!==void 0),n.map((t=>(function(i,s){let o=i.updateTime?Ee(i.updateTime):Ee(s);return o.isEqual($.min())&&(o=Ee(s)),new Yw(o,i.transformResults||[])})(t,e)))):[]}function Mm(n,e){return{documents:[Vm(n,e.path)]}}function Fm(n,e){const t={structuredQuery:{}},r=e.path;let i;e.collectionGroup!==null?(i=r,t.structuredQuery.from=[{collectionId:e.collectionGroup,allDescendants:!0}]):(i=r.popLast(),t.structuredQuery.from=[{collectionId:r.lastSegment()}]),t.parent=Vm(n,i);const s=(function(h){if(h.length!==0)return qm(ne.create(h,"and"))})(e.filters);s&&(t.structuredQuery.where=s);const o=(function(h){if(h.length!==0)return h.map((f=>(function(g){return{field:Cr(g.field),direction:dT(g.dir)}})(f)))})(e.orderBy);o&&(t.structuredQuery.orderBy=o);const c=Gc(n,e.limit);return c!==null&&(t.structuredQuery.limit=c),e.startAt&&(t.structuredQuery.startAt=(function(h){return{before:h.inclusive,values:h.position}})(e.startAt)),e.endAt&&(t.structuredQuery.endAt=(function(h){return{before:!h.inclusive,values:h.position}})(e.endAt)),{_t:t,parent:i}}function Um(n){let e=Om(n.parent);const t=n.structuredQuery,r=t.from?t.from.length:0;let i=null;if(r>0){q(r===1);const f=t.from[0];f.allDescendants?i=f.collectionId:e=e.child(f.collectionId)}let s=[];t.where&&(s=(function(p){const g=Bm(p);return g instanceof ne&&Du(g)?g.getFilters():[g]})(t.where));let o=[];t.orderBy&&(o=(function(p){return p.map((g=>(function(C){return new ms(kr(C.field),(function(k){switch(k){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}})(C.direction))})(g)))})(t.orderBy));let c=null;t.limit&&(c=(function(p){let g;return g=typeof p=="object"?p.value:p,Ss(g)?null:g})(t.limit));let u=null;t.startAt&&(u=(function(p){const g=!!p.before,T=p.values||[];return new wn(T,g)})(t.startAt));let h=null;return t.endAt&&(h=(function(p){const g=!p.before,T=p.values||[];return new wn(T,g)})(t.endAt)),hm(e,i,o,s,c,"F",u,h)}function hT(n,e){const t=(function(i){switch(i){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return U()}})(e.purpose);return t==null?null:{"goog-listen-tags":t}}function Bm(n){return n.unaryFilter!==void 0?(function(t){switch(t.unaryFilter.op){case"IS_NAN":const r=kr(t.unaryFilter.field);return X.create(r,"==",{doubleValue:NaN});case"IS_NULL":const i=kr(t.unaryFilter.field);return X.create(i,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":const s=kr(t.unaryFilter.field);return X.create(s,"!=",{doubleValue:NaN});case"IS_NOT_NULL":const o=kr(t.unaryFilter.field);return X.create(o,"!=",{nullValue:"NULL_VALUE"});default:return U()}})(n):n.fieldFilter!==void 0?(function(t){return X.create(kr(t.fieldFilter.field),(function(i){switch(i){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";default:return U()}})(t.fieldFilter.op),t.fieldFilter.value)})(n):n.compositeFilter!==void 0?(function(t){return ne.create(t.compositeFilter.filters.map((r=>Bm(r))),(function(i){switch(i){case"AND":return"and";case"OR":return"or";default:return U()}})(t.compositeFilter.op))})(n):U()}function dT(n){return rT[n]}function fT(n){return iT[n]}function pT(n){return sT[n]}function Cr(n){return{fieldPath:n.canonicalString()}}function kr(n){return le.fromServerFormat(n.fieldPath)}function qm(n){return n instanceof X?(function(t){if(t.op==="=="){if(Ad(t.value))return{unaryFilter:{field:Cr(t.field),op:"IS_NAN"}};if(Ed(t.value))return{unaryFilter:{field:Cr(t.field),op:"IS_NULL"}}}else if(t.op==="!="){if(Ad(t.value))return{unaryFilter:{field:Cr(t.field),op:"IS_NOT_NAN"}};if(Ed(t.value))return{unaryFilter:{field:Cr(t.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:Cr(t.field),op:fT(t.op),value:t.value}}})(n):n instanceof ne?(function(t){const r=t.getFilters().map((i=>qm(i)));return r.length===1?r[0]:{compositeFilter:{op:pT(t.op),filters:r}}})(n):U()}function mT(n){const e=[];return n.fields.forEach((t=>e.push(t.canonicalString()))),{fieldPaths:e}}function jm(n){return n.length>=4&&n.get(0)==="projects"&&n.get(2)==="databases"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mt{constructor(e,t,r,i,s=$.min(),o=$.min(),c=ye.EMPTY_BYTE_STRING,u=null){this.target=e,this.targetId=t,this.purpose=r,this.sequenceNumber=i,this.snapshotVersion=s,this.lastLimboFreeSnapshotVersion=o,this.resumeToken=c,this.expectedCount=u}withSequenceNumber(e){return new Mt(this.target,this.targetId,this.purpose,e,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(e,t){return new Mt(this.target,this.targetId,this.purpose,this.sequenceNumber,t,this.lastLimboFreeSnapshotVersion,e,null)}withExpectedCount(e){return new Mt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,e)}withLastLimboFreeSnapshotVersion(e){return new Mt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,e,this.resumeToken,this.expectedCount)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $m{constructor(e){this.ct=e}}function gT(n,e){let t;if(e.document)t=Lm(n.ct,e.document,!!e.hasCommittedMutations);else if(e.noDocument){const r=L.fromSegments(e.noDocument.path),i=rr(e.noDocument.readTime);t=ae.newNoDocument(r,i),e.hasCommittedMutations&&t.setHasCommittedMutations()}else{if(!e.unknownDocument)return U();{const r=L.fromSegments(e.unknownDocument.path),i=rr(e.unknownDocument.version);t=ae.newUnknownDocument(r,i)}}return e.readTime&&t.setReadTime((function(i){const s=new de(i[0],i[1]);return $.fromTimestamp(s)})(e.readTime)),t}function jd(n,e){const t=e.key,r={prefixPath:t.getCollectionPath().popLast().toArray(),collectionGroup:t.collectionGroup,documentId:t.path.lastSegment(),readTime:$o(e.readTime),hasCommittedMutations:e.hasCommittedMutations};if(e.isFoundDocument())r.document=(function(s,o){return{name:gs(s,o.key),fields:o.data.value.mapValue.fields,updateTime:Hr(s,o.version.toTimestamp()),createTime:Hr(s,o.createTime.toTimestamp())}})(n.ct,e);else if(e.isNoDocument())r.noDocument={path:t.path.toArray(),readTime:nr(e.version)};else{if(!e.isUnknownDocument())return U();r.unknownDocument={path:t.path.toArray(),version:nr(e.version)}}return r}function $o(n){const e=n.toTimestamp();return[e.seconds,e.nanoseconds]}function nr(n){const e=n.toTimestamp();return{seconds:e.seconds,nanoseconds:e.nanoseconds}}function rr(n){const e=new de(n.seconds,n.nanoseconds);return $.fromTimestamp(e)}function Bn(n,e){const t=(e.baseMutations||[]).map((s=>Hc(n.ct,s)));for(let s=0;s<e.mutations.length-1;++s){const o=e.mutations[s];if(s+1<e.mutations.length&&e.mutations[s+1].transform!==void 0){const c=e.mutations[s+1];o.updateTransforms=c.transform.fieldTransforms,e.mutations.splice(s+1,1),++s}}const r=e.mutations.map((s=>Hc(n.ct,s))),i=de.fromMillis(e.localWriteTimeMs);return new Lu(e.batchId,i,t,r)}function Wi(n){const e=rr(n.readTime),t=n.lastLimboFreeSnapshotVersion!==void 0?rr(n.lastLimboFreeSnapshotVersion):$.min();let r;return r=(function(s){return s.documents!==void 0})(n.query)?(function(s){return q(s.documents.length===1),Ze(oi(Om(s.documents[0])))})(n.query):(function(s){return Ze(Um(s))})(n.query),new Mt(r,n.targetId,"TargetPurposeListen",n.lastListenSequenceNumber,e,t,ye.fromBase64String(n.resumeToken))}function zm(n,e){const t=nr(e.snapshotVersion),r=nr(e.lastLimboFreeSnapshotVersion);let i;i=Bo(e.target)?Mm(n.ct,e.target):Fm(n.ct,e.target)._t;const s=e.resumeToken.toBase64();return{targetId:e.targetId,canonicalId:Zn(e.target),readTime:t,resumeToken:s,lastListenSequenceNumber:e.sequenceNumber,lastLimboFreeSnapshotVersion:r,query:i}}function qu(n){const e=Um({parent:n.parent,structuredQuery:n.structuredQuery});return n.limitType==="LAST"?jo(e,e.limit,"L"):e}function Ic(n,e){return new Fu(e.largestBatchId,Hc(n.ct,e.overlayMutation))}function $d(n,e){const t=e.path.lastSegment();return[n,Xe(e.path.popLast()),t]}function zd(n,e,t,r){return{indexId:n,uid:e,sequenceNumber:t,readTime:nr(r.readTime),documentKey:Xe(r.documentKey.path),largestBatchId:r.largestBatchId}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _T{getBundleMetadata(e,t){return Gd(e).get(t).next((r=>{if(r)return(function(s){return{id:s.bundleId,createTime:rr(s.createTime),version:s.version}})(r)}))}saveBundleMetadata(e,t){return Gd(e).put((function(i){return{bundleId:i.id,createTime:nr(Ee(i.createTime)),version:i.version}})(t))}getNamedQuery(e,t){return Kd(e).get(t).next((r=>{if(r)return(function(s){return{name:s.name,query:qu(s.bundledQuery),readTime:rr(s.readTime)}})(r)}))}saveNamedQuery(e,t){return Kd(e).put((function(i){return{name:i.name,readTime:nr(Ee(i.readTime)),bundledQuery:i.bundledQuery}})(t))}}function Gd(n){return Ce(n,"bundles")}function Kd(n){return Ce(n,"namedQueries")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class da{constructor(e,t){this.serializer=e,this.userId=t}static lt(e,t){const r=t.uid||"";return new da(e,r)}getOverlay(e,t){return Oi(e).get($d(this.userId,t)).next((r=>r?Ic(this.serializer,r):null))}getOverlays(e,t){const r=Et();return b.forEach(t,(i=>this.getOverlay(e,i).next((s=>{s!==null&&r.set(i,s)})))).next((()=>r))}saveOverlays(e,t,r){const i=[];return r.forEach(((s,o)=>{const c=new Fu(t,o);i.push(this.ht(e,c))})),b.waitFor(i)}removeOverlaysForBatchId(e,t,r){const i=new Set;t.forEach((o=>i.add(Xe(o.getCollectionPath()))));const s=[];return i.forEach((o=>{const c=IDBKeyRange.bound([this.userId,o,r],[this.userId,o,r+1],!1,!0);s.push(Oi(e).j("collectionPathOverlayIndex",c))})),b.waitFor(s)}getOverlaysForCollection(e,t,r){const i=Et(),s=Xe(t),o=IDBKeyRange.bound([this.userId,s,r],[this.userId,s,Number.POSITIVE_INFINITY],!0);return Oi(e).U("collectionPathOverlayIndex",o).next((c=>{for(const u of c){const h=Ic(this.serializer,u);i.set(h.getKey(),h)}return i}))}getOverlaysForCollectionGroup(e,t,r,i){const s=Et();let o;const c=IDBKeyRange.bound([this.userId,t,r],[this.userId,t,Number.POSITIVE_INFINITY],!0);return Oi(e).J({index:"collectionGroupOverlayIndex",range:c},((u,h,f)=>{const p=Ic(this.serializer,h);s.size()<i||p.largestBatchId===o?(s.set(p.getKey(),p),o=p.largestBatchId):f.done()})).next((()=>s))}ht(e,t){return Oi(e).put((function(i,s,o){const[c,u,h]=$d(s,o.mutation.key);return{userId:s,collectionPath:u,documentId:h,collectionGroup:o.mutation.key.getCollectionGroup(),largestBatchId:o.largestBatchId,overlayMutation:_s(i.ct,o.mutation)}})(this.serializer,this.userId,t))}}function Oi(n){return Ce(n,"documentOverlays")}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class yT{Pt(e){return Ce(e,"globals")}getSessionToken(e){return this.Pt(e).get("sessionToken").next((t=>{const r=t==null?void 0:t.value;return r?ye.fromUint8Array(r):ye.EMPTY_BYTE_STRING}))}setSessionToken(e,t){return this.Pt(e).put({name:"sessionToken",value:t.toUint8Array()})}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qn{constructor(){}It(e,t){this.Tt(e,t),t.Et()}Tt(e,t){if("nullValue"in e)this.dt(t,5);else if("booleanValue"in e)this.dt(t,10),t.At(e.booleanValue?1:0);else if("integerValue"in e)this.dt(t,15),t.At(ue(e.integerValue));else if("doubleValue"in e){const r=ue(e.doubleValue);isNaN(r)?this.dt(t,13):(this.dt(t,15),hs(r)?t.At(0):t.At(r))}else if("timestampValue"in e){let r=e.timestampValue;this.dt(t,20),typeof r=="string"&&(r=Gt(r)),t.Rt(`${r.seconds||""}`),t.At(r.nanos||0)}else if("stringValue"in e)this.Vt(e.stringValue,t),this.ft(t);else if("bytesValue"in e)this.dt(t,30),t.gt(yn(e.bytesValue)),this.ft(t);else if("referenceValue"in e)this.yt(e.referenceValue,t);else if("geoPointValue"in e){const r=e.geoPointValue;this.dt(t,45),t.At(r.latitude||0),t.At(r.longitude||0)}else"mapValue"in e?tm(e)?this.dt(t,Number.MAX_SAFE_INTEGER):ua(e)?this.wt(e.mapValue,t):(this.St(e.mapValue,t),this.ft(t)):"arrayValue"in e?(this.bt(e.arrayValue,t),this.ft(t)):U()}Vt(e,t){this.dt(t,25),this.Dt(e,t)}Dt(e,t){t.Rt(e)}St(e,t){const r=e.fields||{};this.dt(t,55);for(const i of Object.keys(r))this.Vt(i,t),this.Tt(r[i],t)}wt(e,t){var r,i;const s=e.fields||{};this.dt(t,53);const o="value",c=((i=(r=s[o].arrayValue)===null||r===void 0?void 0:r.values)===null||i===void 0?void 0:i.length)||0;this.dt(t,15),t.At(ue(c)),this.Vt(o,t),this.Tt(s[o],t)}bt(e,t){const r=e.values||[];this.dt(t,50);for(const i of r)this.Tt(i,t)}yt(e,t){this.dt(t,37),L.fromName(e).path.forEach((r=>{this.dt(t,60),this.Dt(r,t)}))}dt(e,t){e.At(t)}ft(e){e.At(2)}}qn.vt=new qn;function IT(n){if(n===0)return 8;let e=0;return n>>4==0&&(e+=4,n<<=4),n>>6==0&&(e+=2,n<<=2),n>>7==0&&(e+=1),e}function Wd(n){const e=64-(function(r){let i=0;for(let s=0;s<8;++s){const o=IT(255&r[s]);if(i+=o,o!==8)break}return i})(n);return Math.ceil(e/8)}class vT{constructor(){this.buffer=new Uint8Array(1024),this.position=0}Ct(e){const t=e[Symbol.iterator]();let r=t.next();for(;!r.done;)this.Ft(r.value),r=t.next();this.Mt()}xt(e){const t=e[Symbol.iterator]();let r=t.next();for(;!r.done;)this.Ot(r.value),r=t.next();this.Nt()}Lt(e){for(const t of e){const r=t.charCodeAt(0);if(r<128)this.Ft(r);else if(r<2048)this.Ft(960|r>>>6),this.Ft(128|63&r);else if(t<"\uD800"||"\uDBFF"<t)this.Ft(480|r>>>12),this.Ft(128|63&r>>>6),this.Ft(128|63&r);else{const i=t.codePointAt(0);this.Ft(240|i>>>18),this.Ft(128|63&i>>>12),this.Ft(128|63&i>>>6),this.Ft(128|63&i)}}this.Mt()}Bt(e){for(const t of e){const r=t.charCodeAt(0);if(r<128)this.Ot(r);else if(r<2048)this.Ot(960|r>>>6),this.Ot(128|63&r);else if(t<"\uD800"||"\uDBFF"<t)this.Ot(480|r>>>12),this.Ot(128|63&r>>>6),this.Ot(128|63&r);else{const i=t.codePointAt(0);this.Ot(240|i>>>18),this.Ot(128|63&i>>>12),this.Ot(128|63&i>>>6),this.Ot(128|63&i)}}this.Nt()}kt(e){const t=this.qt(e),r=Wd(t);this.Qt(1+r),this.buffer[this.position++]=255&r;for(let i=t.length-r;i<t.length;++i)this.buffer[this.position++]=255&t[i]}Kt(e){const t=this.qt(e),r=Wd(t);this.Qt(1+r),this.buffer[this.position++]=~(255&r);for(let i=t.length-r;i<t.length;++i)this.buffer[this.position++]=~(255&t[i])}$t(){this.Ut(255),this.Ut(255)}Wt(){this.Gt(255),this.Gt(255)}reset(){this.position=0}seed(e){this.Qt(e.length),this.buffer.set(e,this.position),this.position+=e.length}zt(){return this.buffer.slice(0,this.position)}qt(e){const t=(function(s){const o=new DataView(new ArrayBuffer(8));return o.setFloat64(0,s,!1),new Uint8Array(o.buffer)})(e),r=(128&t[0])!=0;t[0]^=r?255:128;for(let i=1;i<t.length;++i)t[i]^=r?255:0;return t}Ft(e){const t=255&e;t===0?(this.Ut(0),this.Ut(255)):t===255?(this.Ut(255),this.Ut(0)):this.Ut(t)}Ot(e){const t=255&e;t===0?(this.Gt(0),this.Gt(255)):t===255?(this.Gt(255),this.Gt(0)):this.Gt(e)}Mt(){this.Ut(0),this.Ut(1)}Nt(){this.Gt(0),this.Gt(1)}Ut(e){this.Qt(1),this.buffer[this.position++]=e}Gt(e){this.Qt(1),this.buffer[this.position++]=~e}Qt(e){const t=e+this.position;if(t<=this.buffer.length)return;let r=2*this.buffer.length;r<t&&(r=t);const i=new Uint8Array(r);i.set(this.buffer),this.buffer=i}}class wT{constructor(e){this.jt=e}gt(e){this.jt.Ct(e)}Rt(e){this.jt.Lt(e)}At(e){this.jt.kt(e)}Et(){this.jt.$t()}}class TT{constructor(e){this.jt=e}gt(e){this.jt.xt(e)}Rt(e){this.jt.Bt(e)}At(e){this.jt.Kt(e)}Et(){this.jt.Wt()}}class xi{constructor(){this.jt=new vT,this.Ht=new wT(this.jt),this.Jt=new TT(this.jt)}seed(e){this.jt.seed(e)}Yt(e){return e===0?this.Ht:this.Jt}zt(){return this.jt.zt()}reset(){this.jt.reset()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jn{constructor(e,t,r,i){this.indexId=e,this.documentKey=t,this.arrayValue=r,this.directionalValue=i}Zt(){const e=this.directionalValue.length,t=e===0||this.directionalValue[e-1]===255?e+1:e,r=new Uint8Array(t);return r.set(this.directionalValue,0),t!==e?r.set([0],this.directionalValue.length):++r[r.length-1],new jn(this.indexId,this.documentKey,this.arrayValue,r)}}function on(n,e){let t=n.indexId-e.indexId;return t!==0?t:(t=Hd(n.arrayValue,e.arrayValue),t!==0?t:(t=Hd(n.directionalValue,e.directionalValue),t!==0?t:L.comparator(n.documentKey,e.documentKey)))}function Hd(n,e){for(let t=0;t<n.length&&t<e.length;++t){const r=n[t]-e[t];if(r!==0)return r}return n.length-e.length}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qd{constructor(e){this.Xt=new re(((t,r)=>le.comparator(t.field,r.field))),this.collectionId=e.collectionGroup!=null?e.collectionGroup:e.path.lastSegment(),this.en=e.orderBy,this.tn=[];for(const t of e.filters){const r=t;r.isInequality()?this.Xt=this.Xt.add(r):this.tn.push(r)}}get nn(){return this.Xt.size>1}rn(e){if(q(e.collectionGroup===this.collectionId),this.nn)return!1;const t=Mc(e);if(t!==void 0&&!this.sn(t))return!1;const r=Fn(e);let i=new Set,s=0,o=0;for(;s<r.length&&this.sn(r[s]);++s)i=i.add(r[s].fieldPath.canonicalString());if(s===r.length)return!0;if(this.Xt.size>0){const c=this.Xt.getIterator().getNext();if(!i.has(c.field.canonicalString())){const u=r[s];if(!this.on(c,u)||!this._n(this.en[o++],u))return!1}++s}for(;s<r.length;++s){const c=r[s];if(o>=this.en.length||!this._n(this.en[o++],c))return!1}return!0}an(){if(this.nn)return null;let e=new re(le.comparator);const t=[];for(const r of this.tn)if(!r.field.isKeyField())if(r.op==="array-contains"||r.op==="array-contains-any")t.push(new bo(r.field,2));else{if(e.has(r.field))continue;e=e.add(r.field),t.push(new bo(r.field,0))}for(const r of this.en)r.field.isKeyField()||e.has(r.field)||(e=e.add(r.field),t.push(new bo(r.field,r.dir==="asc"?0:1)));return new Uo(Uo.UNKNOWN_ID,this.collectionId,t,ls.empty())}sn(e){for(const t of this.tn)if(this.on(t,e))return!0;return!1}on(e,t){if(e===void 0||!e.field.isEqual(t.fieldPath))return!1;const r=e.op==="array-contains"||e.op==="array-contains-any";return t.kind===2===r}_n(e,t){return!!e.field.isEqual(t.fieldPath)&&(t.kind===0&&e.dir==="asc"||t.kind===1&&e.dir==="desc")}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Gm(n){var e,t;if(q(n instanceof X||n instanceof ne),n instanceof X){if(n instanceof lm){const i=((t=(e=n.value.arrayValue)===null||e===void 0?void 0:e.values)===null||t===void 0?void 0:t.map((s=>X.create(n.field,"==",s))))||[];return ne.create(i,"or")}return n}const r=n.filters.map((i=>Gm(i)));return ne.create(r,n.op)}function ET(n){if(n.getFilters().length===0)return[];const e=Yc(Gm(n));return q(Km(e)),Qc(e)||Jc(e)?[e]:e.getFilters()}function Qc(n){return n instanceof X}function Jc(n){return n instanceof ne&&Du(n)}function Km(n){return Qc(n)||Jc(n)||(function(t){if(t instanceof ne&&qc(t)){for(const r of t.getFilters())if(!Qc(r)&&!Jc(r))return!1;return!0}return!1})(n)}function Yc(n){if(q(n instanceof X||n instanceof ne),n instanceof X)return n;if(n.filters.length===1)return Yc(n.filters[0]);const e=n.filters.map((r=>Yc(r)));let t=ne.create(e,n.op);return t=zo(t),Km(t)?t:(q(t instanceof ne),q(Gr(t)),q(t.filters.length>1),t.filters.reduce(((r,i)=>ju(r,i))))}function ju(n,e){let t;return q(n instanceof X||n instanceof ne),q(e instanceof X||e instanceof ne),t=n instanceof X?e instanceof X?(function(i,s){return ne.create([i,s],"and")})(n,e):Jd(n,e):e instanceof X?Jd(e,n):(function(i,s){if(q(i.filters.length>0&&s.filters.length>0),Gr(i)&&Gr(s))return am(i,s.getFilters());const o=qc(i)?i:s,c=qc(i)?s:i,u=o.filters.map((h=>ju(h,c)));return ne.create(u,"or")})(n,e),zo(t)}function Jd(n,e){if(Gr(e))return am(e,n.getFilters());{const t=e.filters.map((r=>ju(n,r)));return ne.create(t,"or")}}function zo(n){if(q(n instanceof X||n instanceof ne),n instanceof X)return n;const e=n.getFilters();if(e.length===1)return zo(e[0]);if(sm(n))return n;const t=e.map((i=>zo(i))),r=[];return t.forEach((i=>{i instanceof X?r.push(i):i instanceof ne&&(i.op===n.op?r.push(...i.filters):r.push(i))})),r.length===1?r[0]:ne.create(r,n.op)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class AT{constructor(){this.un=new $u}addToCollectionParentIndex(e,t){return this.un.add(t),b.resolve()}getCollectionParents(e,t){return b.resolve(this.un.getEntries(t))}addFieldIndex(e,t){return b.resolve()}deleteFieldIndex(e,t){return b.resolve()}deleteAllFieldIndexes(e){return b.resolve()}createTargetIndexes(e,t){return b.resolve()}getDocumentsMatchingTarget(e,t){return b.resolve(null)}getIndexType(e,t){return b.resolve(0)}getFieldIndexes(e,t){return b.resolve([])}getNextCollectionGroupToUpdate(e){return b.resolve(null)}getMinOffset(e,t){return b.resolve(lt.min())}getMinOffsetFromCollectionGroup(e,t){return b.resolve(lt.min())}updateCollectionGroup(e,t,r){return b.resolve()}updateIndexEntries(e,t){return b.resolve()}}class $u{constructor(){this.index={}}add(e){const t=e.lastSegment(),r=e.popLast(),i=this.index[t]||new re(Y.comparator),s=!i.has(r);return this.index[t]=i.add(r),s}has(e){const t=e.lastSegment(),r=e.popLast(),i=this.index[t];return i&&i.has(r)}getEntries(e){return(this.index[e]||new re(Y.comparator)).toArray()}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const go=new Uint8Array(0);class bT{constructor(e,t){this.databaseId=t,this.cn=new $u,this.ln=new Sn((r=>Zn(r)),((r,i)=>Cs(r,i))),this.uid=e.uid||""}addToCollectionParentIndex(e,t){if(!this.cn.has(t)){const r=t.lastSegment(),i=t.popLast();e.addOnCommittedListener((()=>{this.cn.add(t)}));const s={collectionId:r,parent:Xe(i)};return Yd(e).put(s)}return b.resolve()}getCollectionParents(e,t){const r=[],i=IDBKeyRange.bound([t,""],[jp(t),""],!1,!0);return Yd(e).U(i).next((s=>{for(const o of s){if(o.collectionId!==t)break;r.push(Tt(o.parent))}return r}))}addFieldIndex(e,t){const r=Li(e),i=(function(c){return{indexId:c.indexId,collectionGroup:c.collectionGroup,fields:c.fields.map((u=>[u.fieldPath.canonicalString(),u.kind]))}})(t);delete i.indexId;const s=r.add(i);if(t.indexState){const o=Er(e);return s.next((c=>{o.put(zd(c,this.uid,t.indexState.sequenceNumber,t.indexState.offset))}))}return s.next()}deleteFieldIndex(e,t){const r=Li(e),i=Er(e),s=Tr(e);return r.delete(t.indexId).next((()=>i.delete(IDBKeyRange.bound([t.indexId],[t.indexId+1],!1,!0)))).next((()=>s.delete(IDBKeyRange.bound([t.indexId],[t.indexId+1],!1,!0))))}deleteAllFieldIndexes(e){const t=Li(e),r=Tr(e),i=Er(e);return t.j().next((()=>r.j())).next((()=>i.j()))}createTargetIndexes(e,t){return b.forEach(this.hn(t),(r=>this.getIndexType(e,r).next((i=>{if(i===0||i===1){const s=new Qd(r).an();if(s!=null)return this.addFieldIndex(e,s)}}))))}getDocumentsMatchingTarget(e,t){const r=Tr(e);let i=!0;const s=new Map;return b.forEach(this.hn(t),(o=>this.Pn(e,o).next((c=>{i&&(i=!!c),s.set(o,c)})))).next((()=>{if(i){let o=H();const c=[];return b.forEach(s,((u,h)=>{V("IndexedDbIndexManager",`Using index ${(function(F){return`id=${F.indexId}|cg=${F.collectionGroup}|f=${F.fields.map((G=>`${G.fieldPath}:${G.kind}`)).join(",")}`})(u)} to execute ${Zn(t)}`);const f=(function(F,G){const J=Mc(G);if(J===void 0)return null;for(const K of qo(F,J.fieldPath))switch(K.op){case"array-contains-any":return K.value.arrayValue.values||[];case"array-contains":return[K.value]}return null})(h,u),p=(function(F,G){const J=new Map;for(const K of Fn(G))for(const v of qo(F,K.fieldPath))switch(v.op){case"==":case"in":J.set(K.fieldPath.canonicalString(),v.value);break;case"not-in":case"!=":return J.set(K.fieldPath.canonicalString(),v.value),Array.from(J.values())}return null})(h,u),g=(function(F,G){const J=[];let K=!0;for(const v of Fn(G)){const _=v.kind===0?Cd(F,v.fieldPath,F.startAt):kd(F,v.fieldPath,F.startAt);J.push(_.value),K&&(K=_.inclusive)}return new wn(J,K)})(h,u),T=(function(F,G){const J=[];let K=!0;for(const v of Fn(G)){const _=v.kind===0?kd(F,v.fieldPath,F.endAt):Cd(F,v.fieldPath,F.endAt);J.push(_.value),K&&(K=_.inclusive)}return new wn(J,K)})(h,u),C=this.In(u,h,g),D=this.In(u,h,T),k=this.Tn(u,h,p),j=this.En(u.indexId,f,C,g.inclusive,D,T.inclusive,k);return b.forEach(j,(z=>r.G(z,t.limit).next((F=>{F.forEach((G=>{const J=L.fromSegments(G.documentKey);o.has(J)||(o=o.add(J),c.push(J))}))}))))})).next((()=>c))}return b.resolve(null)}))}hn(e){let t=this.ln.get(e);return t||(e.filters.length===0?t=[e]:t=ET(ne.create(e.filters,"and")).map((r=>$c(e.path,e.collectionGroup,e.orderBy,r.getFilters(),e.limit,e.startAt,e.endAt))),this.ln.set(e,t),t)}En(e,t,r,i,s,o,c){const u=(t!=null?t.length:1)*Math.max(r.length,s.length),h=u/(t!=null?t.length:1),f=[];for(let p=0;p<u;++p){const g=t?this.dn(t[p/h]):go,T=this.An(e,g,r[p%h],i),C=this.Rn(e,g,s[p%h],o),D=c.map((k=>this.An(e,g,k,!0)));f.push(...this.createRange(T,C,D))}return f}An(e,t,r,i){const s=new jn(e,L.empty(),t,r);return i?s:s.Zt()}Rn(e,t,r,i){const s=new jn(e,L.empty(),t,r);return i?s.Zt():s}Pn(e,t){const r=new Qd(t),i=t.collectionGroup!=null?t.collectionGroup:t.path.lastSegment();return this.getFieldIndexes(e,i).next((s=>{let o=null;for(const c of s)r.rn(c)&&(!o||c.fields.length>o.fields.length)&&(o=c);return o}))}getIndexType(e,t){let r=2;const i=this.hn(t);return b.forEach(i,(s=>this.Pn(e,s).next((o=>{o?r!==0&&o.fields.length<(function(u){let h=new re(le.comparator),f=!1;for(const p of u.filters)for(const g of p.getFlattenedFilters())g.field.isKeyField()||(g.op==="array-contains"||g.op==="array-contains-any"?f=!0:h=h.add(g.field));for(const p of u.orderBy)p.field.isKeyField()||(h=h.add(p.field));return h.size+(f?1:0)})(s)&&(r=1):r=0})))).next((()=>(function(o){return o.limit!==null})(t)&&i.length>1&&r===2?1:r))}Vn(e,t){const r=new xi;for(const i of Fn(e)){const s=t.data.field(i.fieldPath);if(s==null)return null;const o=r.Yt(i.kind);qn.vt.It(s,o)}return r.zt()}dn(e){const t=new xi;return qn.vt.It(e,t.Yt(0)),t.zt()}mn(e,t){const r=new xi;return qn.vt.It(Xn(this.databaseId,t),r.Yt((function(s){const o=Fn(s);return o.length===0?0:o[o.length-1].kind})(e))),r.zt()}Tn(e,t,r){if(r===null)return[];let i=[];i.push(new xi);let s=0;for(const o of Fn(e)){const c=r[s++];for(const u of i)if(this.fn(t,o.fieldPath)&&ps(c))i=this.gn(i,o,c);else{const h=u.Yt(o.kind);qn.vt.It(c,h)}}return this.pn(i)}In(e,t,r){return this.Tn(e,t,r.position)}pn(e){const t=[];for(let r=0;r<e.length;++r)t[r]=e[r].zt();return t}gn(e,t,r){const i=[...e],s=[];for(const o of r.arrayValue.values||[])for(const c of i){const u=new xi;u.seed(c.zt()),qn.vt.It(o,u.Yt(t.kind)),s.push(u)}return s}fn(e,t){return!!e.filters.find((r=>r instanceof X&&r.field.isEqual(t)&&(r.op==="in"||r.op==="not-in")))}getFieldIndexes(e,t){const r=Li(e),i=Er(e);return(t?r.U("collectionGroupIndex",IDBKeyRange.bound(t,t)):r.U()).next((s=>{const o=[];return b.forEach(s,(c=>i.get([c.indexId,this.uid]).next((u=>{o.push((function(f,p){const g=p?new ls(p.sequenceNumber,new lt(rr(p.readTime),new L(Tt(p.documentKey)),p.largestBatchId)):ls.empty(),T=f.fields.map((([C,D])=>new bo(le.fromServerFormat(C),D)));return new Uo(f.indexId,f.collectionGroup,T,g)})(c,u))})))).next((()=>o))}))}getNextCollectionGroupToUpdate(e){return this.getFieldIndexes(e).next((t=>t.length===0?null:(t.sort(((r,i)=>{const s=r.indexState.sequenceNumber-i.indexState.sequenceNumber;return s!==0?s:W(r.collectionGroup,i.collectionGroup)})),t[0].collectionGroup)))}updateCollectionGroup(e,t,r){const i=Li(e),s=Er(e);return this.yn(e).next((o=>i.U("collectionGroupIndex",IDBKeyRange.bound(t,t)).next((c=>b.forEach(c,(u=>s.put(zd(u.indexId,this.uid,o,r))))))))}updateIndexEntries(e,t){const r=new Map;return b.forEach(t,((i,s)=>{const o=r.get(i.collectionGroup);return(o?b.resolve(o):this.getFieldIndexes(e,i.collectionGroup)).next((c=>(r.set(i.collectionGroup,c),b.forEach(c,(u=>this.wn(e,i,u).next((h=>{const f=this.Sn(s,u);return h.isEqual(f)?b.resolve():this.bn(e,s,u,h,f)})))))))}))}Dn(e,t,r,i){return Tr(e).put({indexId:i.indexId,uid:this.uid,arrayValue:i.arrayValue,directionalValue:i.directionalValue,orderedDocumentKey:this.mn(r,t.key),documentKey:t.key.path.toArray()})}vn(e,t,r,i){return Tr(e).delete([i.indexId,this.uid,i.arrayValue,i.directionalValue,this.mn(r,t.key),t.key.path.toArray()])}wn(e,t,r){const i=Tr(e);let s=new re(on);return i.J({index:"documentKeyIndex",range:IDBKeyRange.only([r.indexId,this.uid,this.mn(r,t)])},((o,c)=>{s=s.add(new jn(r.indexId,t,c.arrayValue,c.directionalValue))})).next((()=>s))}Sn(e,t){let r=new re(on);const i=this.Vn(t,e);if(i==null)return r;const s=Mc(t);if(s!=null){const o=e.data.field(s.fieldPath);if(ps(o))for(const c of o.arrayValue.values||[])r=r.add(new jn(t.indexId,e.key,this.dn(c),i))}else r=r.add(new jn(t.indexId,e.key,go,i));return r}bn(e,t,r,i,s){V("IndexedDbIndexManager","Updating index entries for document '%s'",t.key);const o=[];return(function(u,h,f,p,g){const T=u.getIterator(),C=h.getIterator();let D=wr(T),k=wr(C);for(;D||k;){let j=!1,z=!1;if(D&&k){const F=f(D,k);F<0?z=!0:F>0&&(j=!0)}else D!=null?z=!0:j=!0;j?(p(k),k=wr(C)):z?(g(D),D=wr(T)):(D=wr(T),k=wr(C))}})(i,s,on,(c=>{o.push(this.Dn(e,t,r,c))}),(c=>{o.push(this.vn(e,t,r,c))})),b.waitFor(o)}yn(e){let t=1;return Er(e).J({index:"sequenceNumberIndex",reverse:!0,range:IDBKeyRange.upperBound([this.uid,Number.MAX_SAFE_INTEGER])},((r,i,s)=>{s.done(),t=i.sequenceNumber+1})).next((()=>t))}createRange(e,t,r){r=r.sort(((o,c)=>on(o,c))).filter(((o,c,u)=>!c||on(o,u[c-1])!==0));const i=[];i.push(e);for(const o of r){const c=on(o,e),u=on(o,t);if(c===0)i[0]=e.Zt();else if(c>0&&u<0)i.push(o),i.push(o.Zt());else if(u>0)break}i.push(t);const s=[];for(let o=0;o<i.length;o+=2){if(this.Cn(i[o],i[o+1]))return[];const c=[i[o].indexId,this.uid,i[o].arrayValue,i[o].directionalValue,go,[]],u=[i[o+1].indexId,this.uid,i[o+1].arrayValue,i[o+1].directionalValue,go,[]];s.push(IDBKeyRange.bound(c,u))}return s}Cn(e,t){return on(e,t)>0}getMinOffsetFromCollectionGroup(e,t){return this.getFieldIndexes(e,t).next(Xd)}getMinOffset(e,t){return b.mapArray(this.hn(t),(r=>this.Pn(e,r).next((i=>i||U())))).next(Xd)}}function Yd(n){return Ce(n,"collectionParents")}function Tr(n){return Ce(n,"indexEntries")}function Li(n){return Ce(n,"indexConfiguration")}function Er(n){return Ce(n,"indexState")}function Xd(n){q(n.length!==0);let e=n[0].indexState.offset,t=e.largestBatchId;for(let r=1;r<n.length;r++){const i=n[r].indexState.offset;Pu(i,e)<0&&(e=i),t<i.largestBatchId&&(t=i.largestBatchId)}return new lt(e.readTime,e.documentKey,t)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Zd={didRun:!1,sequenceNumbersCollected:0,targetsRemoved:0,documentsRemoved:0};class tt{constructor(e,t,r){this.cacheSizeCollectionThreshold=e,this.percentileToCollect=t,this.maximumSequenceNumbersToCollect=r}static withCacheSize(e){return new tt(e,tt.DEFAULT_COLLECTION_PERCENTILE,tt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Wm(n,e,t){const r=n.store("mutations"),i=n.store("documentMutations"),s=[],o=IDBKeyRange.only(t.batchId);let c=0;const u=r.J({range:o},((f,p,g)=>(c++,g.delete())));s.push(u.next((()=>{q(c===1)})));const h=[];for(const f of t.mutations){const p=Qp(e,f.key.path,t.batchId);s.push(i.delete(p)),h.push(f.key)}return b.waitFor(s).next((()=>h))}function Go(n){if(!n)return 0;let e;if(n.document)e=n.document;else if(n.unknownDocument)e=n.unknownDocument;else{if(!n.noDocument)throw U();e=n.noDocument}return JSON.stringify(e).length}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */tt.DEFAULT_COLLECTION_PERCENTILE=10,tt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT=1e3,tt.DEFAULT=new tt(41943040,tt.DEFAULT_COLLECTION_PERCENTILE,tt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT),tt.DISABLED=new tt(-1,0,0);class fa{constructor(e,t,r,i){this.userId=e,this.serializer=t,this.indexManager=r,this.referenceDelegate=i,this.Fn={}}static lt(e,t,r,i){q(e.uid!=="");const s=e.isAuthenticated()?e.uid:"";return new fa(s,t,r,i)}checkEmpty(e){let t=!0;const r=IDBKeyRange.bound([this.userId,Number.NEGATIVE_INFINITY],[this.userId,Number.POSITIVE_INFINITY]);return an(e).J({index:"userMutationsIndex",range:r},((i,s,o)=>{t=!1,o.done()})).next((()=>t))}addMutationBatch(e,t,r,i){const s=Dr(e),o=an(e);return o.add({}).next((c=>{q(typeof c=="number");const u=new Lu(c,t,r,i),h=(function(T,C,D){const k=D.baseMutations.map((z=>_s(T.ct,z))),j=D.mutations.map((z=>_s(T.ct,z)));return{userId:C,batchId:D.batchId,localWriteTimeMs:D.localWriteTime.toMillis(),baseMutations:k,mutations:j}})(this.serializer,this.userId,u),f=[];let p=new re(((g,T)=>W(g.canonicalString(),T.canonicalString())));for(const g of i){const T=Qp(this.userId,g.key.path,c);p=p.add(g.key.path.popLast()),f.push(o.put(h)),f.push(s.put(T,hw))}return p.forEach((g=>{f.push(this.indexManager.addToCollectionParentIndex(e,g))})),e.addOnCommittedListener((()=>{this.Fn[c]=u.keys()})),b.waitFor(f).next((()=>u))}))}lookupMutationBatch(e,t){return an(e).get(t).next((r=>r?(q(r.userId===this.userId),Bn(this.serializer,r)):null))}Mn(e,t){return this.Fn[t]?b.resolve(this.Fn[t]):this.lookupMutationBatch(e,t).next((r=>{if(r){const i=r.keys();return this.Fn[t]=i,i}return null}))}getNextMutationBatchAfterBatchId(e,t){const r=t+1,i=IDBKeyRange.lowerBound([this.userId,r]);let s=null;return an(e).J({index:"userMutationsIndex",range:i},((o,c,u)=>{c.userId===this.userId&&(q(c.batchId>=r),s=Bn(this.serializer,c)),u.done()})).next((()=>s))}getHighestUnacknowledgedBatchId(e){const t=IDBKeyRange.upperBound([this.userId,Number.POSITIVE_INFINITY]);let r=-1;return an(e).J({index:"userMutationsIndex",range:t,reverse:!0},((i,s,o)=>{r=s.batchId,o.done()})).next((()=>r))}getAllMutationBatches(e){const t=IDBKeyRange.bound([this.userId,-1],[this.userId,Number.POSITIVE_INFINITY]);return an(e).U("userMutationsIndex",t).next((r=>r.map((i=>Bn(this.serializer,i)))))}getAllMutationBatchesAffectingDocumentKey(e,t){const r=Ro(this.userId,t.path),i=IDBKeyRange.lowerBound(r),s=[];return Dr(e).J({range:i},((o,c,u)=>{const[h,f,p]=o,g=Tt(f);if(h===this.userId&&t.path.isEqual(g))return an(e).get(p).next((T=>{if(!T)throw U();q(T.userId===this.userId),s.push(Bn(this.serializer,T))}));u.done()})).next((()=>s))}getAllMutationBatchesAffectingDocumentKeys(e,t){let r=new re(W);const i=[];return t.forEach((s=>{const o=Ro(this.userId,s.path),c=IDBKeyRange.lowerBound(o),u=Dr(e).J({range:c},((h,f,p)=>{const[g,T,C]=h,D=Tt(T);g===this.userId&&s.path.isEqual(D)?r=r.add(C):p.done()}));i.push(u)})),b.waitFor(i).next((()=>this.xn(e,r)))}getAllMutationBatchesAffectingQuery(e,t){const r=t.path,i=r.length+1,s=Ro(this.userId,r),o=IDBKeyRange.lowerBound(s);let c=new re(W);return Dr(e).J({range:o},((u,h,f)=>{const[p,g,T]=u,C=Tt(g);p===this.userId&&r.isPrefixOf(C)?C.length===i&&(c=c.add(T)):f.done()})).next((()=>this.xn(e,c)))}xn(e,t){const r=[],i=[];return t.forEach((s=>{i.push(an(e).get(s).next((o=>{if(o===null)throw U();q(o.userId===this.userId),r.push(Bn(this.serializer,o))})))})),b.waitFor(i).next((()=>r))}removeMutationBatch(e,t){return Wm(e._e,this.userId,t).next((r=>(e.addOnCommittedListener((()=>{this.On(t.batchId)})),b.forEach(r,(i=>this.referenceDelegate.markPotentiallyOrphaned(e,i))))))}On(e){delete this.Fn[e]}performConsistencyCheck(e){return this.checkEmpty(e).next((t=>{if(!t)return b.resolve();const r=IDBKeyRange.lowerBound((function(o){return[o]})(this.userId)),i=[];return Dr(e).J({range:r},((s,o,c)=>{if(s[0]===this.userId){const u=Tt(s[1]);i.push(u)}else c.done()})).next((()=>{q(i.length===0)}))}))}containsKey(e,t){return Hm(e,this.userId,t)}Nn(e){return Qm(e).get(this.userId).next((t=>t||{userId:this.userId,lastAcknowledgedBatchId:-1,lastStreamToken:""}))}}function Hm(n,e,t){const r=Ro(e,t.path),i=r[1],s=IDBKeyRange.lowerBound(r);let o=!1;return Dr(n).J({range:s,H:!0},((c,u,h)=>{const[f,p,g]=c;f===e&&p===i&&(o=!0),h.done()})).next((()=>o))}function an(n){return Ce(n,"mutations")}function Dr(n){return Ce(n,"documentMutations")}function Qm(n){return Ce(n,"mutationQueues")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ir{constructor(e){this.Ln=e}next(){return this.Ln+=2,this.Ln}static Bn(){return new ir(0)}static kn(){return new ir(-1)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class RT{constructor(e,t){this.referenceDelegate=e,this.serializer=t}allocateTargetId(e){return this.qn(e).next((t=>{const r=new ir(t.highestTargetId);return t.highestTargetId=r.next(),this.Qn(e,t).next((()=>t.highestTargetId))}))}getLastRemoteSnapshotVersion(e){return this.qn(e).next((t=>$.fromTimestamp(new de(t.lastRemoteSnapshotVersion.seconds,t.lastRemoteSnapshotVersion.nanoseconds))))}getHighestSequenceNumber(e){return this.qn(e).next((t=>t.highestListenSequenceNumber))}setTargetsMetadata(e,t,r){return this.qn(e).next((i=>(i.highestListenSequenceNumber=t,r&&(i.lastRemoteSnapshotVersion=r.toTimestamp()),t>i.highestListenSequenceNumber&&(i.highestListenSequenceNumber=t),this.Qn(e,i))))}addTargetData(e,t){return this.Kn(e,t).next((()=>this.qn(e).next((r=>(r.targetCount+=1,this.$n(t,r),this.Qn(e,r))))))}updateTargetData(e,t){return this.Kn(e,t)}removeTargetData(e,t){return this.removeMatchingKeysForTargetId(e,t.targetId).next((()=>Ar(e).delete(t.targetId))).next((()=>this.qn(e))).next((r=>(q(r.targetCount>0),r.targetCount-=1,this.Qn(e,r))))}removeTargets(e,t,r){let i=0;const s=[];return Ar(e).J(((o,c)=>{const u=Wi(c);u.sequenceNumber<=t&&r.get(u.targetId)===null&&(i++,s.push(this.removeTargetData(e,u)))})).next((()=>b.waitFor(s))).next((()=>i))}forEachTarget(e,t){return Ar(e).J(((r,i)=>{const s=Wi(i);t(s)}))}qn(e){return ef(e).get("targetGlobalKey").next((t=>(q(t!==null),t)))}Qn(e,t){return ef(e).put("targetGlobalKey",t)}Kn(e,t){return Ar(e).put(zm(this.serializer,t))}$n(e,t){let r=!1;return e.targetId>t.highestTargetId&&(t.highestTargetId=e.targetId,r=!0),e.sequenceNumber>t.highestListenSequenceNumber&&(t.highestListenSequenceNumber=e.sequenceNumber,r=!0),r}getTargetCount(e){return this.qn(e).next((t=>t.targetCount))}getTargetData(e,t){const r=Zn(t),i=IDBKeyRange.bound([r,Number.NEGATIVE_INFINITY],[r,Number.POSITIVE_INFINITY]);let s=null;return Ar(e).J({range:i,index:"queryTargetsIndex"},((o,c,u)=>{const h=Wi(c);Cs(t,h.target)&&(s=h,u.done())})).next((()=>s))}addMatchingKeys(e,t,r){const i=[],s=ln(e);return t.forEach((o=>{const c=Xe(o.path);i.push(s.put({targetId:r,path:c})),i.push(this.referenceDelegate.addReference(e,r,o))})),b.waitFor(i)}removeMatchingKeys(e,t,r){const i=ln(e);return b.forEach(t,(s=>{const o=Xe(s.path);return b.waitFor([i.delete([r,o]),this.referenceDelegate.removeReference(e,r,s)])}))}removeMatchingKeysForTargetId(e,t){const r=ln(e),i=IDBKeyRange.bound([t],[t+1],!1,!0);return r.delete(i)}getMatchingKeysForTargetId(e,t){const r=IDBKeyRange.bound([t],[t+1],!1,!0),i=ln(e);let s=H();return i.J({range:r,H:!0},((o,c,u)=>{const h=Tt(o[1]),f=new L(h);s=s.add(f)})).next((()=>s))}containsKey(e,t){const r=Xe(t.path),i=IDBKeyRange.bound([r],[jp(r)],!1,!0);let s=0;return ln(e).J({index:"documentTargetsIndex",H:!0,range:i},(([o,c],u,h)=>{o!==0&&(s++,h.done())})).next((()=>s>0))}ot(e,t){return Ar(e).get(t).next((r=>r?Wi(r):null))}}function Ar(n){return Ce(n,"targets")}function ef(n){return Ce(n,"targetGlobal")}function ln(n){return Ce(n,"targetDocuments")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function tf([n,e],[t,r]){const i=W(n,t);return i===0?W(e,r):i}class PT{constructor(e){this.Un=e,this.buffer=new re(tf),this.Wn=0}Gn(){return++this.Wn}zn(e){const t=[e,this.Gn()];if(this.buffer.size<this.Un)this.buffer=this.buffer.add(t);else{const r=this.buffer.last();tf(t,r)<0&&(this.buffer=this.buffer.delete(r).add(t))}}get maxValue(){return this.buffer.last()[0]}}class ST{constructor(e,t,r){this.garbageCollector=e,this.asyncQueue=t,this.localStore=r,this.jn=null}start(){this.garbageCollector.params.cacheSizeCollectionThreshold!==-1&&this.Hn(6e4)}stop(){this.jn&&(this.jn.cancel(),this.jn=null)}get started(){return this.jn!==null}Hn(e){V("LruGarbageCollector",`Garbage collection scheduled in ${e}ms`),this.jn=this.asyncQueue.enqueueAfterDelay("lru_garbage_collection",e,(async()=>{this.jn=null;try{await this.localStore.collectGarbage(this.garbageCollector)}catch(t){Pn(t)?V("LruGarbageCollector","Ignoring IndexedDB error during garbage collection: ",t):await Rn(t)}await this.Hn(3e5)}))}}class CT{constructor(e,t){this.Jn=e,this.params=t}calculateTargetCount(e,t){return this.Jn.Yn(e).next((r=>Math.floor(t/100*r)))}nthSequenceNumber(e,t){if(t===0)return b.resolve(rt.oe);const r=new PT(t);return this.Jn.forEachTarget(e,(i=>r.zn(i.sequenceNumber))).next((()=>this.Jn.Zn(e,(i=>r.zn(i))))).next((()=>r.maxValue))}removeTargets(e,t,r){return this.Jn.removeTargets(e,t,r)}removeOrphanedDocuments(e,t){return this.Jn.removeOrphanedDocuments(e,t)}collect(e,t){return this.params.cacheSizeCollectionThreshold===-1?(V("LruGarbageCollector","Garbage collection skipped; disabled"),b.resolve(Zd)):this.getCacheSize(e).next((r=>r<this.params.cacheSizeCollectionThreshold?(V("LruGarbageCollector",`Garbage collection skipped; Cache size ${r} is lower than threshold ${this.params.cacheSizeCollectionThreshold}`),Zd):this.Xn(e,t)))}getCacheSize(e){return this.Jn.getCacheSize(e)}Xn(e,t){let r,i,s,o,c,u,h;const f=Date.now();return this.calculateTargetCount(e,this.params.percentileToCollect).next((p=>(p>this.params.maximumSequenceNumbersToCollect?(V("LruGarbageCollector",`Capping sequence numbers to collect down to the maximum of ${this.params.maximumSequenceNumbersToCollect} from ${p}`),i=this.params.maximumSequenceNumbersToCollect):i=p,o=Date.now(),this.nthSequenceNumber(e,i)))).next((p=>(r=p,c=Date.now(),this.removeTargets(e,r,t)))).next((p=>(s=p,u=Date.now(),this.removeOrphanedDocuments(e,r)))).next((p=>(h=Date.now(),Pr()<=Q.DEBUG&&V("LruGarbageCollector",`LRU Garbage Collection
	Counted targets in ${o-f}ms
	Determined least recently used ${i} in `+(c-o)+`ms
	Removed ${s} targets in `+(u-c)+`ms
	Removed ${p} documents in `+(h-u)+`ms
Total Duration: ${h-f}ms`),b.resolve({didRun:!0,sequenceNumbersCollected:i,targetsRemoved:s,documentsRemoved:p}))))}}function kT(n,e){return new CT(n,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class DT{constructor(e,t){this.db=e,this.garbageCollector=kT(this,t)}Yn(e){const t=this.er(e);return this.db.getTargetCache().getTargetCount(e).next((r=>t.next((i=>r+i))))}er(e){let t=0;return this.Zn(e,(r=>{t++})).next((()=>t))}forEachTarget(e,t){return this.db.getTargetCache().forEachTarget(e,t)}Zn(e,t){return this.tr(e,((r,i)=>t(i)))}addReference(e,t,r){return _o(e,r)}removeReference(e,t,r){return _o(e,r)}removeTargets(e,t,r){return this.db.getTargetCache().removeTargets(e,t,r)}markPotentiallyOrphaned(e,t){return _o(e,t)}nr(e,t){return(function(i,s){let o=!1;return Qm(i).Y((c=>Hm(i,c,s).next((u=>(u&&(o=!0),b.resolve(!u)))))).next((()=>o))})(e,t)}removeOrphanedDocuments(e,t){const r=this.db.getRemoteDocumentCache().newChangeBuffer(),i=[];let s=0;return this.tr(e,((o,c)=>{if(c<=t){const u=this.nr(e,o).next((h=>{if(!h)return s++,r.getEntry(e,o).next((()=>(r.removeEntry(o,$.min()),ln(e).delete((function(p){return[0,Xe(p.path)]})(o)))))}));i.push(u)}})).next((()=>b.waitFor(i))).next((()=>r.apply(e))).next((()=>s))}removeTarget(e,t){const r=t.withSequenceNumber(e.currentSequenceNumber);return this.db.getTargetCache().updateTargetData(e,r)}updateLimboDocument(e,t){return _o(e,t)}tr(e,t){const r=ln(e);let i,s=rt.oe;return r.J({index:"documentTargetsIndex"},(([o,c],{path:u,sequenceNumber:h})=>{o===0?(s!==rt.oe&&t(new L(Tt(i)),s),s=h,i=u):s=rt.oe})).next((()=>{s!==rt.oe&&t(new L(Tt(i)),s)}))}getCacheSize(e){return this.db.getRemoteDocumentCache().getSize(e)}}function _o(n,e){return ln(n).put((function(r,i){return{targetId:0,path:Xe(r.path),sequenceNumber:i}})(e,n.currentSequenceNumber))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jm{constructor(){this.changes=new Sn((e=>e.toString()),((e,t)=>e.isEqual(t))),this.changesApplied=!1}addEntry(e){this.assertNotApplied(),this.changes.set(e.key,e)}removeEntry(e,t){this.assertNotApplied(),this.changes.set(e,ae.newInvalidDocument(e).setReadTime(t))}getEntry(e,t){this.assertNotApplied();const r=this.changes.get(t);return r!==void 0?b.resolve(r):this.getFromCache(e,t)}getEntries(e,t){return this.getAllFromCache(e,t)}apply(e){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(e)}assertNotApplied(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class NT{constructor(e){this.serializer=e}setIndexManager(e){this.indexManager=e}addEntry(e,t,r){return Ln(e).put(r)}removeEntry(e,t,r){return Ln(e).delete((function(s,o){const c=s.path.toArray();return[c.slice(0,c.length-2),c[c.length-2],$o(o),c[c.length-1]]})(t,r))}updateMetadata(e,t){return this.getMetadata(e).next((r=>(r.byteSize+=t,this.rr(e,r))))}getEntry(e,t){let r=ae.newInvalidDocument(t);return Ln(e).J({index:"documentKeyIndex",range:IDBKeyRange.only(Mi(t))},((i,s)=>{r=this.ir(t,s)})).next((()=>r))}sr(e,t){let r={size:0,document:ae.newInvalidDocument(t)};return Ln(e).J({index:"documentKeyIndex",range:IDBKeyRange.only(Mi(t))},((i,s)=>{r={document:this.ir(t,s),size:Go(s)}})).next((()=>r))}getEntries(e,t){let r=st();return this._r(e,t,((i,s)=>{const o=this.ir(i,s);r=r.insert(i,o)})).next((()=>r))}ar(e,t){let r=st(),i=new se(L.comparator);return this._r(e,t,((s,o)=>{const c=this.ir(s,o);r=r.insert(s,c),i=i.insert(s,Go(o))})).next((()=>({documents:r,ur:i})))}_r(e,t,r){if(t.isEmpty())return b.resolve();let i=new re(sf);t.forEach((u=>i=i.add(u)));const s=IDBKeyRange.bound(Mi(i.first()),Mi(i.last())),o=i.getIterator();let c=o.getNext();return Ln(e).J({index:"documentKeyIndex",range:s},((u,h,f)=>{const p=L.fromSegments([...h.prefixPath,h.collectionGroup,h.documentId]);for(;c&&sf(c,p)<0;)r(c,null),c=o.getNext();c&&c.isEqual(p)&&(r(c,h),c=o.hasNext()?o.getNext():null),c?f.$(Mi(c)):f.done()})).next((()=>{for(;c;)r(c,null),c=o.hasNext()?o.getNext():null}))}getDocumentsMatchingQuery(e,t,r,i,s){const o=t.path,c=[o.popLast().toArray(),o.lastSegment(),$o(r.readTime),r.documentKey.path.isEmpty()?"":r.documentKey.path.lastSegment()],u=[o.popLast().toArray(),o.lastSegment(),[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER],""];return Ln(e).U(IDBKeyRange.bound(c,u,!0)).next((h=>{s==null||s.incrementDocumentReadCount(h.length);let f=st();for(const p of h){const g=this.ir(L.fromSegments(p.prefixPath.concat(p.collectionGroup,p.documentId)),p);g.isFoundDocument()&&(Ds(t,g)||i.has(g.key))&&(f=f.insert(g.key,g))}return f}))}getAllFromCollectionGroup(e,t,r,i){let s=st();const o=rf(t,r),c=rf(t,lt.max());return Ln(e).J({index:"collectionGroupIndex",range:IDBKeyRange.bound(o,c,!0)},((u,h,f)=>{const p=this.ir(L.fromSegments(h.prefixPath.concat(h.collectionGroup,h.documentId)),h);s=s.insert(p.key,p),s.size===i&&f.done()})).next((()=>s))}newChangeBuffer(e){return new VT(this,!!e&&e.trackRemovals)}getSize(e){return this.getMetadata(e).next((t=>t.byteSize))}getMetadata(e){return nf(e).get("remoteDocumentGlobalKey").next((t=>(q(!!t),t)))}rr(e,t){return nf(e).put("remoteDocumentGlobalKey",t)}ir(e,t){if(t){const r=gT(this.serializer,t);if(!(r.isNoDocument()&&r.version.isEqual($.min())))return r}return ae.newInvalidDocument(e)}}function Ym(n){return new NT(n)}class VT extends Jm{constructor(e,t){super(),this.cr=e,this.trackRemovals=t,this.lr=new Sn((r=>r.toString()),((r,i)=>r.isEqual(i)))}applyChanges(e){const t=[];let r=0,i=new re(((s,o)=>W(s.canonicalString(),o.canonicalString())));return this.changes.forEach(((s,o)=>{const c=this.lr.get(s);if(t.push(this.cr.removeEntry(e,s,c.readTime)),o.isValidDocument()){const u=jd(this.cr.serializer,o);i=i.add(s.path.popLast());const h=Go(u);r+=h-c.size,t.push(this.cr.addEntry(e,s,u))}else if(r-=c.size,this.trackRemovals){const u=jd(this.cr.serializer,o.convertToNoDocument($.min()));t.push(this.cr.addEntry(e,s,u))}})),i.forEach((s=>{t.push(this.cr.indexManager.addToCollectionParentIndex(e,s))})),t.push(this.cr.updateMetadata(e,r)),b.waitFor(t)}getFromCache(e,t){return this.cr.sr(e,t).next((r=>(this.lr.set(t,{size:r.size,readTime:r.document.readTime}),r.document)))}getAllFromCache(e,t){return this.cr.ar(e,t).next((({documents:r,ur:i})=>(i.forEach(((s,o)=>{this.lr.set(s,{size:o,readTime:r.get(s).readTime})})),r)))}}function nf(n){return Ce(n,"remoteDocumentGlobal")}function Ln(n){return Ce(n,"remoteDocumentsV14")}function Mi(n){const e=n.path.toArray();return[e.slice(0,e.length-2),e[e.length-2],e[e.length-1]]}function rf(n,e){const t=e.documentKey.path.toArray();return[n,$o(e.readTime),t.slice(0,t.length-2),t.length>0?t[t.length-1]:""]}function sf(n,e){const t=n.path.toArray(),r=e.path.toArray();let i=0;for(let s=0;s<t.length-2&&s<r.length-2;++s)if(i=W(t[s],r[s]),i)return i;return i=W(t.length,r.length),i||(i=W(t[t.length-2],r[r.length-2]),i||W(t[t.length-1],r[r.length-1]))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class OT{constructor(e,t){this.overlayedDocument=e,this.mutatedFields=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xm{constructor(e,t,r,i){this.remoteDocumentCache=e,this.mutationQueue=t,this.documentOverlayCache=r,this.indexManager=i}getDocument(e,t){let r=null;return this.documentOverlayCache.getOverlay(e,t).next((i=>(r=i,this.remoteDocumentCache.getEntry(e,t)))).next((i=>(r!==null&&Xi(r.mutation,i,it.empty(),de.now()),i)))}getDocuments(e,t){return this.remoteDocumentCache.getEntries(e,t).next((r=>this.getLocalViewOfDocuments(e,r,H()).next((()=>r))))}getLocalViewOfDocuments(e,t,r=H()){const i=Et();return this.populateOverlays(e,i,t).next((()=>this.computeViews(e,t,i,r).next((s=>{let o=Gi();return s.forEach(((c,u)=>{o=o.insert(c,u.overlayedDocument)})),o}))))}getOverlayedDocuments(e,t){const r=Et();return this.populateOverlays(e,r,t).next((()=>this.computeViews(e,t,r,H())))}populateOverlays(e,t,r){const i=[];return r.forEach((s=>{t.has(s)||i.push(s)})),this.documentOverlayCache.getOverlays(e,i).next((s=>{s.forEach(((o,c)=>{t.set(o,c)}))}))}computeViews(e,t,r,i){let s=st();const o=Yi(),c=(function(){return Yi()})();return t.forEach(((u,h)=>{const f=r.get(h.key);i.has(h.key)&&(f===void 0||f.mutation instanceof Jt)?s=s.insert(h.key,h):f!==void 0?(o.set(h.key,f.mutation.getFieldMask()),Xi(f.mutation,h,f.mutation.getFieldMask(),de.now())):o.set(h.key,it.empty())})),this.recalculateAndSaveOverlays(e,s).next((u=>(u.forEach(((h,f)=>o.set(h,f))),t.forEach(((h,f)=>{var p;return c.set(h,new OT(f,(p=o.get(h))!==null&&p!==void 0?p:null))})),c)))}recalculateAndSaveOverlays(e,t){const r=Yi();let i=new se(((o,c)=>o-c)),s=H();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(e,t).next((o=>{for(const c of o)c.keys().forEach((u=>{const h=t.get(u);if(h===null)return;let f=r.get(u)||it.empty();f=c.applyToLocalView(h,f),r.set(u,f);const p=(i.get(c.batchId)||H()).add(u);i=i.insert(c.batchId,p)}))})).next((()=>{const o=[],c=i.getReverseIterator();for(;c.hasNext();){const u=c.getNext(),h=u.key,f=u.value,p=_m();f.forEach((g=>{if(!s.has(g)){const T=Am(t.get(g),r.get(g));T!==null&&p.set(g,T),s=s.add(g)}})),o.push(this.documentOverlayCache.saveOverlays(e,h,p))}return b.waitFor(o)})).next((()=>r))}recalculateAndSaveOverlaysForDocumentKeys(e,t){return this.remoteDocumentCache.getEntries(e,t).next((r=>this.recalculateAndSaveOverlays(e,r)))}getDocumentsMatchingQuery(e,t,r,i){return(function(o){return L.isDocumentKey(o.path)&&o.collectionGroup===null&&o.filters.length===0})(t)?this.getDocumentsMatchingDocumentQuery(e,t.path):Nu(t)?this.getDocumentsMatchingCollectionGroupQuery(e,t,r,i):this.getDocumentsMatchingCollectionQuery(e,t,r,i)}getNextDocuments(e,t,r,i){return this.remoteDocumentCache.getAllFromCollectionGroup(e,t,r,i).next((s=>{const o=i-s.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(e,t,r.largestBatchId,i-s.size):b.resolve(Et());let c=-1,u=s;return o.next((h=>b.forEach(h,((f,p)=>(c<p.largestBatchId&&(c=p.largestBatchId),s.get(f)?b.resolve():this.remoteDocumentCache.getEntry(e,f).next((g=>{u=u.insert(f,g)}))))).next((()=>this.populateOverlays(e,h,s))).next((()=>this.computeViews(e,u,h,H()))).next((f=>({batchId:c,changes:gm(f)})))))}))}getDocumentsMatchingDocumentQuery(e,t){return this.getDocument(e,new L(t)).next((r=>{let i=Gi();return r.isFoundDocument()&&(i=i.insert(r.key,r)),i}))}getDocumentsMatchingCollectionGroupQuery(e,t,r,i){const s=t.collectionGroup;let o=Gi();return this.indexManager.getCollectionParents(e,s).next((c=>b.forEach(c,(u=>{const h=(function(p,g){return new Qt(g,null,p.explicitOrderBy.slice(),p.filters.slice(),p.limit,p.limitType,p.startAt,p.endAt)})(t,u.child(s));return this.getDocumentsMatchingCollectionQuery(e,h,r,i).next((f=>{f.forEach(((p,g)=>{o=o.insert(p,g)}))}))})).next((()=>o))))}getDocumentsMatchingCollectionQuery(e,t,r,i){let s;return this.documentOverlayCache.getOverlaysForCollection(e,t.path,r.largestBatchId).next((o=>(s=o,this.remoteDocumentCache.getDocumentsMatchingQuery(e,t,r,s,i)))).next((o=>{s.forEach(((u,h)=>{const f=h.getKey();o.get(f)===null&&(o=o.insert(f,ae.newInvalidDocument(f)))}));let c=Gi();return o.forEach(((u,h)=>{const f=s.get(u);f!==void 0&&Xi(f.mutation,h,it.empty(),de.now()),Ds(t,h)&&(c=c.insert(u,h))})),c}))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xT{constructor(e){this.serializer=e,this.hr=new Map,this.Pr=new Map}getBundleMetadata(e,t){return b.resolve(this.hr.get(t))}saveBundleMetadata(e,t){return this.hr.set(t.id,(function(i){return{id:i.id,version:i.version,createTime:Ee(i.createTime)}})(t)),b.resolve()}getNamedQuery(e,t){return b.resolve(this.Pr.get(t))}saveNamedQuery(e,t){return this.Pr.set(t.name,(function(i){return{name:i.name,query:qu(i.bundledQuery),readTime:Ee(i.readTime)}})(t)),b.resolve()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class LT{constructor(){this.overlays=new se(L.comparator),this.Ir=new Map}getOverlay(e,t){return b.resolve(this.overlays.get(t))}getOverlays(e,t){const r=Et();return b.forEach(t,(i=>this.getOverlay(e,i).next((s=>{s!==null&&r.set(i,s)})))).next((()=>r))}saveOverlays(e,t,r){return r.forEach(((i,s)=>{this.ht(e,t,s)})),b.resolve()}removeOverlaysForBatchId(e,t,r){const i=this.Ir.get(r);return i!==void 0&&(i.forEach((s=>this.overlays=this.overlays.remove(s))),this.Ir.delete(r)),b.resolve()}getOverlaysForCollection(e,t,r){const i=Et(),s=t.length+1,o=new L(t.child("")),c=this.overlays.getIteratorFrom(o);for(;c.hasNext();){const u=c.getNext().value,h=u.getKey();if(!t.isPrefixOf(h.path))break;h.path.length===s&&u.largestBatchId>r&&i.set(u.getKey(),u)}return b.resolve(i)}getOverlaysForCollectionGroup(e,t,r,i){let s=new se(((h,f)=>h-f));const o=this.overlays.getIterator();for(;o.hasNext();){const h=o.getNext().value;if(h.getKey().getCollectionGroup()===t&&h.largestBatchId>r){let f=s.get(h.largestBatchId);f===null&&(f=Et(),s=s.insert(h.largestBatchId,f)),f.set(h.getKey(),h)}}const c=Et(),u=s.getIterator();for(;u.hasNext()&&(u.getNext().value.forEach(((h,f)=>c.set(h,f))),!(c.size()>=i)););return b.resolve(c)}ht(e,t,r){const i=this.overlays.get(r.key);if(i!==null){const o=this.Ir.get(i.largestBatchId).delete(r.key);this.Ir.set(i.largestBatchId,o)}this.overlays=this.overlays.insert(r.key,new Fu(t,r));let s=this.Ir.get(t);s===void 0&&(s=H(),this.Ir.set(t,s)),this.Ir.set(t,s.add(r.key))}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class MT{constructor(){this.sessionToken=ye.EMPTY_BYTE_STRING}getSessionToken(e){return b.resolve(this.sessionToken)}setSessionToken(e,t){return this.sessionToken=t,b.resolve()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zu{constructor(){this.Tr=new re(ke.Er),this.dr=new re(ke.Ar)}isEmpty(){return this.Tr.isEmpty()}addReference(e,t){const r=new ke(e,t);this.Tr=this.Tr.add(r),this.dr=this.dr.add(r)}Rr(e,t){e.forEach((r=>this.addReference(r,t)))}removeReference(e,t){this.Vr(new ke(e,t))}mr(e,t){e.forEach((r=>this.removeReference(r,t)))}gr(e){const t=new L(new Y([])),r=new ke(t,e),i=new ke(t,e+1),s=[];return this.dr.forEachInRange([r,i],(o=>{this.Vr(o),s.push(o.key)})),s}pr(){this.Tr.forEach((e=>this.Vr(e)))}Vr(e){this.Tr=this.Tr.delete(e),this.dr=this.dr.delete(e)}yr(e){const t=new L(new Y([])),r=new ke(t,e),i=new ke(t,e+1);let s=H();return this.dr.forEachInRange([r,i],(o=>{s=s.add(o.key)})),s}containsKey(e){const t=new ke(e,0),r=this.Tr.firstAfterOrEqual(t);return r!==null&&e.isEqual(r.key)}}class ke{constructor(e,t){this.key=e,this.wr=t}static Er(e,t){return L.comparator(e.key,t.key)||W(e.wr,t.wr)}static Ar(e,t){return W(e.wr,t.wr)||L.comparator(e.key,t.key)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class FT{constructor(e,t){this.indexManager=e,this.referenceDelegate=t,this.mutationQueue=[],this.Sr=1,this.br=new re(ke.Er)}checkEmpty(e){return b.resolve(this.mutationQueue.length===0)}addMutationBatch(e,t,r,i){const s=this.Sr;this.Sr++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];const o=new Lu(s,t,r,i);this.mutationQueue.push(o);for(const c of i)this.br=this.br.add(new ke(c.key,s)),this.indexManager.addToCollectionParentIndex(e,c.key.path.popLast());return b.resolve(o)}lookupMutationBatch(e,t){return b.resolve(this.Dr(t))}getNextMutationBatchAfterBatchId(e,t){const r=t+1,i=this.vr(r),s=i<0?0:i;return b.resolve(this.mutationQueue.length>s?this.mutationQueue[s]:null)}getHighestUnacknowledgedBatchId(){return b.resolve(this.mutationQueue.length===0?-1:this.Sr-1)}getAllMutationBatches(e){return b.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(e,t){const r=new ke(t,0),i=new ke(t,Number.POSITIVE_INFINITY),s=[];return this.br.forEachInRange([r,i],(o=>{const c=this.Dr(o.wr);s.push(c)})),b.resolve(s)}getAllMutationBatchesAffectingDocumentKeys(e,t){let r=new re(W);return t.forEach((i=>{const s=new ke(i,0),o=new ke(i,Number.POSITIVE_INFINITY);this.br.forEachInRange([s,o],(c=>{r=r.add(c.wr)}))})),b.resolve(this.Cr(r))}getAllMutationBatchesAffectingQuery(e,t){const r=t.path,i=r.length+1;let s=r;L.isDocumentKey(s)||(s=s.child(""));const o=new ke(new L(s),0);let c=new re(W);return this.br.forEachWhile((u=>{const h=u.key.path;return!!r.isPrefixOf(h)&&(h.length===i&&(c=c.add(u.wr)),!0)}),o),b.resolve(this.Cr(c))}Cr(e){const t=[];return e.forEach((r=>{const i=this.Dr(r);i!==null&&t.push(i)})),t}removeMutationBatch(e,t){q(this.Fr(t.batchId,"removed")===0),this.mutationQueue.shift();let r=this.br;return b.forEach(t.mutations,(i=>{const s=new ke(i.key,t.batchId);return r=r.delete(s),this.referenceDelegate.markPotentiallyOrphaned(e,i.key)})).next((()=>{this.br=r}))}On(e){}containsKey(e,t){const r=new ke(t,0),i=this.br.firstAfterOrEqual(r);return b.resolve(t.isEqual(i&&i.key))}performConsistencyCheck(e){return this.mutationQueue.length,b.resolve()}Fr(e,t){return this.vr(e)}vr(e){return this.mutationQueue.length===0?0:e-this.mutationQueue[0].batchId}Dr(e){const t=this.vr(e);return t<0||t>=this.mutationQueue.length?null:this.mutationQueue[t]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class UT{constructor(e){this.Mr=e,this.docs=(function(){return new se(L.comparator)})(),this.size=0}setIndexManager(e){this.indexManager=e}addEntry(e,t){const r=t.key,i=this.docs.get(r),s=i?i.size:0,o=this.Mr(t);return this.docs=this.docs.insert(r,{document:t.mutableCopy(),size:o}),this.size+=o-s,this.indexManager.addToCollectionParentIndex(e,r.path.popLast())}removeEntry(e){const t=this.docs.get(e);t&&(this.docs=this.docs.remove(e),this.size-=t.size)}getEntry(e,t){const r=this.docs.get(t);return b.resolve(r?r.document.mutableCopy():ae.newInvalidDocument(t))}getEntries(e,t){let r=st();return t.forEach((i=>{const s=this.docs.get(i);r=r.insert(i,s?s.document.mutableCopy():ae.newInvalidDocument(i))})),b.resolve(r)}getDocumentsMatchingQuery(e,t,r,i){let s=st();const o=t.path,c=new L(o.child("")),u=this.docs.getIteratorFrom(c);for(;u.hasNext();){const{key:h,value:{document:f}}=u.getNext();if(!o.isPrefixOf(h.path))break;h.path.length>o.length+1||Pu(zp(f),r)<=0||(i.has(f.key)||Ds(t,f))&&(s=s.insert(f.key,f.mutableCopy()))}return b.resolve(s)}getAllFromCollectionGroup(e,t,r,i){U()}Or(e,t){return b.forEach(this.docs,(r=>t(r)))}newChangeBuffer(e){return new BT(this)}getSize(e){return b.resolve(this.size)}}class BT extends Jm{constructor(e){super(),this.cr=e}applyChanges(e){const t=[];return this.changes.forEach(((r,i)=>{i.isValidDocument()?t.push(this.cr.addEntry(e,i)):this.cr.removeEntry(r)})),b.waitFor(t)}getFromCache(e,t){return this.cr.getEntry(e,t)}getAllFromCache(e,t){return this.cr.getEntries(e,t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qT{constructor(e){this.persistence=e,this.Nr=new Sn((t=>Zn(t)),Cs),this.lastRemoteSnapshotVersion=$.min(),this.highestTargetId=0,this.Lr=0,this.Br=new zu,this.targetCount=0,this.kr=ir.Bn()}forEachTarget(e,t){return this.Nr.forEach(((r,i)=>t(i))),b.resolve()}getLastRemoteSnapshotVersion(e){return b.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(e){return b.resolve(this.Lr)}allocateTargetId(e){return this.highestTargetId=this.kr.next(),b.resolve(this.highestTargetId)}setTargetsMetadata(e,t,r){return r&&(this.lastRemoteSnapshotVersion=r),t>this.Lr&&(this.Lr=t),b.resolve()}Kn(e){this.Nr.set(e.target,e);const t=e.targetId;t>this.highestTargetId&&(this.kr=new ir(t),this.highestTargetId=t),e.sequenceNumber>this.Lr&&(this.Lr=e.sequenceNumber)}addTargetData(e,t){return this.Kn(t),this.targetCount+=1,b.resolve()}updateTargetData(e,t){return this.Kn(t),b.resolve()}removeTargetData(e,t){return this.Nr.delete(t.target),this.Br.gr(t.targetId),this.targetCount-=1,b.resolve()}removeTargets(e,t,r){let i=0;const s=[];return this.Nr.forEach(((o,c)=>{c.sequenceNumber<=t&&r.get(c.targetId)===null&&(this.Nr.delete(o),s.push(this.removeMatchingKeysForTargetId(e,c.targetId)),i++)})),b.waitFor(s).next((()=>i))}getTargetCount(e){return b.resolve(this.targetCount)}getTargetData(e,t){const r=this.Nr.get(t)||null;return b.resolve(r)}addMatchingKeys(e,t,r){return this.Br.Rr(t,r),b.resolve()}removeMatchingKeys(e,t,r){this.Br.mr(t,r);const i=this.persistence.referenceDelegate,s=[];return i&&t.forEach((o=>{s.push(i.markPotentiallyOrphaned(e,o))})),b.waitFor(s)}removeMatchingKeysForTargetId(e,t){return this.Br.gr(t),b.resolve()}getMatchingKeysForTargetId(e,t){const r=this.Br.yr(t);return b.resolve(r)}containsKey(e,t){return b.resolve(this.Br.containsKey(t))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zm{constructor(e,t){this.qr={},this.overlays={},this.Qr=new rt(0),this.Kr=!1,this.Kr=!0,this.$r=new MT,this.referenceDelegate=e(this),this.Ur=new qT(this),this.indexManager=new AT,this.remoteDocumentCache=(function(i){return new UT(i)})((r=>this.referenceDelegate.Wr(r))),this.serializer=new $m(t),this.Gr=new xT(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.Kr=!1,Promise.resolve()}get started(){return this.Kr}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(e){return this.indexManager}getDocumentOverlayCache(e){let t=this.overlays[e.toKey()];return t||(t=new LT,this.overlays[e.toKey()]=t),t}getMutationQueue(e,t){let r=this.qr[e.toKey()];return r||(r=new FT(t,this.referenceDelegate),this.qr[e.toKey()]=r),r}getGlobalsCache(){return this.$r}getTargetCache(){return this.Ur}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.Gr}runTransaction(e,t,r){V("MemoryPersistence","Starting transaction:",e);const i=new jT(this.Qr.next());return this.referenceDelegate.zr(),r(i).next((s=>this.referenceDelegate.jr(i).next((()=>s)))).toPromise().then((s=>(i.raiseOnCommittedEvent(),s)))}Hr(e,t){return b.or(Object.values(this.qr).map((r=>()=>r.containsKey(e,t))))}}class jT extends Kp{constructor(e){super(),this.currentSequenceNumber=e}}class pa{constructor(e){this.persistence=e,this.Jr=new zu,this.Yr=null}static Zr(e){return new pa(e)}get Xr(){if(this.Yr)return this.Yr;throw U()}addReference(e,t,r){return this.Jr.addReference(r,t),this.Xr.delete(r.toString()),b.resolve()}removeReference(e,t,r){return this.Jr.removeReference(r,t),this.Xr.add(r.toString()),b.resolve()}markPotentiallyOrphaned(e,t){return this.Xr.add(t.toString()),b.resolve()}removeTarget(e,t){this.Jr.gr(t.targetId).forEach((i=>this.Xr.add(i.toString())));const r=this.persistence.getTargetCache();return r.getMatchingKeysForTargetId(e,t.targetId).next((i=>{i.forEach((s=>this.Xr.add(s.toString())))})).next((()=>r.removeTargetData(e,t)))}zr(){this.Yr=new Set}jr(e){const t=this.persistence.getRemoteDocumentCache().newChangeBuffer();return b.forEach(this.Xr,(r=>{const i=L.fromPath(r);return this.ei(e,i).next((s=>{s||t.removeEntry(i,$.min())}))})).next((()=>(this.Yr=null,t.apply(e))))}updateLimboDocument(e,t){return this.ei(e,t).next((r=>{r?this.Xr.delete(t.toString()):this.Xr.add(t.toString())}))}Wr(e){return 0}ei(e,t){return b.or([()=>b.resolve(this.Jr.containsKey(t)),()=>this.persistence.getTargetCache().containsKey(e,t),()=>this.persistence.Hr(e,t)])}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $T{constructor(e){this.serializer=e}O(e,t,r,i){const s=new aa("createOrUpgrade",t);r<1&&i>=1&&((function(u){u.createObjectStore("owner")})(e),(function(u){u.createObjectStore("mutationQueues",{keyPath:"userId"}),u.createObjectStore("mutations",{keyPath:"batchId",autoIncrement:!0}).createIndex("userMutationsIndex",yd,{unique:!0}),u.createObjectStore("documentMutations")})(e),of(e),(function(u){u.createObjectStore("remoteDocuments")})(e));let o=b.resolve();return r<3&&i>=3&&(r!==0&&((function(u){u.deleteObjectStore("targetDocuments"),u.deleteObjectStore("targets"),u.deleteObjectStore("targetGlobal")})(e),of(e)),o=o.next((()=>(function(u){const h=u.store("targetGlobal"),f={highestTargetId:0,highestListenSequenceNumber:0,lastRemoteSnapshotVersion:$.min().toTimestamp(),targetCount:0};return h.put("targetGlobalKey",f)})(s)))),r<4&&i>=4&&(r!==0&&(o=o.next((()=>(function(u,h){return h.store("mutations").U().next((f=>{u.deleteObjectStore("mutations"),u.createObjectStore("mutations",{keyPath:"batchId",autoIncrement:!0}).createIndex("userMutationsIndex",yd,{unique:!0});const p=h.store("mutations"),g=f.map((T=>p.put(T)));return b.waitFor(g)}))})(e,s)))),o=o.next((()=>{(function(u){u.createObjectStore("clientMetadata",{keyPath:"clientId"})})(e)}))),r<5&&i>=5&&(o=o.next((()=>this.ni(s)))),r<6&&i>=6&&(o=o.next((()=>((function(u){u.createObjectStore("remoteDocumentGlobal")})(e),this.ri(s))))),r<7&&i>=7&&(o=o.next((()=>this.ii(s)))),r<8&&i>=8&&(o=o.next((()=>this.si(e,s)))),r<9&&i>=9&&(o=o.next((()=>{(function(u){u.objectStoreNames.contains("remoteDocumentChanges")&&u.deleteObjectStore("remoteDocumentChanges")})(e)}))),r<10&&i>=10&&(o=o.next((()=>this.oi(s)))),r<11&&i>=11&&(o=o.next((()=>{(function(u){u.createObjectStore("bundles",{keyPath:"bundleId"})})(e),(function(u){u.createObjectStore("namedQueries",{keyPath:"name"})})(e)}))),r<12&&i>=12&&(o=o.next((()=>{(function(u){const h=u.createObjectStore("documentOverlays",{keyPath:Ew});h.createIndex("collectionPathOverlayIndex",Aw,{unique:!1}),h.createIndex("collectionGroupOverlayIndex",bw,{unique:!1})})(e)}))),r<13&&i>=13&&(o=o.next((()=>(function(u){const h=u.createObjectStore("remoteDocumentsV14",{keyPath:dw});h.createIndex("documentKeyIndex",fw),h.createIndex("collectionGroupIndex",pw)})(e))).next((()=>this._i(e,s))).next((()=>e.deleteObjectStore("remoteDocuments")))),r<14&&i>=14&&(o=o.next((()=>this.ai(e,s)))),r<15&&i>=15&&(o=o.next((()=>(function(u){u.createObjectStore("indexConfiguration",{keyPath:"indexId",autoIncrement:!0}).createIndex("collectionGroupIndex","collectionGroup",{unique:!1}),u.createObjectStore("indexState",{keyPath:Iw}).createIndex("sequenceNumberIndex",vw,{unique:!1}),u.createObjectStore("indexEntries",{keyPath:ww}).createIndex("documentKeyIndex",Tw,{unique:!1})})(e)))),r<16&&i>=16&&(o=o.next((()=>{t.objectStore("indexState").clear()})).next((()=>{t.objectStore("indexEntries").clear()}))),r<17&&i>=17&&(o=o.next((()=>{(function(u){u.createObjectStore("globals",{keyPath:"name"})})(e)}))),o}ri(e){let t=0;return e.store("remoteDocuments").J(((r,i)=>{t+=Go(i)})).next((()=>{const r={byteSize:t};return e.store("remoteDocumentGlobal").put("remoteDocumentGlobalKey",r)}))}ni(e){const t=e.store("mutationQueues"),r=e.store("mutations");return t.U().next((i=>b.forEach(i,(s=>{const o=IDBKeyRange.bound([s.userId,-1],[s.userId,s.lastAcknowledgedBatchId]);return r.U("userMutationsIndex",o).next((c=>b.forEach(c,(u=>{q(u.userId===s.userId);const h=Bn(this.serializer,u);return Wm(e,s.userId,h).next((()=>{}))}))))}))))}ii(e){const t=e.store("targetDocuments"),r=e.store("remoteDocuments");return e.store("targetGlobal").get("targetGlobalKey").next((i=>{const s=[];return r.J(((o,c)=>{const u=new Y(o),h=(function(p){return[0,Xe(p)]})(u);s.push(t.get(h).next((f=>f?b.resolve():(p=>t.put({targetId:0,path:Xe(p),sequenceNumber:i.highestListenSequenceNumber}))(u))))})).next((()=>b.waitFor(s)))}))}si(e,t){e.createObjectStore("collectionParents",{keyPath:yw});const r=t.store("collectionParents"),i=new $u,s=o=>{if(i.add(o)){const c=o.lastSegment(),u=o.popLast();return r.put({collectionId:c,parent:Xe(u)})}};return t.store("remoteDocuments").J({H:!0},((o,c)=>{const u=new Y(o);return s(u.popLast())})).next((()=>t.store("documentMutations").J({H:!0},(([o,c,u],h)=>{const f=Tt(c);return s(f.popLast())}))))}oi(e){const t=e.store("targets");return t.J(((r,i)=>{const s=Wi(i),o=zm(this.serializer,s);return t.put(o)}))}_i(e,t){const r=t.store("remoteDocuments"),i=[];return r.J(((s,o)=>{const c=t.store("remoteDocumentsV14"),u=(function(p){return p.document?new L(Y.fromString(p.document.name).popFirst(5)):p.noDocument?L.fromSegments(p.noDocument.path):p.unknownDocument?L.fromSegments(p.unknownDocument.path):U()})(o).path.toArray(),h={prefixPath:u.slice(0,u.length-2),collectionGroup:u[u.length-2],documentId:u[u.length-1],readTime:o.readTime||[0,0],unknownDocument:o.unknownDocument,noDocument:o.noDocument,document:o.document,hasCommittedMutations:!!o.hasCommittedMutations};i.push(c.put(h))})).next((()=>b.waitFor(i)))}ai(e,t){const r=t.store("mutations"),i=Ym(this.serializer),s=new Zm(pa.Zr,this.serializer.ct);return r.U().next((o=>{const c=new Map;return o.forEach((u=>{var h;let f=(h=c.get(u.userId))!==null&&h!==void 0?h:H();Bn(this.serializer,u).keys().forEach((p=>f=f.add(p))),c.set(u.userId,f)})),b.forEach(c,((u,h)=>{const f=new De(h),p=da.lt(this.serializer,f),g=s.getIndexManager(f),T=fa.lt(f,this.serializer,g,s.referenceDelegate);return new Xm(i,T,p,g).recalculateAndSaveOverlaysForDocumentKeys(new Fc(t,rt.oe),u).next()}))}))}}function of(n){n.createObjectStore("targetDocuments",{keyPath:gw}).createIndex("documentTargetsIndex",_w,{unique:!0}),n.createObjectStore("targets",{keyPath:"targetId"}).createIndex("queryTargetsIndex",mw,{unique:!0}),n.createObjectStore("targetGlobal")}const vc="Failed to obtain exclusive access to the persistence layer. To allow shared access, multi-tab synchronization has to be enabled in all tabs. If you are using `experimentalForceOwningTab:true`, make sure that only one tab has persistence enabled at any given time.";class Gu{constructor(e,t,r,i,s,o,c,u,h,f,p=17){if(this.allowTabSynchronization=e,this.persistenceKey=t,this.clientId=r,this.ui=s,this.window=o,this.document=c,this.ci=h,this.li=f,this.hi=p,this.Qr=null,this.Kr=!1,this.isPrimary=!1,this.networkEnabled=!0,this.Pi=null,this.inForeground=!1,this.Ii=null,this.Ti=null,this.Ei=Number.NEGATIVE_INFINITY,this.di=g=>Promise.resolve(),!Gu.D())throw new N(P.UNIMPLEMENTED,"This platform is either missing IndexedDB or is known to have an incomplete implementation. Offline persistence has been disabled.");this.referenceDelegate=new DT(this,i),this.Ai=t+"main",this.serializer=new $m(u),this.Ri=new bt(this.Ai,this.hi,new $T(this.serializer)),this.$r=new yT,this.Ur=new RT(this.referenceDelegate,this.serializer),this.remoteDocumentCache=Ym(this.serializer),this.Gr=new _T,this.window&&this.window.localStorage?this.Vi=this.window.localStorage:(this.Vi=null,f===!1&&Te("IndexedDbPersistence","LocalStorage is unavailable. As a result, persistence may not work reliably. In particular enablePersistence() could fail immediately after refreshing the page."))}start(){return this.mi().then((()=>{if(!this.isPrimary&&!this.allowTabSynchronization)throw new N(P.FAILED_PRECONDITION,vc);return this.fi(),this.gi(),this.pi(),this.runTransaction("getHighestListenSequenceNumber","readonly",(e=>this.Ur.getHighestSequenceNumber(e)))})).then((e=>{this.Qr=new rt(e,this.ci)})).then((()=>{this.Kr=!0})).catch((e=>(this.Ri&&this.Ri.close(),Promise.reject(e))))}yi(e){return this.di=async t=>{if(this.started)return e(t)},e(this.isPrimary)}setDatabaseDeletedListener(e){this.Ri.L((async t=>{t.newVersion===null&&await e()}))}setNetworkEnabled(e){this.networkEnabled!==e&&(this.networkEnabled=e,this.ui.enqueueAndForget((async()=>{this.started&&await this.mi()})))}mi(){return this.runTransaction("updateClientMetadataAndTryBecomePrimary","readwrite",(e=>yo(e).put({clientId:this.clientId,updateTimeMs:Date.now(),networkEnabled:this.networkEnabled,inForeground:this.inForeground}).next((()=>{if(this.isPrimary)return this.wi(e).next((t=>{t||(this.isPrimary=!1,this.ui.enqueueRetryable((()=>this.di(!1))))}))})).next((()=>this.Si(e))).next((t=>this.isPrimary&&!t?this.bi(e).next((()=>!1)):!!t&&this.Di(e).next((()=>!0)))))).catch((e=>{if(Pn(e))return V("IndexedDbPersistence","Failed to extend owner lease: ",e),this.isPrimary;if(!this.allowTabSynchronization)throw e;return V("IndexedDbPersistence","Releasing owner lease after error during lease refresh",e),!1})).then((e=>{this.isPrimary!==e&&this.ui.enqueueRetryable((()=>this.di(e))),this.isPrimary=e}))}wi(e){return Fi(e).get("owner").next((t=>b.resolve(this.vi(t))))}Ci(e){return yo(e).delete(this.clientId)}async Fi(){if(this.isPrimary&&!this.Mi(this.Ei,18e5)){this.Ei=Date.now();const e=await this.runTransaction("maybeGarbageCollectMultiClientState","readwrite-primary",(t=>{const r=Ce(t,"clientMetadata");return r.U().next((i=>{const s=this.xi(i,18e5),o=i.filter((c=>s.indexOf(c)===-1));return b.forEach(o,(c=>r.delete(c.clientId))).next((()=>o))}))})).catch((()=>[]));if(this.Vi)for(const t of e)this.Vi.removeItem(this.Oi(t.clientId))}}pi(){this.Ti=this.ui.enqueueAfterDelay("client_metadata_refresh",4e3,(()=>this.mi().then((()=>this.Fi())).then((()=>this.pi()))))}vi(e){return!!e&&e.ownerId===this.clientId}Si(e){return this.li?b.resolve(!0):Fi(e).get("owner").next((t=>{if(t!==null&&this.Mi(t.leaseTimestampMs,5e3)&&!this.Ni(t.ownerId)){if(this.vi(t)&&this.networkEnabled)return!0;if(!this.vi(t)){if(!t.allowTabSynchronization)throw new N(P.FAILED_PRECONDITION,vc);return!1}}return!(!this.networkEnabled||!this.inForeground)||yo(e).U().next((r=>this.xi(r,5e3).find((i=>{if(this.clientId!==i.clientId){const s=!this.networkEnabled&&i.networkEnabled,o=!this.inForeground&&i.inForeground,c=this.networkEnabled===i.networkEnabled;if(s||o&&c)return!0}return!1}))===void 0))})).next((t=>(this.isPrimary!==t&&V("IndexedDbPersistence",`Client ${t?"is":"is not"} eligible for a primary lease.`),t)))}async shutdown(){this.Kr=!1,this.Li(),this.Ti&&(this.Ti.cancel(),this.Ti=null),this.Bi(),this.ki(),await this.Ri.runTransaction("shutdown","readwrite",["owner","clientMetadata"],(e=>{const t=new Fc(e,rt.oe);return this.bi(t).next((()=>this.Ci(t)))})),this.Ri.close(),this.qi()}xi(e,t){return e.filter((r=>this.Mi(r.updateTimeMs,t)&&!this.Ni(r.clientId)))}Qi(){return this.runTransaction("getActiveClients","readonly",(e=>yo(e).U().next((t=>this.xi(t,18e5).map((r=>r.clientId))))))}get started(){return this.Kr}getGlobalsCache(){return this.$r}getMutationQueue(e,t){return fa.lt(e,this.serializer,t,this.referenceDelegate)}getTargetCache(){return this.Ur}getRemoteDocumentCache(){return this.remoteDocumentCache}getIndexManager(e){return new bT(e,this.serializer.ct.databaseId)}getDocumentOverlayCache(e){return da.lt(this.serializer,e)}getBundleCache(){return this.Gr}runTransaction(e,t,r){V("IndexedDbPersistence","Starting transaction:",e);const i=t==="readonly"?"readonly":"readwrite",s=(function(u){return u===17?Sw:u===16?Pw:u===15?Cu:u===14?Xp:u===13?Yp:u===12?Rw:u===11?Jp:void U()})(this.hi);let o;return this.Ri.runTransaction(e,i,s,(c=>(o=new Fc(c,this.Qr?this.Qr.next():rt.oe),t==="readwrite-primary"?this.wi(o).next((u=>!!u||this.Si(o))).next((u=>{if(!u)throw Te(`Failed to obtain primary lease for action '${e}'.`),this.isPrimary=!1,this.ui.enqueueRetryable((()=>this.di(!1))),new N(P.FAILED_PRECONDITION,Gp);return r(o)})).next((u=>this.Di(o).next((()=>u)))):this.Ki(o).next((()=>r(o)))))).then((c=>(o.raiseOnCommittedEvent(),c)))}Ki(e){return Fi(e).get("owner").next((t=>{if(t!==null&&this.Mi(t.leaseTimestampMs,5e3)&&!this.Ni(t.ownerId)&&!this.vi(t)&&!(this.li||this.allowTabSynchronization&&t.allowTabSynchronization))throw new N(P.FAILED_PRECONDITION,vc)}))}Di(e){const t={ownerId:this.clientId,allowTabSynchronization:this.allowTabSynchronization,leaseTimestampMs:Date.now()};return Fi(e).put("owner",t)}static D(){return bt.D()}bi(e){const t=Fi(e);return t.get("owner").next((r=>this.vi(r)?(V("IndexedDbPersistence","Releasing primary lease."),t.delete("owner")):b.resolve()))}Mi(e,t){const r=Date.now();return!(e<r-t)&&(!(e>r)||(Te(`Detected an update time that is in the future: ${e} > ${r}`),!1))}fi(){this.document!==null&&typeof this.document.addEventListener=="function"&&(this.Ii=()=>{this.ui.enqueueAndForget((()=>(this.inForeground=this.document.visibilityState==="visible",this.mi())))},this.document.addEventListener("visibilitychange",this.Ii),this.inForeground=this.document.visibilityState==="visible")}Bi(){this.Ii&&(this.document.removeEventListener("visibilitychange",this.Ii),this.Ii=null)}gi(){var e;typeof((e=this.window)===null||e===void 0?void 0:e.addEventListener)=="function"&&(this.Pi=()=>{this.Li();const t=/(?:Version|Mobile)\/1[456]/;Ip()&&(navigator.appVersion.match(t)||navigator.userAgent.match(t))&&this.ui.enterRestrictedMode(!0),this.ui.enqueueAndForget((()=>this.shutdown()))},this.window.addEventListener("pagehide",this.Pi))}ki(){this.Pi&&(this.window.removeEventListener("pagehide",this.Pi),this.Pi=null)}Ni(e){var t;try{const r=((t=this.Vi)===null||t===void 0?void 0:t.getItem(this.Oi(e)))!==null;return V("IndexedDbPersistence",`Client '${e}' ${r?"is":"is not"} zombied in LocalStorage`),r}catch(r){return Te("IndexedDbPersistence","Failed to get zombied client id.",r),!1}}Li(){if(this.Vi)try{this.Vi.setItem(this.Oi(this.clientId),String(Date.now()))}catch(e){Te("Failed to set zombie client id.",e)}}qi(){if(this.Vi)try{this.Vi.removeItem(this.Oi(this.clientId))}catch{}}Oi(e){return`firestore_zombie_${this.persistenceKey}_${e}`}}function Fi(n){return Ce(n,"owner")}function yo(n){return Ce(n,"clientMetadata")}function Ku(n,e){let t=n.projectId;return n.isDefaultDatabase||(t+="."+n.database),"firestore/"+e+"/"+t+"/"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Wu{constructor(e,t,r,i){this.targetId=e,this.fromCache=t,this.$i=r,this.Ui=i}static Wi(e,t){let r=H(),i=H();for(const s of t.docChanges)switch(s.type){case 0:r=r.add(s.doc.key);break;case 1:i=i.add(s.doc.key)}return new Wu(e,t.fromCache,r,i)}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zT{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(e){this._documentReadCount+=e}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class eg{constructor(){this.Gi=!1,this.zi=!1,this.ji=100,this.Hi=(function(){return Ip()?8:Wp(pe())>0?6:4})()}initialize(e,t){this.Ji=e,this.indexManager=t,this.Gi=!0}getDocumentsMatchingQuery(e,t,r,i){const s={result:null};return this.Yi(e,t).next((o=>{s.result=o})).next((()=>{if(!s.result)return this.Zi(e,t,i,r).next((o=>{s.result=o}))})).next((()=>{if(s.result)return;const o=new zT;return this.Xi(e,t,o).next((c=>{if(s.result=c,this.zi)return this.es(e,t,o,c.size)}))})).next((()=>s.result))}es(e,t,r,i){return r.documentReadCount<this.ji?(Pr()<=Q.DEBUG&&V("QueryEngine","SDK will not create cache indexes for query:",Sr(t),"since it only creates cache indexes for collection contains","more than or equal to",this.ji,"documents"),b.resolve()):(Pr()<=Q.DEBUG&&V("QueryEngine","Query:",Sr(t),"scans",r.documentReadCount,"local documents and returns",i,"documents as results."),r.documentReadCount>this.Hi*i?(Pr()<=Q.DEBUG&&V("QueryEngine","The SDK decides to create cache indexes for query:",Sr(t),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(e,Ze(t))):b.resolve())}Yi(e,t){if(Dd(t))return b.resolve(null);let r=Ze(t);return this.indexManager.getIndexType(e,r).next((i=>i===0?null:(t.limit!==null&&i===1&&(t=jo(t,null,"F"),r=Ze(t)),this.indexManager.getDocumentsMatchingTarget(e,r).next((s=>{const o=H(...s);return this.Ji.getDocuments(e,o).next((c=>this.indexManager.getMinOffset(e,r).next((u=>{const h=this.ts(t,c);return this.ns(t,h,o,u.readTime)?this.Yi(e,jo(t,null,"F")):this.rs(e,h,t,u)}))))})))))}Zi(e,t,r,i){return Dd(t)||i.isEqual($.min())?b.resolve(null):this.Ji.getDocuments(e,r).next((s=>{const o=this.ts(t,s);return this.ns(t,o,r,i)?b.resolve(null):(Pr()<=Q.DEBUG&&V("QueryEngine","Re-using previous result from %s to execute query: %s",i.toString(),Sr(t)),this.rs(e,o,t,$p(i,-1)).next((c=>c)))}))}ts(e,t){let r=new re(pm(e));return t.forEach(((i,s)=>{Ds(e,s)&&(r=r.add(s))})),r}ns(e,t,r,i){if(e.limit===null)return!1;if(r.size!==t.size)return!0;const s=e.limitType==="F"?t.last():t.first();return!!s&&(s.hasPendingWrites||s.version.compareTo(i)>0)}Xi(e,t,r){return Pr()<=Q.DEBUG&&V("QueryEngine","Using full collection scan to execute query:",Sr(t)),this.Ji.getDocumentsMatchingQuery(e,t,lt.min(),r)}rs(e,t,r,i){return this.Ji.getDocumentsMatchingQuery(e,r,i).next((s=>(t.forEach((o=>{s=s.insert(o.key,o)})),s)))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class GT{constructor(e,t,r,i){this.persistence=e,this.ss=t,this.serializer=i,this.os=new se(W),this._s=new Sn((s=>Zn(s)),Cs),this.us=new Map,this.cs=e.getRemoteDocumentCache(),this.Ur=e.getTargetCache(),this.Gr=e.getBundleCache(),this.ls(r)}ls(e){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(e),this.indexManager=this.persistence.getIndexManager(e),this.mutationQueue=this.persistence.getMutationQueue(e,this.indexManager),this.localDocuments=new Xm(this.cs,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.cs.setIndexManager(this.indexManager),this.ss.initialize(this.localDocuments,this.indexManager)}collectGarbage(e){return this.persistence.runTransaction("Collect garbage","readwrite-primary",(t=>e.collect(t,this.os)))}}function tg(n,e,t,r){return new GT(n,e,t,r)}async function ng(n,e){const t=M(n);return await t.persistence.runTransaction("Handle user change","readonly",(r=>{let i;return t.mutationQueue.getAllMutationBatches(r).next((s=>(i=s,t.ls(e),t.mutationQueue.getAllMutationBatches(r)))).next((s=>{const o=[],c=[];let u=H();for(const h of i){o.push(h.batchId);for(const f of h.mutations)u=u.add(f.key)}for(const h of s){c.push(h.batchId);for(const f of h.mutations)u=u.add(f.key)}return t.localDocuments.getDocuments(r,u).next((h=>({hs:h,removedBatchIds:o,addedBatchIds:c})))}))}))}function KT(n,e){const t=M(n);return t.persistence.runTransaction("Acknowledge batch","readwrite-primary",(r=>{const i=e.batch.keys(),s=t.cs.newChangeBuffer({trackRemovals:!0});return(function(c,u,h,f){const p=h.batch,g=p.keys();let T=b.resolve();return g.forEach((C=>{T=T.next((()=>f.getEntry(u,C))).next((D=>{const k=h.docVersions.get(C);q(k!==null),D.version.compareTo(k)<0&&(p.applyToRemoteDocument(D,h),D.isValidDocument()&&(D.setReadTime(h.commitVersion),f.addEntry(D)))}))})),T.next((()=>c.mutationQueue.removeMutationBatch(u,p)))})(t,r,e,s).next((()=>s.apply(r))).next((()=>t.mutationQueue.performConsistencyCheck(r))).next((()=>t.documentOverlayCache.removeOverlaysForBatchId(r,i,e.batch.batchId))).next((()=>t.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(r,(function(c){let u=H();for(let h=0;h<c.mutationResults.length;++h)c.mutationResults[h].transformResults.length>0&&(u=u.add(c.batch.mutations[h].key));return u})(e)))).next((()=>t.localDocuments.getDocuments(r,i)))}))}function rg(n){const e=M(n);return e.persistence.runTransaction("Get last remote snapshot version","readonly",(t=>e.Ur.getLastRemoteSnapshotVersion(t)))}function WT(n,e){const t=M(n),r=e.snapshotVersion;let i=t.os;return t.persistence.runTransaction("Apply remote event","readwrite-primary",(s=>{const o=t.cs.newChangeBuffer({trackRemovals:!0});i=t.os;const c=[];e.targetChanges.forEach(((f,p)=>{const g=i.get(p);if(!g)return;c.push(t.Ur.removeMatchingKeys(s,f.removedDocuments,p).next((()=>t.Ur.addMatchingKeys(s,f.addedDocuments,p))));let T=g.withSequenceNumber(s.currentSequenceNumber);e.targetMismatches.get(p)!==null?T=T.withResumeToken(ye.EMPTY_BYTE_STRING,$.min()).withLastLimboFreeSnapshotVersion($.min()):f.resumeToken.approximateByteSize()>0&&(T=T.withResumeToken(f.resumeToken,r)),i=i.insert(p,T),(function(D,k,j){return D.resumeToken.approximateByteSize()===0||k.snapshotVersion.toMicroseconds()-D.snapshotVersion.toMicroseconds()>=3e8?!0:j.addedDocuments.size+j.modifiedDocuments.size+j.removedDocuments.size>0})(g,T,f)&&c.push(t.Ur.updateTargetData(s,T))}));let u=st(),h=H();if(e.documentUpdates.forEach((f=>{e.resolvedLimboDocuments.has(f)&&c.push(t.persistence.referenceDelegate.updateLimboDocument(s,f))})),c.push(ig(s,o,e.documentUpdates).next((f=>{u=f.Ps,h=f.Is}))),!r.isEqual($.min())){const f=t.Ur.getLastRemoteSnapshotVersion(s).next((p=>t.Ur.setTargetsMetadata(s,s.currentSequenceNumber,r)));c.push(f)}return b.waitFor(c).next((()=>o.apply(s))).next((()=>t.localDocuments.getLocalViewOfDocuments(s,u,h))).next((()=>u))})).then((s=>(t.os=i,s)))}function ig(n,e,t){let r=H(),i=H();return t.forEach((s=>r=r.add(s))),e.getEntries(n,r).next((s=>{let o=st();return t.forEach(((c,u)=>{const h=s.get(c);u.isFoundDocument()!==h.isFoundDocument()&&(i=i.add(c)),u.isNoDocument()&&u.version.isEqual($.min())?(e.removeEntry(c,u.readTime),o=o.insert(c,u)):!h.isValidDocument()||u.version.compareTo(h.version)>0||u.version.compareTo(h.version)===0&&h.hasPendingWrites?(e.addEntry(u),o=o.insert(c,u)):V("LocalStore","Ignoring outdated watch update for ",c,". Current version:",h.version," Watch version:",u.version)})),{Ps:o,Is:i}}))}function HT(n,e){const t=M(n);return t.persistence.runTransaction("Get next mutation batch","readonly",(r=>(e===void 0&&(e=-1),t.mutationQueue.getNextMutationBatchAfterBatchId(r,e))))}function Qr(n,e){const t=M(n);return t.persistence.runTransaction("Allocate target","readwrite",(r=>{let i;return t.Ur.getTargetData(r,e).next((s=>s?(i=s,b.resolve(i)):t.Ur.allocateTargetId(r).next((o=>(i=new Mt(e,o,"TargetPurposeListen",r.currentSequenceNumber),t.Ur.addTargetData(r,i).next((()=>i)))))))})).then((r=>{const i=t.os.get(r.targetId);return(i===null||r.snapshotVersion.compareTo(i.snapshotVersion)>0)&&(t.os=t.os.insert(r.targetId,r),t._s.set(e,r.targetId)),r}))}async function Jr(n,e,t){const r=M(n),i=r.os.get(e),s=t?"readwrite":"readwrite-primary";try{t||await r.persistence.runTransaction("Release target",s,(o=>r.persistence.referenceDelegate.removeTarget(o,i)))}catch(o){if(!Pn(o))throw o;V("LocalStore",`Failed to update sequence numbers for target ${e}: ${o}`)}r.os=r.os.remove(e),r._s.delete(i.target)}function Ko(n,e,t){const r=M(n);let i=$.min(),s=H();return r.persistence.runTransaction("Execute query","readwrite",(o=>(function(u,h,f){const p=M(u),g=p._s.get(f);return g!==void 0?b.resolve(p.os.get(g)):p.Ur.getTargetData(h,f)})(r,o,Ze(e)).next((c=>{if(c)return i=c.lastLimboFreeSnapshotVersion,r.Ur.getMatchingKeysForTargetId(o,c.targetId).next((u=>{s=u}))})).next((()=>r.ss.getDocumentsMatchingQuery(o,e,t?i:$.min(),t?s:H()))).next((c=>(ag(r,fm(e),c),{documents:c,Ts:s})))))}function sg(n,e){const t=M(n),r=M(t.Ur),i=t.os.get(e);return i?Promise.resolve(i.target):t.persistence.runTransaction("Get target data","readonly",(s=>r.ot(s,e).next((o=>o?o.target:null))))}function og(n,e){const t=M(n),r=t.us.get(e)||$.min();return t.persistence.runTransaction("Get new document changes","readonly",(i=>t.cs.getAllFromCollectionGroup(i,e,$p(r,-1),Number.MAX_SAFE_INTEGER))).then((i=>(ag(t,e,i),i)))}function ag(n,e,t){let r=n.us.get(e)||$.min();t.forEach(((i,s)=>{s.readTime.compareTo(r)>0&&(r=s.readTime)})),n.us.set(e,r)}async function QT(n,e,t,r){const i=M(n);let s=H(),o=st();for(const h of t){const f=e.Es(h.metadata.name);h.document&&(s=s.add(f));const p=e.ds(h);p.setReadTime(e.As(h.metadata.readTime)),o=o.insert(f,p)}const c=i.cs.newChangeBuffer({trackRemovals:!0}),u=await Qr(i,(function(f){return Ze(oi(Y.fromString(`__bundle__/docs/${f}`)))})(r));return i.persistence.runTransaction("Apply bundle documents","readwrite",(h=>ig(h,c,o).next((f=>(c.apply(h),f))).next((f=>i.Ur.removeMatchingKeysForTargetId(h,u.targetId).next((()=>i.Ur.addMatchingKeys(h,s,u.targetId))).next((()=>i.localDocuments.getLocalViewOfDocuments(h,f.Ps,f.Is))).next((()=>f.Ps))))))}async function JT(n,e,t=H()){const r=await Qr(n,Ze(qu(e.bundledQuery))),i=M(n);return i.persistence.runTransaction("Save named query","readwrite",(s=>{const o=Ee(e.readTime);if(r.snapshotVersion.compareTo(o)>=0)return i.Gr.saveNamedQuery(s,e);const c=r.withResumeToken(ye.EMPTY_BYTE_STRING,o);return i.os=i.os.insert(c.targetId,c),i.Ur.updateTargetData(s,c).next((()=>i.Ur.removeMatchingKeysForTargetId(s,r.targetId))).next((()=>i.Ur.addMatchingKeys(s,t,r.targetId))).next((()=>i.Gr.saveNamedQuery(s,e)))}))}function af(n,e){return`firestore_clients_${n}_${e}`}function cf(n,e,t){let r=`firestore_mutations_${n}_${t}`;return e.isAuthenticated()&&(r+=`_${e.uid}`),r}function wc(n,e){return`firestore_targets_${n}_${e}`}class Wo{constructor(e,t,r,i){this.user=e,this.batchId=t,this.state=r,this.error=i}static Rs(e,t,r){const i=JSON.parse(r);let s,o=typeof i=="object"&&["pending","acknowledged","rejected"].indexOf(i.state)!==-1&&(i.error===void 0||typeof i.error=="object");return o&&i.error&&(o=typeof i.error.message=="string"&&typeof i.error.code=="string",o&&(s=new N(i.error.code,i.error.message))),o?new Wo(e,t,i.state,s):(Te("SharedClientState",`Failed to parse mutation state for ID '${t}': ${r}`),null)}Vs(){const e={state:this.state,updateTimeMs:Date.now()};return this.error&&(e.error={code:this.error.code,message:this.error.message}),JSON.stringify(e)}}class Zi{constructor(e,t,r){this.targetId=e,this.state=t,this.error=r}static Rs(e,t){const r=JSON.parse(t);let i,s=typeof r=="object"&&["not-current","current","rejected"].indexOf(r.state)!==-1&&(r.error===void 0||typeof r.error=="object");return s&&r.error&&(s=typeof r.error.message=="string"&&typeof r.error.code=="string",s&&(i=new N(r.error.code,r.error.message))),s?new Zi(e,r.state,i):(Te("SharedClientState",`Failed to parse target state for ID '${e}': ${t}`),null)}Vs(){const e={state:this.state,updateTimeMs:Date.now()};return this.error&&(e.error={code:this.error.code,message:this.error.message}),JSON.stringify(e)}}class Ho{constructor(e,t){this.clientId=e,this.activeTargetIds=t}static Rs(e,t){const r=JSON.parse(t);let i=typeof r=="object"&&r.activeTargetIds instanceof Array,s=Vu();for(let o=0;i&&o<r.activeTargetIds.length;++o)i=Hp(r.activeTargetIds[o]),s=s.add(r.activeTargetIds[o]);return i?new Ho(e,s):(Te("SharedClientState",`Failed to parse client data for instance '${e}': ${t}`),null)}}class Hu{constructor(e,t){this.clientId=e,this.onlineState=t}static Rs(e){const t=JSON.parse(e);return typeof t=="object"&&["Unknown","Online","Offline"].indexOf(t.onlineState)!==-1&&typeof t.clientId=="string"?new Hu(t.clientId,t.onlineState):(Te("SharedClientState",`Failed to parse online state: ${e}`),null)}}class Xc{constructor(){this.activeTargetIds=Vu()}fs(e){this.activeTargetIds=this.activeTargetIds.add(e)}gs(e){this.activeTargetIds=this.activeTargetIds.delete(e)}Vs(){const e={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(e)}}class Tc{constructor(e,t,r,i,s){this.window=e,this.ui=t,this.persistenceKey=r,this.ps=i,this.syncEngine=null,this.onlineStateHandler=null,this.sequenceNumberHandler=null,this.ys=this.ws.bind(this),this.Ss=new se(W),this.started=!1,this.bs=[];const o=r.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");this.storage=this.window.localStorage,this.currentUser=s,this.Ds=af(this.persistenceKey,this.ps),this.vs=(function(u){return`firestore_sequence_number_${u}`})(this.persistenceKey),this.Ss=this.Ss.insert(this.ps,new Xc),this.Cs=new RegExp(`^firestore_clients_${o}_([^_]*)$`),this.Fs=new RegExp(`^firestore_mutations_${o}_(\\d+)(?:_(.*))?$`),this.Ms=new RegExp(`^firestore_targets_${o}_(\\d+)$`),this.xs=(function(u){return`firestore_online_state_${u}`})(this.persistenceKey),this.Os=(function(u){return`firestore_bundle_loaded_v2_${u}`})(this.persistenceKey),this.window.addEventListener("storage",this.ys)}static D(e){return!(!e||!e.localStorage)}async start(){const e=await this.syncEngine.Qi();for(const r of e){if(r===this.ps)continue;const i=this.getItem(af(this.persistenceKey,r));if(i){const s=Ho.Rs(r,i);s&&(this.Ss=this.Ss.insert(s.clientId,s))}}this.Ns();const t=this.storage.getItem(this.xs);if(t){const r=this.Ls(t);r&&this.Bs(r)}for(const r of this.bs)this.ws(r);this.bs=[],this.window.addEventListener("pagehide",(()=>this.shutdown())),this.started=!0}writeSequenceNumber(e){this.setItem(this.vs,JSON.stringify(e))}getAllActiveQueryTargets(){return this.ks(this.Ss)}isActiveQueryTarget(e){let t=!1;return this.Ss.forEach(((r,i)=>{i.activeTargetIds.has(e)&&(t=!0)})),t}addPendingMutation(e){this.qs(e,"pending")}updateMutationState(e,t,r){this.qs(e,t,r),this.Qs(e)}addLocalQueryTarget(e,t=!0){let r="not-current";if(this.isActiveQueryTarget(e)){const i=this.storage.getItem(wc(this.persistenceKey,e));if(i){const s=Zi.Rs(e,i);s&&(r=s.state)}}return t&&this.Ks.fs(e),this.Ns(),r}removeLocalQueryTarget(e){this.Ks.gs(e),this.Ns()}isLocalQueryTarget(e){return this.Ks.activeTargetIds.has(e)}clearQueryState(e){this.removeItem(wc(this.persistenceKey,e))}updateQueryState(e,t,r){this.$s(e,t,r)}handleUserChange(e,t,r){t.forEach((i=>{this.Qs(i)})),this.currentUser=e,r.forEach((i=>{this.addPendingMutation(i)}))}setOnlineState(e){this.Us(e)}notifyBundleLoaded(e){this.Ws(e)}shutdown(){this.started&&(this.window.removeEventListener("storage",this.ys),this.removeItem(this.Ds),this.started=!1)}getItem(e){const t=this.storage.getItem(e);return V("SharedClientState","READ",e,t),t}setItem(e,t){V("SharedClientState","SET",e,t),this.storage.setItem(e,t)}removeItem(e){V("SharedClientState","REMOVE",e),this.storage.removeItem(e)}ws(e){const t=e;if(t.storageArea===this.storage){if(V("SharedClientState","EVENT",t.key,t.newValue),t.key===this.Ds)return void Te("Received WebStorage notification for local change. Another client might have garbage-collected our state");this.ui.enqueueRetryable((async()=>{if(this.started){if(t.key!==null){if(this.Cs.test(t.key)){if(t.newValue==null){const r=this.Gs(t.key);return this.zs(r,null)}{const r=this.js(t.key,t.newValue);if(r)return this.zs(r.clientId,r)}}else if(this.Fs.test(t.key)){if(t.newValue!==null){const r=this.Hs(t.key,t.newValue);if(r)return this.Js(r)}}else if(this.Ms.test(t.key)){if(t.newValue!==null){const r=this.Ys(t.key,t.newValue);if(r)return this.Zs(r)}}else if(t.key===this.xs){if(t.newValue!==null){const r=this.Ls(t.newValue);if(r)return this.Bs(r)}}else if(t.key===this.vs){const r=(function(s){let o=rt.oe;if(s!=null)try{const c=JSON.parse(s);q(typeof c=="number"),o=c}catch(c){Te("SharedClientState","Failed to read sequence number from WebStorage",c)}return o})(t.newValue);r!==rt.oe&&this.sequenceNumberHandler(r)}else if(t.key===this.Os){const r=this.Xs(t.newValue);await Promise.all(r.map((i=>this.syncEngine.eo(i))))}}}else this.bs.push(t)}))}}get Ks(){return this.Ss.get(this.ps)}Ns(){this.setItem(this.Ds,this.Ks.Vs())}qs(e,t,r){const i=new Wo(this.currentUser,e,t,r),s=cf(this.persistenceKey,this.currentUser,e);this.setItem(s,i.Vs())}Qs(e){const t=cf(this.persistenceKey,this.currentUser,e);this.removeItem(t)}Us(e){const t={clientId:this.ps,onlineState:e};this.storage.setItem(this.xs,JSON.stringify(t))}$s(e,t,r){const i=wc(this.persistenceKey,e),s=new Zi(e,t,r);this.setItem(i,s.Vs())}Ws(e){const t=JSON.stringify(Array.from(e));this.setItem(this.Os,t)}Gs(e){const t=this.Cs.exec(e);return t?t[1]:null}js(e,t){const r=this.Gs(e);return Ho.Rs(r,t)}Hs(e,t){const r=this.Fs.exec(e),i=Number(r[1]),s=r[2]!==void 0?r[2]:null;return Wo.Rs(new De(s),i,t)}Ys(e,t){const r=this.Ms.exec(e),i=Number(r[1]);return Zi.Rs(i,t)}Ls(e){return Hu.Rs(e)}Xs(e){return JSON.parse(e)}async Js(e){if(e.user.uid===this.currentUser.uid)return this.syncEngine.no(e.batchId,e.state,e.error);V("SharedClientState",`Ignoring mutation for non-active user ${e.user.uid}`)}Zs(e){return this.syncEngine.ro(e.targetId,e.state,e.error)}zs(e,t){const r=t?this.Ss.insert(e,t):this.Ss.remove(e),i=this.ks(this.Ss),s=this.ks(r),o=[],c=[];return s.forEach((u=>{i.has(u)||o.push(u)})),i.forEach((u=>{s.has(u)||c.push(u)})),this.syncEngine.io(o,c).then((()=>{this.Ss=r}))}Bs(e){this.Ss.get(e.clientId)&&this.onlineStateHandler(e.onlineState)}ks(e){let t=Vu();return e.forEach(((r,i)=>{t=t.unionWith(i.activeTargetIds)})),t}}class cg{constructor(){this.so=new Xc,this.oo={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(e){}updateMutationState(e,t,r){}addLocalQueryTarget(e,t=!0){return t&&this.so.fs(e),this.oo[e]||"not-current"}updateQueryState(e,t,r){this.oo[e]=t}removeLocalQueryTarget(e){this.so.gs(e)}isLocalQueryTarget(e){return this.so.activeTargetIds.has(e)}clearQueryState(e){delete this.oo[e]}getAllActiveQueryTargets(){return this.so.activeTargetIds}isActiveQueryTarget(e){return this.so.activeTargetIds.has(e)}start(){return this.so=new Xc,Promise.resolve()}handleUserChange(e,t,r){}setOnlineState(e){}shutdown(){}writeSequenceNumber(e){}notifyBundleLoaded(e){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class YT{_o(e){}shutdown(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class uf{constructor(){this.ao=()=>this.uo(),this.co=()=>this.lo(),this.ho=[],this.Po()}_o(e){this.ho.push(e)}shutdown(){window.removeEventListener("online",this.ao),window.removeEventListener("offline",this.co)}Po(){window.addEventListener("online",this.ao),window.addEventListener("offline",this.co)}uo(){V("ConnectivityMonitor","Network connectivity changed: AVAILABLE");for(const e of this.ho)e(0)}lo(){V("ConnectivityMonitor","Network connectivity changed: UNAVAILABLE");for(const e of this.ho)e(1)}static D(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Io=null;function Ec(){return Io===null?Io=(function(){return 268435456+Math.round(2147483648*Math.random())})():Io++,"0x"+Io.toString(16)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const XT={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery"};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ZT{constructor(e){this.Io=e.Io,this.To=e.To}Eo(e){this.Ao=e}Ro(e){this.Vo=e}mo(e){this.fo=e}onMessage(e){this.po=e}close(){this.To()}send(e){this.Io(e)}yo(){this.Ao()}wo(){this.Vo()}So(e){this.fo(e)}bo(e){this.po(e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const je="WebChannelConnection";class eE extends class{constructor(t){this.databaseInfo=t,this.databaseId=t.databaseId;const r=t.ssl?"https":"http",i=encodeURIComponent(this.databaseId.projectId),s=encodeURIComponent(this.databaseId.database);this.Do=r+"://"+t.host,this.vo=`projects/${i}/databases/${s}`,this.Co=this.databaseId.database==="(default)"?`project_id=${i}`:`project_id=${i}&database_id=${s}`}get Fo(){return!1}Mo(t,r,i,s,o){const c=Ec(),u=this.xo(t,r.toUriEncodedString());V("RestConnection",`Sending RPC '${t}' ${c}:`,u,i);const h={"google-cloud-resource-prefix":this.vo,"x-goog-request-params":this.Co};return this.Oo(h,s,o),this.No(t,u,h,i).then((f=>(V("RestConnection",`Received RPC '${t}' ${c}: `,f),f)),(f=>{throw Ct("RestConnection",`RPC '${t}' ${c} failed with error: `,f,"url: ",u,"request:",i),f}))}Lo(t,r,i,s,o,c){return this.Mo(t,r,i,s,o)}Oo(t,r,i){t["X-Goog-Api-Client"]=(function(){return"gl-js/ fire/"+si})(),t["Content-Type"]="text/plain",this.databaseInfo.appId&&(t["X-Firebase-GMPID"]=this.databaseInfo.appId),r&&r.headers.forEach(((s,o)=>t[o]=s)),i&&i.headers.forEach(((s,o)=>t[o]=s))}xo(t,r){const i=XT[t];return`${this.Do}/v1/${r}:${i}`}terminate(){}}{constructor(e){super(e),this.forceLongPolling=e.forceLongPolling,this.autoDetectLongPolling=e.autoDetectLongPolling,this.useFetchStreams=e.useFetchStreams,this.longPollingOptions=e.longPollingOptions}No(e,t,r,i){const s=Ec();return new Promise(((o,c)=>{const u=new xp;u.setWithCredentials(!0),u.listenOnce(Lp.COMPLETE,(()=>{try{switch(u.getLastErrorCode()){case Ao.NO_ERROR:const f=u.getResponseJson();V(je,`XHR for RPC '${e}' ${s} received:`,JSON.stringify(f)),o(f);break;case Ao.TIMEOUT:V(je,`RPC '${e}' ${s} timed out`),c(new N(P.DEADLINE_EXCEEDED,"Request time out"));break;case Ao.HTTP_ERROR:const p=u.getStatus();if(V(je,`RPC '${e}' ${s} failed with status:`,p,"response text:",u.getResponseText()),p>0){let g=u.getResponseJson();Array.isArray(g)&&(g=g[0]);const T=g==null?void 0:g.error;if(T&&T.status&&T.message){const C=(function(k){const j=k.toLowerCase().replace(/_/g,"-");return Object.values(P).indexOf(j)>=0?j:P.UNKNOWN})(T.status);c(new N(C,T.message))}else c(new N(P.UNKNOWN,"Server responded with status "+u.getStatus()))}else c(new N(P.UNAVAILABLE,"Connection failed."));break;default:U()}}finally{V(je,`RPC '${e}' ${s} completed.`)}}));const h=JSON.stringify(i);V(je,`RPC '${e}' ${s} sending request:`,i),u.send(t,"POST",h,r,15)}))}Bo(e,t,r){const i=Ec(),s=[this.Do,"/","google.firestore.v1.Firestore","/",e,"/channel"],o=Up(),c=Fp(),u={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},h=this.longPollingOptions.timeoutSeconds;h!==void 0&&(u.longPollingTimeout=Math.round(1e3*h)),this.useFetchStreams&&(u.useFetchStreams=!0),this.Oo(u.initMessageHeaders,t,r),u.encodeInitMessageHeaders=!0;const f=s.join("");V(je,`Creating RPC '${e}' stream ${i}: ${f}`,u);const p=o.createWebChannel(f,u);let g=!1,T=!1;const C=new ZT({Io:k=>{T?V(je,`Not sending because RPC '${e}' stream ${i} is closed:`,k):(g||(V(je,`Opening RPC '${e}' stream ${i} transport.`),p.open(),g=!0),V(je,`RPC '${e}' stream ${i} sending:`,k),p.send(k))},To:()=>p.close()}),D=(k,j,z)=>{k.listen(j,(F=>{try{z(F)}catch(G){setTimeout((()=>{throw G}),0)}}))};return D(p,zi.EventType.OPEN,(()=>{T||(V(je,`RPC '${e}' stream ${i} transport opened.`),C.yo())})),D(p,zi.EventType.CLOSE,(()=>{T||(T=!0,V(je,`RPC '${e}' stream ${i} transport closed`),C.So())})),D(p,zi.EventType.ERROR,(k=>{T||(T=!0,Ct(je,`RPC '${e}' stream ${i} transport errored:`,k),C.So(new N(P.UNAVAILABLE,"The operation could not be completed")))})),D(p,zi.EventType.MESSAGE,(k=>{var j;if(!T){const z=k.data[0];q(!!z);const F=z,G=F.error||((j=F[0])===null||j===void 0?void 0:j.error);if(G){V(je,`RPC '${e}' stream ${i} received error:`,G);const J=G.status;let K=(function(y){const w=be[y];if(w!==void 0)return Pm(w)})(J),v=G.message;K===void 0&&(K=P.INTERNAL,v="Unknown error status: "+J+" with message "+G.message),T=!0,C.So(new N(K,v)),p.close()}else V(je,`RPC '${e}' stream ${i} received:`,z),C.bo(z)}})),D(c,Mp.STAT_EVENT,(k=>{k.stat===Lc.PROXY?V(je,`RPC '${e}' stream ${i} detected buffering proxy`):k.stat===Lc.NOPROXY&&V(je,`RPC '${e}' stream ${i} detected no buffering proxy`)})),setTimeout((()=>{C.wo()}),0),C}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ug(){return typeof window<"u"?window:null}function Do(){return typeof document<"u"?document:null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xs(n){return new oT(n,!0)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qu{constructor(e,t,r=1e3,i=1.5,s=6e4){this.ui=e,this.timerId=t,this.ko=r,this.qo=i,this.Qo=s,this.Ko=0,this.$o=null,this.Uo=Date.now(),this.reset()}reset(){this.Ko=0}Wo(){this.Ko=this.Qo}Go(e){this.cancel();const t=Math.floor(this.Ko+this.zo()),r=Math.max(0,Date.now()-this.Uo),i=Math.max(0,t-r);i>0&&V("ExponentialBackoff",`Backing off for ${i} ms (base delay: ${this.Ko} ms, delay with jitter: ${t} ms, last attempt: ${r} ms ago)`),this.$o=this.ui.enqueueAfterDelay(this.timerId,i,(()=>(this.Uo=Date.now(),e()))),this.Ko*=this.qo,this.Ko<this.ko&&(this.Ko=this.ko),this.Ko>this.Qo&&(this.Ko=this.Qo)}jo(){this.$o!==null&&(this.$o.skipDelay(),this.$o=null)}cancel(){this.$o!==null&&(this.$o.cancel(),this.$o=null)}zo(){return(Math.random()-.5)*this.Ko}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lg{constructor(e,t,r,i,s,o,c,u){this.ui=e,this.Ho=r,this.Jo=i,this.connection=s,this.authCredentialsProvider=o,this.appCheckCredentialsProvider=c,this.listener=u,this.state=0,this.Yo=0,this.Zo=null,this.Xo=null,this.stream=null,this.e_=0,this.t_=new Qu(e,t)}n_(){return this.state===1||this.state===5||this.r_()}r_(){return this.state===2||this.state===3}start(){this.e_=0,this.state!==4?this.auth():this.i_()}async stop(){this.n_()&&await this.close(0)}s_(){this.state=0,this.t_.reset()}o_(){this.r_()&&this.Zo===null&&(this.Zo=this.ui.enqueueAfterDelay(this.Ho,6e4,(()=>this.__())))}a_(e){this.u_(),this.stream.send(e)}async __(){if(this.r_())return this.close(0)}u_(){this.Zo&&(this.Zo.cancel(),this.Zo=null)}c_(){this.Xo&&(this.Xo.cancel(),this.Xo=null)}async close(e,t){this.u_(),this.c_(),this.t_.cancel(),this.Yo++,e!==4?this.t_.reset():t&&t.code===P.RESOURCE_EXHAUSTED?(Te(t.toString()),Te("Using maximum backoff delay to prevent overloading the backend."),this.t_.Wo()):t&&t.code===P.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.l_(),this.stream.close(),this.stream=null),this.state=e,await this.listener.mo(t)}l_(){}auth(){this.state=1;const e=this.h_(this.Yo),t=this.Yo;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then((([r,i])=>{this.Yo===t&&this.P_(r,i)}),(r=>{e((()=>{const i=new N(P.UNKNOWN,"Fetching auth token failed: "+r.message);return this.I_(i)}))}))}P_(e,t){const r=this.h_(this.Yo);this.stream=this.T_(e,t),this.stream.Eo((()=>{r((()=>this.listener.Eo()))})),this.stream.Ro((()=>{r((()=>(this.state=2,this.Xo=this.ui.enqueueAfterDelay(this.Jo,1e4,(()=>(this.r_()&&(this.state=3),Promise.resolve()))),this.listener.Ro())))})),this.stream.mo((i=>{r((()=>this.I_(i)))})),this.stream.onMessage((i=>{r((()=>++this.e_==1?this.E_(i):this.onNext(i)))}))}i_(){this.state=5,this.t_.Go((async()=>{this.state=0,this.start()}))}I_(e){return V("PersistentStream",`close with error: ${e}`),this.stream=null,this.close(4,e)}h_(e){return t=>{this.ui.enqueueAndForget((()=>this.Yo===e?t():(V("PersistentStream","stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve())))}}}class tE extends lg{constructor(e,t,r,i,s,o){super(e,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",t,r,i,o),this.serializer=s}T_(e,t){return this.connection.Bo("Listen",e,t)}E_(e){return this.onNext(e)}onNext(e){this.t_.reset();const t=uT(this.serializer,e),r=(function(s){if(!("targetChange"in s))return $.min();const o=s.targetChange;return o.targetIds&&o.targetIds.length?$.min():o.readTime?Ee(o.readTime):$.min()})(e);return this.listener.d_(t,r)}A_(e){const t={};t.database=Wc(this.serializer),t.addTarget=(function(s,o){let c;const u=o.target;if(c=Bo(u)?{documents:Mm(s,u)}:{query:Fm(s,u)._t},c.targetId=o.targetId,o.resumeToken.approximateByteSize()>0){c.resumeToken=Dm(s,o.resumeToken);const h=Gc(s,o.expectedCount);h!==null&&(c.expectedCount=h)}else if(o.snapshotVersion.compareTo($.min())>0){c.readTime=Hr(s,o.snapshotVersion.toTimestamp());const h=Gc(s,o.expectedCount);h!==null&&(c.expectedCount=h)}return c})(this.serializer,e);const r=hT(this.serializer,e);r&&(t.labels=r),this.a_(t)}R_(e){const t={};t.database=Wc(this.serializer),t.removeTarget=e,this.a_(t)}}class nE extends lg{constructor(e,t,r,i,s,o){super(e,"write_stream_connection_backoff","write_stream_idle","health_check_timeout",t,r,i,o),this.serializer=s}get V_(){return this.e_>0}start(){this.lastStreamToken=void 0,super.start()}l_(){this.V_&&this.m_([])}T_(e,t){return this.connection.Bo("Write",e,t)}E_(e){return q(!!e.streamToken),this.lastStreamToken=e.streamToken,q(!e.writeResults||e.writeResults.length===0),this.listener.f_()}onNext(e){q(!!e.streamToken),this.lastStreamToken=e.streamToken,this.t_.reset();const t=lT(e.writeResults,e.commitTime),r=Ee(e.commitTime);return this.listener.g_(r,t)}p_(){const e={};e.database=Wc(this.serializer),this.a_(e)}m_(e){const t={streamToken:this.lastStreamToken,writes:e.map((r=>_s(this.serializer,r)))};this.a_(t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rE extends class{}{constructor(e,t,r,i){super(),this.authCredentials=e,this.appCheckCredentials=t,this.connection=r,this.serializer=i,this.y_=!1}w_(){if(this.y_)throw new N(P.FAILED_PRECONDITION,"The client has already been terminated.")}Mo(e,t,r,i){return this.w_(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([s,o])=>this.connection.Mo(e,Kc(t,r),i,s,o))).catch((s=>{throw s.name==="FirebaseError"?(s.code===P.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),s):new N(P.UNKNOWN,s.toString())}))}Lo(e,t,r,i,s){return this.w_(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([o,c])=>this.connection.Lo(e,Kc(t,r),i,o,c,s))).catch((o=>{throw o.name==="FirebaseError"?(o.code===P.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new N(P.UNKNOWN,o.toString())}))}terminate(){this.y_=!0,this.connection.terminate()}}class iE{constructor(e,t){this.asyncQueue=e,this.onlineStateHandler=t,this.state="Unknown",this.S_=0,this.b_=null,this.D_=!0}v_(){this.S_===0&&(this.C_("Unknown"),this.b_=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,(()=>(this.b_=null,this.F_("Backend didn't respond within 10 seconds."),this.C_("Offline"),Promise.resolve()))))}M_(e){this.state==="Online"?this.C_("Unknown"):(this.S_++,this.S_>=1&&(this.x_(),this.F_(`Connection failed 1 times. Most recent error: ${e.toString()}`),this.C_("Offline")))}set(e){this.x_(),this.S_=0,e==="Online"&&(this.D_=!1),this.C_(e)}C_(e){e!==this.state&&(this.state=e,this.onlineStateHandler(e))}F_(e){const t=`Could not reach Cloud Firestore backend. ${e}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this.D_?(Te(t),this.D_=!1):V("OnlineStateTracker",t)}x_(){this.b_!==null&&(this.b_.cancel(),this.b_=null)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class sE{constructor(e,t,r,i,s){this.localStore=e,this.datastore=t,this.asyncQueue=r,this.remoteSyncer={},this.O_=[],this.N_=new Map,this.L_=new Set,this.B_=[],this.k_=s,this.k_._o((o=>{r.enqueueAndForget((async()=>{Cn(this)&&(V("RemoteStore","Restarting streams for network reachability change."),await(async function(u){const h=M(u);h.L_.add(4),await ui(h),h.q_.set("Unknown"),h.L_.delete(4),await Ls(h)})(this))}))})),this.q_=new iE(r,i)}}async function Ls(n){if(Cn(n))for(const e of n.B_)await e(!0)}async function ui(n){for(const e of n.B_)await e(!1)}function ma(n,e){const t=M(n);t.N_.has(e.targetId)||(t.N_.set(e.targetId,e),Xu(t)?Yu(t):hi(t).r_()&&Ju(t,e))}function Yr(n,e){const t=M(n),r=hi(t);t.N_.delete(e),r.r_()&&hg(t,e),t.N_.size===0&&(r.r_()?r.o_():Cn(t)&&t.q_.set("Unknown"))}function Ju(n,e){if(n.Q_.xe(e.targetId),e.resumeToken.approximateByteSize()>0||e.snapshotVersion.compareTo($.min())>0){const t=n.remoteSyncer.getRemoteKeysForTarget(e.targetId).size;e=e.withExpectedCount(t)}hi(n).A_(e)}function hg(n,e){n.Q_.xe(e),hi(n).R_(e)}function Yu(n){n.Q_=new nT({getRemoteKeysForTarget:e=>n.remoteSyncer.getRemoteKeysForTarget(e),ot:e=>n.N_.get(e)||null,tt:()=>n.datastore.serializer.databaseId}),hi(n).start(),n.q_.v_()}function Xu(n){return Cn(n)&&!hi(n).n_()&&n.N_.size>0}function Cn(n){return M(n).L_.size===0}function dg(n){n.Q_=void 0}async function oE(n){n.q_.set("Online")}async function aE(n){n.N_.forEach(((e,t)=>{Ju(n,e)}))}async function cE(n,e){dg(n),Xu(n)?(n.q_.M_(e),Yu(n)):n.q_.set("Unknown")}async function uE(n,e,t){if(n.q_.set("Online"),e instanceof km&&e.state===2&&e.cause)try{await(async function(i,s){const o=s.cause;for(const c of s.targetIds)i.N_.has(c)&&(await i.remoteSyncer.rejectListen(c,o),i.N_.delete(c),i.Q_.removeTarget(c))})(n,e)}catch(r){V("RemoteStore","Failed to remove targets %s: %s ",e.targetIds.join(","),r),await Qo(n,r)}else if(e instanceof ko?n.Q_.Ke(e):e instanceof Cm?n.Q_.He(e):n.Q_.We(e),!t.isEqual($.min()))try{const r=await rg(n.localStore);t.compareTo(r)>=0&&await(function(s,o){const c=s.Q_.rt(o);return c.targetChanges.forEach(((u,h)=>{if(u.resumeToken.approximateByteSize()>0){const f=s.N_.get(h);f&&s.N_.set(h,f.withResumeToken(u.resumeToken,o))}})),c.targetMismatches.forEach(((u,h)=>{const f=s.N_.get(u);if(!f)return;s.N_.set(u,f.withResumeToken(ye.EMPTY_BYTE_STRING,f.snapshotVersion)),hg(s,u);const p=new Mt(f.target,u,h,f.sequenceNumber);Ju(s,p)})),s.remoteSyncer.applyRemoteEvent(c)})(n,t)}catch(r){V("RemoteStore","Failed to raise snapshot:",r),await Qo(n,r)}}async function Qo(n,e,t){if(!Pn(e))throw e;n.L_.add(1),await ui(n),n.q_.set("Offline"),t||(t=()=>rg(n.localStore)),n.asyncQueue.enqueueRetryable((async()=>{V("RemoteStore","Retrying IndexedDB access"),await t(),n.L_.delete(1),await Ls(n)}))}function fg(n,e){return e().catch((t=>Qo(n,t,e)))}async function li(n){const e=M(n),t=Tn(e);let r=e.O_.length>0?e.O_[e.O_.length-1].batchId:-1;for(;lE(e);)try{const i=await HT(e.localStore,r);if(i===null){e.O_.length===0&&t.o_();break}r=i.batchId,hE(e,i)}catch(i){await Qo(e,i)}pg(e)&&mg(e)}function lE(n){return Cn(n)&&n.O_.length<10}function hE(n,e){n.O_.push(e);const t=Tn(n);t.r_()&&t.V_&&t.m_(e.mutations)}function pg(n){return Cn(n)&&!Tn(n).n_()&&n.O_.length>0}function mg(n){Tn(n).start()}async function dE(n){Tn(n).p_()}async function fE(n){const e=Tn(n);for(const t of n.O_)e.m_(t.mutations)}async function pE(n,e,t){const r=n.O_.shift(),i=Mu.from(r,e,t);await fg(n,(()=>n.remoteSyncer.applySuccessfulWrite(i))),await li(n)}async function mE(n,e){e&&Tn(n).V_&&await(async function(r,i){if((function(o){return Rm(o)&&o!==P.ABORTED})(i.code)){const s=r.O_.shift();Tn(r).s_(),await fg(r,(()=>r.remoteSyncer.rejectFailedWrite(s.batchId,i))),await li(r)}})(n,e),pg(n)&&mg(n)}async function lf(n,e){const t=M(n);t.asyncQueue.verifyOperationInProgress(),V("RemoteStore","RemoteStore received new credentials");const r=Cn(t);t.L_.add(3),await ui(t),r&&t.q_.set("Unknown"),await t.remoteSyncer.handleCredentialChange(e),t.L_.delete(3),await Ls(t)}async function Zc(n,e){const t=M(n);e?(t.L_.delete(2),await Ls(t)):e||(t.L_.add(2),await ui(t),t.q_.set("Unknown"))}function hi(n){return n.K_||(n.K_=(function(t,r,i){const s=M(t);return s.w_(),new tE(r,s.connection,s.authCredentials,s.appCheckCredentials,s.serializer,i)})(n.datastore,n.asyncQueue,{Eo:oE.bind(null,n),Ro:aE.bind(null,n),mo:cE.bind(null,n),d_:uE.bind(null,n)}),n.B_.push((async e=>{e?(n.K_.s_(),Xu(n)?Yu(n):n.q_.set("Unknown")):(await n.K_.stop(),dg(n))}))),n.K_}function Tn(n){return n.U_||(n.U_=(function(t,r,i){const s=M(t);return s.w_(),new nE(r,s.connection,s.authCredentials,s.appCheckCredentials,s.serializer,i)})(n.datastore,n.asyncQueue,{Eo:()=>Promise.resolve(),Ro:dE.bind(null,n),mo:mE.bind(null,n),f_:fE.bind(null,n),g_:pE.bind(null,n)}),n.B_.push((async e=>{e?(n.U_.s_(),await li(n)):(await n.U_.stop(),n.O_.length>0&&(V("RemoteStore",`Stopping write stream with ${n.O_.length} pending writes`),n.O_=[]))}))),n.U_}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zu{constructor(e,t,r,i,s){this.asyncQueue=e,this.timerId=t,this.targetTimeMs=r,this.op=i,this.removalCallback=s,this.deferred=new Le,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch((o=>{}))}get promise(){return this.deferred.promise}static createAndSchedule(e,t,r,i,s){const o=Date.now()+r,c=new Zu(e,t,o,i,s);return c.start(r),c}start(e){this.timerHandle=setTimeout((()=>this.handleDelayElapsed()),e)}skipDelay(){return this.handleDelayElapsed()}cancel(e){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new N(P.CANCELLED,"Operation cancelled"+(e?": "+e:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget((()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then((e=>this.deferred.resolve(e)))):Promise.resolve()))}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}}function di(n,e){if(Te("AsyncQueue",`${e}: ${n}`),Pn(n))return new N(P.UNAVAILABLE,`${e}: ${n}`);throw n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Or{constructor(e){this.comparator=e?(t,r)=>e(t,r)||L.comparator(t.key,r.key):(t,r)=>L.comparator(t.key,r.key),this.keyedMap=Gi(),this.sortedSet=new se(this.comparator)}static emptySet(e){return new Or(e.comparator)}has(e){return this.keyedMap.get(e)!=null}get(e){return this.keyedMap.get(e)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(e){const t=this.keyedMap.get(e);return t?this.sortedSet.indexOf(t):-1}get size(){return this.sortedSet.size}forEach(e){this.sortedSet.inorderTraversal(((t,r)=>(e(t),!1)))}add(e){const t=this.delete(e.key);return t.copy(t.keyedMap.insert(e.key,e),t.sortedSet.insert(e,null))}delete(e){const t=this.get(e);return t?this.copy(this.keyedMap.remove(e),this.sortedSet.remove(t)):this}isEqual(e){if(!(e instanceof Or)||this.size!==e.size)return!1;const t=this.sortedSet.getIterator(),r=e.sortedSet.getIterator();for(;t.hasNext();){const i=t.getNext().key,s=r.getNext().key;if(!i.isEqual(s))return!1}return!0}toString(){const e=[];return this.forEach((t=>{e.push(t.toString())})),e.length===0?"DocumentSet ()":`DocumentSet (
  `+e.join(`  
`)+`
)`}copy(e,t){const r=new Or;return r.comparator=this.comparator,r.keyedMap=e,r.sortedSet=t,r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hf{constructor(){this.W_=new se(L.comparator)}track(e){const t=e.doc.key,r=this.W_.get(t);r?e.type!==0&&r.type===3?this.W_=this.W_.insert(t,e):e.type===3&&r.type!==1?this.W_=this.W_.insert(t,{type:r.type,doc:e.doc}):e.type===2&&r.type===2?this.W_=this.W_.insert(t,{type:2,doc:e.doc}):e.type===2&&r.type===0?this.W_=this.W_.insert(t,{type:0,doc:e.doc}):e.type===1&&r.type===0?this.W_=this.W_.remove(t):e.type===1&&r.type===2?this.W_=this.W_.insert(t,{type:1,doc:r.doc}):e.type===0&&r.type===1?this.W_=this.W_.insert(t,{type:2,doc:e.doc}):U():this.W_=this.W_.insert(t,e)}G_(){const e=[];return this.W_.inorderTraversal(((t,r)=>{e.push(r)})),e}}class Xr{constructor(e,t,r,i,s,o,c,u,h){this.query=e,this.docs=t,this.oldDocs=r,this.docChanges=i,this.mutatedKeys=s,this.fromCache=o,this.syncStateChanged=c,this.excludesMetadataChanges=u,this.hasCachedResults=h}static fromInitialDocuments(e,t,r,i,s){const o=[];return t.forEach((c=>{o.push({type:0,doc:c})})),new Xr(e,t,Or.emptySet(t),o,r,i,!0,!1,s)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(e){if(!(this.fromCache===e.fromCache&&this.hasCachedResults===e.hasCachedResults&&this.syncStateChanged===e.syncStateChanged&&this.mutatedKeys.isEqual(e.mutatedKeys)&&ks(this.query,e.query)&&this.docs.isEqual(e.docs)&&this.oldDocs.isEqual(e.oldDocs)))return!1;const t=this.docChanges,r=e.docChanges;if(t.length!==r.length)return!1;for(let i=0;i<t.length;i++)if(t[i].type!==r[i].type||!t[i].doc.isEqual(r[i].doc))return!1;return!0}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gE{constructor(){this.z_=void 0,this.j_=[]}H_(){return this.j_.some((e=>e.J_()))}}class _E{constructor(){this.queries=df(),this.onlineState="Unknown",this.Y_=new Set}terminate(){(function(t,r){const i=M(t),s=i.queries;i.queries=df(),s.forEach(((o,c)=>{for(const u of c.j_)u.onError(r)}))})(this,new N(P.ABORTED,"Firestore shutting down"))}}function df(){return new Sn((n=>dm(n)),ks)}async function el(n,e){const t=M(n);let r=3;const i=e.query;let s=t.queries.get(i);s?!s.H_()&&e.J_()&&(r=2):(s=new gE,r=e.J_()?0:1);try{switch(r){case 0:s.z_=await t.onListen(i,!0);break;case 1:s.z_=await t.onListen(i,!1);break;case 2:await t.onFirstRemoteStoreListen(i)}}catch(o){const c=di(o,`Initialization of query '${Sr(e.query)}' failed`);return void e.onError(c)}t.queries.set(i,s),s.j_.push(e),e.Z_(t.onlineState),s.z_&&e.X_(s.z_)&&nl(t)}async function tl(n,e){const t=M(n),r=e.query;let i=3;const s=t.queries.get(r);if(s){const o=s.j_.indexOf(e);o>=0&&(s.j_.splice(o,1),s.j_.length===0?i=e.J_()?0:1:!s.H_()&&e.J_()&&(i=2))}switch(i){case 0:return t.queries.delete(r),t.onUnlisten(r,!0);case 1:return t.queries.delete(r),t.onUnlisten(r,!1);case 2:return t.onLastRemoteStoreUnlisten(r);default:return}}function yE(n,e){const t=M(n);let r=!1;for(const i of e){const s=i.query,o=t.queries.get(s);if(o){for(const c of o.j_)c.X_(i)&&(r=!0);o.z_=i}}r&&nl(t)}function IE(n,e,t){const r=M(n),i=r.queries.get(e);if(i)for(const s of i.j_)s.onError(t);r.queries.delete(e)}function nl(n){n.Y_.forEach((e=>{e.next()}))}var eu,ff;(ff=eu||(eu={})).ea="default",ff.Cache="cache";class rl{constructor(e,t,r){this.query=e,this.ta=t,this.na=!1,this.ra=null,this.onlineState="Unknown",this.options=r||{}}X_(e){if(!this.options.includeMetadataChanges){const r=[];for(const i of e.docChanges)i.type!==3&&r.push(i);e=new Xr(e.query,e.docs,e.oldDocs,r,e.mutatedKeys,e.fromCache,e.syncStateChanged,!0,e.hasCachedResults)}let t=!1;return this.na?this.ia(e)&&(this.ta.next(e),t=!0):this.sa(e,this.onlineState)&&(this.oa(e),t=!0),this.ra=e,t}onError(e){this.ta.error(e)}Z_(e){this.onlineState=e;let t=!1;return this.ra&&!this.na&&this.sa(this.ra,e)&&(this.oa(this.ra),t=!0),t}sa(e,t){if(!e.fromCache||!this.J_())return!0;const r=t!=="Offline";return(!this.options._a||!r)&&(!e.docs.isEmpty()||e.hasCachedResults||t==="Offline")}ia(e){if(e.docChanges.length>0)return!0;const t=this.ra&&this.ra.hasPendingWrites!==e.hasPendingWrites;return!(!e.syncStateChanged&&!t)&&this.options.includeMetadataChanges===!0}oa(e){e=Xr.fromInitialDocuments(e.query,e.docs,e.mutatedKeys,e.fromCache,e.hasCachedResults),this.na=!0,this.ta.next(e)}J_(){return this.options.source!==eu.Cache}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vE{constructor(e,t){this.aa=e,this.byteLength=t}ua(){return"metadata"in this.aa}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pf{constructor(e){this.serializer=e}Es(e){return Rt(this.serializer,e)}ds(e){return e.metadata.exists?Lm(this.serializer,e.document,!1):ae.newNoDocument(this.Es(e.metadata.name),this.As(e.metadata.readTime))}As(e){return Ee(e)}}class wE{constructor(e,t,r){this.ca=e,this.localStore=t,this.serializer=r,this.queries=[],this.documents=[],this.collectionGroups=new Set,this.progress=gg(e)}la(e){this.progress.bytesLoaded+=e.byteLength;let t=this.progress.documentsLoaded;if(e.aa.namedQuery)this.queries.push(e.aa.namedQuery);else if(e.aa.documentMetadata){this.documents.push({metadata:e.aa.documentMetadata}),e.aa.documentMetadata.exists||++t;const r=Y.fromString(e.aa.documentMetadata.name);this.collectionGroups.add(r.get(r.length-2))}else e.aa.document&&(this.documents[this.documents.length-1].document=e.aa.document,++t);return t!==this.progress.documentsLoaded?(this.progress.documentsLoaded=t,Object.assign({},this.progress)):null}ha(e){const t=new Map,r=new pf(this.serializer);for(const i of e)if(i.metadata.queries){const s=r.Es(i.metadata.name);for(const o of i.metadata.queries){const c=(t.get(o)||H()).add(s);t.set(o,c)}}return t}async complete(){const e=await QT(this.localStore,new pf(this.serializer),this.documents,this.ca.id),t=this.ha(this.documents);for(const r of this.queries)await JT(this.localStore,r,t.get(r.name));return this.progress.taskState="Success",{progress:this.progress,Pa:this.collectionGroups,Ia:e}}}function gg(n){return{taskState:"Running",documentsLoaded:0,bytesLoaded:0,totalDocuments:n.totalDocuments,totalBytes:n.totalBytes}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _g{constructor(e){this.key=e}}class yg{constructor(e){this.key=e}}class Ig{constructor(e,t){this.query=e,this.Ta=t,this.Ea=null,this.hasCachedResults=!1,this.current=!1,this.da=H(),this.mutatedKeys=H(),this.Aa=pm(e),this.Ra=new Or(this.Aa)}get Va(){return this.Ta}ma(e,t){const r=t?t.fa:new hf,i=t?t.Ra:this.Ra;let s=t?t.mutatedKeys:this.mutatedKeys,o=i,c=!1;const u=this.query.limitType==="F"&&i.size===this.query.limit?i.last():null,h=this.query.limitType==="L"&&i.size===this.query.limit?i.first():null;if(e.inorderTraversal(((f,p)=>{const g=i.get(f),T=Ds(this.query,p)?p:null,C=!!g&&this.mutatedKeys.has(g.key),D=!!T&&(T.hasLocalMutations||this.mutatedKeys.has(T.key)&&T.hasCommittedMutations);let k=!1;g&&T?g.data.isEqual(T.data)?C!==D&&(r.track({type:3,doc:T}),k=!0):this.ga(g,T)||(r.track({type:2,doc:T}),k=!0,(u&&this.Aa(T,u)>0||h&&this.Aa(T,h)<0)&&(c=!0)):!g&&T?(r.track({type:0,doc:T}),k=!0):g&&!T&&(r.track({type:1,doc:g}),k=!0,(u||h)&&(c=!0)),k&&(T?(o=o.add(T),s=D?s.add(f):s.delete(f)):(o=o.delete(f),s=s.delete(f)))})),this.query.limit!==null)for(;o.size>this.query.limit;){const f=this.query.limitType==="F"?o.last():o.first();o=o.delete(f.key),s=s.delete(f.key),r.track({type:1,doc:f})}return{Ra:o,fa:r,ns:c,mutatedKeys:s}}ga(e,t){return e.hasLocalMutations&&t.hasCommittedMutations&&!t.hasLocalMutations}applyChanges(e,t,r,i){const s=this.Ra;this.Ra=e.Ra,this.mutatedKeys=e.mutatedKeys;const o=e.fa.G_();o.sort(((f,p)=>(function(T,C){const D=k=>{switch(k){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return U()}};return D(T)-D(C)})(f.type,p.type)||this.Aa(f.doc,p.doc))),this.pa(r),i=i!=null&&i;const c=t&&!i?this.ya():[],u=this.da.size===0&&this.current&&!i?1:0,h=u!==this.Ea;return this.Ea=u,o.length!==0||h?{snapshot:new Xr(this.query,e.Ra,s,o,e.mutatedKeys,u===0,h,!1,!!r&&r.resumeToken.approximateByteSize()>0),wa:c}:{wa:c}}Z_(e){return this.current&&e==="Offline"?(this.current=!1,this.applyChanges({Ra:this.Ra,fa:new hf,mutatedKeys:this.mutatedKeys,ns:!1},!1)):{wa:[]}}Sa(e){return!this.Ta.has(e)&&!!this.Ra.has(e)&&!this.Ra.get(e).hasLocalMutations}pa(e){e&&(e.addedDocuments.forEach((t=>this.Ta=this.Ta.add(t))),e.modifiedDocuments.forEach((t=>{})),e.removedDocuments.forEach((t=>this.Ta=this.Ta.delete(t))),this.current=e.current)}ya(){if(!this.current)return[];const e=this.da;this.da=H(),this.Ra.forEach((r=>{this.Sa(r.key)&&(this.da=this.da.add(r.key))}));const t=[];return e.forEach((r=>{this.da.has(r)||t.push(new yg(r))})),this.da.forEach((r=>{e.has(r)||t.push(new _g(r))})),t}ba(e){this.Ta=e.Ts,this.da=H();const t=this.ma(e.documents);return this.applyChanges(t,!0)}Da(){return Xr.fromInitialDocuments(this.query,this.Ra,this.mutatedKeys,this.Ea===0,this.hasCachedResults)}}class TE{constructor(e,t,r){this.query=e,this.targetId=t,this.view=r}}class EE{constructor(e){this.key=e,this.va=!1}}class AE{constructor(e,t,r,i,s,o){this.localStore=e,this.remoteStore=t,this.eventManager=r,this.sharedClientState=i,this.currentUser=s,this.maxConcurrentLimboResolutions=o,this.Ca={},this.Fa=new Sn((c=>dm(c)),ks),this.Ma=new Map,this.xa=new Set,this.Oa=new se(L.comparator),this.Na=new Map,this.La=new zu,this.Ba={},this.ka=new Map,this.qa=ir.kn(),this.onlineState="Unknown",this.Qa=void 0}get isPrimaryClient(){return this.Qa===!0}}async function bE(n,e,t=!0){const r=ga(n);let i;const s=r.Fa.get(e);return s?(r.sharedClientState.addLocalQueryTarget(s.targetId),i=s.view.Da()):i=await vg(r,e,t,!0),i}async function RE(n,e){const t=ga(n);await vg(t,e,!0,!1)}async function vg(n,e,t,r){const i=await Qr(n.localStore,Ze(e)),s=i.targetId,o=n.sharedClientState.addLocalQueryTarget(s,t);let c;return r&&(c=await il(n,e,s,o==="current",i.resumeToken)),n.isPrimaryClient&&t&&ma(n.remoteStore,i),c}async function il(n,e,t,r,i){n.Ka=(p,g,T)=>(async function(D,k,j,z){let F=k.view.ma(j);F.ns&&(F=await Ko(D.localStore,k.query,!1).then((({documents:v})=>k.view.ma(v,F))));const G=z&&z.targetChanges.get(k.targetId),J=z&&z.targetMismatches.get(k.targetId)!=null,K=k.view.applyChanges(F,D.isPrimaryClient,G,J);return tu(D,k.targetId,K.wa),K.snapshot})(n,p,g,T);const s=await Ko(n.localStore,e,!0),o=new Ig(e,s.Ts),c=o.ma(s.documents),u=Os.createSynthesizedTargetChangeForCurrentChange(t,r&&n.onlineState!=="Offline",i),h=o.applyChanges(c,n.isPrimaryClient,u);tu(n,t,h.wa);const f=new TE(e,t,o);return n.Fa.set(e,f),n.Ma.has(t)?n.Ma.get(t).push(e):n.Ma.set(t,[e]),h.snapshot}async function PE(n,e,t){const r=M(n),i=r.Fa.get(e),s=r.Ma.get(i.targetId);if(s.length>1)return r.Ma.set(i.targetId,s.filter((o=>!ks(o,e)))),void r.Fa.delete(e);r.isPrimaryClient?(r.sharedClientState.removeLocalQueryTarget(i.targetId),r.sharedClientState.isActiveQueryTarget(i.targetId)||await Jr(r.localStore,i.targetId,!1).then((()=>{r.sharedClientState.clearQueryState(i.targetId),t&&Yr(r.remoteStore,i.targetId),Zr(r,i.targetId)})).catch(Rn)):(Zr(r,i.targetId),await Jr(r.localStore,i.targetId,!0))}async function SE(n,e){const t=M(n),r=t.Fa.get(e),i=t.Ma.get(r.targetId);t.isPrimaryClient&&i.length===1&&(t.sharedClientState.removeLocalQueryTarget(r.targetId),Yr(t.remoteStore,r.targetId))}async function CE(n,e,t){const r=cl(n);try{const i=await(function(o,c){const u=M(o),h=de.now(),f=c.reduce(((T,C)=>T.add(C.key)),H());let p,g;return u.persistence.runTransaction("Locally write mutations","readwrite",(T=>{let C=st(),D=H();return u.cs.getEntries(T,f).next((k=>{C=k,C.forEach(((j,z)=>{z.isValidDocument()||(D=D.add(j))}))})).next((()=>u.localDocuments.getOverlayedDocuments(T,C))).next((k=>{p=k;const j=[];for(const z of c){const F=Zw(z,p.get(z.key).overlayedDocument);F!=null&&j.push(new Jt(z.key,F,rm(F.value.mapValue),he.exists(!0)))}return u.mutationQueue.addMutationBatch(T,h,j,c)})).next((k=>{g=k;const j=k.applyToLocalDocumentSet(p,D);return u.documentOverlayCache.saveOverlays(T,k.batchId,j)}))})).then((()=>({batchId:g.batchId,changes:gm(p)})))})(r.localStore,e);r.sharedClientState.addPendingMutation(i.batchId),(function(o,c,u){let h=o.Ba[o.currentUser.toKey()];h||(h=new se(W)),h=h.insert(c,u),o.Ba[o.currentUser.toKey()]=h})(r,i.batchId,t),await Yt(r,i.changes),await li(r.remoteStore)}catch(i){const s=di(i,"Failed to persist write");t.reject(s)}}async function wg(n,e){const t=M(n);try{const r=await WT(t.localStore,e);e.targetChanges.forEach(((i,s)=>{const o=t.Na.get(s);o&&(q(i.addedDocuments.size+i.modifiedDocuments.size+i.removedDocuments.size<=1),i.addedDocuments.size>0?o.va=!0:i.modifiedDocuments.size>0?q(o.va):i.removedDocuments.size>0&&(q(o.va),o.va=!1))})),await Yt(t,r,e)}catch(r){await Rn(r)}}function mf(n,e,t){const r=M(n);if(r.isPrimaryClient&&t===0||!r.isPrimaryClient&&t===1){const i=[];r.Fa.forEach(((s,o)=>{const c=o.view.Z_(e);c.snapshot&&i.push(c.snapshot)})),(function(o,c){const u=M(o);u.onlineState=c;let h=!1;u.queries.forEach(((f,p)=>{for(const g of p.j_)g.Z_(c)&&(h=!0)})),h&&nl(u)})(r.eventManager,e),i.length&&r.Ca.d_(i),r.onlineState=e,r.isPrimaryClient&&r.sharedClientState.setOnlineState(e)}}async function kE(n,e,t){const r=M(n);r.sharedClientState.updateQueryState(e,"rejected",t);const i=r.Na.get(e),s=i&&i.key;if(s){let o=new se(L.comparator);o=o.insert(s,ae.newNoDocument(s,$.min()));const c=H().add(s),u=new Vs($.min(),new Map,new se(W),o,c);await wg(r,u),r.Oa=r.Oa.remove(s),r.Na.delete(e),al(r)}else await Jr(r.localStore,e,!1).then((()=>Zr(r,e,t))).catch(Rn)}async function DE(n,e){const t=M(n),r=e.batch.batchId;try{const i=await KT(t.localStore,e);ol(t,r,null),sl(t,r),t.sharedClientState.updateMutationState(r,"acknowledged"),await Yt(t,i)}catch(i){await Rn(i)}}async function NE(n,e,t){const r=M(n);try{const i=await(function(o,c){const u=M(o);return u.persistence.runTransaction("Reject batch","readwrite-primary",(h=>{let f;return u.mutationQueue.lookupMutationBatch(h,c).next((p=>(q(p!==null),f=p.keys(),u.mutationQueue.removeMutationBatch(h,p)))).next((()=>u.mutationQueue.performConsistencyCheck(h))).next((()=>u.documentOverlayCache.removeOverlaysForBatchId(h,f,c))).next((()=>u.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(h,f))).next((()=>u.localDocuments.getDocuments(h,f)))}))})(r.localStore,e);ol(r,e,t),sl(r,e),r.sharedClientState.updateMutationState(e,"rejected",t),await Yt(r,i)}catch(i){await Rn(i)}}async function VE(n,e){const t=M(n);Cn(t.remoteStore)||V("SyncEngine","The network is disabled. The task returned by 'awaitPendingWrites()' will not complete until the network is enabled.");try{const r=await(function(o){const c=M(o);return c.persistence.runTransaction("Get highest unacknowledged batch id","readonly",(u=>c.mutationQueue.getHighestUnacknowledgedBatchId(u)))})(t.localStore);if(r===-1)return void e.resolve();const i=t.ka.get(r)||[];i.push(e),t.ka.set(r,i)}catch(r){const i=di(r,"Initialization of waitForPendingWrites() operation failed");e.reject(i)}}function sl(n,e){(n.ka.get(e)||[]).forEach((t=>{t.resolve()})),n.ka.delete(e)}function ol(n,e,t){const r=M(n);let i=r.Ba[r.currentUser.toKey()];if(i){const s=i.get(e);s&&(t?s.reject(t):s.resolve(),i=i.remove(e)),r.Ba[r.currentUser.toKey()]=i}}function Zr(n,e,t=null){n.sharedClientState.removeLocalQueryTarget(e);for(const r of n.Ma.get(e))n.Fa.delete(r),t&&n.Ca.$a(r,t);n.Ma.delete(e),n.isPrimaryClient&&n.La.gr(e).forEach((r=>{n.La.containsKey(r)||Tg(n,r)}))}function Tg(n,e){n.xa.delete(e.path.canonicalString());const t=n.Oa.get(e);t!==null&&(Yr(n.remoteStore,t),n.Oa=n.Oa.remove(e),n.Na.delete(t),al(n))}function tu(n,e,t){for(const r of t)r instanceof _g?(n.La.addReference(r.key,e),OE(n,r)):r instanceof yg?(V("SyncEngine","Document no longer in limbo: "+r.key),n.La.removeReference(r.key,e),n.La.containsKey(r.key)||Tg(n,r.key)):U()}function OE(n,e){const t=e.key,r=t.path.canonicalString();n.Oa.get(t)||n.xa.has(r)||(V("SyncEngine","New document in limbo: "+t),n.xa.add(r),al(n))}function al(n){for(;n.xa.size>0&&n.Oa.size<n.maxConcurrentLimboResolutions;){const e=n.xa.values().next().value;n.xa.delete(e);const t=new L(Y.fromString(e)),r=n.qa.next();n.Na.set(r,new EE(t)),n.Oa=n.Oa.insert(t,r),ma(n.remoteStore,new Mt(Ze(oi(t.path)),r,"TargetPurposeLimboResolution",rt.oe))}}async function Yt(n,e,t){const r=M(n),i=[],s=[],o=[];r.Fa.isEmpty()||(r.Fa.forEach(((c,u)=>{o.push(r.Ka(u,e,t).then((h=>{var f;if((h||t)&&r.isPrimaryClient){const p=h?!h.fromCache:(f=t==null?void 0:t.targetChanges.get(u.targetId))===null||f===void 0?void 0:f.current;r.sharedClientState.updateQueryState(u.targetId,p?"current":"not-current")}if(h){i.push(h);const p=Wu.Wi(u.targetId,h);s.push(p)}})))})),await Promise.all(o),r.Ca.d_(i),await(async function(u,h){const f=M(u);try{await f.persistence.runTransaction("notifyLocalViewChanges","readwrite",(p=>b.forEach(h,(g=>b.forEach(g.$i,(T=>f.persistence.referenceDelegate.addReference(p,g.targetId,T))).next((()=>b.forEach(g.Ui,(T=>f.persistence.referenceDelegate.removeReference(p,g.targetId,T)))))))))}catch(p){if(!Pn(p))throw p;V("LocalStore","Failed to update sequence numbers: "+p)}for(const p of h){const g=p.targetId;if(!p.fromCache){const T=f.os.get(g),C=T.snapshotVersion,D=T.withLastLimboFreeSnapshotVersion(C);f.os=f.os.insert(g,D)}}})(r.localStore,s))}async function xE(n,e){const t=M(n);if(!t.currentUser.isEqual(e)){V("SyncEngine","User change. New user:",e.toKey());const r=await ng(t.localStore,e);t.currentUser=e,(function(s,o){s.ka.forEach((c=>{c.forEach((u=>{u.reject(new N(P.CANCELLED,o))}))})),s.ka.clear()})(t,"'waitForPendingWrites' promise is rejected due to a user change."),t.sharedClientState.handleUserChange(e,r.removedBatchIds,r.addedBatchIds),await Yt(t,r.hs)}}function LE(n,e){const t=M(n),r=t.Na.get(e);if(r&&r.va)return H().add(r.key);{let i=H();const s=t.Ma.get(e);if(!s)return i;for(const o of s){const c=t.Fa.get(o);i=i.unionWith(c.view.Va)}return i}}async function ME(n,e){const t=M(n),r=await Ko(t.localStore,e.query,!0),i=e.view.ba(r);return t.isPrimaryClient&&tu(t,e.targetId,i.wa),i}async function FE(n,e){const t=M(n);return og(t.localStore,e).then((r=>Yt(t,r)))}async function UE(n,e,t,r){const i=M(n),s=await(function(c,u){const h=M(c),f=M(h.mutationQueue);return h.persistence.runTransaction("Lookup mutation documents","readonly",(p=>f.Mn(p,u).next((g=>g?h.localDocuments.getDocuments(p,g):b.resolve(null)))))})(i.localStore,e);s!==null?(t==="pending"?await li(i.remoteStore):t==="acknowledged"||t==="rejected"?(ol(i,e,r||null),sl(i,e),(function(c,u){M(M(c).mutationQueue).On(u)})(i.localStore,e)):U(),await Yt(i,s)):V("SyncEngine","Cannot apply mutation batch with id: "+e)}async function BE(n,e){const t=M(n);if(ga(t),cl(t),e===!0&&t.Qa!==!0){const r=t.sharedClientState.getAllActiveQueryTargets(),i=await gf(t,r.toArray());t.Qa=!0,await Zc(t.remoteStore,!0);for(const s of i)ma(t.remoteStore,s)}else if(e===!1&&t.Qa!==!1){const r=[];let i=Promise.resolve();t.Ma.forEach(((s,o)=>{t.sharedClientState.isLocalQueryTarget(o)?r.push(o):i=i.then((()=>(Zr(t,o),Jr(t.localStore,o,!0)))),Yr(t.remoteStore,o)})),await i,await gf(t,r),(function(o){const c=M(o);c.Na.forEach(((u,h)=>{Yr(c.remoteStore,h)})),c.La.pr(),c.Na=new Map,c.Oa=new se(L.comparator)})(t),t.Qa=!1,await Zc(t.remoteStore,!1)}}async function gf(n,e,t){const r=M(n),i=[],s=[];for(const o of e){let c;const u=r.Ma.get(o);if(u&&u.length!==0){c=await Qr(r.localStore,Ze(u[0]));for(const h of u){const f=r.Fa.get(h),p=await ME(r,f);p.snapshot&&s.push(p.snapshot)}}else{const h=await sg(r.localStore,o);c=await Qr(r.localStore,h),await il(r,Eg(h),o,!1,c.resumeToken)}i.push(c)}return r.Ca.d_(s),i}function Eg(n){return hm(n.path,n.collectionGroup,n.orderBy,n.filters,n.limit,"F",n.startAt,n.endAt)}function qE(n){return(function(t){return M(M(t).persistence).Qi()})(M(n).localStore)}async function jE(n,e,t,r){const i=M(n);if(i.Qa)return void V("SyncEngine","Ignoring unexpected query state notification.");const s=i.Ma.get(e);if(s&&s.length>0)switch(t){case"current":case"not-current":{const o=await og(i.localStore,fm(s[0])),c=Vs.createSynthesizedRemoteEventForCurrentChange(e,t==="current",ye.EMPTY_BYTE_STRING);await Yt(i,o,c);break}case"rejected":await Jr(i.localStore,e,!0),Zr(i,e,r);break;default:U()}}async function $E(n,e,t){const r=ga(n);if(r.Qa){for(const i of e){if(r.Ma.has(i)&&r.sharedClientState.isActiveQueryTarget(i)){V("SyncEngine","Adding an already active target "+i);continue}const s=await sg(r.localStore,i),o=await Qr(r.localStore,s);await il(r,Eg(s),o.targetId,!1,o.resumeToken),ma(r.remoteStore,o)}for(const i of t)r.Ma.has(i)&&await Jr(r.localStore,i,!1).then((()=>{Yr(r.remoteStore,i),Zr(r,i)})).catch(Rn)}}function ga(n){const e=M(n);return e.remoteStore.remoteSyncer.applyRemoteEvent=wg.bind(null,e),e.remoteStore.remoteSyncer.getRemoteKeysForTarget=LE.bind(null,e),e.remoteStore.remoteSyncer.rejectListen=kE.bind(null,e),e.Ca.d_=yE.bind(null,e.eventManager),e.Ca.$a=IE.bind(null,e.eventManager),e}function cl(n){const e=M(n);return e.remoteStore.remoteSyncer.applySuccessfulWrite=DE.bind(null,e),e.remoteStore.remoteSyncer.rejectFailedWrite=NE.bind(null,e),e}function zE(n,e,t){const r=M(n);(async function(s,o,c){try{const u=await o.getMetadata();if(await(function(T,C){const D=M(T),k=Ee(C.createTime);return D.persistence.runTransaction("hasNewerBundle","readonly",(j=>D.Gr.getBundleMetadata(j,C.id))).then((j=>!!j&&j.createTime.compareTo(k)>=0))})(s.localStore,u))return await o.close(),c._completeWith((function(T){return{taskState:"Success",documentsLoaded:T.totalDocuments,bytesLoaded:T.totalBytes,totalDocuments:T.totalDocuments,totalBytes:T.totalBytes}})(u)),Promise.resolve(new Set);c._updateProgress(gg(u));const h=new wE(u,s.localStore,o.serializer);let f=await o.Ua();for(;f;){const g=await h.la(f);g&&c._updateProgress(g),f=await o.Ua()}const p=await h.complete();return await Yt(s,p.Ia,void 0),await(function(T,C){const D=M(T);return D.persistence.runTransaction("Save bundle","readwrite",(k=>D.Gr.saveBundleMetadata(k,C)))})(s.localStore,u),c._completeWith(p.progress),Promise.resolve(p.Pa)}catch(u){return Ct("SyncEngine",`Loading bundle failed with ${u}`),c._failWith(u),Promise.resolve(new Set)}})(r,e,t).then((i=>{r.sharedClientState.notifyBundleLoaded(i)}))}class ys{constructor(){this.kind="memory",this.synchronizeTabs=!1}async initialize(e){this.serializer=xs(e.databaseInfo.databaseId),this.sharedClientState=this.Wa(e),this.persistence=this.Ga(e),await this.persistence.start(),this.localStore=this.za(e),this.gcScheduler=this.ja(e,this.localStore),this.indexBackfillerScheduler=this.Ha(e,this.localStore)}ja(e,t){return null}Ha(e,t){return null}za(e){return tg(this.persistence,new eg,e.initialUser,this.serializer)}Ga(e){return new Zm(pa.Zr,this.serializer)}Wa(e){return new cg}async terminate(){var e,t;(e=this.gcScheduler)===null||e===void 0||e.stop(),(t=this.indexBackfillerScheduler)===null||t===void 0||t.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}}ys.provider={build:()=>new ys};class Ag extends ys{constructor(e,t,r){super(),this.Ja=e,this.cacheSizeBytes=t,this.forceOwnership=r,this.kind="persistent",this.synchronizeTabs=!1}async initialize(e){await super.initialize(e),await this.Ja.initialize(this,e),await cl(this.Ja.syncEngine),await li(this.Ja.remoteStore),await this.persistence.yi((()=>(this.gcScheduler&&!this.gcScheduler.started&&this.gcScheduler.start(),this.indexBackfillerScheduler&&!this.indexBackfillerScheduler.started&&this.indexBackfillerScheduler.start(),Promise.resolve())))}za(e){return tg(this.persistence,new eg,e.initialUser,this.serializer)}ja(e,t){const r=this.persistence.referenceDelegate.garbageCollector;return new ST(r,e.asyncQueue,t)}Ha(e,t){const r=new uw(t,this.persistence);return new cw(e.asyncQueue,r)}Ga(e){const t=Ku(e.databaseInfo.databaseId,e.databaseInfo.persistenceKey),r=this.cacheSizeBytes!==void 0?tt.withCacheSize(this.cacheSizeBytes):tt.DEFAULT;return new Gu(this.synchronizeTabs,t,e.clientId,r,e.asyncQueue,ug(),Do(),this.serializer,this.sharedClientState,!!this.forceOwnership)}Wa(e){return new cg}}class GE extends Ag{constructor(e,t){super(e,t,!1),this.Ja=e,this.cacheSizeBytes=t,this.synchronizeTabs=!0}async initialize(e){await super.initialize(e);const t=this.Ja.syncEngine;this.sharedClientState instanceof Tc&&(this.sharedClientState.syncEngine={no:UE.bind(null,t),ro:jE.bind(null,t),io:$E.bind(null,t),Qi:qE.bind(null,t),eo:FE.bind(null,t)},await this.sharedClientState.start()),await this.persistence.yi((async r=>{await BE(this.Ja.syncEngine,r),this.gcScheduler&&(r&&!this.gcScheduler.started?this.gcScheduler.start():r||this.gcScheduler.stop()),this.indexBackfillerScheduler&&(r&&!this.indexBackfillerScheduler.started?this.indexBackfillerScheduler.start():r||this.indexBackfillerScheduler.stop())}))}Wa(e){const t=ug();if(!Tc.D(t))throw new N(P.UNIMPLEMENTED,"IndexedDB persistence is only available on platforms that support LocalStorage.");const r=Ku(e.databaseInfo.databaseId,e.databaseInfo.persistenceKey);return new Tc(t,e.asyncQueue,r,e.clientId,e.initialUser)}}class Is{async initialize(e,t){this.localStore||(this.localStore=e.localStore,this.sharedClientState=e.sharedClientState,this.datastore=this.createDatastore(t),this.remoteStore=this.createRemoteStore(t),this.eventManager=this.createEventManager(t),this.syncEngine=this.createSyncEngine(t,!e.synchronizeTabs),this.sharedClientState.onlineStateHandler=r=>mf(this.syncEngine,r,1),this.remoteStore.remoteSyncer.handleCredentialChange=xE.bind(null,this.syncEngine),await Zc(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(e){return(function(){return new _E})()}createDatastore(e){const t=xs(e.databaseInfo.databaseId),r=(function(s){return new eE(s)})(e.databaseInfo);return(function(s,o,c,u){return new rE(s,o,c,u)})(e.authCredentials,e.appCheckCredentials,r,t)}createRemoteStore(e){return(function(r,i,s,o,c){return new sE(r,i,s,o,c)})(this.localStore,this.datastore,e.asyncQueue,(t=>mf(this.syncEngine,t,0)),(function(){return uf.D()?new uf:new YT})())}createSyncEngine(e,t){return(function(i,s,o,c,u,h,f){const p=new AE(i,s,o,c,u,h);return f&&(p.Qa=!0),p})(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,e.initialUser,e.maxConcurrentLimboResolutions,t)}async terminate(){var e,t;await(async function(i){const s=M(i);V("RemoteStore","RemoteStore shutting down."),s.L_.add(5),await ui(s),s.k_.shutdown(),s.q_.set("Unknown")})(this.remoteStore),(e=this.datastore)===null||e===void 0||e.terminate(),(t=this.eventManager)===null||t===void 0||t.terminate()}}Is.provider={build:()=>new Is};function _f(n,e=10240){let t=0;return{async read(){if(t<n.byteLength){const r={value:n.slice(t,t+e),done:!1};return t+=e,r}return{done:!0}},async cancel(){},releaseLock(){},closed:Promise.resolve()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _a{constructor(e){this.observer=e,this.muted=!1}next(e){this.muted||this.observer.next&&this.Ya(this.observer.next,e)}error(e){this.muted||(this.observer.error?this.Ya(this.observer.error,e):Te("Uncaught Error in snapshot listener:",e.toString()))}Za(){this.muted=!0}Ya(e,t){setTimeout((()=>{this.muted||e(t)}),0)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class KE{constructor(e,t){this.Xa=e,this.serializer=t,this.metadata=new Le,this.buffer=new Uint8Array,this.eu=(function(){return new TextDecoder("utf-8")})(),this.tu().then((r=>{r&&r.ua()?this.metadata.resolve(r.aa.metadata):this.metadata.reject(new Error(`The first element of the bundle is not a metadata, it is
             ${JSON.stringify(r==null?void 0:r.aa)}`))}),(r=>this.metadata.reject(r)))}close(){return this.Xa.cancel()}async getMetadata(){return this.metadata.promise}async Ua(){return await this.getMetadata(),this.tu()}async tu(){const e=await this.nu();if(e===null)return null;const t=this.eu.decode(e),r=Number(t);isNaN(r)&&this.ru(`length string (${t}) is not valid number`);const i=await this.iu(r);return new vE(JSON.parse(i),e.length+r)}su(){return this.buffer.findIndex((e=>e===123))}async nu(){for(;this.su()<0&&!await this.ou(););if(this.buffer.length===0)return null;const e=this.su();e<0&&this.ru("Reached the end of bundle when a length string is expected.");const t=this.buffer.slice(0,e);return this.buffer=this.buffer.slice(e),t}async iu(e){for(;this.buffer.length<e;)await this.ou()&&this.ru("Reached the end of bundle when more is expected.");const t=this.eu.decode(this.buffer.slice(0,e));return this.buffer=this.buffer.slice(e),t}ru(e){throw this.Xa.cancel(),new Error(`Invalid bundle format: ${e}`)}async ou(){const e=await this.Xa.read();if(!e.done){const t=new Uint8Array(this.buffer.length+e.value.length);t.set(this.buffer),t.set(e.value,this.buffer.length),this.buffer=t}return e.done}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class WE{constructor(e){this.datastore=e,this.readVersions=new Map,this.mutations=[],this.committed=!1,this.lastTransactionError=null,this.writtenDocs=new Set}async lookup(e){if(this.ensureCommitNotCalled(),this.mutations.length>0)throw this.lastTransactionError=new N(P.INVALID_ARGUMENT,"Firestore transactions require all reads to be executed before all writes."),this.lastTransactionError;const t=await(async function(i,s){const o=M(i),c={documents:s.map((p=>gs(o.serializer,p)))},u=await o.Lo("BatchGetDocuments",o.serializer.databaseId,Y.emptyPath(),c,s.length),h=new Map;u.forEach((p=>{const g=cT(o.serializer,p);h.set(g.key.toString(),g)}));const f=[];return s.forEach((p=>{const g=h.get(p.toString());q(!!g),f.push(g)})),f})(this.datastore,e);return t.forEach((r=>this.recordVersion(r))),t}set(e,t){this.write(t.toMutation(e,this.precondition(e))),this.writtenDocs.add(e.toString())}update(e,t){try{this.write(t.toMutation(e,this.preconditionForUpdate(e)))}catch(r){this.lastTransactionError=r}this.writtenDocs.add(e.toString())}delete(e){this.write(new ci(e,this.precondition(e))),this.writtenDocs.add(e.toString())}async commit(){if(this.ensureCommitNotCalled(),this.lastTransactionError)throw this.lastTransactionError;const e=this.readVersions;this.mutations.forEach((t=>{e.delete(t.key.toString())})),e.forEach(((t,r)=>{const i=L.fromPath(r);this.mutations.push(new xu(i,this.precondition(i)))})),await(async function(r,i){const s=M(r),o={writes:i.map((c=>_s(s.serializer,c)))};await s.Mo("Commit",s.serializer.databaseId,Y.emptyPath(),o)})(this.datastore,this.mutations),this.committed=!0}recordVersion(e){let t;if(e.isFoundDocument())t=e.version;else{if(!e.isNoDocument())throw U();t=$.min()}const r=this.readVersions.get(e.key.toString());if(r){if(!t.isEqual(r))throw new N(P.ABORTED,"Document version changed between two reads.")}else this.readVersions.set(e.key.toString(),t)}precondition(e){const t=this.readVersions.get(e.toString());return!this.writtenDocs.has(e.toString())&&t?t.isEqual($.min())?he.exists(!1):he.updateTime(t):he.none()}preconditionForUpdate(e){const t=this.readVersions.get(e.toString());if(!this.writtenDocs.has(e.toString())&&t){if(t.isEqual($.min()))throw new N(P.INVALID_ARGUMENT,"Can't update a document that doesn't exist.");return he.updateTime(t)}return he.exists(!0)}write(e){this.ensureCommitNotCalled(),this.mutations.push(e)}ensureCommitNotCalled(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class HE{constructor(e,t,r,i,s){this.asyncQueue=e,this.datastore=t,this.options=r,this.updateFunction=i,this.deferred=s,this._u=r.maxAttempts,this.t_=new Qu(this.asyncQueue,"transaction_retry")}au(){this._u-=1,this.uu()}uu(){this.t_.Go((async()=>{const e=new WE(this.datastore),t=this.cu(e);t&&t.then((r=>{this.asyncQueue.enqueueAndForget((()=>e.commit().then((()=>{this.deferred.resolve(r)})).catch((i=>{this.lu(i)}))))})).catch((r=>{this.lu(r)}))}))}cu(e){try{const t=this.updateFunction(e);return!Ss(t)&&t.catch&&t.then?t:(this.deferred.reject(Error("Transaction callback must return a Promise")),null)}catch(t){return this.deferred.reject(t),null}}lu(e){this._u>0&&this.hu(e)?(this._u-=1,this.asyncQueue.enqueueAndForget((()=>(this.uu(),Promise.resolve())))):this.deferred.reject(e)}hu(e){if(e.name==="FirebaseError"){const t=e.code;return t==="aborted"||t==="failed-precondition"||t==="already-exists"||!Rm(t)}return!1}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class QE{constructor(e,t,r,i,s){this.authCredentials=e,this.appCheckCredentials=t,this.asyncQueue=r,this.databaseInfo=i,this.user=De.UNAUTHENTICATED,this.clientId=qp.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this._uninitializedComponentsProvider=s,this.authCredentials.start(r,(async o=>{V("FirestoreClient","Received user=",o.uid),await this.authCredentialListener(o),this.user=o})),this.appCheckCredentials.start(r,(o=>(V("FirestoreClient","Received new app check token=",o),this.appCheckCredentialListener(o,this.user))))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this.databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(e){this.authCredentialListener=e}setAppCheckTokenChangeListener(e){this.appCheckCredentialListener=e}terminate(){this.asyncQueue.enterRestrictedMode();const e=new Le;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted((async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),e.resolve()}catch(t){const r=di(t,"Failed to shutdown persistence");e.reject(r)}})),e.promise}}async function Ac(n,e){n.asyncQueue.verifyOperationInProgress(),V("FirestoreClient","Initializing OfflineComponentProvider");const t=n.configuration;await e.initialize(t);let r=t.initialUser;n.setCredentialChangeListener((async i=>{r.isEqual(i)||(await ng(e.localStore,i),r=i)})),e.persistence.setDatabaseDeletedListener((()=>n.terminate())),n._offlineComponents=e}async function yf(n,e){n.asyncQueue.verifyOperationInProgress();const t=await ul(n);V("FirestoreClient","Initializing OnlineComponentProvider"),await e.initialize(t,n.configuration),n.setCredentialChangeListener((r=>lf(e.remoteStore,r))),n.setAppCheckTokenChangeListener(((r,i)=>lf(e.remoteStore,i))),n._onlineComponents=e}async function ul(n){if(!n._offlineComponents)if(n._uninitializedComponentsProvider){V("FirestoreClient","Using user provided OfflineComponentProvider");try{await Ac(n,n._uninitializedComponentsProvider._offline)}catch(e){const t=e;if(!(function(i){return i.name==="FirebaseError"?i.code===P.FAILED_PRECONDITION||i.code===P.UNIMPLEMENTED:!(typeof DOMException<"u"&&i instanceof DOMException)||i.code===22||i.code===20||i.code===11})(t))throw t;Ct("Error using user provided cache. Falling back to memory cache: "+t),await Ac(n,new ys)}}else V("FirestoreClient","Using default OfflineComponentProvider"),await Ac(n,new ys);return n._offlineComponents}async function ya(n){return n._onlineComponents||(n._uninitializedComponentsProvider?(V("FirestoreClient","Using user provided OnlineComponentProvider"),await yf(n,n._uninitializedComponentsProvider._online)):(V("FirestoreClient","Using default OnlineComponentProvider"),await yf(n,new Is))),n._onlineComponents}function bg(n){return ul(n).then((e=>e.persistence))}function ll(n){return ul(n).then((e=>e.localStore))}function Rg(n){return ya(n).then((e=>e.remoteStore))}function hl(n){return ya(n).then((e=>e.syncEngine))}function JE(n){return ya(n).then((e=>e.datastore))}async function ei(n){const e=await ya(n),t=e.eventManager;return t.onListen=bE.bind(null,e.syncEngine),t.onUnlisten=PE.bind(null,e.syncEngine),t.onFirstRemoteStoreListen=RE.bind(null,e.syncEngine),t.onLastRemoteStoreUnlisten=SE.bind(null,e.syncEngine),t}function YE(n){return n.asyncQueue.enqueue((async()=>{const e=await bg(n),t=await Rg(n);return e.setNetworkEnabled(!0),(function(i){const s=M(i);return s.L_.delete(0),Ls(s)})(t)}))}function XE(n){return n.asyncQueue.enqueue((async()=>{const e=await bg(n),t=await Rg(n);return e.setNetworkEnabled(!1),(async function(i){const s=M(i);s.L_.add(0),await ui(s),s.q_.set("Offline")})(t)}))}function ZE(n,e){const t=new Le;return n.asyncQueue.enqueueAndForget((async()=>(async function(i,s,o){try{const c=await(function(h,f){const p=M(h);return p.persistence.runTransaction("read document","readonly",(g=>p.localDocuments.getDocument(g,f)))})(i,s);c.isFoundDocument()?o.resolve(c):c.isNoDocument()?o.resolve(null):o.reject(new N(P.UNAVAILABLE,"Failed to get document from cache. (However, this document may exist on the server. Run again without setting 'source' in the GetOptions to attempt to retrieve the document from the server.)"))}catch(c){const u=di(c,`Failed to get document '${s} from cache`);o.reject(u)}})(await ll(n),e,t))),t.promise}function Pg(n,e,t={}){const r=new Le;return n.asyncQueue.enqueueAndForget((async()=>(function(s,o,c,u,h){const f=new _a({next:g=>{f.Za(),o.enqueueAndForget((()=>tl(s,p)));const T=g.docs.has(c);!T&&g.fromCache?h.reject(new N(P.UNAVAILABLE,"Failed to get document because the client is offline.")):T&&g.fromCache&&u&&u.source==="server"?h.reject(new N(P.UNAVAILABLE,'Failed to get document from server. (However, this document does exist in the local cache. Run again without setting source to "server" to retrieve the cached document.)')):h.resolve(g)},error:g=>h.reject(g)}),p=new rl(oi(c.path),f,{includeMetadataChanges:!0,_a:!0});return el(s,p)})(await ei(n),n.asyncQueue,e,t,r))),r.promise}function eA(n,e){const t=new Le;return n.asyncQueue.enqueueAndForget((async()=>(async function(i,s,o){try{const c=await Ko(i,s,!0),u=new Ig(s,c.Ts),h=u.ma(c.documents),f=u.applyChanges(h,!1);o.resolve(f.snapshot)}catch(c){const u=di(c,`Failed to execute query '${s} against cache`);o.reject(u)}})(await ll(n),e,t))),t.promise}function Sg(n,e,t={}){const r=new Le;return n.asyncQueue.enqueueAndForget((async()=>(function(s,o,c,u,h){const f=new _a({next:g=>{f.Za(),o.enqueueAndForget((()=>tl(s,p))),g.fromCache&&u.source==="server"?h.reject(new N(P.UNAVAILABLE,'Failed to get documents from server. (However, these documents may exist in the local cache. Run again without setting source to "server" to retrieve the cached documents.)')):h.resolve(g)},error:g=>h.reject(g)}),p=new rl(c,f,{includeMetadataChanges:!0,_a:!0});return el(s,p)})(await ei(n),n.asyncQueue,e,t,r))),r.promise}function tA(n,e){const t=new _a(e);return n.asyncQueue.enqueueAndForget((async()=>(function(i,s){M(i).Y_.add(s),s.next()})(await ei(n),t))),()=>{t.Za(),n.asyncQueue.enqueueAndForget((async()=>(function(i,s){M(i).Y_.delete(s)})(await ei(n),t)))}}function nA(n,e,t,r){const i=(function(o,c){let u;return u=typeof o=="string"?Sm().encode(o):o,(function(f,p){return new KE(f,p)})((function(f,p){if(f instanceof Uint8Array)return _f(f,p);if(f instanceof ArrayBuffer)return _f(new Uint8Array(f),p);if(f instanceof ReadableStream)return f.getReader();throw new Error("Source of `toByteStreamReader` has to be a ArrayBuffer or ReadableStream")})(u),c)})(t,xs(e));n.asyncQueue.enqueueAndForget((async()=>{zE(await hl(n),i,r)}))}function rA(n,e){return n.asyncQueue.enqueue((async()=>(function(r,i){const s=M(r);return s.persistence.runTransaction("Get named query","readonly",(o=>s.Gr.getNamedQuery(o,i)))})(await ll(n),e)))}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Cg(n){const e={};return n.timeoutSeconds!==void 0&&(e.timeoutSeconds=n.timeoutSeconds),e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const If=new Map;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function dl(n,e,t){if(!t)throw new N(P.INVALID_ARGUMENT,`Function ${n}() cannot be called with an empty ${e}.`)}function kg(n,e,t,r){if(e===!0&&r===!0)throw new N(P.INVALID_ARGUMENT,`${n} and ${t} cannot be used together.`)}function vf(n){if(!L.isDocumentKey(n))throw new N(P.INVALID_ARGUMENT,`Invalid document reference. Document references must have an even number of segments, but ${n} has ${n.length}.`)}function wf(n){if(L.isDocumentKey(n))throw new N(P.INVALID_ARGUMENT,`Invalid collection reference. Collection references must have an odd number of segments, but ${n} has ${n.length}.`)}function Ia(n){if(n===void 0)return"undefined";if(n===null)return"null";if(typeof n=="string")return n.length>20&&(n=`${n.substring(0,20)}...`),JSON.stringify(n);if(typeof n=="number"||typeof n=="boolean")return""+n;if(typeof n=="object"){if(n instanceof Array)return"an array";{const e=(function(r){return r.constructor?r.constructor.name:null})(n);return e?`a custom ${e} object`:"an object"}}return typeof n=="function"?"a function":U()}function te(n,e){if("_delegate"in n&&(n=n._delegate),!(n instanceof e)){if(e.name===n.constructor.name)throw new N(P.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const t=Ia(n);throw new N(P.INVALID_ARGUMENT,`Expected type '${e.name}', but it was: ${t}`)}}return n}function Dg(n,e){if(e<=0)throw new N(P.INVALID_ARGUMENT,`Function ${n}() requires a positive number, but it was: ${e}.`)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Tf{constructor(e){var t,r;if(e.host===void 0){if(e.ssl!==void 0)throw new N(P.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host="firestore.googleapis.com",this.ssl=!0}else this.host=e.host,this.ssl=(t=e.ssl)===null||t===void 0||t;if(this.credentials=e.credentials,this.ignoreUndefinedProperties=!!e.ignoreUndefinedProperties,this.localCache=e.localCache,e.cacheSizeBytes===void 0)this.cacheSizeBytes=41943040;else{if(e.cacheSizeBytes!==-1&&e.cacheSizeBytes<1048576)throw new N(P.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=e.cacheSizeBytes}kg("experimentalForceLongPolling",e.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",e.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!e.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:e.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!e.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=Cg((r=e.experimentalLongPollingOptions)!==null&&r!==void 0?r:{}),(function(s){if(s.timeoutSeconds!==void 0){if(isNaN(s.timeoutSeconds))throw new N(P.INVALID_ARGUMENT,`invalid long polling timeout: ${s.timeoutSeconds} (must not be NaN)`);if(s.timeoutSeconds<5)throw new N(P.INVALID_ARGUMENT,`invalid long polling timeout: ${s.timeoutSeconds} (minimum allowed value is 5)`);if(s.timeoutSeconds>30)throw new N(P.INVALID_ARGUMENT,`invalid long polling timeout: ${s.timeoutSeconds} (maximum allowed value is 30)`)}})(this.experimentalLongPollingOptions),this.useFetchStreams=!!e.useFetchStreams}isEqual(e){return this.host===e.host&&this.ssl===e.ssl&&this.credentials===e.credentials&&this.cacheSizeBytes===e.cacheSizeBytes&&this.experimentalForceLongPolling===e.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===e.experimentalAutoDetectLongPolling&&(function(r,i){return r.timeoutSeconds===i.timeoutSeconds})(this.experimentalLongPollingOptions,e.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===e.ignoreUndefinedProperties&&this.useFetchStreams===e.useFetchStreams}}class Ms{constructor(e,t,r,i){this._authCredentials=e,this._appCheckCredentials=t,this._databaseId=r,this._app=i,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new Tf({}),this._settingsFrozen=!1,this._terminateTask="notTerminated"}get app(){if(!this._app)throw new N(P.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(e){if(this._settingsFrozen)throw new N(P.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new Tf(e),e.credentials!==void 0&&(this._authCredentials=(function(r){if(!r)return new Yv;switch(r.type){case"firstParty":return new tw(r.sessionIndex||"0",r.iamToken||null,r.authTokenFactory||null);case"provider":return r.client;default:throw new N(P.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}})(e.credentials))}_getSettings(){return this._settings}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return(function(t){const r=If.get(t);r&&(V("ComponentProvider","Removing Datastore"),If.delete(t),r.terminate())})(this),Promise.resolve()}}function iA(n,e,t,r={}){var i;const s=(n=te(n,Ms))._getSettings(),o=`${e}:${t}`;if(s.host!=="firestore.googleapis.com"&&s.host!==o&&Ct("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used."),n._setSettings(Object.assign(Object.assign({},s),{host:o,ssl:!1})),r.mockUserToken){let c,u;if(typeof r.mockUserToken=="string")c=r.mockUserToken,u=De.MOCK_USER;else{c=mp(r.mockUserToken,(i=n._app)===null||i===void 0?void 0:i.options.projectId);const h=r.mockUserToken.sub||r.mockUserToken.user_id;if(!h)throw new N(P.INVALID_ARGUMENT,"mockUserToken must contain 'sub' or 'user_id' field!");u=new De(h)}n._authCredentials=new Xv(new Bp(c,u))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let et=class Ng{constructor(e,t,r){this.converter=t,this._query=r,this.type="query",this.firestore=e}withConverter(e){return new Ng(this.firestore,e,this._query)}},fe=class Vg{constructor(e,t,r){this.converter=t,this._key=r,this.type="document",this.firestore=e}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new pn(this.firestore,this.converter,this._key.path.popLast())}withConverter(e){return new Vg(this.firestore,e,this._key)}},pn=class Og extends et{constructor(e,t,r){super(e,t,oi(r)),this._path=r,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const e=this._path.popLast();return e.isEmpty()?null:new fe(this.firestore,null,new L(e))}withConverter(e){return new Og(this.firestore,e,this._path)}};function xg(n,e,...t){if(n=B(n),dl("collection","path",e),n instanceof Ms){const r=Y.fromString(e,...t);return wf(r),new pn(n,null,r)}{if(!(n instanceof fe||n instanceof pn))throw new N(P.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(Y.fromString(e,...t));return wf(r),new pn(n.firestore,null,r)}}function sA(n,e){if(n=te(n,Ms),dl("collectionGroup","collection id",e),e.indexOf("/")>=0)throw new N(P.INVALID_ARGUMENT,`Invalid collection ID '${e}' passed to function collectionGroup(). Collection IDs must not contain '/'.`);return new et(n,null,(function(r){return new Qt(Y.emptyPath(),r)})(e))}function Jo(n,e,...t){if(n=B(n),arguments.length===1&&(e=qp.newId()),dl("doc","path",e),n instanceof Ms){const r=Y.fromString(e,...t);return vf(r),new fe(n,null,new L(r))}{if(!(n instanceof fe||n instanceof pn))throw new N(P.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(Y.fromString(e,...t));return vf(r),new fe(n.firestore,n instanceof pn?n.converter:null,new L(r))}}function Lg(n,e){return n=B(n),e=B(e),(n instanceof fe||n instanceof pn)&&(e instanceof fe||e instanceof pn)&&n.firestore===e.firestore&&n.path===e.path&&n.converter===e.converter}function Mg(n,e){return n=B(n),e=B(e),n instanceof et&&e instanceof et&&n.firestore===e.firestore&&ks(n._query,e._query)&&n.converter===e.converter}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ef{constructor(e=Promise.resolve()){this.Pu=[],this.Iu=!1,this.Tu=[],this.Eu=null,this.du=!1,this.Au=!1,this.Ru=[],this.t_=new Qu(this,"async_queue_retry"),this.Vu=()=>{const r=Do();r&&V("AsyncQueue","Visibility state changed to "+r.visibilityState),this.t_.jo()},this.mu=e;const t=Do();t&&typeof t.addEventListener=="function"&&t.addEventListener("visibilitychange",this.Vu)}get isShuttingDown(){return this.Iu}enqueueAndForget(e){this.enqueue(e)}enqueueAndForgetEvenWhileRestricted(e){this.fu(),this.gu(e)}enterRestrictedMode(e){if(!this.Iu){this.Iu=!0,this.Au=e||!1;const t=Do();t&&typeof t.removeEventListener=="function"&&t.removeEventListener("visibilitychange",this.Vu)}}enqueue(e){if(this.fu(),this.Iu)return new Promise((()=>{}));const t=new Le;return this.gu((()=>this.Iu&&this.Au?Promise.resolve():(e().then(t.resolve,t.reject),t.promise))).then((()=>t.promise))}enqueueRetryable(e){this.enqueueAndForget((()=>(this.Pu.push(e),this.pu())))}async pu(){if(this.Pu.length!==0){try{await this.Pu[0](),this.Pu.shift(),this.t_.reset()}catch(e){if(!Pn(e))throw e;V("AsyncQueue","Operation failed with retryable error: "+e)}this.Pu.length>0&&this.t_.Go((()=>this.pu()))}}gu(e){const t=this.mu.then((()=>(this.du=!0,e().catch((r=>{this.Eu=r,this.du=!1;const i=(function(o){let c=o.message||"";return o.stack&&(c=o.stack.includes(o.message)?o.stack:o.message+`
`+o.stack),c})(r);throw Te("INTERNAL UNHANDLED ERROR: ",i),r})).then((r=>(this.du=!1,r))))));return this.mu=t,t}enqueueAfterDelay(e,t,r){this.fu(),this.Ru.indexOf(e)>-1&&(t=0);const i=Zu.createAndSchedule(this,e,t,r,(s=>this.yu(s)));return this.Tu.push(i),i}fu(){this.Eu&&U()}verifyOperationInProgress(){}async wu(){let e;do e=this.mu,await e;while(e!==this.mu)}Su(e){for(const t of this.Tu)if(t.timerId===e)return!0;return!1}bu(e){return this.wu().then((()=>{this.Tu.sort(((t,r)=>t.targetTimeMs-r.targetTimeMs));for(const t of this.Tu)if(t.skipDelay(),e!=="all"&&t.timerId===e)break;return this.wu()}))}Du(e){this.Ru.push(e)}yu(e){const t=this.Tu.indexOf(e);this.Tu.splice(t,1)}}function nu(n){return(function(t,r){if(typeof t!="object"||t===null)return!1;const i=t;for(const s of r)if(s in i&&typeof i[s]=="function")return!0;return!1})(n,["next","error","complete"])}class oA{constructor(){this._progressObserver={},this._taskCompletionResolver=new Le,this._lastProgress={taskState:"Running",totalBytes:0,totalDocuments:0,bytesLoaded:0,documentsLoaded:0}}onProgress(e,t,r){this._progressObserver={next:e,error:t,complete:r}}catch(e){return this._taskCompletionResolver.promise.catch(e)}then(e,t){return this._taskCompletionResolver.promise.then(e,t)}_completeWith(e){this._updateProgress(e),this._progressObserver.complete&&this._progressObserver.complete(),this._taskCompletionResolver.resolve(e)}_failWith(e){this._lastProgress.taskState="Error",this._progressObserver.next&&this._progressObserver.next(this._lastProgress),this._progressObserver.error&&this._progressObserver.error(e),this._taskCompletionResolver.reject(e)}_updateProgress(e){this._lastProgress=e,this._progressObserver.next&&this._progressObserver.next(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const aA=-1;let Ae=class extends Ms{constructor(e,t,r,i){super(e,t,r,i),this.type="firestore",this._queue=new Ef,this._persistenceKey=(i==null?void 0:i.name)||"[DEFAULT]"}async _terminate(){if(this._firestoreClient){const e=this._firestoreClient.terminate();this._queue=new Ef(e),this._firestoreClient=void 0,await e}}};function ze(n){if(n._terminated)throw new N(P.FAILED_PRECONDITION,"The client has already been terminated.");return n._firestoreClient||Fg(n),n._firestoreClient}function Fg(n){var e,t,r;const i=n._freezeSettings(),s=(function(c,u,h,f){return new Dw(c,u,h,f.host,f.ssl,f.experimentalForceLongPolling,f.experimentalAutoDetectLongPolling,Cg(f.experimentalLongPollingOptions),f.useFetchStreams)})(n._databaseId,((e=n._app)===null||e===void 0?void 0:e.options.appId)||"",n._persistenceKey,i);n._componentsProvider||!((t=i.localCache)===null||t===void 0)&&t._offlineComponentProvider&&(!((r=i.localCache)===null||r===void 0)&&r._onlineComponentProvider)&&(n._componentsProvider={_offline:i.localCache._offlineComponentProvider,_online:i.localCache._onlineComponentProvider}),n._firestoreClient=new QE(n._authCredentials,n._appCheckCredentials,n._queue,s,n._componentsProvider&&(function(c){const u=c==null?void 0:c._online.build();return{_offline:c==null?void 0:c._offline.build(u),_online:u}})(n._componentsProvider))}function cA(n,e){Ct("enableIndexedDbPersistence() will be deprecated in the future, you can use `FirestoreSettings.cache` instead.");const t=n._freezeSettings();return Ug(n,Is.provider,{build:r=>new Ag(r,t.cacheSizeBytes,e==null?void 0:e.forceOwnership)}),Promise.resolve()}async function uA(n){Ct("enableMultiTabIndexedDbPersistence() will be deprecated in the future, you can use `FirestoreSettings.cache` instead.");const e=n._freezeSettings();Ug(n,Is.provider,{build:t=>new GE(t,e.cacheSizeBytes)})}function Ug(n,e,t){if((n=te(n,Ae))._firestoreClient||n._terminated)throw new N(P.FAILED_PRECONDITION,"Firestore has already been started and persistence can no longer be enabled. You can only enable persistence before calling any other methods on a Firestore object.");if(n._componentsProvider||n._getSettings().localCache)throw new N(P.FAILED_PRECONDITION,"SDK cache is already specified.");n._componentsProvider={_online:e,_offline:t},Fg(n)}function lA(n){if(n._initialized&&!n._terminated)throw new N(P.FAILED_PRECONDITION,"Persistence can only be cleared before a Firestore instance is initialized or after it is terminated.");const e=new Le;return n._queue.enqueueAndForgetEvenWhileRestricted((async()=>{try{await(async function(r){if(!bt.D())return Promise.resolve();const i=r+"main";await bt.delete(i)})(Ku(n._databaseId,n._persistenceKey)),e.resolve()}catch(t){e.reject(t)}})),e.promise}function hA(n){return(function(t){const r=new Le;return t.asyncQueue.enqueueAndForget((async()=>VE(await hl(t),r))),r.promise})(ze(n=te(n,Ae)))}function dA(n){return YE(ze(n=te(n,Ae)))}function fA(n){return XE(ze(n=te(n,Ae)))}function pA(n,e){const t=ze(n=te(n,Ae)),r=new oA;return nA(t,n._databaseId,e,r),r}function mA(n,e){return rA(ze(n=te(n,Ae)),e).then((t=>t?new et(n,null,t.query):null))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Dt{constructor(e){this._byteString=e}static fromBase64String(e){try{return new Dt(ye.fromBase64String(e))}catch(t){throw new N(P.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+t)}}static fromUint8Array(e){return new Dt(ye.fromUint8Array(e))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(e){return this._byteString.isEqual(e._byteString)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let En=class{constructor(...e){for(let t=0;t<e.length;++t)if(e[t].length===0)throw new N(P.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new le(e)}isEqual(e){return this._internalPath.isEqual(e._internalPath)}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let dr=class{constructor(e){this._methodName=e}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class va{constructor(e,t){if(!isFinite(e)||e<-90||e>90)throw new N(P.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+e);if(!isFinite(t)||t<-180||t>180)throw new N(P.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+t);this._lat=e,this._long=t}get latitude(){return this._lat}get longitude(){return this._long}isEqual(e){return this._lat===e._lat&&this._long===e._long}toJSON(){return{latitude:this._lat,longitude:this._long}}_compareTo(e){return W(this._lat,e._lat)||W(this._long,e._long)}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class fl{constructor(e){this._values=(e||[]).map((t=>t))}toArray(){return this._values.map((e=>e))}isEqual(e){return(function(r,i){if(r.length!==i.length)return!1;for(let s=0;s<r.length;++s)if(r[s]!==i[s])return!1;return!0})(this._values,e._values)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gA=/^__.*__$/;class _A{constructor(e,t,r){this.data=e,this.fieldMask=t,this.fieldTransforms=r}toMutation(e,t){return this.fieldMask!==null?new Jt(e,this.data,this.fieldMask,t,this.fieldTransforms):new ai(e,this.data,t,this.fieldTransforms)}}class Bg{constructor(e,t,r){this.data=e,this.fieldMask=t,this.fieldTransforms=r}toMutation(e,t){return new Jt(e,this.data,this.fieldMask,t,this.fieldTransforms)}}function qg(n){switch(n){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw U()}}class wa{constructor(e,t,r,i,s,o){this.settings=e,this.databaseId=t,this.serializer=r,this.ignoreUndefinedProperties=i,s===void 0&&this.vu(),this.fieldTransforms=s||[],this.fieldMask=o||[]}get path(){return this.settings.path}get Cu(){return this.settings.Cu}Fu(e){return new wa(Object.assign(Object.assign({},this.settings),e),this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}Mu(e){var t;const r=(t=this.path)===null||t===void 0?void 0:t.child(e),i=this.Fu({path:r,xu:!1});return i.Ou(e),i}Nu(e){var t;const r=(t=this.path)===null||t===void 0?void 0:t.child(e),i=this.Fu({path:r,xu:!1});return i.vu(),i}Lu(e){return this.Fu({path:void 0,xu:!0})}Bu(e){return Yo(e,this.settings.methodName,this.settings.ku||!1,this.path,this.settings.qu)}contains(e){return this.fieldMask.find((t=>e.isPrefixOf(t)))!==void 0||this.fieldTransforms.find((t=>e.isPrefixOf(t.field)))!==void 0}vu(){if(this.path)for(let e=0;e<this.path.length;e++)this.Ou(this.path.get(e))}Ou(e){if(e.length===0)throw this.Bu("Document fields must not be empty");if(qg(this.Cu)&&gA.test(e))throw this.Bu('Document fields cannot begin and end with "__"')}}class yA{constructor(e,t,r){this.databaseId=e,this.ignoreUndefinedProperties=t,this.serializer=r||xs(e)}Qu(e,t,r,i=!1){return new wa({Cu:e,methodName:t,qu:r,path:le.emptyPath(),xu:!1,ku:i},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}}function fr(n){const e=n._freezeSettings(),t=xs(n._databaseId);return new yA(n._databaseId,!!e.ignoreUndefinedProperties,t)}function Ta(n,e,t,r,i,s={}){const o=n.Qu(s.merge||s.mergeFields?2:0,e,t,i);vl("Data must be an object, but it was:",o,r);const c=zg(r,o);let u,h;if(s.merge)u=new it(o.fieldMask),h=o.fieldTransforms;else if(s.mergeFields){const f=[];for(const p of s.mergeFields){const g=ru(e,p,t);if(!o.contains(g))throw new N(P.INVALID_ARGUMENT,`Field '${g}' is specified in your field mask but missing from your input data.`);Kg(f,g)||f.push(g)}u=new it(f),h=o.fieldTransforms.filter((p=>u.covers(p.field)))}else u=null,h=o.fieldTransforms;return new _A(new xe(c),u,h)}class Fs extends dr{_toFieldTransform(e){if(e.Cu!==2)throw e.Cu===1?e.Bu(`${this._methodName}() can only appear at the top level of your update data`):e.Bu(`${this._methodName}() cannot be used with set() unless you pass {merge:true}`);return e.fieldMask.push(e.path),null}isEqual(e){return e instanceof Fs}}function jg(n,e,t){return new wa({Cu:3,qu:e.settings.qu,methodName:n._methodName,xu:t},e.databaseId,e.serializer,e.ignoreUndefinedProperties)}class pl extends dr{_toFieldTransform(e){return new Ns(e.path,new Kr)}isEqual(e){return e instanceof pl}}class ml extends dr{constructor(e,t){super(e),this.Ku=t}_toFieldTransform(e){const t=jg(this,e,!0),r=this.Ku.map((s=>pr(s,t))),i=new er(r);return new Ns(e.path,i)}isEqual(e){return e instanceof ml&&os(this.Ku,e.Ku)}}class gl extends dr{constructor(e,t){super(e),this.Ku=t}_toFieldTransform(e){const t=jg(this,e,!0),r=this.Ku.map((s=>pr(s,t))),i=new tr(r);return new Ns(e.path,i)}isEqual(e){return e instanceof gl&&os(this.Ku,e.Ku)}}class _l extends dr{constructor(e,t){super(e),this.$u=t}_toFieldTransform(e){const t=new Wr(e.serializer,Im(e.serializer,this.$u));return new Ns(e.path,t)}isEqual(e){return e instanceof _l&&this.$u===e.$u}}function yl(n,e,t,r){const i=n.Qu(1,e,t);vl("Data must be an object, but it was:",i,r);const s=[],o=xe.empty();hr(r,((u,h)=>{const f=wl(e,u,t);h=B(h);const p=i.Nu(f);if(h instanceof Fs)s.push(f);else{const g=pr(h,p);g!=null&&(s.push(f),o.set(f,g))}}));const c=new it(s);return new Bg(o,c,i.fieldTransforms)}function Il(n,e,t,r,i,s){const o=n.Qu(1,e,t),c=[ru(e,r,t)],u=[i];if(s.length%2!=0)throw new N(P.INVALID_ARGUMENT,`Function ${e}() needs to be called with an even number of arguments that alternate between field names and values.`);for(let g=0;g<s.length;g+=2)c.push(ru(e,s[g])),u.push(s[g+1]);const h=[],f=xe.empty();for(let g=c.length-1;g>=0;--g)if(!Kg(h,c[g])){const T=c[g];let C=u[g];C=B(C);const D=o.Nu(T);if(C instanceof Fs)h.push(T);else{const k=pr(C,D);k!=null&&(h.push(T),f.set(T,k))}}const p=new it(h);return new Bg(f,p,o.fieldTransforms)}function $g(n,e,t,r=!1){return pr(t,n.Qu(r?4:3,e))}function pr(n,e){if(Gg(n=B(n)))return vl("Unsupported field value:",e,n),zg(n,e);if(n instanceof dr)return(function(r,i){if(!qg(i.Cu))throw i.Bu(`${r._methodName}() can only be used with update() and set()`);if(!i.path)throw i.Bu(`${r._methodName}() is not currently supported inside arrays`);const s=r._toFieldTransform(i);s&&i.fieldTransforms.push(s)})(n,e),null;if(n===void 0&&e.ignoreUndefinedProperties)return null;if(e.path&&e.fieldMask.push(e.path),n instanceof Array){if(e.settings.xu&&e.Cu!==4)throw e.Bu("Nested arrays are not supported");return(function(r,i){const s=[];let o=0;for(const c of r){let u=pr(c,i.Lu(o));u==null&&(u={nullValue:"NULL_VALUE"}),s.push(u),o++}return{arrayValue:{values:s}}})(n,e)}return(function(r,i){if((r=B(r))===null)return{nullValue:"NULL_VALUE"};if(typeof r=="number")return Im(i.serializer,r);if(typeof r=="boolean")return{booleanValue:r};if(typeof r=="string")return{stringValue:r};if(r instanceof Date){const s=de.fromDate(r);return{timestampValue:Hr(i.serializer,s)}}if(r instanceof de){const s=new de(r.seconds,1e3*Math.floor(r.nanoseconds/1e3));return{timestampValue:Hr(i.serializer,s)}}if(r instanceof va)return{geoPointValue:{latitude:r.latitude,longitude:r.longitude}};if(r instanceof Dt)return{bytesValue:Dm(i.serializer,r._byteString)};if(r instanceof fe){const s=i.databaseId,o=r.firestore._databaseId;if(!o.isEqual(s))throw i.Bu(`Document reference is for database ${o.projectId}/${o.database} but should be for database ${s.projectId}/${s.database}`);return{referenceValue:Bu(r.firestore._databaseId||i.databaseId,r._key.path)}}if(r instanceof fl)return(function(o,c){return{mapValue:{fields:{__type__:{stringValue:"__vector__"},value:{arrayValue:{values:o.toArray().map((u=>{if(typeof u!="number")throw c.Bu("VectorValues must only contain numeric values.");return Ou(c.serializer,u)}))}}}}}})(r,i);throw i.Bu(`Unsupported field value: ${Ia(r)}`)})(n,e)}function zg(n,e){const t={};return Zp(n)?e.path&&e.path.length>0&&e.fieldMask.push(e.path):hr(n,((r,i)=>{const s=pr(i,e.Mu(r));s!=null&&(t[r]=s)})),{mapValue:{fields:t}}}function Gg(n){return!(typeof n!="object"||n===null||n instanceof Array||n instanceof Date||n instanceof de||n instanceof va||n instanceof Dt||n instanceof fe||n instanceof dr||n instanceof fl)}function vl(n,e,t){if(!Gg(t)||!(function(i){return typeof i=="object"&&i!==null&&(Object.getPrototypeOf(i)===Object.prototype||Object.getPrototypeOf(i)===null)})(t)){const r=Ia(t);throw r==="an object"?e.Bu(n+" a custom object"):e.Bu(n+" "+r)}}function ru(n,e,t){if((e=B(e))instanceof En)return e._internalPath;if(typeof e=="string")return wl(n,e);throw Yo("Field path arguments must be of type string or ",n,!1,void 0,t)}const IA=new RegExp("[~\\*/\\[\\]]");function wl(n,e,t){if(e.search(IA)>=0)throw Yo(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`,n,!1,void 0,t);try{return new En(...e.split("."))._internalPath}catch{throw Yo(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,n,!1,void 0,t)}}function Yo(n,e,t,r,i){const s=r&&!r.isEmpty(),o=i!==void 0;let c=`Function ${e}() called with invalid data`;t&&(c+=" (via `toFirestore()`)"),c+=". ";let u="";return(s||o)&&(u+=" (found",s&&(u+=` in field ${r}`),o&&(u+=` in document ${i}`),u+=")"),new N(P.INVALID_ARGUMENT,c+n+u)}function Kg(n,e){return n.some((t=>t.isEqual(e)))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vs{constructor(e,t,r,i,s){this._firestore=e,this._userDataWriter=t,this._key=r,this._document=i,this._converter=s}get id(){return this._key.path.lastSegment()}get ref(){return new fe(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const e=new vA(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(e)}return this._userDataWriter.convertValue(this._document.data.value)}}get(e){if(this._document){const t=this._document.data.field(Ea("DocumentSnapshot.get",e));if(t!==null)return this._userDataWriter.convertValue(t)}}}class vA extends vs{data(){return super.data()}}function Ea(n,e){return typeof e=="string"?wl(n,e):e instanceof En?e._internalPath:e._delegate._internalPath}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Wg(n){if(n.limitType==="L"&&n.explicitOrderBy.length===0)throw new N(P.UNIMPLEMENTED,"limitToLast() queries require specifying at least one orderBy() clause")}class Tl{}class Us extends Tl{}function cn(n,e,...t){let r=[];e instanceof Tl&&r.push(e),r=r.concat(t),(function(s){const o=s.filter((u=>u instanceof El)).length,c=s.filter((u=>u instanceof Aa)).length;if(o>1||o>0&&c>0)throw new N(P.INVALID_ARGUMENT,"InvalidQuery. When using composite filters, you cannot use more than one filter at the top level. Consider nesting the multiple filters within an `and(...)` statement. For example: change `query(query, where(...), or(...))` to `query(query, and(where(...), or(...)))`.")})(r);for(const i of r)n=i._apply(n);return n}class Aa extends Us{constructor(e,t,r){super(),this._field=e,this._op=t,this._value=r,this.type="where"}static _create(e,t,r){return new Aa(e,t,r)}_apply(e){const t=this._parse(e);return Qg(e._query,t),new et(e.firestore,e.converter,zc(e._query,t))}_parse(e){const t=fr(e.firestore);return(function(s,o,c,u,h,f,p){let g;if(h.isKeyField()){if(f==="array-contains"||f==="array-contains-any")throw new N(P.INVALID_ARGUMENT,`Invalid Query. You can't perform '${f}' queries on documentId().`);if(f==="in"||f==="not-in"){bf(p,f);const T=[];for(const C of p)T.push(Af(u,s,C));g={arrayValue:{values:T}}}else g=Af(u,s,p)}else f!=="in"&&f!=="not-in"&&f!=="array-contains-any"||bf(p,f),g=$g(c,o,p,f==="in"||f==="not-in");return X.create(h,f,g)})(e._query,"where",t,e.firestore._databaseId,this._field,this._op,this._value)}}function wA(n,e,t){const r=e,i=Ea("where",n);return Aa._create(i,r,t)}class El extends Tl{constructor(e,t){super(),this.type=e,this._queryConstraints=t}static _create(e,t){return new El(e,t)}_parse(e){const t=this._queryConstraints.map((r=>r._parse(e))).filter((r=>r.getFilters().length>0));return t.length===1?t[0]:ne.create(t,this._getOperator())}_apply(e){const t=this._parse(e);return t.getFilters().length===0?e:((function(i,s){let o=i;const c=s.getFlattenedFilters();for(const u of c)Qg(o,u),o=zc(o,u)})(e._query,t),new et(e.firestore,e.converter,zc(e._query,t)))}_getQueryConstraints(){return this._queryConstraints}_getOperator(){return this.type==="and"?"and":"or"}}class Al extends Us{constructor(e,t){super(),this._field=e,this._direction=t,this.type="orderBy"}static _create(e,t){return new Al(e,t)}_apply(e){const t=(function(i,s,o){if(i.startAt!==null)throw new N(P.INVALID_ARGUMENT,"Invalid query. You must not call startAt() or startAfter() before calling orderBy().");if(i.endAt!==null)throw new N(P.INVALID_ARGUMENT,"Invalid query. You must not call endAt() or endBefore() before calling orderBy().");return new ms(s,o)})(e._query,this._field,this._direction);return new et(e.firestore,e.converter,(function(i,s){const o=i.explicitOrderBy.concat([s]);return new Qt(i.path,i.collectionGroup,o,i.filters.slice(),i.limit,i.limitType,i.startAt,i.endAt)})(e._query,t))}}function TA(n,e="asc"){const t=e,r=Ea("orderBy",n);return Al._create(r,t)}class ba extends Us{constructor(e,t,r){super(),this.type=e,this._limit=t,this._limitType=r}static _create(e,t,r){return new ba(e,t,r)}_apply(e){return new et(e.firestore,e.converter,jo(e._query,this._limit,this._limitType))}}function EA(n){return Dg("limit",n),ba._create("limit",n,"F")}function AA(n){return Dg("limitToLast",n),ba._create("limitToLast",n,"L")}class Ra extends Us{constructor(e,t,r){super(),this.type=e,this._docOrFields=t,this._inclusive=r}static _create(e,t,r){return new Ra(e,t,r)}_apply(e){const t=Hg(e,this.type,this._docOrFields,this._inclusive);return new et(e.firestore,e.converter,(function(i,s){return new Qt(i.path,i.collectionGroup,i.explicitOrderBy.slice(),i.filters.slice(),i.limit,i.limitType,s,i.endAt)})(e._query,t))}}function bA(...n){return Ra._create("startAt",n,!0)}function RA(...n){return Ra._create("startAfter",n,!1)}class Pa extends Us{constructor(e,t,r){super(),this.type=e,this._docOrFields=t,this._inclusive=r}static _create(e,t,r){return new Pa(e,t,r)}_apply(e){const t=Hg(e,this.type,this._docOrFields,this._inclusive);return new et(e.firestore,e.converter,(function(i,s){return new Qt(i.path,i.collectionGroup,i.explicitOrderBy.slice(),i.filters.slice(),i.limit,i.limitType,i.startAt,s)})(e._query,t))}}function PA(...n){return Pa._create("endBefore",n,!1)}function SA(...n){return Pa._create("endAt",n,!0)}function Hg(n,e,t,r){if(t[0]=B(t[0]),t[0]instanceof vs)return(function(s,o,c,u,h){if(!u)throw new N(P.NOT_FOUND,`Can't use a DocumentSnapshot that doesn't exist for ${c}().`);const f=[];for(const p of Vr(s))if(p.field.isKeyField())f.push(Xn(o,u.key));else{const g=u.data.field(p.field);if(ca(g))throw new N(P.INVALID_ARGUMENT,'Invalid query. You are trying to start or end a query using a document for which the field "'+p.field+'" is an uncommitted server timestamp. (Since the value of this field is unknown, you cannot start/end a query with it.)');if(g===null){const T=p.field.canonicalString();throw new N(P.INVALID_ARGUMENT,`Invalid query. You are trying to start or end a query using a document for which the field '${T}' (used as the orderBy) does not exist.`)}f.push(g)}return new wn(f,h)})(n._query,n.firestore._databaseId,e,t[0]._document,r);{const i=fr(n.firestore);return(function(o,c,u,h,f,p){const g=o.explicitOrderBy;if(f.length>g.length)throw new N(P.INVALID_ARGUMENT,`Too many arguments provided to ${h}(). The number of arguments must be less than or equal to the number of orderBy() clauses`);const T=[];for(let C=0;C<f.length;C++){const D=f[C];if(g[C].field.isKeyField()){if(typeof D!="string")throw new N(P.INVALID_ARGUMENT,`Invalid query. Expected a string for document ID in ${h}(), but got a ${typeof D}`);if(!Nu(o)&&D.indexOf("/")!==-1)throw new N(P.INVALID_ARGUMENT,`Invalid query. When querying a collection and ordering by documentId(), the value passed to ${h}() must be a plain document ID, but '${D}' contains a slash.`);const k=o.path.child(Y.fromString(D));if(!L.isDocumentKey(k))throw new N(P.INVALID_ARGUMENT,`Invalid query. When querying a collection group and ordering by documentId(), the value passed to ${h}() must result in a valid document path, but '${k}' is not because it contains an odd number of segments.`);const j=new L(k);T.push(Xn(c,j))}else{const k=$g(u,h,D);T.push(k)}}return new wn(T,p)})(n._query,n.firestore._databaseId,i,e,t,r)}}function Af(n,e,t){if(typeof(t=B(t))=="string"){if(t==="")throw new N(P.INVALID_ARGUMENT,"Invalid query. When querying with documentId(), you must provide a valid document ID, but it was an empty string.");if(!Nu(e)&&t.indexOf("/")!==-1)throw new N(P.INVALID_ARGUMENT,`Invalid query. When querying a collection by documentId(), you must provide a plain document ID, but '${t}' contains a '/' character.`);const r=e.path.child(Y.fromString(t));if(!L.isDocumentKey(r))throw new N(P.INVALID_ARGUMENT,`Invalid query. When querying a collection group by documentId(), the value provided must result in a valid document path, but '${r}' is not because it has an odd number of segments (${r.length}).`);return Xn(n,new L(r))}if(t instanceof fe)return Xn(n,t._key);throw new N(P.INVALID_ARGUMENT,`Invalid query. When querying with documentId(), you must provide a valid string or a DocumentReference, but it was: ${Ia(t)}.`)}function bf(n,e){if(!Array.isArray(n)||n.length===0)throw new N(P.INVALID_ARGUMENT,`Invalid Query. A non-empty array is required for '${e.toString()}' filters.`)}function Qg(n,e){const t=(function(i,s){for(const o of i)for(const c of o.getFlattenedFilters())if(s.indexOf(c.op)>=0)return c.op;return null})(n.filters,(function(i){switch(i){case"!=":return["!=","not-in"];case"array-contains-any":case"in":return["not-in"];case"not-in":return["array-contains-any","in","not-in","!="];default:return[]}})(e.op));if(t!==null)throw t===e.op?new N(P.INVALID_ARGUMENT,`Invalid query. You cannot use more than one '${e.op.toString()}' filter.`):new N(P.INVALID_ARGUMENT,`Invalid query. You cannot use '${e.op.toString()}' filters with '${t.toString()}' filters.`)}class bl{convertValue(e,t="none"){switch(Yn(e)){case 0:return null;case 1:return e.booleanValue;case 2:return ue(e.integerValue||e.doubleValue);case 3:return this.convertTimestamp(e.timestampValue);case 4:return this.convertServerTimestamp(e,t);case 5:return e.stringValue;case 6:return this.convertBytes(yn(e.bytesValue));case 7:return this.convertReference(e.referenceValue);case 8:return this.convertGeoPoint(e.geoPointValue);case 9:return this.convertArray(e.arrayValue,t);case 11:return this.convertObject(e.mapValue,t);case 10:return this.convertVectorValue(e.mapValue);default:throw U()}}convertObject(e,t){return this.convertObjectMap(e.fields,t)}convertObjectMap(e,t="none"){const r={};return hr(e,((i,s)=>{r[i]=this.convertValue(s,t)})),r}convertVectorValue(e){var t,r,i;const s=(i=(r=(t=e.fields)===null||t===void 0?void 0:t.value.arrayValue)===null||r===void 0?void 0:r.values)===null||i===void 0?void 0:i.map((o=>ue(o.doubleValue)));return new fl(s)}convertGeoPoint(e){return new va(ue(e.latitude),ue(e.longitude))}convertArray(e,t){return(e.values||[]).map((r=>this.convertValue(r,t)))}convertServerTimestamp(e,t){switch(t){case"previous":const r=ku(e);return r==null?null:this.convertValue(r,t);case"estimate":return this.convertTimestamp(ds(e));default:return null}}convertTimestamp(e){const t=Gt(e);return new de(t.seconds,t.nanos)}convertDocumentKey(e,t){const r=Y.fromString(e);q(jm(r));const i=new In(r.get(1),r.get(3)),s=new L(r.popFirst(5));return i.isEqual(t)||Te(`Document ${s} contains a document reference within a different database (${i.projectId}/${i.database}) which is not supported. It will be treated as a reference in the current database (${t.projectId}/${t.database}) instead.`),s}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Sa(n,e,t){let r;return r=n?t&&(t.merge||t.mergeFields)?n.toFirestore(e,t):n.toFirestore(e):e,r}class CA extends bl{constructor(e){super(),this.firestore=e}convertBytes(e){return new Dt(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new fe(this.firestore,null,t)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zn{constructor(e,t){this.hasPendingWrites=e,this.fromCache=t}isEqual(e){return this.hasPendingWrites===e.hasPendingWrites&&this.fromCache===e.fromCache}}let Kt=class extends vs{constructor(e,t,r,i,s,o){super(e,t,r,i,o),this._firestore=e,this._firestoreImpl=e,this.metadata=s}exists(){return super.exists()}data(e={}){if(this._document){if(this._converter){const t=new es(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(t,e)}return this._userDataWriter.convertValue(this._document.data.value,e.serverTimestamps)}}get(e,t={}){if(this._document){const r=this._document.data.field(Ea("DocumentSnapshot.get",e));if(r!==null)return this._userDataWriter.convertValue(r,t.serverTimestamps)}}},es=class extends Kt{data(e={}){return super.data(e)}},An=class{constructor(e,t,r,i){this._firestore=e,this._userDataWriter=t,this._snapshot=i,this.metadata=new zn(i.hasPendingWrites,i.fromCache),this.query=r}get docs(){const e=[];return this.forEach((t=>e.push(t))),e}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(e,t){this._snapshot.docs.forEach((r=>{e.call(t,new es(this._firestore,this._userDataWriter,r.key,r,new zn(this._snapshot.mutatedKeys.has(r.key),this._snapshot.fromCache),this.query.converter))}))}docChanges(e={}){const t=!!e.includeMetadataChanges;if(t&&this._snapshot.excludesMetadataChanges)throw new N(P.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===t||(this._cachedChanges=(function(i,s){if(i._snapshot.oldDocs.isEmpty()){let o=0;return i._snapshot.docChanges.map((c=>{const u=new es(i._firestore,i._userDataWriter,c.doc.key,c.doc,new zn(i._snapshot.mutatedKeys.has(c.doc.key),i._snapshot.fromCache),i.query.converter);return c.doc,{type:"added",doc:u,oldIndex:-1,newIndex:o++}}))}{let o=i._snapshot.oldDocs;return i._snapshot.docChanges.filter((c=>s||c.type!==3)).map((c=>{const u=new es(i._firestore,i._userDataWriter,c.doc.key,c.doc,new zn(i._snapshot.mutatedKeys.has(c.doc.key),i._snapshot.fromCache),i.query.converter);let h=-1,f=-1;return c.type!==0&&(h=o.indexOf(c.doc.key),o=o.delete(c.doc.key)),c.type!==1&&(o=o.add(c.doc),f=o.indexOf(c.doc.key)),{type:kA(c.type),doc:u,oldIndex:h,newIndex:f}}))}})(this,t),this._cachedChangesIncludeMetadataChanges=t),this._cachedChanges}};function kA(n){switch(n){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return U()}}function Jg(n,e){return n instanceof Kt&&e instanceof Kt?n._firestore===e._firestore&&n._key.isEqual(e._key)&&(n._document===null?e._document===null:n._document.isEqual(e._document))&&n._converter===e._converter:n instanceof An&&e instanceof An&&n._firestore===e._firestore&&Mg(n.query,e.query)&&n.metadata.isEqual(e.metadata)&&n._snapshot.isEqual(e._snapshot)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function DA(n){n=te(n,fe);const e=te(n.firestore,Ae);return Pg(ze(e),n._key).then((t=>Rl(e,n,t)))}class mr extends bl{constructor(e){super(),this.firestore=e}convertBytes(e){return new Dt(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new fe(this.firestore,null,t)}}function NA(n){n=te(n,fe);const e=te(n.firestore,Ae),t=ze(e),r=new mr(e);return ZE(t,n._key).then((i=>new Kt(e,r,n._key,i,new zn(i!==null&&i.hasLocalMutations,!0),n.converter)))}function VA(n){n=te(n,fe);const e=te(n.firestore,Ae);return Pg(ze(e),n._key,{source:"server"}).then((t=>Rl(e,n,t)))}function OA(n){n=te(n,et);const e=te(n.firestore,Ae),t=ze(e),r=new mr(e);return Wg(n._query),Sg(t,n._query).then((i=>new An(e,r,n,i)))}function xA(n){n=te(n,et);const e=te(n.firestore,Ae),t=ze(e),r=new mr(e);return eA(t,n._query).then((i=>new An(e,r,n,i)))}function LA(n){n=te(n,et);const e=te(n.firestore,Ae),t=ze(e),r=new mr(e);return Sg(t,n._query,{source:"server"}).then((i=>new An(e,r,n,i)))}function Rf(n,e,t){n=te(n,fe);const r=te(n.firestore,Ae),i=Sa(n.converter,e,t);return Bs(r,[Ta(fr(r),"setDoc",n._key,i,n.converter!==null,t).toMutation(n._key,he.none())])}function Pf(n,e,t,...r){n=te(n,fe);const i=te(n.firestore,Ae),s=fr(i);let o;return o=typeof(e=B(e))=="string"||e instanceof En?Il(s,"updateDoc",n._key,e,t,r):yl(s,"updateDoc",n._key,e),Bs(i,[o.toMutation(n._key,he.exists(!0))])}function MA(n){return Bs(te(n.firestore,Ae),[new ci(n._key,he.none())])}function FA(n,e){const t=te(n.firestore,Ae),r=Jo(n),i=Sa(n.converter,e);return Bs(t,[Ta(fr(n.firestore),"addDoc",r._key,i,n.converter!==null,{}).toMutation(r._key,he.exists(!1))]).then((()=>r))}function Yg(n,...e){var t,r,i;n=B(n);let s={includeMetadataChanges:!1,source:"default"},o=0;typeof e[o]!="object"||nu(e[o])||(s=e[o],o++);const c={includeMetadataChanges:s.includeMetadataChanges,source:s.source};if(nu(e[o])){const p=e[o];e[o]=(t=p.next)===null||t===void 0?void 0:t.bind(p),e[o+1]=(r=p.error)===null||r===void 0?void 0:r.bind(p),e[o+2]=(i=p.complete)===null||i===void 0?void 0:i.bind(p)}let u,h,f;if(n instanceof fe)h=te(n.firestore,Ae),f=oi(n._key.path),u={next:p=>{e[o]&&e[o](Rl(h,n,p))},error:e[o+1],complete:e[o+2]};else{const p=te(n,et);h=te(p.firestore,Ae),f=p._query;const g=new mr(h);u={next:T=>{e[o]&&e[o](new An(h,g,p,T))},error:e[o+1],complete:e[o+2]},Wg(n._query)}return(function(g,T,C,D){const k=new _a(D),j=new rl(T,k,C);return g.asyncQueue.enqueueAndForget((async()=>el(await ei(g),j))),()=>{k.Za(),g.asyncQueue.enqueueAndForget((async()=>tl(await ei(g),j)))}})(ze(h),f,c,u)}function UA(n,e){return tA(ze(n=te(n,Ae)),nu(e)?e:{next:e})}function Bs(n,e){return(function(r,i){const s=new Le;return r.asyncQueue.enqueueAndForget((async()=>CE(await hl(r),i,s))),s.promise})(ze(n),e)}function Rl(n,e,t){const r=t.docs.get(e._key),i=new mr(n);return new Kt(n,i,e._key,r,new zn(t.hasPendingWrites,t.fromCache),e.converter)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const BA={maxAttempts:5};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let qA=class{constructor(e,t){this._firestore=e,this._commitHandler=t,this._mutations=[],this._committed=!1,this._dataReader=fr(e)}set(e,t,r){this._verifyNotCommitted();const i=hn(e,this._firestore),s=Sa(i.converter,t,r),o=Ta(this._dataReader,"WriteBatch.set",i._key,s,i.converter!==null,r);return this._mutations.push(o.toMutation(i._key,he.none())),this}update(e,t,r,...i){this._verifyNotCommitted();const s=hn(e,this._firestore);let o;return o=typeof(t=B(t))=="string"||t instanceof En?Il(this._dataReader,"WriteBatch.update",s._key,t,r,i):yl(this._dataReader,"WriteBatch.update",s._key,t),this._mutations.push(o.toMutation(s._key,he.exists(!0))),this}delete(e){this._verifyNotCommitted();const t=hn(e,this._firestore);return this._mutations=this._mutations.concat(new ci(t._key,he.none())),this}commit(){return this._verifyNotCommitted(),this._committed=!0,this._mutations.length>0?this._commitHandler(this._mutations):Promise.resolve()}_verifyNotCommitted(){if(this._committed)throw new N(P.FAILED_PRECONDITION,"A write batch can no longer be used after commit() has been called.")}};function hn(n,e){if((n=B(n)).firestore!==e)throw new N(P.INVALID_ARGUMENT,"Provided document reference is from a different Firestore instance.");return n}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let jA=class extends class{constructor(t,r){this._firestore=t,this._transaction=r,this._dataReader=fr(t)}get(t){const r=hn(t,this._firestore),i=new CA(this._firestore);return this._transaction.lookup([r._key]).then((s=>{if(!s||s.length!==1)return U();const o=s[0];if(o.isFoundDocument())return new vs(this._firestore,i,o.key,o,r.converter);if(o.isNoDocument())return new vs(this._firestore,i,r._key,null,r.converter);throw U()}))}set(t,r,i){const s=hn(t,this._firestore),o=Sa(s.converter,r,i),c=Ta(this._dataReader,"Transaction.set",s._key,o,s.converter!==null,i);return this._transaction.set(s._key,c),this}update(t,r,i,...s){const o=hn(t,this._firestore);let c;return c=typeof(r=B(r))=="string"||r instanceof En?Il(this._dataReader,"Transaction.update",o._key,r,i,s):yl(this._dataReader,"Transaction.update",o._key,r),this._transaction.update(o._key,c),this}delete(t){const r=hn(t,this._firestore);return this._transaction.delete(r._key),this}}{constructor(e,t){super(e,t),this._firestore=e}get(e){const t=hn(e,this._firestore),r=new mr(this._firestore);return super.get(e).then((i=>new Kt(this._firestore,r,t._key,i._document,new zn(!1,!1),t.converter)))}};function $A(n,e,t){n=te(n,Ae);const r=Object.assign(Object.assign({},BA),t);return(function(s){if(s.maxAttempts<1)throw new N(P.INVALID_ARGUMENT,"Max attempts must be at least 1")})(r),(function(s,o,c){const u=new Le;return s.asyncQueue.enqueueAndForget((async()=>{const h=await JE(s);new HE(s.asyncQueue,h,c,o,u).au()})),u.promise})(ze(n),(i=>e(new jA(n,i))),r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function zA(){return new Fs("deleteField")}function GA(){return new pl("serverTimestamp")}function KA(...n){return new ml("arrayUnion",n)}function WA(...n){return new gl("arrayRemove",n)}function HA(n){return new _l("increment",n)}(function(e,t=!0){(function(i){si=i})(Ht),St(new ot("firestore",((r,{instanceIdentifier:i,options:s})=>{const o=r.getProvider("app").getImmediate(),c=new Ae(new Zv(r.getProvider("auth-internal")),new rw(r.getProvider("app-check-internal")),(function(h,f){if(!Object.prototype.hasOwnProperty.apply(h.options,["projectId"]))throw new N(P.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new In(h.options.projectId,f)})(o,i),o);return s=Object.assign({useFetchStreams:t},s),c._setSettings(s),c}),"PUBLIC").setMultipleInstances(!0)),Ye(md,"4.7.3",e),Ye(md,"4.7.3","esm2017")})();const QA="@firebase/firestore-compat",JA="0.3.38";/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Pl(n,e){if(e===void 0)return{merge:!1};if(e.mergeFields!==void 0&&e.merge!==void 0)throw new N("invalid-argument",`Invalid options passed to function ${n}(): You cannot specify both "merge" and "mergeFields".`);return e}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Sf(){if(typeof Uint8Array>"u")throw new N("unimplemented","Uint8Arrays are not available in this environment.")}function Cf(){if(!Cw())throw new N("unimplemented","Blobs are unavailable in Firestore in this environment.")}let Xg=class iu{constructor(e){this._delegate=e}static fromBase64String(e){return Cf(),new iu(Dt.fromBase64String(e))}static fromUint8Array(e){return Sf(),new iu(Dt.fromUint8Array(e))}toBase64(){return Cf(),this._delegate.toBase64()}toUint8Array(){return Sf(),this._delegate.toUint8Array()}isEqual(e){return this._delegate.isEqual(e._delegate)}toString(){return"Blob(base64: "+this.toBase64()+")"}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function su(n){return YA(n,["next","error","complete"])}function YA(n,e){if(typeof n!="object"||n===null)return!1;const t=n;for(const r of e)if(r in t&&typeof t[r]=="function")return!0;return!1}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class XA{enableIndexedDbPersistence(e,t){return cA(e._delegate,{forceOwnership:t})}enableMultiTabIndexedDbPersistence(e){return uA(e._delegate)}clearIndexedDbPersistence(e){return lA(e._delegate)}}class Zg{constructor(e,t,r){this._delegate=t,this._persistenceProvider=r,this.INTERNAL={delete:()=>this.terminate()},e instanceof In||(this._appCompat=e)}get _databaseId(){return this._delegate._databaseId}settings(e){const t=this._delegate._getSettings();!e.merge&&t.host!==e.host&&Ct("You are overriding the original host. If you did not intend to override your settings, use {merge: true}."),e.merge&&(e=Object.assign(Object.assign({},t),e),delete e.merge),this._delegate._setSettings(e)}useEmulator(e,t,r={}){iA(this._delegate,e,t,r)}enableNetwork(){return dA(this._delegate)}disableNetwork(){return fA(this._delegate)}enablePersistence(e){let t=!1,r=!1;return e&&(t=!!e.synchronizeTabs,r=!!e.experimentalForceOwningTab,kg("synchronizeTabs",t,"experimentalForceOwningTab",r)),t?this._persistenceProvider.enableMultiTabIndexedDbPersistence(this):this._persistenceProvider.enableIndexedDbPersistence(this,r)}clearPersistence(){return this._persistenceProvider.clearIndexedDbPersistence(this)}terminate(){return this._appCompat&&(this._appCompat._removeServiceInstance("firestore-compat"),this._appCompat._removeServiceInstance("firestore")),this._delegate._delete()}waitForPendingWrites(){return hA(this._delegate)}onSnapshotsInSync(e){return UA(this._delegate,e)}get app(){if(!this._appCompat)throw new N("failed-precondition","Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._appCompat}collection(e){try{return new ti(this,xg(this._delegate,e))}catch(t){throw Qe(t,"collection()","Firestore.collection()")}}doc(e){try{return new ht(this,Jo(this._delegate,e))}catch(t){throw Qe(t,"doc()","Firestore.doc()")}}collectionGroup(e){try{return new He(this,sA(this._delegate,e))}catch(t){throw Qe(t,"collectionGroup()","Firestore.collectionGroup()")}}runTransaction(e){return $A(this._delegate,t=>e(new e_(this,t)))}batch(){return ze(this._delegate),new t_(new qA(this._delegate,e=>Bs(this._delegate,e)))}loadBundle(e){return pA(this._delegate,e)}namedQuery(e){return mA(this._delegate,e).then(t=>t?new He(this,t):null)}}class Ca extends bl{constructor(e){super(),this.firestore=e}convertBytes(e){return new Xg(new Dt(e))}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return ht.forKey(t,this.firestore,null)}}function ZA(n){Qv(n)}class e_{constructor(e,t){this._firestore=e,this._delegate=t,this._userDataWriter=new Ca(e)}get(e){const t=Gn(e);return this._delegate.get(t).then(r=>new ws(this._firestore,new Kt(this._firestore._delegate,this._userDataWriter,r._key,r._document,r.metadata,t.converter)))}set(e,t,r){const i=Gn(e);return r?(Pl("Transaction.set",r),this._delegate.set(i,t,r)):this._delegate.set(i,t),this}update(e,t,r,...i){const s=Gn(e);return arguments.length===2?this._delegate.update(s,t):this._delegate.update(s,t,r,...i),this}delete(e){const t=Gn(e);return this._delegate.delete(t),this}}class t_{constructor(e){this._delegate=e}set(e,t,r){const i=Gn(e);return r?(Pl("WriteBatch.set",r),this._delegate.set(i,t,r)):this._delegate.set(i,t),this}update(e,t,r,...i){const s=Gn(e);return arguments.length===2?this._delegate.update(s,t):this._delegate.update(s,t,r,...i),this}delete(e){const t=Gn(e);return this._delegate.delete(t),this}commit(){return this._delegate.commit()}}class sr{constructor(e,t,r){this._firestore=e,this._userDataWriter=t,this._delegate=r}fromFirestore(e,t){const r=new es(this._firestore._delegate,this._userDataWriter,e._key,e._document,e.metadata,null);return this._delegate.fromFirestore(new Ts(this._firestore,r),t??{})}toFirestore(e,t){return t?this._delegate.toFirestore(e,t):this._delegate.toFirestore(e)}static getInstance(e,t){const r=sr.INSTANCES;let i=r.get(e);i||(i=new WeakMap,r.set(e,i));let s=i.get(t);return s||(s=new sr(e,new Ca(e),t),i.set(t,s)),s}}sr.INSTANCES=new WeakMap;class ht{constructor(e,t){this.firestore=e,this._delegate=t,this._userDataWriter=new Ca(e)}static forPath(e,t,r){if(e.length%2!==0)throw new N("invalid-argument",`Invalid document reference. Document references must have an even number of segments, but ${e.canonicalString()} has ${e.length}`);return new ht(t,new fe(t._delegate,r,new L(e)))}static forKey(e,t,r){return new ht(t,new fe(t._delegate,r,e))}get id(){return this._delegate.id}get parent(){return new ti(this.firestore,this._delegate.parent)}get path(){return this._delegate.path}collection(e){try{return new ti(this.firestore,xg(this._delegate,e))}catch(t){throw Qe(t,"collection()","DocumentReference.collection()")}}isEqual(e){return e=B(e),e instanceof fe?Lg(this._delegate,e):!1}set(e,t){t=Pl("DocumentReference.set",t);try{return t?Rf(this._delegate,e,t):Rf(this._delegate,e)}catch(r){throw Qe(r,"setDoc()","DocumentReference.set()")}}update(e,t,...r){try{return arguments.length===1?Pf(this._delegate,e):Pf(this._delegate,e,t,...r)}catch(i){throw Qe(i,"updateDoc()","DocumentReference.update()")}}delete(){return MA(this._delegate)}onSnapshot(...e){const t=n_(e),r=r_(e,i=>new ws(this.firestore,new Kt(this.firestore._delegate,this._userDataWriter,i._key,i._document,i.metadata,this._delegate.converter)));return Yg(this._delegate,t,r)}get(e){let t;return(e==null?void 0:e.source)==="cache"?t=NA(this._delegate):(e==null?void 0:e.source)==="server"?t=VA(this._delegate):t=DA(this._delegate),t.then(r=>new ws(this.firestore,new Kt(this.firestore._delegate,this._userDataWriter,r._key,r._document,r.metadata,this._delegate.converter)))}withConverter(e){return new ht(this.firestore,e?this._delegate.withConverter(sr.getInstance(this.firestore,e)):this._delegate.withConverter(null))}}function Qe(n,e,t){return n.message=n.message.replace(e,t),n}function n_(n){for(const e of n)if(typeof e=="object"&&!su(e))return e;return{}}function r_(n,e){var t,r;let i;return su(n[0])?i=n[0]:su(n[1])?i=n[1]:typeof n[0]=="function"?i={next:n[0],error:n[1],complete:n[2]}:i={next:n[1],error:n[2],complete:n[3]},{next:s=>{i.next&&i.next(e(s))},error:(t=i.error)===null||t===void 0?void 0:t.bind(i),complete:(r=i.complete)===null||r===void 0?void 0:r.bind(i)}}class ws{constructor(e,t){this._firestore=e,this._delegate=t}get ref(){return new ht(this._firestore,this._delegate.ref)}get id(){return this._delegate.id}get metadata(){return this._delegate.metadata}get exists(){return this._delegate.exists()}data(e){return this._delegate.data(e)}get(e,t){return this._delegate.get(e,t)}isEqual(e){return Jg(this._delegate,e._delegate)}}class Ts extends ws{data(e){const t=this._delegate.data(e);return this._delegate._converter||Jv(t!==void 0),t}}class He{constructor(e,t){this.firestore=e,this._delegate=t,this._userDataWriter=new Ca(e)}where(e,t,r){try{return new He(this.firestore,cn(this._delegate,wA(e,t,r)))}catch(i){throw Qe(i,/(orderBy|where)\(\)/,"Query.$1()")}}orderBy(e,t){try{return new He(this.firestore,cn(this._delegate,TA(e,t)))}catch(r){throw Qe(r,/(orderBy|where)\(\)/,"Query.$1()")}}limit(e){try{return new He(this.firestore,cn(this._delegate,EA(e)))}catch(t){throw Qe(t,"limit()","Query.limit()")}}limitToLast(e){try{return new He(this.firestore,cn(this._delegate,AA(e)))}catch(t){throw Qe(t,"limitToLast()","Query.limitToLast()")}}startAt(...e){try{return new He(this.firestore,cn(this._delegate,bA(...e)))}catch(t){throw Qe(t,"startAt()","Query.startAt()")}}startAfter(...e){try{return new He(this.firestore,cn(this._delegate,RA(...e)))}catch(t){throw Qe(t,"startAfter()","Query.startAfter()")}}endBefore(...e){try{return new He(this.firestore,cn(this._delegate,PA(...e)))}catch(t){throw Qe(t,"endBefore()","Query.endBefore()")}}endAt(...e){try{return new He(this.firestore,cn(this._delegate,SA(...e)))}catch(t){throw Qe(t,"endAt()","Query.endAt()")}}isEqual(e){return Mg(this._delegate,e._delegate)}get(e){let t;return(e==null?void 0:e.source)==="cache"?t=xA(this._delegate):(e==null?void 0:e.source)==="server"?t=LA(this._delegate):t=OA(this._delegate),t.then(r=>new ou(this.firestore,new An(this.firestore._delegate,this._userDataWriter,this._delegate,r._snapshot)))}onSnapshot(...e){const t=n_(e),r=r_(e,i=>new ou(this.firestore,new An(this.firestore._delegate,this._userDataWriter,this._delegate,i._snapshot)));return Yg(this._delegate,t,r)}withConverter(e){return new He(this.firestore,e?this._delegate.withConverter(sr.getInstance(this.firestore,e)):this._delegate.withConverter(null))}}class eb{constructor(e,t){this._firestore=e,this._delegate=t}get type(){return this._delegate.type}get doc(){return new Ts(this._firestore,this._delegate.doc)}get oldIndex(){return this._delegate.oldIndex}get newIndex(){return this._delegate.newIndex}}class ou{constructor(e,t){this._firestore=e,this._delegate=t}get query(){return new He(this._firestore,this._delegate.query)}get metadata(){return this._delegate.metadata}get size(){return this._delegate.size}get empty(){return this._delegate.empty}get docs(){return this._delegate.docs.map(e=>new Ts(this._firestore,e))}docChanges(e){return this._delegate.docChanges(e).map(t=>new eb(this._firestore,t))}forEach(e,t){this._delegate.forEach(r=>{e.call(t,new Ts(this._firestore,r))})}isEqual(e){return Jg(this._delegate,e._delegate)}}class ti extends He{constructor(e,t){super(e,t),this.firestore=e,this._delegate=t}get id(){return this._delegate.id}get path(){return this._delegate.path}get parent(){const e=this._delegate.parent;return e?new ht(this.firestore,e):null}doc(e){try{return e===void 0?new ht(this.firestore,Jo(this._delegate)):new ht(this.firestore,Jo(this._delegate,e))}catch(t){throw Qe(t,"doc()","CollectionReference.doc()")}}add(e){return FA(this._delegate,e).then(t=>new ht(this.firestore,t))}isEqual(e){return Lg(this._delegate,e._delegate)}withConverter(e){return new ti(this.firestore,e?this._delegate.withConverter(sr.getInstance(this.firestore,e)):this._delegate.withConverter(null))}}function Gn(n){return te(n,fe)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sl{constructor(...e){this._delegate=new En(...e)}static documentId(){return new Sl(le.keyField().canonicalString())}isEqual(e){return e=B(e),e instanceof En?this._delegate._internalPath.isEqual(e._internalPath):!1}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $n{constructor(e){this._delegate=e}static serverTimestamp(){const e=GA();return e._methodName="FieldValue.serverTimestamp",new $n(e)}static delete(){const e=zA();return e._methodName="FieldValue.delete",new $n(e)}static arrayUnion(...e){const t=KA(...e);return t._methodName="FieldValue.arrayUnion",new $n(t)}static arrayRemove(...e){const t=WA(...e);return t._methodName="FieldValue.arrayRemove",new $n(t)}static increment(e){const t=HA(e);return t._methodName="FieldValue.increment",new $n(t)}isEqual(e){return this._delegate.isEqual(e._delegate)}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const tb={Firestore:Zg,GeoPoint:va,Timestamp:de,Blob:Xg,Transaction:e_,WriteBatch:t_,DocumentReference:ht,DocumentSnapshot:ws,Query:He,QueryDocumentSnapshot:Ts,QuerySnapshot:ou,CollectionReference:ti,FieldPath:Sl,FieldValue:$n,setLogLevel:ZA,CACHE_SIZE_UNLIMITED:aA};function nb(n,e){n.INTERNAL.registerComponent(new ot("firestore-compat",t=>{const r=t.getProvider("app-compat").getImmediate(),i=t.getProvider("firestore").getImmediate();return e(r,i)},"PUBLIC").setServiceProps(Object.assign({},tb)))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function rb(n){nb(n,(e,t)=>new Zg(e,t,new XA)),n.registerVersion(QA,JA)}rb(bn);function Cl(n,e){var t={};for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&e.indexOf(r)<0&&(t[r]=n[r]);if(n!=null&&typeof Object.getOwnPropertySymbols=="function")for(var i=0,r=Object.getOwnPropertySymbols(n);i<r.length;i++)e.indexOf(r[i])<0&&Object.prototype.propertyIsEnumerable.call(n,r[i])&&(t[r[i]]=n[r[i]]);return t}const Ui={FACEBOOK:"facebook.com",GITHUB:"github.com",GOOGLE:"google.com",PASSWORD:"password",TWITTER:"twitter.com"},br={EMAIL_SIGNIN:"EMAIL_SIGNIN",PASSWORD_RESET:"PASSWORD_RESET",RECOVER_EMAIL:"RECOVER_EMAIL",REVERT_SECOND_FACTOR_ADDITION:"REVERT_SECOND_FACTOR_ADDITION",VERIFY_AND_CHANGE_EMAIL:"VERIFY_AND_CHANGE_EMAIL",VERIFY_EMAIL:"VERIFY_EMAIL"};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ib(){return{"admin-restricted-operation":"This operation is restricted to administrators only.","argument-error":"","app-not-authorized":"This app, identified by the domain where it's hosted, is not authorized to use Firebase Authentication with the provided API key. Review your key configuration in the Google API console.","app-not-installed":"The requested mobile application corresponding to the identifier (Android package name or iOS bundle ID) provided is not installed on this device.","captcha-check-failed":"The reCAPTCHA response token provided is either invalid, expired, already used or the domain associated with it does not match the list of whitelisted domains.","code-expired":"The SMS code has expired. Please re-send the verification code to try again.","cordova-not-ready":"Cordova framework is not ready.","cors-unsupported":"This browser is not supported.","credential-already-in-use":"This credential is already associated with a different user account.","custom-token-mismatch":"The custom token corresponds to a different audience.","requires-recent-login":"This operation is sensitive and requires recent authentication. Log in again before retrying this request.","dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK.","dynamic-link-not-activated":"Please activate Dynamic Links in the Firebase Console and agree to the terms and conditions.","email-change-needs-verification":"Multi-factor users must always have a verified email.","email-already-in-use":"The email address is already in use by another account.","emulator-config-failed":'Auth instance has already been used to make a network call. Auth can no longer be configured to use the emulator. Try calling "connectAuthEmulator()" sooner.',"expired-action-code":"The action code has expired.","cancelled-popup-request":"This operation has been cancelled due to another conflicting popup being opened.","internal-error":"An internal AuthError has occurred.","invalid-app-credential":"The phone verification request contains an invalid application verifier. The reCAPTCHA token response is either invalid or expired.","invalid-app-id":"The mobile app identifier is not registered for the current project.","invalid-user-token":"This user's credential isn't valid for this project. This can happen if the user's token has been tampered with, or if the user isn't for the project associated with this API key.","invalid-auth-event":"An internal AuthError has occurred.","invalid-verification-code":"The SMS verification code used to create the phone auth credential is invalid. Please resend the verification code sms and be sure to use the verification code provided by the user.","invalid-continue-uri":"The continue URL provided in the request is invalid.","invalid-cordova-configuration":"The following Cordova plugins must be installed to enable OAuth sign-in: cordova-plugin-buildinfo, cordova-universal-links-plugin, cordova-plugin-browsertab, cordova-plugin-inappbrowser and cordova-plugin-customurlscheme.","invalid-custom-token":"The custom token format is incorrect. Please check the documentation.","invalid-dynamic-link-domain":"The provided dynamic link domain is not configured or authorized for the current project.","invalid-email":"The email address is badly formatted.","invalid-emulator-scheme":"Emulator URL must start with a valid scheme (http:// or https://).","invalid-api-key":"Your API key is invalid, please check you have copied it correctly.","invalid-cert-hash":"The SHA-1 certificate hash provided is invalid.","invalid-credential":"The supplied auth credential is incorrect, malformed or has expired.","invalid-message-payload":"The email template corresponding to this action contains invalid characters in its message. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-multi-factor-session":"The request does not contain a valid proof of first factor successful sign-in.","invalid-oauth-provider":"EmailAuthProvider is not supported for this operation. This operation only supports OAuth providers.","invalid-oauth-client-id":"The OAuth client ID provided is either invalid or does not match the specified API key.","unauthorized-domain":"This domain is not authorized for OAuth operations for your Firebase project. Edit the list of authorized domains from the Firebase console.","invalid-action-code":"The action code is invalid. This can happen if the code is malformed, expired, or has already been used.","wrong-password":"The password is invalid or the user does not have a password.","invalid-persistence-type":"The specified persistence type is invalid. It can only be local, session or none.","invalid-phone-number":"The format of the phone number provided is incorrect. Please enter the phone number in a format that can be parsed into E.164 format. E.164 phone numbers are written in the format [+][country code][subscriber number including area code].","invalid-provider-id":"The specified provider ID is invalid.","invalid-recipient-email":"The email corresponding to this action failed to send as the provided recipient email address is invalid.","invalid-sender":"The email template corresponding to this action contains an invalid sender email or name. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-verification-id":"The verification ID used to create the phone auth credential is invalid.","invalid-tenant-id":"The Auth instance's tenant ID is invalid.","login-blocked":"Login blocked by user-provided method: {$originalMessage}","missing-android-pkg-name":"An Android Package Name must be provided if the Android App is required to be installed.","auth-domain-config-required":"Be sure to include authDomain when calling firebase.initializeApp(), by following the instructions in the Firebase console.","missing-app-credential":"The phone verification request is missing an application verifier assertion. A reCAPTCHA response token needs to be provided.","missing-verification-code":"The phone auth credential was created with an empty SMS verification code.","missing-continue-uri":"A continue URL must be provided in the request.","missing-iframe-start":"An internal AuthError has occurred.","missing-ios-bundle-id":"An iOS Bundle ID must be provided if an App Store ID is provided.","missing-or-invalid-nonce":"The request does not contain a valid nonce. This can occur if the SHA-256 hash of the provided raw nonce does not match the hashed nonce in the ID token payload.","missing-password":"A non-empty password must be provided","missing-multi-factor-info":"No second factor identifier is provided.","missing-multi-factor-session":"The request is missing proof of first factor successful sign-in.","missing-phone-number":"To send verification codes, provide a phone number for the recipient.","missing-verification-id":"The phone auth credential was created with an empty verification ID.","app-deleted":"This instance of FirebaseApp has been deleted.","multi-factor-info-not-found":"The user does not have a second factor matching the identifier provided.","multi-factor-auth-required":"Proof of ownership of a second factor is required to complete sign-in.","account-exists-with-different-credential":"An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.","network-request-failed":"A network AuthError (such as timeout, interrupted connection or unreachable host) has occurred.","no-auth-event":"An internal AuthError has occurred.","no-such-provider":"User was not linked to an account with the given provider.","null-user":"A null user object was provided as the argument for an operation which requires a non-null user object.","operation-not-allowed":"The given sign-in provider is disabled for this Firebase project. Enable it in the Firebase console, under the sign-in method tab of the Auth section.","operation-not-supported-in-this-environment":'This operation is not supported in the environment this application is running on. "location.protocol" must be http, https or chrome-extension and web storage must be enabled.',"popup-blocked":"Unable to establish a connection with the popup. It may have been blocked by the browser.","popup-closed-by-user":"The popup has been closed by the user before finalizing the operation.","provider-already-linked":"User can only be linked to one identity for the given provider.","quota-exceeded":"The project's quota for this operation has been exceeded.","redirect-cancelled-by-user":"The redirect operation has been cancelled by the user before finalizing.","redirect-operation-pending":"A redirect sign-in operation is already pending.","rejected-credential":"The request contains malformed or mismatching credentials.","second-factor-already-in-use":"The second factor is already enrolled on this account.","maximum-second-factor-count-exceeded":"The maximum allowed number of second factors on a user has been exceeded.","tenant-id-mismatch":"The provided tenant ID does not match the Auth instance's tenant ID",timeout:"The operation has timed out.","user-token-expired":"The user's credential is no longer valid. The user must sign in again.","too-many-requests":"We have blocked all requests from this device due to unusual activity. Try again later.","unauthorized-continue-uri":"The domain of the continue URL is not whitelisted.  Please whitelist the domain in the Firebase console.","unsupported-first-factor":"Enrolling a second factor or signing in with a multi-factor account requires sign-in with a supported first factor.","unsupported-persistence-type":"The current environment does not support the specified persistence type.","unsupported-tenant-operation":"This operation is not supported in a multi-tenant context.","unverified-email":"The operation requires a verified email.","user-cancelled":"The user did not grant your application the permissions it requested.","user-not-found":"There is no user record corresponding to this identifier. The user may have been deleted.","user-disabled":"The user account has been disabled by an administrator.","user-mismatch":"The supplied credentials do not correspond to the previously signed in user.","user-signed-out":"","weak-password":"The password must be 6 characters long or more.","web-storage-unsupported":"This browser is not supported or 3rd party cookies and data may be disabled.","already-initialized":"initializeAuth() has already been called with different options. To avoid this error, call initializeAuth() with the same options as when it was originally called, or call getAuth() to return the already initialized instance.","missing-recaptcha-token":"The reCAPTCHA token is missing when sending request to the backend.","invalid-recaptcha-token":"The reCAPTCHA token is invalid when sending request to the backend.","invalid-recaptcha-action":"The reCAPTCHA action is invalid when sending request to the backend.","recaptcha-not-enabled":"reCAPTCHA Enterprise integration is not enabled for this project.","missing-client-type":"The reCAPTCHA client type is missing when sending request to the backend.","missing-recaptcha-version":"The reCAPTCHA version is missing when sending request to the backend.","invalid-req-type":"Invalid request parameters.","invalid-recaptcha-version":"The reCAPTCHA version is invalid when sending request to the backend.","unsupported-password-policy-schema-version":"The password policy received from the backend uses a schema version that is not supported by this version of the Firebase SDK.","password-does-not-meet-requirements":"The password does not meet the requirements."}}function i_(){return{"dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK."}}const sb=ib,ob=i_,s_=new lr("auth","Firebase",i_());/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xo=new oa("@firebase/auth");function ab(n,...e){Xo.logLevel<=Q.WARN&&Xo.warn(`Auth (${Ht}): ${n}`,...e)}function No(n,...e){Xo.logLevel<=Q.ERROR&&Xo.error(`Auth (${Ht}): ${n}`,...e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Me(n,...e){throw Dl(n,...e)}function Se(n,...e){return Dl(n,...e)}function kl(n,e,t){const r=Object.assign(Object.assign({},ob()),{[e]:t});return new lr("auth","Firebase",r).create(e,{appName:n.name})}function Ne(n){return kl(n,"operation-not-supported-in-this-environment","Operations that alter the current user are not supported in conjunction with FirebaseServerApp")}function fi(n,e,t){const r=t;if(!(e instanceof r))throw r.name!==e.constructor.name&&Me(n,"argument-error"),kl(n,"argument-error",`Type of ${e.constructor.name} does not match expected instance.Did you pass a reference from a different Auth SDK?`)}function Dl(n,...e){if(typeof n!="string"){const t=e[0],r=[...e.slice(1)];return r[0]&&(r[0].appName=n.name),n._errorFactory.create(t,...r)}return s_.create(n,...e)}function O(n,e,...t){if(!n)throw Dl(e,...t)}function At(n){const e="INTERNAL ASSERTION FAILED: "+n;throw No(e),new Error(e)}function gt(n,e){n||At(e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Es(){var n;return typeof self<"u"&&((n=self.location)===null||n===void 0?void 0:n.href)||""}function Nl(){return kf()==="http:"||kf()==="https:"}function kf(){var n;return typeof self<"u"&&((n=self.location)===null||n===void 0?void 0:n.protocol)||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function cb(){return typeof navigator<"u"&&navigator&&"onLine"in navigator&&typeof navigator.onLine=="boolean"&&(Nl()||_p()||"connection"in navigator)?navigator.onLine:!0}function ub(){if(typeof navigator>"u")return null;const n=navigator;return n.languages&&n.languages[0]||n.language||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qs{constructor(e,t){this.shortDelay=e,this.longDelay=t,gt(t>e,"Short delay should be less than long delay!"),this.isMobile=II()||vu()}get(){return cb()?this.isMobile?this.longDelay:this.shortDelay:Math.min(5e3,this.shortDelay)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Vl(n,e){gt(n.emulator,"Emulator should always be set here");const{url:t}=n.emulator;return e?`${t}${e.startsWith("/")?e.slice(1):e}`:t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class o_{static initialize(e,t,r){this.fetchImpl=e,t&&(this.headersImpl=t),r&&(this.responseImpl=r)}static fetch(){if(this.fetchImpl)return this.fetchImpl;if(typeof self<"u"&&"fetch"in self)return self.fetch;if(typeof globalThis<"u"&&globalThis.fetch)return globalThis.fetch;if(typeof fetch<"u")return fetch;At("Could not find fetch implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static headers(){if(this.headersImpl)return this.headersImpl;if(typeof self<"u"&&"Headers"in self)return self.Headers;if(typeof globalThis<"u"&&globalThis.Headers)return globalThis.Headers;if(typeof Headers<"u")return Headers;At("Could not find Headers implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static response(){if(this.responseImpl)return this.responseImpl;if(typeof self<"u"&&"Response"in self)return self.Response;if(typeof globalThis<"u"&&globalThis.Response)return globalThis.Response;if(typeof Response<"u")return Response;At("Could not find Response implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lb={CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_PASSWORD:"wrong-password",MISSING_PASSWORD:"missing-password",INVALID_LOGIN_CREDENTIALS:"invalid-credential",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",INVALID_PENDING_TOKEN:"invalid-credential",FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",MISSING_REQ_TYPE:"internal-error",EMAIL_NOT_FOUND:"user-not-found",RESET_PASSWORD_EXCEED_LIMIT:"too-many-requests",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",PASSWORD_DOES_NOT_MEET_REQUIREMENTS:"password-does-not-meet-requirements",INVALID_CODE:"invalid-verification-code",INVALID_SESSION_INFO:"invalid-verification-id",INVALID_TEMPORARY_PROOF:"invalid-credential",MISSING_SESSION_INFO:"missing-verification-id",SESSION_EXPIRED:"code-expired",MISSING_ANDROID_PACKAGE_NAME:"missing-android-pkg-name",UNAUTHORIZED_DOMAIN:"unauthorized-continue-uri",INVALID_OAUTH_CLIENT_ID:"invalid-oauth-client-id",ADMIN_ONLY_OPERATION:"admin-restricted-operation",INVALID_MFA_PENDING_CREDENTIAL:"invalid-multi-factor-session",MFA_ENROLLMENT_NOT_FOUND:"multi-factor-info-not-found",MISSING_MFA_ENROLLMENT_ID:"missing-multi-factor-info",MISSING_MFA_PENDING_CREDENTIAL:"missing-multi-factor-session",SECOND_FACTOR_EXISTS:"second-factor-already-in-use",SECOND_FACTOR_LIMIT_EXCEEDED:"maximum-second-factor-count-exceeded",BLOCKING_FUNCTION_ERROR_RESPONSE:"internal-error",RECAPTCHA_NOT_ENABLED:"recaptcha-not-enabled",MISSING_RECAPTCHA_TOKEN:"missing-recaptcha-token",INVALID_RECAPTCHA_TOKEN:"invalid-recaptcha-token",INVALID_RECAPTCHA_ACTION:"invalid-recaptcha-action",MISSING_CLIENT_TYPE:"missing-client-type",MISSING_RECAPTCHA_VERSION:"missing-recaptcha-version",INVALID_RECAPTCHA_VERSION:"invalid-recaptcha-version",INVALID_REQ_TYPE:"invalid-req-type"};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const hb=new qs(3e4,6e4);function ve(n,e){return n.tenantId&&!e.tenantId?Object.assign(Object.assign({},e),{tenantId:n.tenantId}):e}async function we(n,e,t,r,i={}){return a_(n,i,async()=>{let s={},o={};r&&(e==="GET"?o=r:s={body:JSON.stringify(r)});const c=ii(Object.assign({key:n.config.apiKey},o)).slice(1),u=await n._getAdditionalHeaders();u["Content-Type"]="application/json",n.languageCode&&(u["X-Firebase-Locale"]=n.languageCode);const h=Object.assign({method:e,headers:u},s);return wI()||(h.referrerPolicy="no-referrer"),o_.fetch()(c_(n,n.config.apiHost,t,c),h)})}async function a_(n,e,t){n._canInitEmulator=!1;const r=Object.assign(Object.assign({},lb),e);try{const i=new fb(n),s=await Promise.race([t(),i.promise]);i.clearNetworkTimeout();const o=await s.json();if("needConfirmation"in o)throw Hi(n,"account-exists-with-different-credential",o);if(s.ok&&!("errorMessage"in o))return o;{const c=s.ok?o.errorMessage:o.error.message,[u,h]=c.split(" : ");if(u==="FEDERATED_USER_ID_ALREADY_LINKED")throw Hi(n,"credential-already-in-use",o);if(u==="EMAIL_EXISTS")throw Hi(n,"email-already-in-use",o);if(u==="USER_DISABLED")throw Hi(n,"user-disabled",o);const f=r[u]||u.toLowerCase().replace(/[_\s]+/g,"-");if(h)throw kl(n,f,h);Me(n,f)}}catch(i){if(i instanceof Pe)throw i;Me(n,"network-request-failed",{message:String(i)})}}async function Xt(n,e,t,r,i={}){const s=await we(n,e,t,r,i);return"mfaPendingCredential"in s&&Me(n,"multi-factor-auth-required",{_serverResponse:s}),s}function c_(n,e,t,r){const i=`${e}${t}?${r}`;return n.config.emulator?Vl(n.config,i):`${n.config.apiScheme}://${i}`}function db(n){switch(n){case"ENFORCE":return"ENFORCE";case"AUDIT":return"AUDIT";case"OFF":return"OFF";default:return"ENFORCEMENT_STATE_UNSPECIFIED"}}class fb{constructor(e){this.auth=e,this.timer=null,this.promise=new Promise((t,r)=>{this.timer=setTimeout(()=>r(Se(this.auth,"network-request-failed")),hb.get())})}clearNetworkTimeout(){clearTimeout(this.timer)}}function Hi(n,e,t){const r={appName:n.name};t.email&&(r.email=t.email),t.phoneNumber&&(r.phoneNumber=t.phoneNumber);const i=Se(n,e,r);return i.customData._tokenResponse=t,i}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Df(n){return n!==void 0&&n.getResponse!==void 0}function Nf(n){return n!==void 0&&n.enterprise!==void 0}class pb{constructor(e){if(this.siteKey="",this.recaptchaEnforcementState=[],e.recaptchaKey===void 0)throw new Error("recaptchaKey undefined");this.siteKey=e.recaptchaKey.split("/")[3],this.recaptchaEnforcementState=e.recaptchaEnforcementState}getProviderEnforcementState(e){if(!this.recaptchaEnforcementState||this.recaptchaEnforcementState.length===0)return null;for(const t of this.recaptchaEnforcementState)if(t.provider&&t.provider===e)return db(t.enforcementState);return null}isProviderEnabled(e){return this.getProviderEnforcementState(e)==="ENFORCE"||this.getProviderEnforcementState(e)==="AUDIT"}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function mb(n){return(await we(n,"GET","/v1/recaptchaParams")).recaptchaSiteKey||""}async function gb(n,e){return we(n,"GET","/v2/recaptchaConfig",ve(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function _b(n,e){return we(n,"POST","/v1/accounts:delete",e)}async function yb(n,e){return we(n,"POST","/v1/accounts:update",e)}async function u_(n,e){return we(n,"POST","/v1/accounts:lookup",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ts(n){if(n)try{const e=new Date(Number(n));if(!isNaN(e.getTime()))return e.toUTCString()}catch{}}async function Ib(n,e=!1){const t=B(n),r=await t.getIdToken(e),i=ka(r);O(i&&i.exp&&i.auth_time&&i.iat,t.auth,"internal-error");const s=typeof i.firebase=="object"?i.firebase:void 0,o=s==null?void 0:s.sign_in_provider;return{claims:i,token:r,authTime:ts(bc(i.auth_time)),issuedAtTime:ts(bc(i.iat)),expirationTime:ts(bc(i.exp)),signInProvider:o||null,signInSecondFactor:(s==null?void 0:s.sign_in_second_factor)||null}}function bc(n){return Number(n)*1e3}function ka(n){const[e,t,r]=n.split(".");if(e===void 0||t===void 0||r===void 0)return No("JWT malformed, contained fewer than 3 sections"),null;try{const i=dp(t);return i?JSON.parse(i):(No("Failed to decode base64 JWT payload"),null)}catch(i){return No("Caught error parsing JWT payload as JSON",i==null?void 0:i.toString()),null}}function Vf(n){const e=ka(n);return O(e,"internal-error"),O(typeof e.exp<"u","internal-error"),O(typeof e.iat<"u","internal-error"),Number(e.exp)-Number(e.iat)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Wt(n,e,t=!1){if(t)return e;try{return await e}catch(r){throw r instanceof Pe&&vb(r)&&n.auth.currentUser===n&&await n.auth.signOut(),r}}function vb({code:n}){return n==="auth/user-disabled"||n==="auth/user-token-expired"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wb{constructor(e){this.user=e,this.isRunning=!1,this.timerId=null,this.errorBackoff=3e4}_start(){this.isRunning||(this.isRunning=!0,this.schedule())}_stop(){this.isRunning&&(this.isRunning=!1,this.timerId!==null&&clearTimeout(this.timerId))}getInterval(e){var t;if(e){const r=this.errorBackoff;return this.errorBackoff=Math.min(this.errorBackoff*2,96e4),r}else{this.errorBackoff=3e4;const i=((t=this.user.stsTokenManager.expirationTime)!==null&&t!==void 0?t:0)-Date.now()-3e5;return Math.max(0,i)}}schedule(e=!1){if(!this.isRunning)return;const t=this.getInterval(e);this.timerId=setTimeout(async()=>{await this.iteration()},t)}async iteration(){try{await this.user.getIdToken(!0)}catch(e){(e==null?void 0:e.code)==="auth/network-request-failed"&&this.schedule(!0);return}this.schedule()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class au{constructor(e,t){this.createdAt=e,this.lastLoginAt=t,this._initializeTime()}_initializeTime(){this.lastSignInTime=ts(this.lastLoginAt),this.creationTime=ts(this.createdAt)}_copy(e){this.createdAt=e.createdAt,this.lastLoginAt=e.lastLoginAt,this._initializeTime()}toJSON(){return{createdAt:this.createdAt,lastLoginAt:this.lastLoginAt}}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function As(n){var e;const t=n.auth,r=await n.getIdToken(),i=await Wt(n,u_(t,{idToken:r}));O(i==null?void 0:i.users.length,t,"internal-error");const s=i.users[0];n._notifyReloadListener(s);const o=!((e=s.providerUserInfo)===null||e===void 0)&&e.length?l_(s.providerUserInfo):[],c=Eb(n.providerData,o),u=n.isAnonymous,h=!(n.email&&s.passwordHash)&&!(c!=null&&c.length),f=u?h:!1,p={uid:s.localId,displayName:s.displayName||null,photoURL:s.photoUrl||null,email:s.email||null,emailVerified:s.emailVerified||!1,phoneNumber:s.phoneNumber||null,tenantId:s.tenantId||null,providerData:c,metadata:new au(s.createdAt,s.lastLoginAt),isAnonymous:f};Object.assign(n,p)}async function Tb(n){const e=B(n);await As(e),await e.auth._persistUserIfCurrent(e),e.auth._notifyListenersIfCurrent(e)}function Eb(n,e){return[...n.filter(r=>!e.some(i=>i.providerId===r.providerId)),...e]}function l_(n){return n.map(e=>{var{providerId:t}=e,r=Cl(e,["providerId"]);return{providerId:t,uid:r.rawId||"",displayName:r.displayName||null,email:r.email||null,phoneNumber:r.phoneNumber||null,photoURL:r.photoUrl||null}})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ab(n,e){const t=await a_(n,{},async()=>{const r=ii({grant_type:"refresh_token",refresh_token:e}).slice(1),{tokenApiHost:i,apiKey:s}=n.config,o=c_(n,i,"/v1/token",`key=${s}`),c=await n._getAdditionalHeaders();return c["Content-Type"]="application/x-www-form-urlencoded",o_.fetch()(o,{method:"POST",headers:c,body:r})});return{accessToken:t.access_token,expiresIn:t.expires_in,refreshToken:t.refresh_token}}async function bb(n,e){return we(n,"POST","/v2/accounts:revokeToken",ve(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xr{constructor(){this.refreshToken=null,this.accessToken=null,this.expirationTime=null}get isExpired(){return!this.expirationTime||Date.now()>this.expirationTime-3e4}updateFromServerResponse(e){O(e.idToken,"internal-error"),O(typeof e.idToken<"u","internal-error"),O(typeof e.refreshToken<"u","internal-error");const t="expiresIn"in e&&typeof e.expiresIn<"u"?Number(e.expiresIn):Vf(e.idToken);this.updateTokensAndExpiration(e.idToken,e.refreshToken,t)}updateFromIdToken(e){O(e.length!==0,"internal-error");const t=Vf(e);this.updateTokensAndExpiration(e,null,t)}async getToken(e,t=!1){return!t&&this.accessToken&&!this.isExpired?this.accessToken:(O(this.refreshToken,e,"user-token-expired"),this.refreshToken?(await this.refresh(e,this.refreshToken),this.accessToken):null)}clearRefreshToken(){this.refreshToken=null}async refresh(e,t){const{accessToken:r,refreshToken:i,expiresIn:s}=await Ab(e,t);this.updateTokensAndExpiration(r,i,Number(s))}updateTokensAndExpiration(e,t,r){this.refreshToken=t||null,this.accessToken=e||null,this.expirationTime=Date.now()+r*1e3}static fromJSON(e,t){const{refreshToken:r,accessToken:i,expirationTime:s}=t,o=new xr;return r&&(O(typeof r=="string","internal-error",{appName:e}),o.refreshToken=r),i&&(O(typeof i=="string","internal-error",{appName:e}),o.accessToken=i),s&&(O(typeof s=="number","internal-error",{appName:e}),o.expirationTime=s),o}toJSON(){return{refreshToken:this.refreshToken,accessToken:this.accessToken,expirationTime:this.expirationTime}}_assign(e){this.accessToken=e.accessToken,this.refreshToken=e.refreshToken,this.expirationTime=e.expirationTime}_clone(){return Object.assign(new xr,this.toJSON())}_performRefresh(){return At("not implemented")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function un(n,e){O(typeof n=="string"||typeof n>"u","internal-error",{appName:e})}class Ft{constructor(e){var{uid:t,auth:r,stsTokenManager:i}=e,s=Cl(e,["uid","auth","stsTokenManager"]);this.providerId="firebase",this.proactiveRefresh=new wb(this),this.reloadUserInfo=null,this.reloadListener=null,this.uid=t,this.auth=r,this.stsTokenManager=i,this.accessToken=i.accessToken,this.displayName=s.displayName||null,this.email=s.email||null,this.emailVerified=s.emailVerified||!1,this.phoneNumber=s.phoneNumber||null,this.photoURL=s.photoURL||null,this.isAnonymous=s.isAnonymous||!1,this.tenantId=s.tenantId||null,this.providerData=s.providerData?[...s.providerData]:[],this.metadata=new au(s.createdAt||void 0,s.lastLoginAt||void 0)}async getIdToken(e){const t=await Wt(this,this.stsTokenManager.getToken(this.auth,e));return O(t,this.auth,"internal-error"),this.accessToken!==t&&(this.accessToken=t,await this.auth._persistUserIfCurrent(this),this.auth._notifyListenersIfCurrent(this)),t}getIdTokenResult(e){return Ib(this,e)}reload(){return Tb(this)}_assign(e){this!==e&&(O(this.uid===e.uid,this.auth,"internal-error"),this.displayName=e.displayName,this.photoURL=e.photoURL,this.email=e.email,this.emailVerified=e.emailVerified,this.phoneNumber=e.phoneNumber,this.isAnonymous=e.isAnonymous,this.tenantId=e.tenantId,this.providerData=e.providerData.map(t=>Object.assign({},t)),this.metadata._copy(e.metadata),this.stsTokenManager._assign(e.stsTokenManager))}_clone(e){const t=new Ft(Object.assign(Object.assign({},this),{auth:e,stsTokenManager:this.stsTokenManager._clone()}));return t.metadata._copy(this.metadata),t}_onReload(e){O(!this.reloadListener,this.auth,"internal-error"),this.reloadListener=e,this.reloadUserInfo&&(this._notifyReloadListener(this.reloadUserInfo),this.reloadUserInfo=null)}_notifyReloadListener(e){this.reloadListener?this.reloadListener(e):this.reloadUserInfo=e}_startProactiveRefresh(){this.proactiveRefresh._start()}_stopProactiveRefresh(){this.proactiveRefresh._stop()}async _updateTokensIfNecessary(e,t=!1){let r=!1;e.idToken&&e.idToken!==this.stsTokenManager.accessToken&&(this.stsTokenManager.updateFromServerResponse(e),r=!0),t&&await As(this),await this.auth._persistUserIfCurrent(this),r&&this.auth._notifyListenersIfCurrent(this)}async delete(){if(_e(this.auth.app))return Promise.reject(Ne(this.auth));const e=await this.getIdToken();return await Wt(this,_b(this.auth,{idToken:e})),this.stsTokenManager.clearRefreshToken(),this.auth.signOut()}toJSON(){return Object.assign(Object.assign({uid:this.uid,email:this.email||void 0,emailVerified:this.emailVerified,displayName:this.displayName||void 0,isAnonymous:this.isAnonymous,photoURL:this.photoURL||void 0,phoneNumber:this.phoneNumber||void 0,tenantId:this.tenantId||void 0,providerData:this.providerData.map(e=>Object.assign({},e)),stsTokenManager:this.stsTokenManager.toJSON(),_redirectEventId:this._redirectEventId},this.metadata.toJSON()),{apiKey:this.auth.config.apiKey,appName:this.auth.name})}get refreshToken(){return this.stsTokenManager.refreshToken||""}static _fromJSON(e,t){var r,i,s,o,c,u,h,f;const p=(r=t.displayName)!==null&&r!==void 0?r:void 0,g=(i=t.email)!==null&&i!==void 0?i:void 0,T=(s=t.phoneNumber)!==null&&s!==void 0?s:void 0,C=(o=t.photoURL)!==null&&o!==void 0?o:void 0,D=(c=t.tenantId)!==null&&c!==void 0?c:void 0,k=(u=t._redirectEventId)!==null&&u!==void 0?u:void 0,j=(h=t.createdAt)!==null&&h!==void 0?h:void 0,z=(f=t.lastLoginAt)!==null&&f!==void 0?f:void 0,{uid:F,emailVerified:G,isAnonymous:J,providerData:K,stsTokenManager:v}=t;O(F&&v,e,"internal-error");const _=xr.fromJSON(this.name,v);O(typeof F=="string",e,"internal-error"),un(p,e.name),un(g,e.name),O(typeof G=="boolean",e,"internal-error"),O(typeof J=="boolean",e,"internal-error"),un(T,e.name),un(C,e.name),un(D,e.name),un(k,e.name),un(j,e.name),un(z,e.name);const y=new Ft({uid:F,auth:e,email:g,emailVerified:G,displayName:p,isAnonymous:J,photoURL:C,phoneNumber:T,tenantId:D,stsTokenManager:_,createdAt:j,lastLoginAt:z});return K&&Array.isArray(K)&&(y.providerData=K.map(w=>Object.assign({},w))),k&&(y._redirectEventId=k),y}static async _fromIdTokenResponse(e,t,r=!1){const i=new xr;i.updateFromServerResponse(t);const s=new Ft({uid:t.localId,auth:e,stsTokenManager:i,isAnonymous:r});return await As(s),s}static async _fromGetAccountInfoResponse(e,t,r){const i=t.users[0];O(i.localId!==void 0,"internal-error");const s=i.providerUserInfo!==void 0?l_(i.providerUserInfo):[],o=!(i.email&&i.passwordHash)&&!(s!=null&&s.length),c=new xr;c.updateFromIdToken(r);const u=new Ft({uid:i.localId,auth:e,stsTokenManager:c,isAnonymous:o}),h={uid:i.localId,displayName:i.displayName||null,photoURL:i.photoUrl||null,email:i.email||null,emailVerified:i.emailVerified||!1,phoneNumber:i.phoneNumber||null,tenantId:i.tenantId||null,providerData:s,metadata:new au(i.createdAt,i.lastLoginAt),isAnonymous:!(i.email&&i.passwordHash)&&!(s!=null&&s.length)};return Object.assign(u,h),u}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Of=new Map;function ut(n){gt(n instanceof Function,"Expected a class definition");let e=Of.get(n);return e?(gt(e instanceof n,"Instance stored in cache mismatched with class"),e):(e=new n,Of.set(n,e),e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class h_{constructor(){this.type="NONE",this.storage={}}async _isAvailable(){return!0}async _set(e,t){this.storage[e]=t}async _get(e){const t=this.storage[e];return t===void 0?null:t}async _remove(e){delete this.storage[e]}_addListener(e,t){}_removeListener(e,t){}}h_.type="NONE";const ni=h_;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Hn(n,e,t){return`firebase:${n}:${e}:${t}`}class Lr{constructor(e,t,r){this.persistence=e,this.auth=t,this.userKey=r;const{config:i,name:s}=this.auth;this.fullUserKey=Hn(this.userKey,i.apiKey,s),this.fullPersistenceKey=Hn("persistence",i.apiKey,s),this.boundEventHandler=t._onStorageEvent.bind(t),this.persistence._addListener(this.fullUserKey,this.boundEventHandler)}setCurrentUser(e){return this.persistence._set(this.fullUserKey,e.toJSON())}async getCurrentUser(){const e=await this.persistence._get(this.fullUserKey);return e?Ft._fromJSON(this.auth,e):null}removeCurrentUser(){return this.persistence._remove(this.fullUserKey)}savePersistenceForRedirect(){return this.persistence._set(this.fullPersistenceKey,this.persistence.type)}async setPersistence(e){if(this.persistence===e)return;const t=await this.getCurrentUser();if(await this.removeCurrentUser(),this.persistence=e,t)return this.setCurrentUser(t)}delete(){this.persistence._removeListener(this.fullUserKey,this.boundEventHandler)}static async create(e,t,r="authUser"){if(!t.length)return new Lr(ut(ni),e,r);const i=(await Promise.all(t.map(async h=>{if(await h._isAvailable())return h}))).filter(h=>h);let s=i[0]||ut(ni);const o=Hn(r,e.config.apiKey,e.name);let c=null;for(const h of t)try{const f=await h._get(o);if(f){const p=Ft._fromJSON(e,f);h!==s&&(c=p),s=h;break}}catch{}const u=i.filter(h=>h._shouldAllowMigration);return!s._shouldAllowMigration||!u.length?new Lr(s,e,r):(s=u[0],c&&await s._set(o,c.toJSON()),await Promise.all(t.map(async h=>{if(h!==s)try{await h._remove(o)}catch{}})),new Lr(s,e,r))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xf(n){const e=n.toLowerCase();if(e.includes("opera/")||e.includes("opr/")||e.includes("opios/"))return"Opera";if(m_(e))return"IEMobile";if(e.includes("msie")||e.includes("trident/"))return"IE";if(e.includes("edge/"))return"Edge";if(d_(e))return"Firefox";if(e.includes("silk/"))return"Silk";if(g_(e))return"Blackberry";if(__(e))return"Webos";if(f_(e))return"Safari";if((e.includes("chrome/")||p_(e))&&!e.includes("edge/"))return"Chrome";if(js(e))return"Android";{const t=/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/,r=n.match(t);if((r==null?void 0:r.length)===2)return r[1]}return"Other"}function d_(n=pe()){return/firefox\//i.test(n)}function f_(n=pe()){const e=n.toLowerCase();return e.includes("safari/")&&!e.includes("chrome/")&&!e.includes("crios/")&&!e.includes("android")}function p_(n=pe()){return/crios\//i.test(n)}function m_(n=pe()){return/iemobile/i.test(n)}function js(n=pe()){return/android/i.test(n)}function g_(n=pe()){return/blackberry/i.test(n)}function __(n=pe()){return/webos/i.test(n)}function $s(n=pe()){return/iphone|ipad|ipod/i.test(n)||/macintosh/i.test(n)&&/mobile/i.test(n)}function Rb(n=pe()){return/(iPad|iPhone|iPod).*OS 7_\d/i.test(n)||/(iPad|iPhone|iPod).*OS 8_\d/i.test(n)}function Pb(n=pe()){var e;return $s(n)&&!!(!((e=window.navigator)===null||e===void 0)&&e.standalone)}function Sb(){return yp()&&document.documentMode===10}function y_(n=pe()){return $s(n)||js(n)||__(n)||g_(n)||/windows phone/i.test(n)||m_(n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function I_(n,e=[]){let t;switch(n){case"Browser":t=xf(pe());break;case"Worker":t=`${xf(pe())}-${n}`;break;default:t=n}const r=e.length?e.join(","):"FirebaseCore-web";return`${t}/JsCore/${Ht}/${r}`}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Cb{constructor(e){this.auth=e,this.queue=[]}pushCallback(e,t){const r=s=>new Promise((o,c)=>{try{const u=e(s);o(u)}catch(u){c(u)}});r.onAbort=t,this.queue.push(r);const i=this.queue.length-1;return()=>{this.queue[i]=()=>Promise.resolve()}}async runMiddleware(e){if(this.auth.currentUser===e)return;const t=[];try{for(const r of this.queue)await r(e),r.onAbort&&t.push(r.onAbort)}catch(r){t.reverse();for(const i of t)try{i()}catch{}throw this.auth._errorFactory.create("login-blocked",{originalMessage:r==null?void 0:r.message})}}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function kb(n,e={}){return we(n,"GET","/v2/passwordPolicy",ve(n,e))}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Db=6;class Nb{constructor(e){var t,r,i,s;const o=e.customStrengthOptions;this.customStrengthOptions={},this.customStrengthOptions.minPasswordLength=(t=o.minPasswordLength)!==null&&t!==void 0?t:Db,o.maxPasswordLength&&(this.customStrengthOptions.maxPasswordLength=o.maxPasswordLength),o.containsLowercaseCharacter!==void 0&&(this.customStrengthOptions.containsLowercaseLetter=o.containsLowercaseCharacter),o.containsUppercaseCharacter!==void 0&&(this.customStrengthOptions.containsUppercaseLetter=o.containsUppercaseCharacter),o.containsNumericCharacter!==void 0&&(this.customStrengthOptions.containsNumericCharacter=o.containsNumericCharacter),o.containsNonAlphanumericCharacter!==void 0&&(this.customStrengthOptions.containsNonAlphanumericCharacter=o.containsNonAlphanumericCharacter),this.enforcementState=e.enforcementState,this.enforcementState==="ENFORCEMENT_STATE_UNSPECIFIED"&&(this.enforcementState="OFF"),this.allowedNonAlphanumericCharacters=(i=(r=e.allowedNonAlphanumericCharacters)===null||r===void 0?void 0:r.join(""))!==null&&i!==void 0?i:"",this.forceUpgradeOnSignin=(s=e.forceUpgradeOnSignin)!==null&&s!==void 0?s:!1,this.schemaVersion=e.schemaVersion}validatePassword(e){var t,r,i,s,o,c;const u={isValid:!0,passwordPolicy:this};return this.validatePasswordLengthOptions(e,u),this.validatePasswordCharacterOptions(e,u),u.isValid&&(u.isValid=(t=u.meetsMinPasswordLength)!==null&&t!==void 0?t:!0),u.isValid&&(u.isValid=(r=u.meetsMaxPasswordLength)!==null&&r!==void 0?r:!0),u.isValid&&(u.isValid=(i=u.containsLowercaseLetter)!==null&&i!==void 0?i:!0),u.isValid&&(u.isValid=(s=u.containsUppercaseLetter)!==null&&s!==void 0?s:!0),u.isValid&&(u.isValid=(o=u.containsNumericCharacter)!==null&&o!==void 0?o:!0),u.isValid&&(u.isValid=(c=u.containsNonAlphanumericCharacter)!==null&&c!==void 0?c:!0),u}validatePasswordLengthOptions(e,t){const r=this.customStrengthOptions.minPasswordLength,i=this.customStrengthOptions.maxPasswordLength;r&&(t.meetsMinPasswordLength=e.length>=r),i&&(t.meetsMaxPasswordLength=e.length<=i)}validatePasswordCharacterOptions(e,t){this.updatePasswordCharacterOptionsStatuses(t,!1,!1,!1,!1);let r;for(let i=0;i<e.length;i++)r=e.charAt(i),this.updatePasswordCharacterOptionsStatuses(t,r>="a"&&r<="z",r>="A"&&r<="Z",r>="0"&&r<="9",this.allowedNonAlphanumericCharacters.includes(r))}updatePasswordCharacterOptionsStatuses(e,t,r,i,s){this.customStrengthOptions.containsLowercaseLetter&&(e.containsLowercaseLetter||(e.containsLowercaseLetter=t)),this.customStrengthOptions.containsUppercaseLetter&&(e.containsUppercaseLetter||(e.containsUppercaseLetter=r)),this.customStrengthOptions.containsNumericCharacter&&(e.containsNumericCharacter||(e.containsNumericCharacter=i)),this.customStrengthOptions.containsNonAlphanumericCharacter&&(e.containsNonAlphanumericCharacter||(e.containsNonAlphanumericCharacter=s))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vb{constructor(e,t,r,i){this.app=e,this.heartbeatServiceProvider=t,this.appCheckServiceProvider=r,this.config=i,this.currentUser=null,this.emulatorConfig=null,this.operations=Promise.resolve(),this.authStateSubscription=new Lf(this),this.idTokenSubscription=new Lf(this),this.beforeStateQueue=new Cb(this),this.redirectUser=null,this.isProactiveRefreshEnabled=!1,this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION=1,this._canInitEmulator=!0,this._isInitialized=!1,this._deleted=!1,this._initializationPromise=null,this._popupRedirectResolver=null,this._errorFactory=s_,this._agentRecaptchaConfig=null,this._tenantRecaptchaConfigs={},this._projectPasswordPolicy=null,this._tenantPasswordPolicies={},this.lastNotifiedUid=void 0,this.languageCode=null,this.tenantId=null,this.settings={appVerificationDisabledForTesting:!1},this.frameworks=[],this.name=e.name,this.clientVersion=i.sdkClientVersion}_initializeWithPersistence(e,t){return t&&(this._popupRedirectResolver=ut(t)),this._initializationPromise=this.queue(async()=>{var r,i;if(!this._deleted&&(this.persistenceManager=await Lr.create(this,e),!this._deleted)){if(!((r=this._popupRedirectResolver)===null||r===void 0)&&r._shouldInitProactively)try{await this._popupRedirectResolver._initialize(this)}catch{}await this.initializeCurrentUser(t),this.lastNotifiedUid=((i=this.currentUser)===null||i===void 0?void 0:i.uid)||null,!this._deleted&&(this._isInitialized=!0)}}),this._initializationPromise}async _onStorageEvent(){if(this._deleted)return;const e=await this.assertedPersistence.getCurrentUser();if(!(!this.currentUser&&!e)){if(this.currentUser&&e&&this.currentUser.uid===e.uid){this._currentUser._assign(e),await this.currentUser.getIdToken();return}await this._updateCurrentUser(e,!0)}}async initializeCurrentUserFromIdToken(e){try{const t=await u_(this,{idToken:e}),r=await Ft._fromGetAccountInfoResponse(this,t,e);await this.directlySetCurrentUser(r)}catch(t){console.warn("FirebaseServerApp could not login user with provided authIdToken: ",t),await this.directlySetCurrentUser(null)}}async initializeCurrentUser(e){var t;if(_e(this.app)){const o=this.app.settings.authIdToken;return o?new Promise(c=>{setTimeout(()=>this.initializeCurrentUserFromIdToken(o).then(c,c))}):this.directlySetCurrentUser(null)}const r=await this.assertedPersistence.getCurrentUser();let i=r,s=!1;if(e&&this.config.authDomain){await this.getOrInitRedirectPersistenceManager();const o=(t=this.redirectUser)===null||t===void 0?void 0:t._redirectEventId,c=i==null?void 0:i._redirectEventId,u=await this.tryRedirectSignIn(e);(!o||o===c)&&(u!=null&&u.user)&&(i=u.user,s=!0)}if(!i)return this.directlySetCurrentUser(null);if(!i._redirectEventId){if(s)try{await this.beforeStateQueue.runMiddleware(i)}catch(o){i=r,this._popupRedirectResolver._overrideRedirectResult(this,()=>Promise.reject(o))}return i?this.reloadAndSetCurrentUserOrClear(i):this.directlySetCurrentUser(null)}return O(this._popupRedirectResolver,this,"argument-error"),await this.getOrInitRedirectPersistenceManager(),this.redirectUser&&this.redirectUser._redirectEventId===i._redirectEventId?this.directlySetCurrentUser(i):this.reloadAndSetCurrentUserOrClear(i)}async tryRedirectSignIn(e){let t=null;try{t=await this._popupRedirectResolver._completeRedirectFn(this,e,!0)}catch{await this._setRedirectUser(null)}return t}async reloadAndSetCurrentUserOrClear(e){try{await As(e)}catch(t){if((t==null?void 0:t.code)!=="auth/network-request-failed")return this.directlySetCurrentUser(null)}return this.directlySetCurrentUser(e)}useDeviceLanguage(){this.languageCode=ub()}async _delete(){this._deleted=!0}async updateCurrentUser(e){if(_e(this.app))return Promise.reject(Ne(this));const t=e?B(e):null;return t&&O(t.auth.config.apiKey===this.config.apiKey,this,"invalid-user-token"),this._updateCurrentUser(t&&t._clone(this))}async _updateCurrentUser(e,t=!1){if(!this._deleted)return e&&O(this.tenantId===e.tenantId,this,"tenant-id-mismatch"),t||await this.beforeStateQueue.runMiddleware(e),this.queue(async()=>{await this.directlySetCurrentUser(e),this.notifyAuthListeners()})}async signOut(){return _e(this.app)?Promise.reject(Ne(this)):(await this.beforeStateQueue.runMiddleware(null),(this.redirectPersistenceManager||this._popupRedirectResolver)&&await this._setRedirectUser(null),this._updateCurrentUser(null,!0))}setPersistence(e){return _e(this.app)?Promise.reject(Ne(this)):this.queue(async()=>{await this.assertedPersistence.setPersistence(ut(e))})}_getRecaptchaConfig(){return this.tenantId==null?this._agentRecaptchaConfig:this._tenantRecaptchaConfigs[this.tenantId]}async validatePassword(e){this._getPasswordPolicyInternal()||await this._updatePasswordPolicy();const t=this._getPasswordPolicyInternal();return t.schemaVersion!==this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION?Promise.reject(this._errorFactory.create("unsupported-password-policy-schema-version",{})):t.validatePassword(e)}_getPasswordPolicyInternal(){return this.tenantId===null?this._projectPasswordPolicy:this._tenantPasswordPolicies[this.tenantId]}async _updatePasswordPolicy(){const e=await kb(this),t=new Nb(e);this.tenantId===null?this._projectPasswordPolicy=t:this._tenantPasswordPolicies[this.tenantId]=t}_getPersistence(){return this.assertedPersistence.persistence.type}_updateErrorMap(e){this._errorFactory=new lr("auth","Firebase",e())}onAuthStateChanged(e,t,r){return this.registerStateListener(this.authStateSubscription,e,t,r)}beforeAuthStateChanged(e,t){return this.beforeStateQueue.pushCallback(e,t)}onIdTokenChanged(e,t,r){return this.registerStateListener(this.idTokenSubscription,e,t,r)}authStateReady(){return new Promise((e,t)=>{if(this.currentUser)e();else{const r=this.onAuthStateChanged(()=>{r(),e()},t)}})}async revokeAccessToken(e){if(this.currentUser){const t=await this.currentUser.getIdToken(),r={providerId:"apple.com",tokenType:"ACCESS_TOKEN",token:e,idToken:t};this.tenantId!=null&&(r.tenantId=this.tenantId),await bb(this,r)}}toJSON(){var e;return{apiKey:this.config.apiKey,authDomain:this.config.authDomain,appName:this.name,currentUser:(e=this._currentUser)===null||e===void 0?void 0:e.toJSON()}}async _setRedirectUser(e,t){const r=await this.getOrInitRedirectPersistenceManager(t);return e===null?r.removeCurrentUser():r.setCurrentUser(e)}async getOrInitRedirectPersistenceManager(e){if(!this.redirectPersistenceManager){const t=e&&ut(e)||this._popupRedirectResolver;O(t,this,"argument-error"),this.redirectPersistenceManager=await Lr.create(this,[ut(t._redirectPersistence)],"redirectUser"),this.redirectUser=await this.redirectPersistenceManager.getCurrentUser()}return this.redirectPersistenceManager}async _redirectUserForId(e){var t,r;return this._isInitialized&&await this.queue(async()=>{}),((t=this._currentUser)===null||t===void 0?void 0:t._redirectEventId)===e?this._currentUser:((r=this.redirectUser)===null||r===void 0?void 0:r._redirectEventId)===e?this.redirectUser:null}async _persistUserIfCurrent(e){if(e===this.currentUser)return this.queue(async()=>this.directlySetCurrentUser(e))}_notifyListenersIfCurrent(e){e===this.currentUser&&this.notifyAuthListeners()}_key(){return`${this.config.authDomain}:${this.config.apiKey}:${this.name}`}_startProactiveRefresh(){this.isProactiveRefreshEnabled=!0,this.currentUser&&this._currentUser._startProactiveRefresh()}_stopProactiveRefresh(){this.isProactiveRefreshEnabled=!1,this.currentUser&&this._currentUser._stopProactiveRefresh()}get _currentUser(){return this.currentUser}notifyAuthListeners(){var e,t;if(!this._isInitialized)return;this.idTokenSubscription.next(this.currentUser);const r=(t=(e=this.currentUser)===null||e===void 0?void 0:e.uid)!==null&&t!==void 0?t:null;this.lastNotifiedUid!==r&&(this.lastNotifiedUid=r,this.authStateSubscription.next(this.currentUser))}registerStateListener(e,t,r,i){if(this._deleted)return()=>{};const s=typeof t=="function"?t:t.next.bind(t);let o=!1;const c=this._isInitialized?Promise.resolve():this._initializationPromise;if(O(c,this,"internal-error"),c.then(()=>{o||s(this.currentUser)}),typeof t=="function"){const u=e.addObserver(t,r,i);return()=>{o=!0,u()}}else{const u=e.addObserver(t);return()=>{o=!0,u()}}}async directlySetCurrentUser(e){this.currentUser&&this.currentUser!==e&&this._currentUser._stopProactiveRefresh(),e&&this.isProactiveRefreshEnabled&&e._startProactiveRefresh(),this.currentUser=e,e?await this.assertedPersistence.setCurrentUser(e):await this.assertedPersistence.removeCurrentUser()}queue(e){return this.operations=this.operations.then(e,e),this.operations}get assertedPersistence(){return O(this.persistenceManager,this,"internal-error"),this.persistenceManager}_logFramework(e){!e||this.frameworks.includes(e)||(this.frameworks.push(e),this.frameworks.sort(),this.clientVersion=I_(this.config.clientPlatform,this._getFrameworks()))}_getFrameworks(){return this.frameworks}async _getAdditionalHeaders(){var e;const t={"X-Client-Version":this.clientVersion};this.app.options.appId&&(t["X-Firebase-gmpid"]=this.app.options.appId);const r=await((e=this.heartbeatServiceProvider.getImmediate({optional:!0}))===null||e===void 0?void 0:e.getHeartbeatsHeader());r&&(t["X-Firebase-Client"]=r);const i=await this._getAppCheckToken();return i&&(t["X-Firebase-AppCheck"]=i),t}async _getAppCheckToken(){var e;const t=await((e=this.appCheckServiceProvider.getImmediate({optional:!0}))===null||e===void 0?void 0:e.getToken());return t!=null&&t.error&&ab(`Error while retrieving App Check token: ${t.error}`),t==null?void 0:t.token}}function Ie(n){return B(n)}class Lf{constructor(e){this.auth=e,this.observer=null,this.addObserver=vp(t=>this.observer=t)}get next(){return O(this.observer,this.auth,"internal-error"),this.observer.next.bind(this.observer)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let zs={async loadJS(){throw new Error("Unable to load external scripts")},recaptchaV2Script:"",recaptchaEnterpriseScript:"",gapiScript:""};function Ob(n){zs=n}function Ol(n){return zs.loadJS(n)}function xb(){return zs.recaptchaV2Script}function Lb(){return zs.recaptchaEnterpriseScript}function Mb(){return zs.gapiScript}function v_(n){return`__${n}${Math.floor(Math.random()*1e6)}`}const Fb="recaptcha-enterprise",Ub="NO_RECAPTCHA";class Bb{constructor(e){this.type=Fb,this.auth=Ie(e)}async verify(e="verify",t=!1){async function r(s){if(!t){if(s.tenantId==null&&s._agentRecaptchaConfig!=null)return s._agentRecaptchaConfig.siteKey;if(s.tenantId!=null&&s._tenantRecaptchaConfigs[s.tenantId]!==void 0)return s._tenantRecaptchaConfigs[s.tenantId].siteKey}return new Promise(async(o,c)=>{gb(s,{clientType:"CLIENT_TYPE_WEB",version:"RECAPTCHA_ENTERPRISE"}).then(u=>{if(u.recaptchaKey===void 0)c(new Error("recaptcha Enterprise site key undefined"));else{const h=new pb(u);return s.tenantId==null?s._agentRecaptchaConfig=h:s._tenantRecaptchaConfigs[s.tenantId]=h,o(h.siteKey)}}).catch(u=>{c(u)})})}function i(s,o,c){const u=window.grecaptcha;Nf(u)?u.enterprise.ready(()=>{u.enterprise.execute(s,{action:e}).then(h=>{o(h)}).catch(()=>{o(Ub)})}):c(Error("No reCAPTCHA enterprise script loaded."))}return new Promise((s,o)=>{r(this.auth).then(c=>{if(!t&&Nf(window.grecaptcha))i(c,s,o);else{if(typeof window>"u"){o(new Error("RecaptchaVerifier is only supported in browser"));return}let u=Lb();u.length!==0&&(u+=c),Ol(u).then(()=>{i(c,s,o)}).catch(h=>{o(h)})}}).catch(c=>{o(c)})})}}async function Mf(n,e,t,r=!1){const i=new Bb(n);let s;try{s=await i.verify(t)}catch{s=await i.verify(t,!0)}const o=Object.assign({},e);return r?Object.assign(o,{captchaResp:s}):Object.assign(o,{captchaResponse:s}),Object.assign(o,{clientType:"CLIENT_TYPE_WEB"}),Object.assign(o,{recaptchaVersion:"RECAPTCHA_ENTERPRISE"}),o}async function bs(n,e,t,r){var i;if(!((i=n._getRecaptchaConfig())===null||i===void 0)&&i.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")){const s=await Mf(n,e,t,t==="getOobCode");return r(n,s)}else return r(n,e).catch(async s=>{if(s.code==="auth/missing-recaptcha-token"){console.log(`${t} is protected by reCAPTCHA Enterprise for this project. Automatically triggering the reCAPTCHA flow and restarting the flow.`);const o=await Mf(n,e,t,t==="getOobCode");return r(n,o)}else return Promise.reject(s)})}function qb(n,e){const t=(e==null?void 0:e.persistence)||[],r=(Array.isArray(t)?t:[t]).map(ut);e!=null&&e.errorMap&&n._updateErrorMap(e.errorMap),n._initializeWithPersistence(r,e==null?void 0:e.popupRedirectResolver)}function jb(n,e,t){const r=Ie(n);O(r._canInitEmulator,r,"emulator-config-failed"),O(/^https?:\/\//.test(e),r,"invalid-emulator-scheme");const i=!!(t!=null&&t.disableWarnings),s=w_(e),{host:o,port:c}=$b(e),u=c===null?"":`:${c}`;r.config.emulator={url:`${s}//${o}${u}/`},r.settings.appVerificationDisabledForTesting=!0,r.emulatorConfig=Object.freeze({host:o,port:c,protocol:s.replace(":",""),options:Object.freeze({disableWarnings:i})}),i||zb()}function w_(n){const e=n.indexOf(":");return e<0?"":n.substr(0,e+1)}function $b(n){const e=w_(n),t=/(\/\/)?([^?#/]+)/.exec(n.substr(e.length));if(!t)return{host:"",port:null};const r=t[2].split("@").pop()||"",i=/^(\[[^\]]+\])(:|$)/.exec(r);if(i){const s=i[1];return{host:s,port:Ff(r.substr(s.length+1))}}else{const[s,o]=r.split(":");return{host:s,port:Ff(o)}}}function Ff(n){if(!n)return null;const e=Number(n);return isNaN(e)?null:e}function zb(){function n(){const e=document.createElement("p"),t=e.style;e.innerText="Running in emulator mode. Do not use with production credentials.",t.position="fixed",t.width="100%",t.backgroundColor="#ffffff",t.border=".1em solid #000000",t.color="#b50000",t.bottom="0px",t.left="0px",t.margin="0px",t.zIndex="10000",t.textAlign="center",e.classList.add("firebase-emulator-warning"),document.body.appendChild(e)}typeof console<"u"&&typeof console.info=="function"&&console.info("WARNING: You are using the Auth Emulator, which is intended for local testing only.  Do not use with production credentials."),typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?window.addEventListener("DOMContentLoaded",n):n())}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pi{constructor(e,t){this.providerId=e,this.signInMethod=t}toJSON(){return At("not implemented")}_getIdTokenResponse(e){return At("not implemented")}_linkToIdToken(e,t){return At("not implemented")}_getReauthenticationResolver(e){return At("not implemented")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function T_(n,e){return we(n,"POST","/v1/accounts:resetPassword",ve(n,e))}async function Gb(n,e){return we(n,"POST","/v1/accounts:update",e)}async function Kb(n,e){return we(n,"POST","/v1/accounts:signUp",e)}async function Wb(n,e){return we(n,"POST","/v1/accounts:update",ve(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Hb(n,e){return Xt(n,"POST","/v1/accounts:signInWithPassword",ve(n,e))}async function Da(n,e){return we(n,"POST","/v1/accounts:sendOobCode",ve(n,e))}async function Qb(n,e){return Da(n,e)}async function Jb(n,e){return Da(n,e)}async function Yb(n,e){return Da(n,e)}async function Xb(n,e){return Da(n,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Zb(n,e){return Xt(n,"POST","/v1/accounts:signInWithEmailLink",ve(n,e))}async function eR(n,e){return Xt(n,"POST","/v1/accounts:signInWithEmailLink",ve(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rs extends pi{constructor(e,t,r,i=null){super("password",r),this._email=e,this._password=t,this._tenantId=i}static _fromEmailAndPassword(e,t){return new Rs(e,t,"password")}static _fromEmailAndCode(e,t,r=null){return new Rs(e,t,"emailLink",r)}toJSON(){return{email:this._email,password:this._password,signInMethod:this.signInMethod,tenantId:this._tenantId}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e;if(t!=null&&t.email&&(t!=null&&t.password)){if(t.signInMethod==="password")return this._fromEmailAndPassword(t.email,t.password);if(t.signInMethod==="emailLink")return this._fromEmailAndCode(t.email,t.password,t.tenantId)}return null}async _getIdTokenResponse(e){switch(this.signInMethod){case"password":const t={returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return bs(e,t,"signInWithPassword",Hb);case"emailLink":return Zb(e,{email:this._email,oobCode:this._password});default:Me(e,"internal-error")}}async _linkToIdToken(e,t){switch(this.signInMethod){case"password":const r={idToken:t,returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return bs(e,r,"signUpPassword",Kb);case"emailLink":return eR(e,{idToken:t,email:this._email,oobCode:this._password});default:Me(e,"internal-error")}}_getReauthenticationResolver(e){return this._getIdTokenResponse(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function jt(n,e){return Xt(n,"POST","/v1/accounts:signInWithIdp",ve(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const tR="http://localhost";class Nt extends pi{constructor(){super(...arguments),this.pendingToken=null}static _fromParams(e){const t=new Nt(e.providerId,e.signInMethod);return e.idToken||e.accessToken?(e.idToken&&(t.idToken=e.idToken),e.accessToken&&(t.accessToken=e.accessToken),e.nonce&&!e.pendingToken&&(t.nonce=e.nonce),e.pendingToken&&(t.pendingToken=e.pendingToken)):e.oauthToken&&e.oauthTokenSecret?(t.accessToken=e.oauthToken,t.secret=e.oauthTokenSecret):Me("argument-error"),t}toJSON(){return{idToken:this.idToken,accessToken:this.accessToken,secret:this.secret,nonce:this.nonce,pendingToken:this.pendingToken,providerId:this.providerId,signInMethod:this.signInMethod}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e,{providerId:r,signInMethod:i}=t,s=Cl(t,["providerId","signInMethod"]);if(!r||!i)return null;const o=new Nt(r,i);return o.idToken=s.idToken||void 0,o.accessToken=s.accessToken||void 0,o.secret=s.secret,o.nonce=s.nonce,o.pendingToken=s.pendingToken||null,o}_getIdTokenResponse(e){const t=this.buildRequest();return jt(e,t)}_linkToIdToken(e,t){const r=this.buildRequest();return r.idToken=t,jt(e,r)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,jt(e,t)}buildRequest(){const e={requestUri:tR,returnSecureToken:!0};if(this.pendingToken)e.pendingToken=this.pendingToken;else{const t={};this.idToken&&(t.id_token=this.idToken),this.accessToken&&(t.access_token=this.accessToken),this.secret&&(t.oauth_token_secret=this.secret),t.providerId=this.providerId,this.nonce&&!this.pendingToken&&(t.nonce=this.nonce),e.postBody=ii(t)}return e}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function nR(n,e){return we(n,"POST","/v1/accounts:sendVerificationCode",ve(n,e))}async function rR(n,e){return Xt(n,"POST","/v1/accounts:signInWithPhoneNumber",ve(n,e))}async function iR(n,e){const t=await Xt(n,"POST","/v1/accounts:signInWithPhoneNumber",ve(n,e));if(t.temporaryProof)throw Hi(n,"account-exists-with-different-credential",t);return t}const sR={USER_NOT_FOUND:"user-not-found"};async function oR(n,e){const t=Object.assign(Object.assign({},e),{operation:"REAUTH"});return Xt(n,"POST","/v1/accounts:signInWithPhoneNumber",ve(n,t),sR)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qn extends pi{constructor(e){super("phone","phone"),this.params=e}static _fromVerification(e,t){return new Qn({verificationId:e,verificationCode:t})}static _fromTokenResponse(e,t){return new Qn({phoneNumber:e,temporaryProof:t})}_getIdTokenResponse(e){return rR(e,this._makeVerificationRequest())}_linkToIdToken(e,t){return iR(e,Object.assign({idToken:t},this._makeVerificationRequest()))}_getReauthenticationResolver(e){return oR(e,this._makeVerificationRequest())}_makeVerificationRequest(){const{temporaryProof:e,phoneNumber:t,verificationId:r,verificationCode:i}=this.params;return e&&t?{temporaryProof:e,phoneNumber:t}:{sessionInfo:r,code:i}}toJSON(){const e={providerId:this.providerId};return this.params.phoneNumber&&(e.phoneNumber=this.params.phoneNumber),this.params.temporaryProof&&(e.temporaryProof=this.params.temporaryProof),this.params.verificationCode&&(e.verificationCode=this.params.verificationCode),this.params.verificationId&&(e.verificationId=this.params.verificationId),e}static fromJSON(e){typeof e=="string"&&(e=JSON.parse(e));const{verificationId:t,verificationCode:r,phoneNumber:i,temporaryProof:s}=e;return!r&&!t&&!i&&!s?null:new Qn({verificationId:t,verificationCode:r,phoneNumber:i,temporaryProof:s})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function aR(n){switch(n){case"recoverEmail":return"RECOVER_EMAIL";case"resetPassword":return"PASSWORD_RESET";case"signIn":return"EMAIL_SIGNIN";case"verifyEmail":return"VERIFY_EMAIL";case"verifyAndChangeEmail":return"VERIFY_AND_CHANGE_EMAIL";case"revertSecondFactorAddition":return"REVERT_SECOND_FACTOR_ADDITION";default:return null}}function cR(n){const e=Nr($i(n)).link,t=e?Nr($i(e)).deep_link_id:null,r=Nr($i(n)).deep_link_id;return(r?Nr($i(r)).link:null)||r||t||e||n}class Na{constructor(e){var t,r,i,s,o,c;const u=Nr($i(e)),h=(t=u.apiKey)!==null&&t!==void 0?t:null,f=(r=u.oobCode)!==null&&r!==void 0?r:null,p=aR((i=u.mode)!==null&&i!==void 0?i:null);O(h&&f&&p,"argument-error"),this.apiKey=h,this.operation=p,this.code=f,this.continueUrl=(s=u.continueUrl)!==null&&s!==void 0?s:null,this.languageCode=(o=u.languageCode)!==null&&o!==void 0?o:null,this.tenantId=(c=u.tenantId)!==null&&c!==void 0?c:null}static parseLink(e){const t=cR(e);try{return new Na(t)}catch{return null}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kn{constructor(){this.providerId=kn.PROVIDER_ID}static credential(e,t){return Rs._fromEmailAndPassword(e,t)}static credentialWithLink(e,t){const r=Na.parseLink(t);return O(r,"argument-error"),Rs._fromEmailAndCode(e,r.code,r.tenantId)}}kn.PROVIDER_ID="password";kn.EMAIL_PASSWORD_SIGN_IN_METHOD="password";kn.EMAIL_LINK_SIGN_IN_METHOD="emailLink";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zt{constructor(e){this.providerId=e,this.defaultLanguageCode=null,this.customParameters={}}setDefaultLanguage(e){this.defaultLanguageCode=e}setCustomParameters(e){return this.customParameters=e,this}getCustomParameters(){return this.customParameters}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mi extends Zt{constructor(){super(...arguments),this.scopes=[]}addScope(e){return this.scopes.includes(e)||this.scopes.push(e),this}getScopes(){return[...this.scopes]}}class Mr extends mi{static credentialFromJSON(e){const t=typeof e=="string"?JSON.parse(e):e;return O("providerId"in t&&"signInMethod"in t,"argument-error"),Nt._fromParams(t)}credential(e){return this._credential(Object.assign(Object.assign({},e),{nonce:e.rawNonce}))}_credential(e){return O(e.idToken||e.accessToken,"argument-error"),Nt._fromParams(Object.assign(Object.assign({},e),{providerId:this.providerId,signInMethod:this.providerId}))}static credentialFromResult(e){return Mr.oauthCredentialFromTaggedObject(e)}static credentialFromError(e){return Mr.oauthCredentialFromTaggedObject(e.customData||{})}static oauthCredentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:r,oauthTokenSecret:i,pendingToken:s,nonce:o,providerId:c}=e;if(!r&&!i&&!t&&!s||!c)return null;try{return new Mr(c)._credential({idToken:t,accessToken:r,nonce:o,pendingToken:s})}catch{return null}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _t extends mi{constructor(){super("facebook.com")}static credential(e){return Nt._fromParams({providerId:_t.PROVIDER_ID,signInMethod:_t.FACEBOOK_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return _t.credentialFromTaggedObject(e)}static credentialFromError(e){return _t.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return _t.credential(e.oauthAccessToken)}catch{return null}}}_t.FACEBOOK_SIGN_IN_METHOD="facebook.com";_t.PROVIDER_ID="facebook.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class yt extends mi{constructor(){super("google.com"),this.addScope("profile")}static credential(e,t){return Nt._fromParams({providerId:yt.PROVIDER_ID,signInMethod:yt.GOOGLE_SIGN_IN_METHOD,idToken:e,accessToken:t})}static credentialFromResult(e){return yt.credentialFromTaggedObject(e)}static credentialFromError(e){return yt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:r}=e;if(!t&&!r)return null;try{return yt.credential(t,r)}catch{return null}}}yt.GOOGLE_SIGN_IN_METHOD="google.com";yt.PROVIDER_ID="google.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class It extends mi{constructor(){super("github.com")}static credential(e){return Nt._fromParams({providerId:It.PROVIDER_ID,signInMethod:It.GITHUB_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return It.credentialFromTaggedObject(e)}static credentialFromError(e){return It.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return It.credential(e.oauthAccessToken)}catch{return null}}}It.GITHUB_SIGN_IN_METHOD="github.com";It.PROVIDER_ID="github.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const uR="http://localhost";class ri extends pi{constructor(e,t){super(e,e),this.pendingToken=t}_getIdTokenResponse(e){const t=this.buildRequest();return jt(e,t)}_linkToIdToken(e,t){const r=this.buildRequest();return r.idToken=t,jt(e,r)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,jt(e,t)}toJSON(){return{signInMethod:this.signInMethod,providerId:this.providerId,pendingToken:this.pendingToken}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e,{providerId:r,signInMethod:i,pendingToken:s}=t;return!r||!i||!s||r!==i?null:new ri(r,s)}static _create(e,t){return new ri(e,t)}buildRequest(){return{requestUri:uR,returnSecureToken:!0,pendingToken:this.pendingToken}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lR="saml.";class Zo extends Zt{constructor(e){O(e.startsWith(lR),"argument-error"),super(e)}static credentialFromResult(e){return Zo.samlCredentialFromTaggedObject(e)}static credentialFromError(e){return Zo.samlCredentialFromTaggedObject(e.customData||{})}static credentialFromJSON(e){const t=ri.fromJSON(e);return O(t,"argument-error"),t}static samlCredentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{pendingToken:t,providerId:r}=e;if(!t||!r)return null;try{return ri._create(r,t)}catch{return null}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vt extends mi{constructor(){super("twitter.com")}static credential(e,t){return Nt._fromParams({providerId:vt.PROVIDER_ID,signInMethod:vt.TWITTER_SIGN_IN_METHOD,oauthToken:e,oauthTokenSecret:t})}static credentialFromResult(e){return vt.credentialFromTaggedObject(e)}static credentialFromError(e){return vt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthAccessToken:t,oauthTokenSecret:r}=e;if(!t||!r)return null;try{return vt.credential(t,r)}catch{return null}}}vt.TWITTER_SIGN_IN_METHOD="twitter.com";vt.PROVIDER_ID="twitter.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function E_(n,e){return Xt(n,"POST","/v1/accounts:signUp",ve(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pt{constructor(e){this.user=e.user,this.providerId=e.providerId,this._tokenResponse=e._tokenResponse,this.operationType=e.operationType}static async _fromIdTokenResponse(e,t,r,i=!1){const s=await Ft._fromIdTokenResponse(e,r,i),o=Uf(r);return new pt({user:s,providerId:o,_tokenResponse:r,operationType:t})}static async _forOperation(e,t,r){await e._updateTokensIfNecessary(r,!0);const i=Uf(r);return new pt({user:e,providerId:i,_tokenResponse:r,operationType:t})}}function Uf(n){return n.providerId?n.providerId:"phoneNumber"in n?"phone":null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function hR(n){var e;if(_e(n.app))return Promise.reject(Ne(n));const t=Ie(n);if(await t._initializationPromise,!((e=t.currentUser)===null||e===void 0)&&e.isAnonymous)return new pt({user:t.currentUser,providerId:null,operationType:"signIn"});const r=await E_(t,{returnSecureToken:!0}),i=await pt._fromIdTokenResponse(t,"signIn",r,!0);return await t._updateCurrentUser(i.user),i}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ea extends Pe{constructor(e,t,r,i){var s;super(t.code,t.message),this.operationType=r,this.user=i,Object.setPrototypeOf(this,ea.prototype),this.customData={appName:e.name,tenantId:(s=e.tenantId)!==null&&s!==void 0?s:void 0,_serverResponse:t.customData._serverResponse,operationType:r}}static _fromErrorAndOperation(e,t,r,i){return new ea(e,t,r,i)}}function A_(n,e,t,r){return(e==="reauthenticate"?t._getReauthenticationResolver(n):t._getIdTokenResponse(n)).catch(s=>{throw s.code==="auth/multi-factor-auth-required"?ea._fromErrorAndOperation(n,s,e,r):s})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function b_(n){return new Set(n.map(({providerId:e})=>e).filter(e=>!!e))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function dR(n,e){const t=B(n);await Va(!0,t,e);const{providerUserInfo:r}=await yb(t.auth,{idToken:await t.getIdToken(),deleteProvider:[e]}),i=b_(r||[]);return t.providerData=t.providerData.filter(s=>i.has(s.providerId)),i.has("phone")||(t.phoneNumber=null),await t.auth._persistUserIfCurrent(t),t}async function xl(n,e,t=!1){const r=await Wt(n,e._linkToIdToken(n.auth,await n.getIdToken()),t);return pt._forOperation(n,"link",r)}async function Va(n,e,t){await As(e);const r=b_(e.providerData),i=n===!1?"provider-already-linked":"no-such-provider";O(r.has(t)===n,e.auth,i)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function R_(n,e,t=!1){const{auth:r}=n;if(_e(r.app))return Promise.reject(Ne(r));const i="reauthenticate";try{const s=await Wt(n,A_(r,i,e,n),t);O(s.idToken,r,"internal-error");const o=ka(s.idToken);O(o,r,"internal-error");const{sub:c}=o;return O(n.uid===c,r,"user-mismatch"),pt._forOperation(n,i,s)}catch(s){throw(s==null?void 0:s.code)==="auth/user-not-found"&&Me(r,"user-mismatch"),s}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function P_(n,e,t=!1){if(_e(n.app))return Promise.reject(Ne(n));const r="signIn",i=await A_(n,r,e),s=await pt._fromIdTokenResponse(n,r,i);return t||await n._updateCurrentUser(s.user),s}async function Oa(n,e){return P_(Ie(n),e)}async function S_(n,e){const t=B(n);return await Va(!1,t,e.providerId),xl(t,e)}async function C_(n,e){return R_(B(n),e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function fR(n,e){return Xt(n,"POST","/v1/accounts:signInWithCustomToken",ve(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function pR(n,e){if(_e(n.app))return Promise.reject(Ne(n));const t=Ie(n),r=await fR(t,{token:e,returnSecureToken:!0}),i=await pt._fromIdTokenResponse(t,"signIn",r);return await t._updateCurrentUser(i.user),i}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gs{constructor(e,t){this.factorId=e,this.uid=t.mfaEnrollmentId,this.enrollmentTime=new Date(t.enrolledAt).toUTCString(),this.displayName=t.displayName}static _fromServerResponse(e,t){return"phoneInfo"in t?Ll._fromServerResponse(e,t):"totpInfo"in t?Ml._fromServerResponse(e,t):Me(e,"internal-error")}}class Ll extends Gs{constructor(e){super("phone",e),this.phoneNumber=e.phoneInfo}static _fromServerResponse(e,t){return new Ll(t)}}class Ml extends Gs{constructor(e){super("totp",e)}static _fromServerResponse(e,t){return new Ml(t)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xa(n,e,t){var r;O(((r=t.url)===null||r===void 0?void 0:r.length)>0,n,"invalid-continue-uri"),O(typeof t.dynamicLinkDomain>"u"||t.dynamicLinkDomain.length>0,n,"invalid-dynamic-link-domain"),e.continueUrl=t.url,e.dynamicLinkDomain=t.dynamicLinkDomain,e.canHandleCodeInApp=t.handleCodeInApp,t.iOS&&(O(t.iOS.bundleId.length>0,n,"missing-ios-bundle-id"),e.iOSBundleId=t.iOS.bundleId),t.android&&(O(t.android.packageName.length>0,n,"missing-android-pkg-name"),e.androidInstallApp=t.android.installApp,e.androidMinimumVersionCode=t.android.minimumVersion,e.androidPackageName=t.android.packageName)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Fl(n){const e=Ie(n);e._getPasswordPolicyInternal()&&await e._updatePasswordPolicy()}async function mR(n,e,t){const r=Ie(n),i={requestType:"PASSWORD_RESET",email:e,clientType:"CLIENT_TYPE_WEB"};t&&xa(r,i,t),await bs(r,i,"getOobCode",Jb)}async function gR(n,e,t){await T_(B(n),{oobCode:e,newPassword:t}).catch(async r=>{throw r.code==="auth/password-does-not-meet-requirements"&&Fl(n),r})}async function _R(n,e){await Wb(B(n),{oobCode:e})}async function k_(n,e){const t=B(n),r=await T_(t,{oobCode:e}),i=r.requestType;switch(O(i,t,"internal-error"),i){case"EMAIL_SIGNIN":break;case"VERIFY_AND_CHANGE_EMAIL":O(r.newEmail,t,"internal-error");break;case"REVERT_SECOND_FACTOR_ADDITION":O(r.mfaInfo,t,"internal-error");default:O(r.email,t,"internal-error")}let s=null;return r.mfaInfo&&(s=Gs._fromServerResponse(Ie(t),r.mfaInfo)),{data:{email:(r.requestType==="VERIFY_AND_CHANGE_EMAIL"?r.newEmail:r.email)||null,previousEmail:(r.requestType==="VERIFY_AND_CHANGE_EMAIL"?r.email:r.newEmail)||null,multiFactorInfo:s},operation:i}}async function yR(n,e){const{data:t}=await k_(B(n),e);return t.email}async function IR(n,e,t){if(_e(n.app))return Promise.reject(Ne(n));const r=Ie(n),o=await bs(r,{returnSecureToken:!0,email:e,password:t,clientType:"CLIENT_TYPE_WEB"},"signUpPassword",E_).catch(u=>{throw u.code==="auth/password-does-not-meet-requirements"&&Fl(n),u}),c=await pt._fromIdTokenResponse(r,"signIn",o);return await r._updateCurrentUser(c.user),c}function vR(n,e,t){return _e(n.app)?Promise.reject(Ne(n)):Oa(B(n),kn.credential(e,t)).catch(async r=>{throw r.code==="auth/password-does-not-meet-requirements"&&Fl(n),r})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function wR(n,e,t){const r=Ie(n),i={requestType:"EMAIL_SIGNIN",email:e,clientType:"CLIENT_TYPE_WEB"};function s(o,c){O(c.handleCodeInApp,r,"argument-error"),c&&xa(r,o,c)}s(i,t),await bs(r,i,"getOobCode",Yb)}function TR(n,e){const t=Na.parseLink(e);return(t==null?void 0:t.operation)==="EMAIL_SIGNIN"}async function ER(n,e,t){if(_e(n.app))return Promise.reject(Ne(n));const r=B(n),i=kn.credentialWithLink(e,t||Es());return O(i._tenantId===(r.tenantId||null),r,"tenant-id-mismatch"),Oa(r,i)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function AR(n,e){return we(n,"POST","/v1/accounts:createAuthUri",ve(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function bR(n,e){const t=Nl()?Es():"http://localhost",r={identifier:e,continueUri:t},{signinMethods:i}=await AR(B(n),r);return i||[]}async function RR(n,e){const t=B(n),i={requestType:"VERIFY_EMAIL",idToken:await n.getIdToken()};e&&xa(t.auth,i,e);const{email:s}=await Qb(t.auth,i);s!==n.email&&await n.reload()}async function PR(n,e,t){const r=B(n),s={requestType:"VERIFY_AND_CHANGE_EMAIL",idToken:await n.getIdToken(),newEmail:e};t&&xa(r.auth,s,t);const{email:o}=await Xb(r.auth,s);o!==n.email&&await n.reload()}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function SR(n,e){return we(n,"POST","/v1/accounts:update",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function CR(n,{displayName:e,photoURL:t}){if(e===void 0&&t===void 0)return;const r=B(n),s={idToken:await r.getIdToken(),displayName:e,photoUrl:t,returnSecureToken:!0},o=await Wt(r,SR(r.auth,s));r.displayName=o.displayName||null,r.photoURL=o.photoUrl||null;const c=r.providerData.find(({providerId:u})=>u==="password");c&&(c.displayName=r.displayName,c.photoURL=r.photoURL),await r._updateTokensIfNecessary(o)}function kR(n,e){const t=B(n);return _e(t.auth.app)?Promise.reject(Ne(t.auth)):D_(t,e,null)}function DR(n,e){return D_(B(n),null,e)}async function D_(n,e,t){const{auth:r}=n,s={idToken:await n.getIdToken(),returnSecureToken:!0};e&&(s.email=e),t&&(s.password=t);const o=await Wt(n,Gb(r,s));await n._updateTokensIfNecessary(o,!0)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function NR(n){var e,t;if(!n)return null;const{providerId:r}=n,i=n.rawUserInfo?JSON.parse(n.rawUserInfo):{},s=n.isNewUser||n.kind==="identitytoolkit#SignupNewUserResponse";if(!r&&(n!=null&&n.idToken)){const o=(t=(e=ka(n.idToken))===null||e===void 0?void 0:e.firebase)===null||t===void 0?void 0:t.sign_in_provider;if(o){const c=o!=="anonymous"&&o!=="custom"?o:null;return new Fr(s,c)}}if(!r)return null;switch(r){case"facebook.com":return new VR(s,i);case"github.com":return new OR(s,i);case"google.com":return new xR(s,i);case"twitter.com":return new LR(s,i,n.screenName||null);case"custom":case"anonymous":return new Fr(s,null);default:return new Fr(s,r,i)}}class Fr{constructor(e,t,r={}){this.isNewUser=e,this.providerId=t,this.profile=r}}class N_ extends Fr{constructor(e,t,r,i){super(e,t,r),this.username=i}}class VR extends Fr{constructor(e,t){super(e,"facebook.com",t)}}class OR extends N_{constructor(e,t){super(e,"github.com",t,typeof(t==null?void 0:t.login)=="string"?t==null?void 0:t.login:null)}}class xR extends Fr{constructor(e,t){super(e,"google.com",t)}}class LR extends N_{constructor(e,t,r){super(e,"twitter.com",t,r)}}function MR(n){const{user:e,_tokenResponse:t}=n;return e.isAnonymous&&!t?{providerId:null,isNewUser:!1,profile:null}:NR(t)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Kn{constructor(e,t,r){this.type=e,this.credential=t,this.user=r}static _fromIdtoken(e,t){return new Kn("enroll",e,t)}static _fromMfaPendingCredential(e){return new Kn("signin",e)}toJSON(){return{multiFactorSession:{[this.type==="enroll"?"idToken":"pendingCredential"]:this.credential}}}static fromJSON(e){var t,r;if(e!=null&&e.multiFactorSession){if(!((t=e.multiFactorSession)===null||t===void 0)&&t.pendingCredential)return Kn._fromMfaPendingCredential(e.multiFactorSession.pendingCredential);if(!((r=e.multiFactorSession)===null||r===void 0)&&r.idToken)return Kn._fromIdtoken(e.multiFactorSession.idToken)}return null}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ul{constructor(e,t,r){this.session=e,this.hints=t,this.signInResolver=r}static _fromError(e,t){const r=Ie(e),i=t.customData._serverResponse,s=(i.mfaInfo||[]).map(c=>Gs._fromServerResponse(r,c));O(i.mfaPendingCredential,r,"internal-error");const o=Kn._fromMfaPendingCredential(i.mfaPendingCredential);return new Ul(o,s,async c=>{const u=await c._process(r,o);delete i.mfaInfo,delete i.mfaPendingCredential;const h=Object.assign(Object.assign({},i),{idToken:u.idToken,refreshToken:u.refreshToken});switch(t.operationType){case"signIn":const f=await pt._fromIdTokenResponse(r,t.operationType,h);return await r._updateCurrentUser(f.user),f;case"reauthenticate":return O(t.user,r,"internal-error"),pt._forOperation(t.user,t.operationType,h);default:Me(r,"internal-error")}})}async resolveSignIn(e){const t=e;return this.signInResolver(t)}}function FR(n,e){var t;const r=B(n),i=e;return O(e.customData.operationType,r,"argument-error"),O((t=i.customData._serverResponse)===null||t===void 0?void 0:t.mfaPendingCredential,r,"argument-error"),Ul._fromError(r,i)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function UR(n,e){return we(n,"POST","/v2/accounts/mfaEnrollment:start",ve(n,e))}function BR(n,e){return we(n,"POST","/v2/accounts/mfaEnrollment:finalize",ve(n,e))}function qR(n,e){return we(n,"POST","/v2/accounts/mfaEnrollment:withdraw",ve(n,e))}class Bl{constructor(e){this.user=e,this.enrolledFactors=[],e._onReload(t=>{t.mfaInfo&&(this.enrolledFactors=t.mfaInfo.map(r=>Gs._fromServerResponse(e.auth,r)))})}static _fromUser(e){return new Bl(e)}async getSession(){return Kn._fromIdtoken(await this.user.getIdToken(),this.user)}async enroll(e,t){const r=e,i=await this.getSession(),s=await Wt(this.user,r._process(this.user.auth,i,t));return await this.user._updateTokensIfNecessary(s),this.user.reload()}async unenroll(e){const t=typeof e=="string"?e:e.uid,r=await this.user.getIdToken();try{const i=await Wt(this.user,qR(this.user.auth,{idToken:r,mfaEnrollmentId:t}));this.enrolledFactors=this.enrolledFactors.filter(({uid:s})=>s!==t),await this.user._updateTokensIfNecessary(i),await this.user.reload()}catch(i){throw i}}}const Rc=new WeakMap;function jR(n){const e=B(n);return Rc.has(e)||Rc.set(e,Bl._fromUser(e)),Rc.get(e)}const ta="__sak";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class V_{constructor(e,t){this.storageRetriever=e,this.type=t}_isAvailable(){try{return this.storage?(this.storage.setItem(ta,"1"),this.storage.removeItem(ta),Promise.resolve(!0)):Promise.resolve(!1)}catch{return Promise.resolve(!1)}}_set(e,t){return this.storage.setItem(e,JSON.stringify(t)),Promise.resolve()}_get(e){const t=this.storage.getItem(e);return Promise.resolve(t?JSON.parse(t):null)}_remove(e){return this.storage.removeItem(e),Promise.resolve()}get storage(){return this.storageRetriever()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $R=1e3,zR=10;class O_ extends V_{constructor(){super(()=>window.localStorage,"LOCAL"),this.boundEventHandler=(e,t)=>this.onStorageEvent(e,t),this.listeners={},this.localCache={},this.pollTimer=null,this.fallbackToPolling=y_(),this._shouldAllowMigration=!0}forAllChangedKeys(e){for(const t of Object.keys(this.listeners)){const r=this.storage.getItem(t),i=this.localCache[t];r!==i&&e(t,i,r)}}onStorageEvent(e,t=!1){if(!e.key){this.forAllChangedKeys((o,c,u)=>{this.notifyListeners(o,u)});return}const r=e.key;t?this.detachListener():this.stopPolling();const i=()=>{const o=this.storage.getItem(r);!t&&this.localCache[r]===o||this.notifyListeners(r,o)},s=this.storage.getItem(r);Sb()&&s!==e.newValue&&e.newValue!==e.oldValue?setTimeout(i,zR):i()}notifyListeners(e,t){this.localCache[e]=t;const r=this.listeners[e];if(r)for(const i of Array.from(r))i(t&&JSON.parse(t))}startPolling(){this.stopPolling(),this.pollTimer=setInterval(()=>{this.forAllChangedKeys((e,t,r)=>{this.onStorageEvent(new StorageEvent("storage",{key:e,oldValue:t,newValue:r}),!0)})},$R)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}attachListener(){window.addEventListener("storage",this.boundEventHandler)}detachListener(){window.removeEventListener("storage",this.boundEventHandler)}_addListener(e,t){Object.keys(this.listeners).length===0&&(this.fallbackToPolling?this.startPolling():this.attachListener()),this.listeners[e]||(this.listeners[e]=new Set,this.localCache[e]=this.storage.getItem(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&(this.detachListener(),this.stopPolling())}async _set(e,t){await super._set(e,t),this.localCache[e]=JSON.stringify(t)}async _get(e){const t=await super._get(e);return this.localCache[e]=JSON.stringify(t),t}async _remove(e){await super._remove(e),delete this.localCache[e]}}O_.type="LOCAL";const ql=O_;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class x_ extends V_{constructor(){super(()=>window.sessionStorage,"SESSION")}_addListener(e,t){}_removeListener(e,t){}}x_.type="SESSION";const or=x_;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function GR(n){return Promise.all(n.map(async e=>{try{return{fulfilled:!0,value:await e}}catch(t){return{fulfilled:!1,reason:t}}}))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class La{constructor(e){this.eventTarget=e,this.handlersMap={},this.boundEventHandler=this.handleEvent.bind(this)}static _getInstance(e){const t=this.receivers.find(i=>i.isListeningto(e));if(t)return t;const r=new La(e);return this.receivers.push(r),r}isListeningto(e){return this.eventTarget===e}async handleEvent(e){const t=e,{eventId:r,eventType:i,data:s}=t.data,o=this.handlersMap[i];if(!(o!=null&&o.size))return;t.ports[0].postMessage({status:"ack",eventId:r,eventType:i});const c=Array.from(o).map(async h=>h(t.origin,s)),u=await GR(c);t.ports[0].postMessage({status:"done",eventId:r,eventType:i,response:u})}_subscribe(e,t){Object.keys(this.handlersMap).length===0&&this.eventTarget.addEventListener("message",this.boundEventHandler),this.handlersMap[e]||(this.handlersMap[e]=new Set),this.handlersMap[e].add(t)}_unsubscribe(e,t){this.handlersMap[e]&&t&&this.handlersMap[e].delete(t),(!t||this.handlersMap[e].size===0)&&delete this.handlersMap[e],Object.keys(this.handlersMap).length===0&&this.eventTarget.removeEventListener("message",this.boundEventHandler)}}La.receivers=[];/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ks(n="",e=10){let t="";for(let r=0;r<e;r++)t+=Math.floor(Math.random()*10);return n+t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class KR{constructor(e){this.target=e,this.handlers=new Set}removeMessageHandler(e){e.messageChannel&&(e.messageChannel.port1.removeEventListener("message",e.onMessage),e.messageChannel.port1.close()),this.handlers.delete(e)}async _send(e,t,r=50){const i=typeof MessageChannel<"u"?new MessageChannel:null;if(!i)throw new Error("connection_unavailable");let s,o;return new Promise((c,u)=>{const h=Ks("",20);i.port1.start();const f=setTimeout(()=>{u(new Error("unsupported_event"))},r);o={messageChannel:i,onMessage(p){const g=p;if(g.data.eventId===h)switch(g.data.status){case"ack":clearTimeout(f),s=setTimeout(()=>{u(new Error("timeout"))},3e3);break;case"done":clearTimeout(s),c(g.data.response);break;default:clearTimeout(f),clearTimeout(s),u(new Error("invalid_response"));break}}},this.handlers.add(o),i.port1.addEventListener("message",o.onMessage),this.target.postMessage({eventType:e,eventId:h,data:t},[i.port2])}).finally(()=>{o&&this.removeMessageHandler(o)})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Re(){return window}function WR(n){Re().location.href=n}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function jl(){return typeof Re().WorkerGlobalScope<"u"&&typeof Re().importScripts=="function"}async function HR(){if(!(navigator!=null&&navigator.serviceWorker))return null;try{return(await navigator.serviceWorker.ready).active}catch{return null}}function QR(){var n;return((n=navigator==null?void 0:navigator.serviceWorker)===null||n===void 0?void 0:n.controller)||null}function JR(){return jl()?self:null}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const L_="firebaseLocalStorageDb",YR=1,na="firebaseLocalStorage",M_="fbase_key";class Ws{constructor(e){this.request=e}toPromise(){return new Promise((e,t)=>{this.request.addEventListener("success",()=>{e(this.request.result)}),this.request.addEventListener("error",()=>{t(this.request.error)})})}}function Ma(n,e){return n.transaction([na],e?"readwrite":"readonly").objectStore(na)}function XR(){const n=indexedDB.deleteDatabase(L_);return new Ws(n).toPromise()}function cu(){const n=indexedDB.open(L_,YR);return new Promise((e,t)=>{n.addEventListener("error",()=>{t(n.error)}),n.addEventListener("upgradeneeded",()=>{const r=n.result;try{r.createObjectStore(na,{keyPath:M_})}catch(i){t(i)}}),n.addEventListener("success",async()=>{const r=n.result;r.objectStoreNames.contains(na)?e(r):(r.close(),await XR(),e(await cu()))})})}async function Bf(n,e,t){const r=Ma(n,!0).put({[M_]:e,value:t});return new Ws(r).toPromise()}async function ZR(n,e){const t=Ma(n,!1).get(e),r=await new Ws(t).toPromise();return r===void 0?null:r.value}function qf(n,e){const t=Ma(n,!0).delete(e);return new Ws(t).toPromise()}const eP=800,tP=3;class F_{constructor(){this.type="LOCAL",this._shouldAllowMigration=!0,this.listeners={},this.localCache={},this.pollTimer=null,this.pendingWrites=0,this.receiver=null,this.sender=null,this.serviceWorkerReceiverAvailable=!1,this.activeServiceWorker=null,this._workerInitializationPromise=this.initializeServiceWorkerMessaging().then(()=>{},()=>{})}async _openDb(){return this.db?this.db:(this.db=await cu(),this.db)}async _withRetries(e){let t=0;for(;;)try{const r=await this._openDb();return await e(r)}catch(r){if(t++>tP)throw r;this.db&&(this.db.close(),this.db=void 0)}}async initializeServiceWorkerMessaging(){return jl()?this.initializeReceiver():this.initializeSender()}async initializeReceiver(){this.receiver=La._getInstance(JR()),this.receiver._subscribe("keyChanged",async(e,t)=>({keyProcessed:(await this._poll()).includes(t.key)})),this.receiver._subscribe("ping",async(e,t)=>["keyChanged"])}async initializeSender(){var e,t;if(this.activeServiceWorker=await HR(),!this.activeServiceWorker)return;this.sender=new KR(this.activeServiceWorker);const r=await this.sender._send("ping",{},800);r&&!((e=r[0])===null||e===void 0)&&e.fulfilled&&!((t=r[0])===null||t===void 0)&&t.value.includes("keyChanged")&&(this.serviceWorkerReceiverAvailable=!0)}async notifyServiceWorker(e){if(!(!this.sender||!this.activeServiceWorker||QR()!==this.activeServiceWorker))try{await this.sender._send("keyChanged",{key:e},this.serviceWorkerReceiverAvailable?800:50)}catch{}}async _isAvailable(){try{if(!indexedDB)return!1;const e=await cu();return await Bf(e,ta,"1"),await qf(e,ta),!0}catch{}return!1}async _withPendingWrite(e){this.pendingWrites++;try{await e()}finally{this.pendingWrites--}}async _set(e,t){return this._withPendingWrite(async()=>(await this._withRetries(r=>Bf(r,e,t)),this.localCache[e]=t,this.notifyServiceWorker(e)))}async _get(e){const t=await this._withRetries(r=>ZR(r,e));return this.localCache[e]=t,t}async _remove(e){return this._withPendingWrite(async()=>(await this._withRetries(t=>qf(t,e)),delete this.localCache[e],this.notifyServiceWorker(e)))}async _poll(){const e=await this._withRetries(i=>{const s=Ma(i,!1).getAll();return new Ws(s).toPromise()});if(!e)return[];if(this.pendingWrites!==0)return[];const t=[],r=new Set;if(e.length!==0)for(const{fbase_key:i,value:s}of e)r.add(i),JSON.stringify(this.localCache[i])!==JSON.stringify(s)&&(this.notifyListeners(i,s),t.push(i));for(const i of Object.keys(this.localCache))this.localCache[i]&&!r.has(i)&&(this.notifyListeners(i,null),t.push(i));return t}notifyListeners(e,t){this.localCache[e]=t;const r=this.listeners[e];if(r)for(const i of Array.from(r))i(t)}startPolling(){this.stopPolling(),this.pollTimer=setInterval(async()=>this._poll(),eP)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}_addListener(e,t){Object.keys(this.listeners).length===0&&this.startPolling(),this.listeners[e]||(this.listeners[e]=new Set,this._get(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&this.stopPolling()}}F_.type="LOCAL";const Ps=F_;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function nP(n,e){return we(n,"POST","/v2/accounts/mfaSignIn:start",ve(n,e))}function rP(n,e){return we(n,"POST","/v2/accounts/mfaSignIn:finalize",ve(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const iP=500,sP=6e4,vo=1e12;class oP{constructor(e){this.auth=e,this.counter=vo,this._widgets=new Map}render(e,t){const r=this.counter;return this._widgets.set(r,new aP(e,this.auth.name,t||{})),this.counter++,r}reset(e){var t;const r=e||vo;(t=this._widgets.get(r))===null||t===void 0||t.delete(),this._widgets.delete(r)}getResponse(e){var t;const r=e||vo;return((t=this._widgets.get(r))===null||t===void 0?void 0:t.getResponse())||""}async execute(e){var t;const r=e||vo;return(t=this._widgets.get(r))===null||t===void 0||t.execute(),""}}class aP{constructor(e,t,r){this.params=r,this.timerId=null,this.deleted=!1,this.responseToken=null,this.clickHandler=()=>{this.execute()};const i=typeof e=="string"?document.getElementById(e):e;O(i,"argument-error",{appName:t}),this.container=i,this.isVisible=this.params.size!=="invisible",this.isVisible?this.execute():this.container.addEventListener("click",this.clickHandler)}getResponse(){return this.checkIfDeleted(),this.responseToken}delete(){this.checkIfDeleted(),this.deleted=!0,this.timerId&&(clearTimeout(this.timerId),this.timerId=null),this.container.removeEventListener("click",this.clickHandler)}execute(){this.checkIfDeleted(),!this.timerId&&(this.timerId=window.setTimeout(()=>{this.responseToken=cP(50);const{callback:e,"expired-callback":t}=this.params;if(e)try{e(this.responseToken)}catch{}this.timerId=window.setTimeout(()=>{if(this.timerId=null,this.responseToken=null,t)try{t()}catch{}this.isVisible&&this.execute()},sP)},iP))}checkIfDeleted(){if(this.deleted)throw new Error("reCAPTCHA mock was already deleted!")}}function cP(n){const e=[],t="1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";for(let r=0;r<n;r++)e.push(t.charAt(Math.floor(Math.random()*t.length)));return e.join("")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Pc=v_("rcb"),uP=new qs(3e4,6e4);class lP{constructor(){var e;this.hostLanguage="",this.counter=0,this.librarySeparatelyLoaded=!!(!((e=Re().grecaptcha)===null||e===void 0)&&e.render)}load(e,t=""){return O(hP(t),e,"argument-error"),this.shouldResolveImmediately(t)&&Df(Re().grecaptcha)?Promise.resolve(Re().grecaptcha):new Promise((r,i)=>{const s=Re().setTimeout(()=>{i(Se(e,"network-request-failed"))},uP.get());Re()[Pc]=()=>{Re().clearTimeout(s),delete Re()[Pc];const c=Re().grecaptcha;if(!c||!Df(c)){i(Se(e,"internal-error"));return}const u=c.render;c.render=(h,f)=>{const p=u(h,f);return this.counter++,p},this.hostLanguage=t,r(c)};const o=`${xb()}?${ii({onload:Pc,render:"explicit",hl:t})}`;Ol(o).catch(()=>{clearTimeout(s),i(Se(e,"internal-error"))})})}clearedOneInstance(){this.counter--}shouldResolveImmediately(e){var t;return!!(!((t=Re().grecaptcha)===null||t===void 0)&&t.render)&&(e===this.hostLanguage||this.counter>0||this.librarySeparatelyLoaded)}}function hP(n){return n.length<=6&&/^\s*[a-zA-Z0-9\-]*\s*$/.test(n)}class dP{async load(e){return new oP(e)}clearedOneInstance(){}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const U_="recaptcha",fP={theme:"light",type:"image"};let pP=class{constructor(e,t,r=Object.assign({},fP)){this.parameters=r,this.type=U_,this.destroyed=!1,this.widgetId=null,this.tokenChangeListeners=new Set,this.renderPromise=null,this.recaptcha=null,this.auth=Ie(e),this.isInvisible=this.parameters.size==="invisible",O(typeof document<"u",this.auth,"operation-not-supported-in-this-environment");const i=typeof t=="string"?document.getElementById(t):t;O(i,this.auth,"argument-error"),this.container=i,this.parameters.callback=this.makeTokenCallback(this.parameters.callback),this._recaptchaLoader=this.auth.settings.appVerificationDisabledForTesting?new dP:new lP,this.validateStartingState()}async verify(){this.assertNotDestroyed();const e=await this.render(),t=this.getAssertedRecaptcha(),r=t.getResponse(e);return r||new Promise(i=>{const s=o=>{o&&(this.tokenChangeListeners.delete(s),i(o))};this.tokenChangeListeners.add(s),this.isInvisible&&t.execute(e)})}render(){try{this.assertNotDestroyed()}catch(e){return Promise.reject(e)}return this.renderPromise?this.renderPromise:(this.renderPromise=this.makeRenderPromise().catch(e=>{throw this.renderPromise=null,e}),this.renderPromise)}_reset(){this.assertNotDestroyed(),this.widgetId!==null&&this.getAssertedRecaptcha().reset(this.widgetId)}clear(){this.assertNotDestroyed(),this.destroyed=!0,this._recaptchaLoader.clearedOneInstance(),this.isInvisible||this.container.childNodes.forEach(e=>{this.container.removeChild(e)})}validateStartingState(){O(!this.parameters.sitekey,this.auth,"argument-error"),O(this.isInvisible||!this.container.hasChildNodes(),this.auth,"argument-error"),O(typeof document<"u",this.auth,"operation-not-supported-in-this-environment")}makeTokenCallback(e){return t=>{if(this.tokenChangeListeners.forEach(r=>r(t)),typeof e=="function")e(t);else if(typeof e=="string"){const r=Re()[e];typeof r=="function"&&r(t)}}}assertNotDestroyed(){O(!this.destroyed,this.auth,"internal-error")}async makeRenderPromise(){if(await this.init(),!this.widgetId){let e=this.container;if(!this.isInvisible){const t=document.createElement("div");e.appendChild(t),e=t}this.widgetId=this.getAssertedRecaptcha().render(e,this.parameters)}return this.widgetId}async init(){O(Nl()&&!jl(),this.auth,"internal-error"),await mP(),this.recaptcha=await this._recaptchaLoader.load(this.auth,this.auth.languageCode||void 0);const e=await mb(this.auth);O(e,this.auth,"internal-error"),this.parameters.sitekey=e}getAssertedRecaptcha(){return O(this.recaptcha,this.auth,"internal-error"),this.recaptcha}};function mP(){let n=null;return new Promise(e=>{if(document.readyState==="complete"){e();return}n=()=>e(),window.addEventListener("load",n)}).catch(e=>{throw n&&window.removeEventListener("load",n),e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $l{constructor(e,t){this.verificationId=e,this.onConfirmation=t}confirm(e){const t=Qn._fromVerification(this.verificationId,e);return this.onConfirmation(t)}}async function gP(n,e,t){if(_e(n.app))return Promise.reject(Ne(n));const r=Ie(n),i=await Fa(r,e,B(t));return new $l(i,s=>Oa(r,s))}async function _P(n,e,t){const r=B(n);await Va(!1,r,"phone");const i=await Fa(r.auth,e,B(t));return new $l(i,s=>S_(r,s))}async function yP(n,e,t){const r=B(n);if(_e(r.auth.app))return Promise.reject(Ne(r.auth));const i=await Fa(r.auth,e,B(t));return new $l(i,s=>C_(r,s))}async function Fa(n,e,t){var r;const i=await t.verify();try{O(typeof i=="string",n,"argument-error"),O(t.type===U_,n,"argument-error");let s;if(typeof e=="string"?s={phoneNumber:e}:s=e,"session"in s){const o=s.session;if("phoneNumber"in s)return O(o.type==="enroll",n,"internal-error"),(await UR(n,{idToken:o.credential,phoneEnrollmentInfo:{phoneNumber:s.phoneNumber,recaptchaToken:i}})).phoneSessionInfo.sessionInfo;{O(o.type==="signin",n,"internal-error");const c=((r=s.multiFactorHint)===null||r===void 0?void 0:r.uid)||s.multiFactorUid;return O(c,n,"missing-multi-factor-info"),(await nP(n,{mfaPendingCredential:o.credential,mfaEnrollmentId:c,phoneSignInInfo:{recaptchaToken:i}})).phoneResponseInfo.sessionInfo}}else{const{sessionInfo:o}=await nR(n,{phoneNumber:s.phoneNumber,recaptchaToken:i});return o}}finally{t._reset()}}async function IP(n,e){const t=B(n);if(_e(t.auth.app))return Promise.reject(Ne(t.auth));await xl(t,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let ar=class Vo{constructor(e){this.providerId=Vo.PROVIDER_ID,this.auth=Ie(e)}verifyPhoneNumber(e,t){return Fa(this.auth,e,B(t))}static credential(e,t){return Qn._fromVerification(e,t)}static credentialFromResult(e){const t=e;return Vo.credentialFromTaggedObject(t)}static credentialFromError(e){return Vo.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{phoneNumber:t,temporaryProof:r}=e;return t&&r?Qn._fromTokenResponse(t,r):null}};ar.PROVIDER_ID="phone";ar.PHONE_SIGN_IN_METHOD="phone";/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function gr(n,e){return e?ut(e):(O(n._popupRedirectResolver,n,"argument-error"),n._popupRedirectResolver)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zl extends pi{constructor(e){super("custom","custom"),this.params=e}_getIdTokenResponse(e){return jt(e,this._buildIdpRequest())}_linkToIdToken(e,t){return jt(e,this._buildIdpRequest(t))}_getReauthenticationResolver(e){return jt(e,this._buildIdpRequest())}_buildIdpRequest(e){const t={requestUri:this.params.requestUri,sessionId:this.params.sessionId,postBody:this.params.postBody,tenantId:this.params.tenantId,pendingToken:this.params.pendingToken,returnSecureToken:!0,returnIdpCredential:!0};return e&&(t.idToken=e),t}}function vP(n){return P_(n.auth,new zl(n),n.bypassAuthState)}function wP(n){const{auth:e,user:t}=n;return O(t,e,"internal-error"),R_(t,new zl(n),n.bypassAuthState)}async function TP(n){const{auth:e,user:t}=n;return O(t,e,"internal-error"),xl(t,new zl(n),n.bypassAuthState)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class B_{constructor(e,t,r,i,s=!1){this.auth=e,this.resolver=r,this.user=i,this.bypassAuthState=s,this.pendingPromise=null,this.eventManager=null,this.filter=Array.isArray(t)?t:[t]}execute(){return new Promise(async(e,t)=>{this.pendingPromise={resolve:e,reject:t};try{this.eventManager=await this.resolver._initialize(this.auth),await this.onExecution(),this.eventManager.registerConsumer(this)}catch(r){this.reject(r)}})}async onAuthEvent(e){const{urlResponse:t,sessionId:r,postBody:i,tenantId:s,error:o,type:c}=e;if(o){this.reject(o);return}const u={auth:this.auth,requestUri:t,sessionId:r,tenantId:s||void 0,postBody:i||void 0,user:this.user,bypassAuthState:this.bypassAuthState};try{this.resolve(await this.getIdpTask(c)(u))}catch(h){this.reject(h)}}onError(e){this.reject(e)}getIdpTask(e){switch(e){case"signInViaPopup":case"signInViaRedirect":return vP;case"linkViaPopup":case"linkViaRedirect":return TP;case"reauthViaPopup":case"reauthViaRedirect":return wP;default:Me(this.auth,"internal-error")}}resolve(e){gt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.resolve(e),this.unregisterAndCleanUp()}reject(e){gt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.reject(e),this.unregisterAndCleanUp()}unregisterAndCleanUp(){this.eventManager&&this.eventManager.unregisterConsumer(this),this.pendingPromise=null,this.cleanUp()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const EP=new qs(2e3,1e4);async function AP(n,e,t){if(_e(n.app))return Promise.reject(Se(n,"operation-not-supported-in-this-environment"));const r=Ie(n);fi(n,e,Zt);const i=gr(r,t);return new Ut(r,"signInViaPopup",e,i).executeNotNull()}async function bP(n,e,t){const r=B(n);if(_e(r.auth.app))return Promise.reject(Se(r.auth,"operation-not-supported-in-this-environment"));fi(r.auth,e,Zt);const i=gr(r.auth,t);return new Ut(r.auth,"reauthViaPopup",e,i,r).executeNotNull()}async function RP(n,e,t){const r=B(n);fi(r.auth,e,Zt);const i=gr(r.auth,t);return new Ut(r.auth,"linkViaPopup",e,i,r).executeNotNull()}class Ut extends B_{constructor(e,t,r,i,s){super(e,t,i,s),this.provider=r,this.authWindow=null,this.pollId=null,Ut.currentPopupAction&&Ut.currentPopupAction.cancel(),Ut.currentPopupAction=this}async executeNotNull(){const e=await this.execute();return O(e,this.auth,"internal-error"),e}async onExecution(){gt(this.filter.length===1,"Popup operations only handle one event");const e=Ks();this.authWindow=await this.resolver._openPopup(this.auth,this.provider,this.filter[0],e),this.authWindow.associatedEvent=e,this.resolver._originValidation(this.auth).catch(t=>{this.reject(t)}),this.resolver._isIframeWebStorageSupported(this.auth,t=>{t||this.reject(Se(this.auth,"web-storage-unsupported"))}),this.pollUserCancellation()}get eventId(){var e;return((e=this.authWindow)===null||e===void 0?void 0:e.associatedEvent)||null}cancel(){this.reject(Se(this.auth,"cancelled-popup-request"))}cleanUp(){this.authWindow&&this.authWindow.close(),this.pollId&&window.clearTimeout(this.pollId),this.authWindow=null,this.pollId=null,Ut.currentPopupAction=null}pollUserCancellation(){const e=()=>{var t,r;if(!((r=(t=this.authWindow)===null||t===void 0?void 0:t.window)===null||r===void 0)&&r.closed){this.pollId=window.setTimeout(()=>{this.pollId=null,this.reject(Se(this.auth,"popup-closed-by-user"))},8e3);return}this.pollId=window.setTimeout(e,EP.get())};e()}}Ut.currentPopupAction=null;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const PP="pendingRedirect",ns=new Map;class SP extends B_{constructor(e,t,r=!1){super(e,["signInViaRedirect","linkViaRedirect","reauthViaRedirect","unknown"],t,void 0,r),this.eventId=null}async execute(){let e=ns.get(this.auth._key());if(!e){try{const r=await CP(this.resolver,this.auth)?await super.execute():null;e=()=>Promise.resolve(r)}catch(t){e=()=>Promise.reject(t)}ns.set(this.auth._key(),e)}return this.bypassAuthState||ns.set(this.auth._key(),()=>Promise.resolve(null)),e()}async onAuthEvent(e){if(e.type==="signInViaRedirect")return super.onAuthEvent(e);if(e.type==="unknown"){this.resolve(null);return}if(e.eventId){const t=await this.auth._redirectUserForId(e.eventId);if(t)return this.user=t,super.onAuthEvent(e);this.resolve(null)}}async onExecution(){}cleanUp(){}}async function CP(n,e){const t=j_(e),r=q_(n);if(!await r._isAvailable())return!1;const i=await r._get(t)==="true";return await r._remove(t),i}async function Gl(n,e){return q_(n)._set(j_(e),"true")}function kP(){ns.clear()}function Kl(n,e){ns.set(n._key(),e)}function q_(n){return ut(n._redirectPersistence)}function j_(n){return Hn(PP,n.config.apiKey,n.name)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function DP(n,e,t){return NP(n,e,t)}async function NP(n,e,t){if(_e(n.app))return Promise.reject(Ne(n));const r=Ie(n);fi(n,e,Zt),await r._initializationPromise;const i=gr(r,t);return await Gl(i,r),i._openRedirect(r,e,"signInViaRedirect")}function VP(n,e,t){return OP(n,e,t)}async function OP(n,e,t){const r=B(n);if(fi(r.auth,e,Zt),_e(r.auth.app))return Promise.reject(Ne(r.auth));await r.auth._initializationPromise;const i=gr(r.auth,t);await Gl(i,r.auth);const s=await $_(r);return i._openRedirect(r.auth,e,"reauthViaRedirect",s)}function xP(n,e,t){return LP(n,e,t)}async function LP(n,e,t){const r=B(n);fi(r.auth,e,Zt),await r.auth._initializationPromise;const i=gr(r.auth,t);await Va(!1,r,e.providerId),await Gl(i,r.auth);const s=await $_(r);return i._openRedirect(r.auth,e,"linkViaRedirect",s)}async function MP(n,e){return await Ie(n)._initializationPromise,Ua(n,e,!1)}async function Ua(n,e,t=!1){if(_e(n.app))return Promise.reject(Ne(n));const r=Ie(n),i=gr(r,e),o=await new SP(r,i,t).execute();return o&&!t&&(delete o.user._redirectEventId,await r._persistUserIfCurrent(o.user),await r._setRedirectUser(null,e)),o}async function $_(n){const e=Ks(`${n.uid}:::`);return n._redirectEventId=e,await n.auth._setRedirectUser(n),await n.auth._persistUserIfCurrent(n),e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const FP=600*1e3;class z_{constructor(e){this.auth=e,this.cachedEventUids=new Set,this.consumers=new Set,this.queuedRedirectEvent=null,this.hasHandledPotentialRedirect=!1,this.lastProcessedEventTime=Date.now()}registerConsumer(e){this.consumers.add(e),this.queuedRedirectEvent&&this.isEventForConsumer(this.queuedRedirectEvent,e)&&(this.sendToConsumer(this.queuedRedirectEvent,e),this.saveEventToCache(this.queuedRedirectEvent),this.queuedRedirectEvent=null)}unregisterConsumer(e){this.consumers.delete(e)}onEvent(e){if(this.hasEventBeenHandled(e))return!1;let t=!1;return this.consumers.forEach(r=>{this.isEventForConsumer(e,r)&&(t=!0,this.sendToConsumer(e,r),this.saveEventToCache(e))}),this.hasHandledPotentialRedirect||!UP(e)||(this.hasHandledPotentialRedirect=!0,t||(this.queuedRedirectEvent=e,t=!0)),t}sendToConsumer(e,t){var r;if(e.error&&!G_(e)){const i=((r=e.error.code)===null||r===void 0?void 0:r.split("auth/")[1])||"internal-error";t.onError(Se(this.auth,i))}else t.onAuthEvent(e)}isEventForConsumer(e,t){const r=t.eventId===null||!!e.eventId&&e.eventId===t.eventId;return t.filter.includes(e.type)&&r}hasEventBeenHandled(e){return Date.now()-this.lastProcessedEventTime>=FP&&this.cachedEventUids.clear(),this.cachedEventUids.has(jf(e))}saveEventToCache(e){this.cachedEventUids.add(jf(e)),this.lastProcessedEventTime=Date.now()}}function jf(n){return[n.type,n.eventId,n.sessionId,n.tenantId].filter(e=>e).join("-")}function G_({type:n,error:e}){return n==="unknown"&&(e==null?void 0:e.code)==="auth/no-auth-event"}function UP(n){switch(n.type){case"signInViaRedirect":case"linkViaRedirect":case"reauthViaRedirect":return!0;case"unknown":return G_(n);default:return!1}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function K_(n,e={}){return we(n,"GET","/v1/projects",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const BP=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,qP=/^https?/;async function jP(n){if(n.config.emulator)return;const{authorizedDomains:e}=await K_(n);for(const t of e)try{if($P(t))return}catch{}Me(n,"unauthorized-domain")}function $P(n){const e=Es(),{protocol:t,hostname:r}=new URL(e);if(n.startsWith("chrome-extension://")){const o=new URL(n);return o.hostname===""&&r===""?t==="chrome-extension:"&&n.replace("chrome-extension://","")===e.replace("chrome-extension://",""):t==="chrome-extension:"&&o.hostname===r}if(!qP.test(t))return!1;if(BP.test(n))return r===n;const i=n.replace(/\./g,"\\.");return new RegExp("^(.+\\."+i+"|"+i+")$","i").test(r)}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const zP=new qs(3e4,6e4);function $f(){const n=Re().___jsl;if(n!=null&&n.H){for(const e of Object.keys(n.H))if(n.H[e].r=n.H[e].r||[],n.H[e].L=n.H[e].L||[],n.H[e].r=[...n.H[e].L],n.CP)for(let t=0;t<n.CP.length;t++)n.CP[t]=null}}function GP(n){return new Promise((e,t)=>{var r,i,s;function o(){$f(),gapi.load("gapi.iframes",{callback:()=>{e(gapi.iframes.getContext())},ontimeout:()=>{$f(),t(Se(n,"network-request-failed"))},timeout:zP.get()})}if(!((i=(r=Re().gapi)===null||r===void 0?void 0:r.iframes)===null||i===void 0)&&i.Iframe)e(gapi.iframes.getContext());else if(!((s=Re().gapi)===null||s===void 0)&&s.load)o();else{const c=v_("iframefcb");return Re()[c]=()=>{gapi.load?o():t(Se(n,"network-request-failed"))},Ol(`${Mb()}?onload=${c}`).catch(u=>t(u))}}).catch(e=>{throw Oo=null,e})}let Oo=null;function KP(n){return Oo=Oo||GP(n),Oo}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const WP=new qs(5e3,15e3),HP="__/auth/iframe",QP="emulator/auth/iframe",JP={style:{position:"absolute",top:"-100px",width:"1px",height:"1px"},"aria-hidden":"true",tabindex:"-1"},YP=new Map([["identitytoolkit.googleapis.com","p"],["staging-identitytoolkit.sandbox.googleapis.com","s"],["test-identitytoolkit.sandbox.googleapis.com","t"]]);function XP(n){const e=n.config;O(e.authDomain,n,"auth-domain-config-required");const t=e.emulator?Vl(e,QP):`https://${n.config.authDomain}/${HP}`,r={apiKey:e.apiKey,appName:n.name,v:Ht},i=YP.get(n.config.apiHost);i&&(r.eid=i);const s=n._getFrameworks();return s.length&&(r.fw=s.join(",")),`${t}?${ii(r).slice(1)}`}async function ZP(n){const e=await KP(n),t=Re().gapi;return O(t,n,"internal-error"),e.open({where:document.body,url:XP(n),messageHandlersFilter:t.iframes.CROSS_ORIGIN_IFRAMES_FILTER,attributes:JP,dontclear:!0},r=>new Promise(async(i,s)=>{await r.restyle({setHideOnLeave:!1});const o=Se(n,"network-request-failed"),c=Re().setTimeout(()=>{s(o)},WP.get());function u(){Re().clearTimeout(c),i(r)}r.ping(u).then(u,()=>{s(o)})}))}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const eS={location:"yes",resizable:"yes",statusbar:"yes",toolbar:"no"},tS=500,nS=600,rS="_blank",iS="http://localhost";class zf{constructor(e){this.window=e,this.associatedEvent=null}close(){if(this.window)try{this.window.close()}catch{}}}function sS(n,e,t,r=tS,i=nS){const s=Math.max((window.screen.availHeight-i)/2,0).toString(),o=Math.max((window.screen.availWidth-r)/2,0).toString();let c="";const u=Object.assign(Object.assign({},eS),{width:r.toString(),height:i.toString(),top:s,left:o}),h=pe().toLowerCase();t&&(c=p_(h)?rS:t),d_(h)&&(e=e||iS,u.scrollbars="yes");const f=Object.entries(u).reduce((g,[T,C])=>`${g}${T}=${C},`,"");if(Pb(h)&&c!=="_self")return oS(e||"",c),new zf(null);const p=window.open(e||"",c,f);O(p,n,"popup-blocked");try{p.focus()}catch{}return new zf(p)}function oS(n,e){const t=document.createElement("a");t.href=n,t.target=e;const r=document.createEvent("MouseEvent");r.initMouseEvent("click",!0,!0,window,1,0,0,0,0,!1,!1,!1,!1,1,null),t.dispatchEvent(r)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const aS="__/auth/handler",cS="emulator/auth/handler",uS=encodeURIComponent("fac");async function uu(n,e,t,r,i,s){O(n.config.authDomain,n,"auth-domain-config-required"),O(n.config.apiKey,n,"invalid-api-key");const o={apiKey:n.config.apiKey,appName:n.name,authType:t,redirectUrl:r,v:Ht,eventId:i};if(e instanceof Zt){e.setDefaultLanguage(n.languageCode),o.providerId=e.providerId||"",RI(e.getCustomParameters())||(o.customParameters=JSON.stringify(e.getCustomParameters()));for(const[f,p]of Object.entries(s||{}))o[f]=p}if(e instanceof mi){const f=e.getScopes().filter(p=>p!=="");f.length>0&&(o.scopes=f.join(","))}n.tenantId&&(o.tid=n.tenantId);const c=o;for(const f of Object.keys(c))c[f]===void 0&&delete c[f];const u=await n._getAppCheckToken(),h=u?`#${uS}=${encodeURIComponent(u)}`:"";return`${lS(n)}?${ii(c).slice(1)}${h}`}function lS({config:n}){return n.emulator?Vl(n,cS):`https://${n.authDomain}/${aS}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Sc="webStorageSupport";class hS{constructor(){this.eventManagers={},this.iframes={},this.originValidationPromises={},this._redirectPersistence=or,this._completeRedirectFn=Ua,this._overrideRedirectResult=Kl}async _openPopup(e,t,r,i){var s;gt((s=this.eventManagers[e._key()])===null||s===void 0?void 0:s.manager,"_initialize() not called before _openPopup()");const o=await uu(e,t,r,Es(),i);return sS(e,o,Ks())}async _openRedirect(e,t,r,i){await this._originValidation(e);const s=await uu(e,t,r,Es(),i);return WR(s),new Promise(()=>{})}_initialize(e){const t=e._key();if(this.eventManagers[t]){const{manager:i,promise:s}=this.eventManagers[t];return i?Promise.resolve(i):(gt(s,"If manager is not set, promise should be"),s)}const r=this.initAndGetManager(e);return this.eventManagers[t]={promise:r},r.catch(()=>{delete this.eventManagers[t]}),r}async initAndGetManager(e){const t=await ZP(e),r=new z_(e);return t.register("authEvent",i=>(O(i==null?void 0:i.authEvent,e,"invalid-auth-event"),{status:r.onEvent(i.authEvent)?"ACK":"ERROR"}),gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER),this.eventManagers[e._key()]={manager:r},this.iframes[e._key()]=t,r}_isIframeWebStorageSupported(e,t){this.iframes[e._key()].send(Sc,{type:Sc},i=>{var s;const o=(s=i==null?void 0:i[0])===null||s===void 0?void 0:s[Sc];o!==void 0&&t(!!o),Me(e,"internal-error")},gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER)}_originValidation(e){const t=e._key();return this.originValidationPromises[t]||(this.originValidationPromises[t]=jP(e)),this.originValidationPromises[t]}get _shouldInitProactively(){return y_()||f_()||$s()}}const dS=hS;class fS{constructor(e){this.factorId=e}_process(e,t,r){switch(t.type){case"enroll":return this._finalizeEnroll(e,t.credential,r);case"signin":return this._finalizeSignIn(e,t.credential);default:return At("unexpected MultiFactorSessionType")}}}class Wl extends fS{constructor(e){super("phone"),this.credential=e}static _fromCredential(e){return new Wl(e)}_finalizeEnroll(e,t,r){return BR(e,{idToken:t,displayName:r,phoneVerificationInfo:this.credential._makeVerificationRequest()})}_finalizeSignIn(e,t){return rP(e,{mfaPendingCredential:t,phoneVerificationInfo:this.credential._makeVerificationRequest()})}}class W_{constructor(){}static assertion(e){return Wl._fromCredential(e)}}W_.FACTOR_ID="phone";var Gf="@firebase/auth",Kf="1.7.9";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pS{constructor(e){this.auth=e,this.internalListeners=new Map}getUid(){var e;return this.assertAuthConfigured(),((e=this.auth.currentUser)===null||e===void 0?void 0:e.uid)||null}async getToken(e){return this.assertAuthConfigured(),await this.auth._initializationPromise,this.auth.currentUser?{accessToken:await this.auth.currentUser.getIdToken(e)}:null}addAuthTokenListener(e){if(this.assertAuthConfigured(),this.internalListeners.has(e))return;const t=this.auth.onIdTokenChanged(r=>{e((r==null?void 0:r.stsTokenManager.accessToken)||null)});this.internalListeners.set(e,t),this.updateProactiveRefresh()}removeAuthTokenListener(e){this.assertAuthConfigured();const t=this.internalListeners.get(e);t&&(this.internalListeners.delete(e),t(),this.updateProactiveRefresh())}assertAuthConfigured(){O(this.auth._initializationPromise,"dependent-sdk-initialized-before-auth")}updateProactiveRefresh(){this.internalListeners.size>0?this.auth._startProactiveRefresh():this.auth._stopProactiveRefresh()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function mS(n){switch(n){case"Node":return"node";case"ReactNative":return"rn";case"Worker":return"webworker";case"Cordova":return"cordova";case"WebExtension":return"web-extension";default:return}}function gS(n){St(new ot("auth",(e,{options:t})=>{const r=e.getProvider("app").getImmediate(),i=e.getProvider("heartbeat"),s=e.getProvider("app-check-internal"),{apiKey:o,authDomain:c}=r.options;O(o&&!o.includes(":"),"invalid-api-key",{appName:r.name});const u={apiKey:o,authDomain:c,clientPlatform:n,apiHost:"identitytoolkit.googleapis.com",tokenApiHost:"securetoken.googleapis.com",apiScheme:"https",sdkClientVersion:I_(n)},h=new Vb(r,i,s,u);return qb(h,t),h},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,t,r)=>{e.getProvider("auth-internal").initialize()})),St(new ot("auth-internal",e=>{const t=Ie(e.getProvider("auth").getImmediate());return(r=>new pS(r))(t)},"PRIVATE").setInstantiationMode("EXPLICIT")),Ye(Gf,Kf,mS(n)),Ye(Gf,Kf,"esm2017")}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const _S=300;_I("authIdTokenMaxAge");function yS(){var n,e;return(e=(n=document.getElementsByTagName("head"))===null||n===void 0?void 0:n[0])!==null&&e!==void 0?e:document}Ob({loadJS(n){return new Promise((e,t)=>{const r=document.createElement("script");r.setAttribute("src",n),r.onload=e,r.onerror=i=>{const s=Se("internal-error");s.customData=i,t(s)},r.type="text/javascript",r.charset="UTF-8",yS().appendChild(r)})},gapiScript:"https://apis.google.com/js/api.js",recaptchaV2Script:"https://www.google.com/recaptcha/api.js",recaptchaEnterpriseScript:"https://www.google.com/recaptcha/enterprise.js?render="});gS("Browser");/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function cr(){return window}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const IS=2e3;async function vS(n,e,t){var r;const{BuildInfo:i}=cr();gt(e.sessionId,"AuthEvent did not contain a session ID");const s=await bS(e.sessionId),o={};return $s()?o.ibi=i.packageName:js()?o.apn=i.packageName:Me(n,"operation-not-supported-in-this-environment"),i.displayName&&(o.appDisplayName=i.displayName),o.sessionId=s,uu(n,t,e.type,void 0,(r=e.eventId)!==null&&r!==void 0?r:void 0,o)}async function wS(n){const{BuildInfo:e}=cr(),t={};$s()?t.iosBundleId=e.packageName:js()?t.androidPackageName=e.packageName:Me(n,"operation-not-supported-in-this-environment"),await K_(n,t)}function TS(n){const{cordova:e}=cr();return new Promise(t=>{e.plugins.browsertab.isAvailable(r=>{let i=null;r?e.plugins.browsertab.openUrl(n):i=e.InAppBrowser.open(n,Rb()?"_blank":"_system","location=yes"),t(i)})})}async function ES(n,e,t){const{cordova:r}=cr();let i=()=>{};try{await new Promise((s,o)=>{let c=null;function u(){var p;s();const g=(p=r.plugins.browsertab)===null||p===void 0?void 0:p.close;typeof g=="function"&&g(),typeof(t==null?void 0:t.close)=="function"&&t.close()}function h(){c||(c=window.setTimeout(()=>{o(Se(n,"redirect-cancelled-by-user"))},IS))}function f(){(document==null?void 0:document.visibilityState)==="visible"&&h()}e.addPassiveListener(u),document.addEventListener("resume",h,!1),js()&&document.addEventListener("visibilitychange",f,!1),i=()=>{e.removePassiveListener(u),document.removeEventListener("resume",h,!1),document.removeEventListener("visibilitychange",f,!1),c&&window.clearTimeout(c)}})}finally{i()}}function AS(n){var e,t,r,i,s,o,c,u,h,f;const p=cr();O(typeof((e=p==null?void 0:p.universalLinks)===null||e===void 0?void 0:e.subscribe)=="function",n,"invalid-cordova-configuration",{missingPlugin:"cordova-universal-links-plugin-fix"}),O(typeof((t=p==null?void 0:p.BuildInfo)===null||t===void 0?void 0:t.packageName)<"u",n,"invalid-cordova-configuration",{missingPlugin:"cordova-plugin-buildInfo"}),O(typeof((s=(i=(r=p==null?void 0:p.cordova)===null||r===void 0?void 0:r.plugins)===null||i===void 0?void 0:i.browsertab)===null||s===void 0?void 0:s.openUrl)=="function",n,"invalid-cordova-configuration",{missingPlugin:"cordova-plugin-browsertab"}),O(typeof((u=(c=(o=p==null?void 0:p.cordova)===null||o===void 0?void 0:o.plugins)===null||c===void 0?void 0:c.browsertab)===null||u===void 0?void 0:u.isAvailable)=="function",n,"invalid-cordova-configuration",{missingPlugin:"cordova-plugin-browsertab"}),O(typeof((f=(h=p==null?void 0:p.cordova)===null||h===void 0?void 0:h.InAppBrowser)===null||f===void 0?void 0:f.open)=="function",n,"invalid-cordova-configuration",{missingPlugin:"cordova-plugin-inappbrowser"})}async function bS(n){const e=RS(n),t=await crypto.subtle.digest("SHA-256",e);return Array.from(new Uint8Array(t)).map(i=>i.toString(16).padStart(2,"0")).join("")}function RS(n){if(gt(/[0-9a-zA-Z]+/.test(n),"Can only convert alpha-numeric strings"),typeof TextEncoder<"u")return new TextEncoder().encode(n);const e=new ArrayBuffer(n.length),t=new Uint8Array(e);for(let r=0;r<n.length;r++)t[r]=n.charCodeAt(r);return t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const PS=20;class SS extends z_{constructor(){super(...arguments),this.passiveListeners=new Set,this.initPromise=new Promise(e=>{this.resolveInitialized=e})}addPassiveListener(e){this.passiveListeners.add(e)}removePassiveListener(e){this.passiveListeners.delete(e)}resetRedirect(){this.queuedRedirectEvent=null,this.hasHandledPotentialRedirect=!1}onEvent(e){return this.resolveInitialized(),this.passiveListeners.forEach(t=>t(e)),super.onEvent(e)}async initialized(){await this.initPromise}}function CS(n,e,t=null){return{type:e,eventId:t,urlResponse:null,sessionId:NS(),postBody:null,tenantId:n.tenantId,error:Se(n,"no-auth-event")}}function kS(n,e){return lu()._set(hu(n),e)}async function Wf(n){const e=await lu()._get(hu(n));return e&&await lu()._remove(hu(n)),e}function DS(n,e){var t,r;const i=OS(e);if(i.includes("/__/auth/callback")){const s=xo(i),o=s.firebaseError?VS(decodeURIComponent(s.firebaseError)):null,c=(r=(t=o==null?void 0:o.code)===null||t===void 0?void 0:t.split("auth/"))===null||r===void 0?void 0:r[1],u=c?Se(c):null;return u?{type:n.type,eventId:n.eventId,tenantId:n.tenantId,error:u,urlResponse:null,sessionId:null,postBody:null}:{type:n.type,eventId:n.eventId,tenantId:n.tenantId,sessionId:n.sessionId,urlResponse:i,postBody:null}}return null}function NS(){const n=[],e="1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";for(let t=0;t<PS;t++){const r=Math.floor(Math.random()*e.length);n.push(e.charAt(r))}return n.join("")}function lu(){return ut(ql)}function hu(n){return Hn("authEvent",n.config.apiKey,n.name)}function VS(n){try{return JSON.parse(n)}catch{return null}}function OS(n){const e=xo(n),t=e.link?decodeURIComponent(e.link):void 0,r=xo(t).link,i=e.deep_link_id?decodeURIComponent(e.deep_link_id):void 0;return xo(i).link||i||r||t||n}function xo(n){if(!(n!=null&&n.includes("?")))return{};const[e,...t]=n.split("?");return Nr(t.join("?"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xS=500;class LS{constructor(){this._redirectPersistence=or,this._shouldInitProactively=!0,this.eventManagers=new Map,this.originValidationPromises={},this._completeRedirectFn=Ua,this._overrideRedirectResult=Kl}async _initialize(e){const t=e._key();let r=this.eventManagers.get(t);return r||(r=new SS(e),this.eventManagers.set(t,r),this.attachCallbackListeners(e,r)),r}_openPopup(e){Me(e,"operation-not-supported-in-this-environment")}async _openRedirect(e,t,r,i){AS(e);const s=await this._initialize(e);await s.initialized(),s.resetRedirect(),kP(),await this._originValidation(e);const o=CS(e,r,i);await kS(e,o);const c=await vS(e,o,t),u=await TS(c);return ES(e,s,u)}_isIframeWebStorageSupported(e,t){throw new Error("Method not implemented.")}_originValidation(e){const t=e._key();return this.originValidationPromises[t]||(this.originValidationPromises[t]=wS(e)),this.originValidationPromises[t]}attachCallbackListeners(e,t){const{universalLinks:r,handleOpenURL:i,BuildInfo:s}=cr(),o=setTimeout(async()=>{await Wf(e),t.onEvent(Hf())},xS),c=async f=>{clearTimeout(o);const p=await Wf(e);let g=null;p&&(f!=null&&f.url)&&(g=DS(p,f.url)),t.onEvent(g||Hf())};typeof r<"u"&&typeof r.subscribe=="function"&&r.subscribe(null,c);const u=i,h=`${s.packageName.toLowerCase()}://`;cr().handleOpenURL=async f=>{if(f.toLowerCase().startsWith(h)&&c({url:f}),typeof u=="function")try{u(f)}catch(p){console.error(p)}}}}const MS=LS;function Hf(){return{type:"unknown",eventId:null,sessionId:null,urlResponse:null,postBody:null,tenantId:null,error:Se("no-auth-event")}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function FS(n,e){Ie(n)._logFramework(e)}var US="@firebase/auth-compat",BS="0.5.14";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qS=1e3;function rs(){var n;return((n=self==null?void 0:self.location)===null||n===void 0?void 0:n.protocol)||null}function jS(){return rs()==="http:"||rs()==="https:"}function H_(n=pe()){return!!((rs()==="file:"||rs()==="ionic:"||rs()==="capacitor:")&&n.toLowerCase().match(/iphone|ipad|ipod|android/))}function $S(){return vu()||Iu()}function zS(){return yp()&&(document==null?void 0:document.documentMode)===11}function GS(n=pe()){return/Edge\/\d+/.test(n)}function KS(n=pe()){return zS()||GS(n)}function Q_(){try{const n=self.localStorage,e=Ks();if(n)return n.setItem(e,"1"),n.removeItem(e),KS()?ss():!0}catch{return Hl()&&ss()}return!1}function Hl(){return typeof global<"u"&&"WorkerGlobalScope"in global&&"importScripts"in global}function Cc(){return(jS()||_p()||H_())&&!$S()&&Q_()&&!Hl()}function J_(){return H_()&&typeof document<"u"}async function WS(){return J_()?new Promise(n=>{const e=setTimeout(()=>{n(!1)},qS);document.addEventListener("deviceready",()=>{clearTimeout(e),n(!0)})}):!1}function HS(){return typeof window<"u"?window:null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ct={LOCAL:"local",NONE:"none",SESSION:"session"},Bi=O,Y_="persistence";function QS(n,e){if(Bi(Object.values(ct).includes(e),n,"invalid-persistence-type"),vu()){Bi(e!==ct.SESSION,n,"unsupported-persistence-type");return}if(Iu()){Bi(e===ct.NONE,n,"unsupported-persistence-type");return}if(Hl()){Bi(e===ct.NONE||e===ct.LOCAL&&ss(),n,"unsupported-persistence-type");return}Bi(e===ct.NONE||Q_(),n,"unsupported-persistence-type")}async function du(n){await n._initializationPromise;const e=X_(),t=Hn(Y_,n.config.apiKey,n.name);e&&e.setItem(t,n._getPersistence())}function JS(n,e){const t=X_();if(!t)return[];const r=Hn(Y_,n,e);switch(t.getItem(r)){case ct.NONE:return[ni];case ct.LOCAL:return[Ps,or];case ct.SESSION:return[or];default:return[]}}function X_(){var n;try{return((n=HS())===null||n===void 0?void 0:n.sessionStorage)||null}catch{return null}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const YS=O;class fn{constructor(){this.browserResolver=ut(dS),this.cordovaResolver=ut(MS),this.underlyingResolver=null,this._redirectPersistence=or,this._completeRedirectFn=Ua,this._overrideRedirectResult=Kl}async _initialize(e){return await this.selectUnderlyingResolver(),this.assertedUnderlyingResolver._initialize(e)}async _openPopup(e,t,r,i){return await this.selectUnderlyingResolver(),this.assertedUnderlyingResolver._openPopup(e,t,r,i)}async _openRedirect(e,t,r,i){return await this.selectUnderlyingResolver(),this.assertedUnderlyingResolver._openRedirect(e,t,r,i)}_isIframeWebStorageSupported(e,t){this.assertedUnderlyingResolver._isIframeWebStorageSupported(e,t)}_originValidation(e){return this.assertedUnderlyingResolver._originValidation(e)}get _shouldInitProactively(){return J_()||this.browserResolver._shouldInitProactively}get assertedUnderlyingResolver(){return YS(this.underlyingResolver,"internal-error"),this.underlyingResolver}async selectUnderlyingResolver(){if(this.underlyingResolver)return;const e=await WS();this.underlyingResolver=e?this.cordovaResolver:this.browserResolver}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Z_(n){return n.unwrap()}function XS(n){return n.wrapped()}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ZS(n){return ey(n)}function eC(n,e){var t;const r=(t=e.customData)===null||t===void 0?void 0:t._tokenResponse;if((e==null?void 0:e.code)==="auth/multi-factor-auth-required"){const i=e;i.resolver=new tC(n,FR(n,e))}else if(r){const i=ey(e),s=e;i&&(s.credential=i,s.tenantId=r.tenantId||void 0,s.email=r.email||void 0,s.phoneNumber=r.phoneNumber||void 0)}}function ey(n){const{_tokenResponse:e}=n instanceof Pe?n.customData:n;if(!e)return null;if(!(n instanceof Pe)&&"temporaryProof"in e&&"phoneNumber"in e)return ar.credentialFromResult(n);const t=e.providerId;if(!t||t===Ui.PASSWORD)return null;let r;switch(t){case Ui.GOOGLE:r=yt;break;case Ui.FACEBOOK:r=_t;break;case Ui.GITHUB:r=It;break;case Ui.TWITTER:r=vt;break;default:const{oauthIdToken:i,oauthAccessToken:s,oauthTokenSecret:o,pendingToken:c,nonce:u}=e;return!s&&!o&&!i&&!c?null:c?t.startsWith("saml.")?ri._create(t,c):Nt._fromParams({providerId:t,signInMethod:t,pendingToken:c,idToken:i,accessToken:s}):new Mr(t).credential({idToken:i,accessToken:s,rawNonce:u})}return n instanceof Pe?r.credentialFromError(n):r.credentialFromResult(n)}function nt(n,e){return e.catch(t=>{throw t instanceof Pe&&eC(n,t),t}).then(t=>{const r=t.operationType,i=t.user;return{operationType:r,credential:ZS(t),additionalUserInfo:MR(t),user:Bt.getOrCreate(i)}})}async function fu(n,e){const t=await e;return{verificationId:t.verificationId,confirm:r=>nt(n,t.confirm(r))}}class tC{constructor(e,t){this.resolver=t,this.auth=XS(e)}get session(){return this.resolver.session}get hints(){return this.resolver.hints}resolveSignIn(e){return nt(Z_(this.auth),this.resolver.resolveSignIn(e))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Bt{constructor(e){this._delegate=e,this.multiFactor=jR(e)}static getOrCreate(e){return Bt.USER_MAP.has(e)||Bt.USER_MAP.set(e,new Bt(e)),Bt.USER_MAP.get(e)}delete(){return this._delegate.delete()}reload(){return this._delegate.reload()}toJSON(){return this._delegate.toJSON()}getIdTokenResult(e){return this._delegate.getIdTokenResult(e)}getIdToken(e){return this._delegate.getIdToken(e)}linkAndRetrieveDataWithCredential(e){return this.linkWithCredential(e)}async linkWithCredential(e){return nt(this.auth,S_(this._delegate,e))}async linkWithPhoneNumber(e,t){return fu(this.auth,_P(this._delegate,e,t))}async linkWithPopup(e){return nt(this.auth,RP(this._delegate,e,fn))}async linkWithRedirect(e){return await du(Ie(this.auth)),xP(this._delegate,e,fn)}reauthenticateAndRetrieveDataWithCredential(e){return this.reauthenticateWithCredential(e)}async reauthenticateWithCredential(e){return nt(this.auth,C_(this._delegate,e))}reauthenticateWithPhoneNumber(e,t){return fu(this.auth,yP(this._delegate,e,t))}reauthenticateWithPopup(e){return nt(this.auth,bP(this._delegate,e,fn))}async reauthenticateWithRedirect(e){return await du(Ie(this.auth)),VP(this._delegate,e,fn)}sendEmailVerification(e){return RR(this._delegate,e)}async unlink(e){return await dR(this._delegate,e),this}updateEmail(e){return kR(this._delegate,e)}updatePassword(e){return DR(this._delegate,e)}updatePhoneNumber(e){return IP(this._delegate,e)}updateProfile(e){return CR(this._delegate,e)}verifyBeforeUpdateEmail(e,t){return PR(this._delegate,e,t)}get emailVerified(){return this._delegate.emailVerified}get isAnonymous(){return this._delegate.isAnonymous}get metadata(){return this._delegate.metadata}get phoneNumber(){return this._delegate.phoneNumber}get providerData(){return this._delegate.providerData}get refreshToken(){return this._delegate.refreshToken}get tenantId(){return this._delegate.tenantId}get displayName(){return this._delegate.displayName}get email(){return this._delegate.email}get photoURL(){return this._delegate.photoURL}get providerId(){return this._delegate.providerId}get uid(){return this._delegate.uid}get auth(){return this._delegate.auth}}Bt.USER_MAP=new WeakMap;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qi=O;class pu{constructor(e,t){if(this.app=e,t.isInitialized()){this._delegate=t.getImmediate(),this.linkUnderlyingAuth();return}const{apiKey:r}=e.options;qi(r,"invalid-api-key",{appName:e.name}),qi(r,"invalid-api-key",{appName:e.name});const i=typeof window<"u"?fn:void 0;this._delegate=t.initialize({options:{persistence:nC(r,e.name),popupRedirectResolver:i}}),this._delegate._updateErrorMap(sb),this.linkUnderlyingAuth()}get emulatorConfig(){return this._delegate.emulatorConfig}get currentUser(){return this._delegate.currentUser?Bt.getOrCreate(this._delegate.currentUser):null}get languageCode(){return this._delegate.languageCode}set languageCode(e){this._delegate.languageCode=e}get settings(){return this._delegate.settings}get tenantId(){return this._delegate.tenantId}set tenantId(e){this._delegate.tenantId=e}useDeviceLanguage(){this._delegate.useDeviceLanguage()}signOut(){return this._delegate.signOut()}useEmulator(e,t){jb(this._delegate,e,t)}applyActionCode(e){return _R(this._delegate,e)}checkActionCode(e){return k_(this._delegate,e)}confirmPasswordReset(e,t){return gR(this._delegate,e,t)}async createUserWithEmailAndPassword(e,t){return nt(this._delegate,IR(this._delegate,e,t))}fetchProvidersForEmail(e){return this.fetchSignInMethodsForEmail(e)}fetchSignInMethodsForEmail(e){return bR(this._delegate,e)}isSignInWithEmailLink(e){return TR(this._delegate,e)}async getRedirectResult(){qi(Cc(),this._delegate,"operation-not-supported-in-this-environment");const e=await MP(this._delegate,fn);return e?nt(this._delegate,Promise.resolve(e)):{credential:null,user:null}}addFrameworkForLogging(e){FS(this._delegate,e)}onAuthStateChanged(e,t,r){const{next:i,error:s,complete:o}=Qf(e,t,r);return this._delegate.onAuthStateChanged(i,s,o)}onIdTokenChanged(e,t,r){const{next:i,error:s,complete:o}=Qf(e,t,r);return this._delegate.onIdTokenChanged(i,s,o)}sendSignInLinkToEmail(e,t){return wR(this._delegate,e,t)}sendPasswordResetEmail(e,t){return mR(this._delegate,e,t||void 0)}async setPersistence(e){QS(this._delegate,e);let t;switch(e){case ct.SESSION:t=or;break;case ct.LOCAL:t=await ut(Ps)._isAvailable()?Ps:ql;break;case ct.NONE:t=ni;break;default:return Me("argument-error",{appName:this._delegate.name})}return this._delegate.setPersistence(t)}signInAndRetrieveDataWithCredential(e){return this.signInWithCredential(e)}signInAnonymously(){return nt(this._delegate,hR(this._delegate))}signInWithCredential(e){return nt(this._delegate,Oa(this._delegate,e))}signInWithCustomToken(e){return nt(this._delegate,pR(this._delegate,e))}signInWithEmailAndPassword(e,t){return nt(this._delegate,vR(this._delegate,e,t))}signInWithEmailLink(e,t){return nt(this._delegate,ER(this._delegate,e,t))}signInWithPhoneNumber(e,t){return fu(this._delegate,gP(this._delegate,e,t))}async signInWithPopup(e){return qi(Cc(),this._delegate,"operation-not-supported-in-this-environment"),nt(this._delegate,AP(this._delegate,e,fn))}async signInWithRedirect(e){return qi(Cc(),this._delegate,"operation-not-supported-in-this-environment"),await du(this._delegate),DP(this._delegate,e,fn)}updateCurrentUser(e){return this._delegate.updateCurrentUser(e)}verifyPasswordResetCode(e){return yR(this._delegate,e)}unwrap(){return this._delegate}_delete(){return this._delegate._delete()}linkUnderlyingAuth(){this._delegate.wrapped=()=>this}}pu.Persistence=ct;function Qf(n,e,t){let r=n;typeof n!="function"&&({next:r,error:e,complete:t}=n);const i=r;return{next:o=>i(o&&Bt.getOrCreate(o)),error:e,complete:t}}function nC(n,e){const t=JS(n,e);if(typeof self<"u"&&!t.includes(Ps)&&t.push(Ps),typeof window<"u")for(const r of[ql,or])t.includes(r)||t.push(r);return t.includes(ni)||t.push(ni),t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ql{constructor(){this.providerId="phone",this._delegate=new ar(Z_(bn.auth()))}static credential(e,t){return ar.credential(e,t)}verifyPhoneNumber(e,t){return this._delegate.verifyPhoneNumber(e,t)}unwrap(){return this._delegate}}Ql.PHONE_SIGN_IN_METHOD=ar.PHONE_SIGN_IN_METHOD;Ql.PROVIDER_ID=ar.PROVIDER_ID;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const rC=O;class iC{constructor(e,t,r=bn.app()){var i;rC((i=r.options)===null||i===void 0?void 0:i.apiKey,"invalid-api-key",{appName:r.name}),this._delegate=new pP(r.auth(),e,t),this.type=this._delegate.type}clear(){this._delegate.clear()}render(){return this._delegate.render()}verify(){return this._delegate.verify()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const sC="auth-compat";function oC(n){n.INTERNAL.registerComponent(new ot(sC,e=>{const t=e.getProvider("app-compat").getImmediate(),r=e.getProvider("auth");return new pu(t,r)},"PUBLIC").setServiceProps({ActionCodeInfo:{Operation:{EMAIL_SIGNIN:br.EMAIL_SIGNIN,PASSWORD_RESET:br.PASSWORD_RESET,RECOVER_EMAIL:br.RECOVER_EMAIL,REVERT_SECOND_FACTOR_ADDITION:br.REVERT_SECOND_FACTOR_ADDITION,VERIFY_AND_CHANGE_EMAIL:br.VERIFY_AND_CHANGE_EMAIL,VERIFY_EMAIL:br.VERIFY_EMAIL}},EmailAuthProvider:kn,FacebookAuthProvider:_t,GithubAuthProvider:It,GoogleAuthProvider:yt,OAuthProvider:Mr,SAMLAuthProvider:Zo,PhoneAuthProvider:Ql,PhoneMultiFactorGenerator:W_,RecaptchaVerifier:iC,TwitterAuthProvider:vt,Auth:pu,AuthCredential:pi,Error:Pe}).setInstantiationMode("LAZY").setMultipleInstances(!1)),n.registerVersion(US,BS)}oC(bn);/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const aC="type.googleapis.com/google.protobuf.Int64Value",cC="type.googleapis.com/google.protobuf.UInt64Value";function ty(n,e){const t={};for(const r in n)n.hasOwnProperty(r)&&(t[r]=e(n[r]));return t}function mu(n){if(n==null)return null;if(n instanceof Number&&(n=n.valueOf()),typeof n=="number"&&isFinite(n)||n===!0||n===!1||Object.prototype.toString.call(n)==="[object String]")return n;if(n instanceof Date)return n.toISOString();if(Array.isArray(n))return n.map(e=>mu(e));if(typeof n=="function"||typeof n=="object")return ty(n,e=>mu(e));throw new Error("Data cannot be encoded in JSON: "+n)}function ra(n){if(n==null)return n;if(n["@type"])switch(n["@type"]){case aC:case cC:{const e=Number(n.value);if(isNaN(e))throw new Error("Data cannot be decoded from JSON: "+n);return e}default:throw new Error("Data cannot be decoded from JSON: "+n)}return Array.isArray(n)?n.map(e=>ra(e)):typeof n=="function"||typeof n=="object"?ty(n,e=>ra(e)):n}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Jl="functions";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Jf={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class Ur extends Pe{constructor(e,t,r){super(`${Jl}/${e}`,t||""),this.details=r}}function uC(n){if(n>=200&&n<300)return"ok";switch(n){case 0:return"internal";case 400:return"invalid-argument";case 401:return"unauthenticated";case 403:return"permission-denied";case 404:return"not-found";case 409:return"aborted";case 429:return"resource-exhausted";case 499:return"cancelled";case 500:return"internal";case 501:return"unimplemented";case 503:return"unavailable";case 504:return"deadline-exceeded"}return"unknown"}function lC(n,e){let t=uC(n),r=t,i;try{const s=e&&e.error;if(s){const o=s.status;if(typeof o=="string"){if(!Jf[o])return new Ur("internal","internal");t=Jf[o],r=o}const c=s.message;typeof c=="string"&&(r=c),i=s.details,i!==void 0&&(i=ra(i))}}catch{}return t==="ok"?null:new Ur(t,r,i)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hC{constructor(e,t,r){this.auth=null,this.messaging=null,this.appCheck=null,this.auth=e.getImmediate({optional:!0}),this.messaging=t.getImmediate({optional:!0}),this.auth||e.get().then(i=>this.auth=i,()=>{}),this.messaging||t.get().then(i=>this.messaging=i,()=>{}),this.appCheck||r.get().then(i=>this.appCheck=i,()=>{})}async getAuthToken(){if(this.auth)try{const e=await this.auth.getToken();return e==null?void 0:e.accessToken}catch{return}}async getMessagingToken(){if(!(!this.messaging||!("Notification"in self)||Notification.permission!=="granted"))try{return await this.messaging.getToken()}catch{return}}async getAppCheckToken(e){if(this.appCheck){const t=e?await this.appCheck.getLimitedUseToken():await this.appCheck.getToken();return t.error?null:t.token}return null}async getContext(e){const t=await this.getAuthToken(),r=await this.getMessagingToken(),i=await this.getAppCheckToken(e);return{authToken:t,messagingToken:r,appCheckToken:i}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gu="us-central1";function dC(n){let e=null;return{promise:new Promise((t,r)=>{e=setTimeout(()=>{r(new Ur("deadline-exceeded","deadline-exceeded"))},n)}),cancel:()=>{e&&clearTimeout(e)}}}let fC=class{constructor(e,t,r,i,s=gu,o){this.app=e,this.fetchImpl=o,this.emulatorOrigin=null,this.contextProvider=new hC(t,r,i),this.cancelAllRequests=new Promise(c=>{this.deleteService=()=>Promise.resolve(c())});try{const c=new URL(s);this.customDomain=c.origin+(c.pathname==="/"?"":c.pathname),this.region=gu}catch{this.customDomain=null,this.region=s}}_delete(){return this.deleteService()}_url(e){const t=this.app.options.projectId;return this.emulatorOrigin!==null?`${this.emulatorOrigin}/${t}/${this.region}/${e}`:this.customDomain!==null?`${this.customDomain}/${e}`:`https://${this.region}-${t}.cloudfunctions.net/${e}`}};function pC(n,e,t){n.emulatorOrigin=`http://${e}:${t}`}function mC(n,e,t){return(r=>yC(n,e,r,t||{}))}function gC(n,e,t){return(r=>ny(n,e,r,t||{}))}async function _C(n,e,t,r){t["Content-Type"]="application/json";let i;try{i=await r(n,{method:"POST",body:JSON.stringify(e),headers:t})}catch{return{status:0,json:null}}let s=null;try{s=await i.json()}catch{}return{status:i.status,json:s}}function yC(n,e,t,r){const i=n._url(e);return ny(n,i,t,r)}async function ny(n,e,t,r){t=mu(t);const i={data:t},s={},o=await n.contextProvider.getContext(r.limitedUseAppCheckTokens);o.authToken&&(s.Authorization="Bearer "+o.authToken),o.messagingToken&&(s["Firebase-Instance-ID-Token"]=o.messagingToken),o.appCheckToken!==null&&(s["X-Firebase-AppCheck"]=o.appCheckToken);const c=r.timeout||7e4,u=dC(c),h=await Promise.race([_C(e,i,s,n.fetchImpl),u.promise,n.cancelAllRequests]);if(u.cancel(),!h)throw new Ur("cancelled","Firebase Functions instance was deleted.");const f=lC(h.status,h.json);if(f)throw f;if(!h.json)throw new Ur("internal","Response is not valid JSON object.");let p=h.json.data;if(typeof p>"u"&&(p=h.json.result),typeof p>"u")throw new Ur("internal","Response is missing data field.");return{data:ra(p)}}const Yf="@firebase/functions",Xf="0.11.8";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const IC="auth-internal",vC="app-check-internal",wC="messaging-internal";function TC(n,e){const t=(r,{instanceIdentifier:i})=>{const s=r.getProvider("app").getImmediate(),o=r.getProvider(IC),c=r.getProvider(wC),u=r.getProvider(vC);return new fC(s,o,c,u,i,n)};St(new ot(Jl,t,"PUBLIC").setMultipleInstances(!0)),Ye(Yf,Xf,e),Ye(Yf,Xf,"esm2017")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function bk(n=Sp(),e=gu){const r=Eu(B(n),Jl).getImmediate({identifier:e}),i=gI("functions");return i&&_u(r,...i),r}function _u(n,e,t){pC(B(n),e,t)}function EC(n,e,t){return mC(B(n),e,t)}function AC(n,e,t){return gC(B(n),e,t)}TC(fetch.bind(self));const bC="@firebase/functions-compat",RC="0.3.14";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ry{constructor(e,t){this.app=e,this._delegate=t,this._region=this._delegate.region,this._customDomain=this._delegate.customDomain}httpsCallable(e,t){return EC(this._delegate,e,t)}httpsCallableFromURL(e,t){return AC(this._delegate,e,t)}useFunctionsEmulator(e){const t=e.match("[a-zA-Z]+://([a-zA-Z0-9.-]+)(?::([0-9]+))?");if(t==null)throw new Pe("functions","No origin provided to useFunctionsEmulator()");if(t[2]==null)throw new Pe("functions","Port missing in origin provided to useFunctionsEmulator()");return _u(this._delegate,t[1],Number(t[2]))}useEmulator(e,t){return _u(this._delegate,e,t)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const PC="us-central1",SC=(n,{instanceIdentifier:e})=>{const t=n.getProvider("app-compat").getImmediate(),r=n.getProvider("functions").getImmediate({identifier:e??PC});return new ry(t,r)};function CC(){const n={Functions:ry};bn.INTERNAL.registerComponent(new ot("functions-compat",SC,"PUBLIC").setServiceProps(n).setMultipleInstances(!0))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */CC();bn.registerVersion(bC,RC);/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const iy="firebasestorage.googleapis.com",sy="storageBucket",kC=120*1e3,DC=600*1e3,NC=1e3;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class me extends Pe{constructor(e,t,r=0){super(kc(e),`Firebase Storage: ${t} (${kc(e)})`),this.status_=r,this.customData={serverResponse:null},this._baseMessage=this.message,Object.setPrototypeOf(this,me.prototype)}get status(){return this.status_}set status(e){this.status_=e}_codeEquals(e){return kc(e)===this.code}get serverResponse(){return this.customData.serverResponse}set serverResponse(e){this.customData.serverResponse=e,this.customData.serverResponse?this.message=`${this._baseMessage}
${this.customData.serverResponse}`:this.message=this._baseMessage}}var ce;(function(n){n.UNKNOWN="unknown",n.OBJECT_NOT_FOUND="object-not-found",n.BUCKET_NOT_FOUND="bucket-not-found",n.PROJECT_NOT_FOUND="project-not-found",n.QUOTA_EXCEEDED="quota-exceeded",n.UNAUTHENTICATED="unauthenticated",n.UNAUTHORIZED="unauthorized",n.UNAUTHORIZED_APP="unauthorized-app",n.RETRY_LIMIT_EXCEEDED="retry-limit-exceeded",n.INVALID_CHECKSUM="invalid-checksum",n.CANCELED="canceled",n.INVALID_EVENT_NAME="invalid-event-name",n.INVALID_URL="invalid-url",n.INVALID_DEFAULT_BUCKET="invalid-default-bucket",n.NO_DEFAULT_BUCKET="no-default-bucket",n.CANNOT_SLICE_BLOB="cannot-slice-blob",n.SERVER_FILE_WRONG_SIZE="server-file-wrong-size",n.NO_DOWNLOAD_URL="no-download-url",n.INVALID_ARGUMENT="invalid-argument",n.INVALID_ARGUMENT_COUNT="invalid-argument-count",n.APP_DELETED="app-deleted",n.INVALID_ROOT_OPERATION="invalid-root-operation",n.INVALID_FORMAT="invalid-format",n.INTERNAL_ERROR="internal-error",n.UNSUPPORTED_ENVIRONMENT="unsupported-environment"})(ce||(ce={}));function kc(n){return"storage/"+n}function Yl(){const n="An unknown error occurred, please check the error payload for server response.";return new me(ce.UNKNOWN,n)}function VC(n){return new me(ce.OBJECT_NOT_FOUND,"Object '"+n+"' does not exist.")}function OC(n){return new me(ce.QUOTA_EXCEEDED,"Quota for bucket '"+n+"' exceeded, please view quota on https://firebase.google.com/pricing/.")}function xC(){const n="User is not authenticated, please authenticate using Firebase Authentication and try again.";return new me(ce.UNAUTHENTICATED,n)}function LC(){return new me(ce.UNAUTHORIZED_APP,"This app does not have permission to access Firebase Storage on this project.")}function MC(n){return new me(ce.UNAUTHORIZED,"User does not have permission to access '"+n+"'.")}function oy(){return new me(ce.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again.")}function ay(){return new me(ce.CANCELED,"User canceled the upload/download.")}function FC(n){return new me(ce.INVALID_URL,"Invalid URL '"+n+"'.")}function UC(n){return new me(ce.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+n+"'.")}function BC(){return new me(ce.NO_DEFAULT_BUCKET,"No default bucket found. Did you set the '"+sy+"' property when initializing the app?")}function cy(){return new me(ce.CANNOT_SLICE_BLOB,"Cannot slice blob for upload. Please retry the upload.")}function qC(){return new me(ce.SERVER_FILE_WRONG_SIZE,"Server recorded incorrect upload file size, please retry the upload.")}function jC(){return new me(ce.NO_DOWNLOAD_URL,"The given file does not have any download URLs.")}function $C(n){return new me(ce.UNSUPPORTED_ENVIRONMENT,`${n} is missing. Make sure to install the required polyfills. See https://firebase.google.com/docs/web/environments-js-sdk#polyfills for more information.`)}function Br(n){return new me(ce.INVALID_ARGUMENT,n)}function uy(){return new me(ce.APP_DELETED,"The Firebase app was deleted.")}function ly(n){return new me(ce.INVALID_ROOT_OPERATION,"The operation '"+n+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}function is(n,e){return new me(ce.INVALID_FORMAT,"String does not match format '"+n+"': "+e)}function ji(n){throw new me(ce.INTERNAL_ERROR,"Internal error: "+n)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $e{constructor(e,t){this.bucket=e,this.path_=t}get path(){return this.path_}get isRoot(){return this.path.length===0}fullServerUrl(){const e=encodeURIComponent;return"/b/"+e(this.bucket)+"/o/"+e(this.path)}bucketOnlyServerUrl(){return"/b/"+encodeURIComponent(this.bucket)+"/o"}static makeFromBucketSpec(e,t){let r;try{r=$e.makeFromUrl(e,t)}catch{return new $e(e,"")}if(r.path==="")return r;throw UC(e)}static makeFromUrl(e,t){let r=null;const i="([A-Za-z0-9.\\-_]+)";function s(G){G.path.charAt(G.path.length-1)==="/"&&(G.path_=G.path_.slice(0,-1))}const o="(/(.*))?$",c=new RegExp("^gs://"+i+o,"i"),u={bucket:1,path:3};function h(G){G.path_=decodeURIComponent(G.path)}const f="v[A-Za-z0-9_]+",p=t.replace(/[.]/g,"\\."),g="(/([^?#]*).*)?$",T=new RegExp(`^https?://${p}/${f}/b/${i}/o${g}`,"i"),C={bucket:1,path:3},D=t===iy?"(?:storage.googleapis.com|storage.cloud.google.com)":t,k="([^?#]*)",j=new RegExp(`^https?://${D}/${i}/${k}`,"i"),F=[{regex:c,indices:u,postModify:s},{regex:T,indices:C,postModify:h},{regex:j,indices:{bucket:1,path:2},postModify:h}];for(let G=0;G<F.length;G++){const J=F[G],K=J.regex.exec(e);if(K){const v=K[J.indices.bucket];let _=K[J.indices.path];_||(_=""),r=new $e(v,_),J.postModify(r);break}}if(r==null)throw FC(e);return r}}class zC{constructor(e){this.promise_=Promise.reject(e)}getPromise(){return this.promise_}cancel(e=!1){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function GC(n,e,t){let r=1,i=null,s=null,o=!1,c=0;function u(){return c===2}let h=!1;function f(...k){h||(h=!0,e.apply(null,k))}function p(k){i=setTimeout(()=>{i=null,n(T,u())},k)}function g(){s&&clearTimeout(s)}function T(k,...j){if(h){g();return}if(k){g(),f.call(null,k,...j);return}if(u()||o){g(),f.call(null,k,...j);return}r<64&&(r*=2);let F;c===1?(c=2,F=0):F=(r+Math.random())*1e3,p(F)}let C=!1;function D(k){C||(C=!0,g(),!h&&(i!==null?(k||(c=2),clearTimeout(i),p(0)):k||(c=1)))}return p(0),s=setTimeout(()=>{o=!0,D(!0)},t),D}function KC(n){n(!1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function WC(n){return n!==void 0}function HC(n){return typeof n=="function"}function QC(n){return typeof n=="object"&&!Array.isArray(n)}function Ba(n){return typeof n=="string"||n instanceof String}function Zf(n){return Xl()&&n instanceof Blob}function Xl(){return typeof Blob<"u"}function yu(n,e,t,r){if(r<e)throw Br(`Invalid value for '${n}'. Expected ${e} or greater.`);if(r>t)throw Br(`Invalid value for '${n}'. Expected ${t} or less.`)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Dn(n,e,t){let r=e;return t==null&&(r=`https://${e}`),`${t}://${r}/v0${n}`}function hy(n){const e=encodeURIComponent;let t="?";for(const r in n)if(n.hasOwnProperty(r)){const i=e(r)+"="+e(n[r]);t=t+i+"&"}return t=t.slice(0,-1),t}var Jn;(function(n){n[n.NO_ERROR=0]="NO_ERROR",n[n.NETWORK_ERROR=1]="NETWORK_ERROR",n[n.ABORT=2]="ABORT"})(Jn||(Jn={}));/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function dy(n,e){const t=n>=500&&n<600,i=[408,429].indexOf(n)!==-1,s=e.indexOf(n)!==-1;return t||i||s}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class JC{constructor(e,t,r,i,s,o,c,u,h,f,p,g=!0){this.url_=e,this.method_=t,this.headers_=r,this.body_=i,this.successCodes_=s,this.additionalRetryCodes_=o,this.callback_=c,this.errorCallback_=u,this.timeout_=h,this.progressCallback_=f,this.connectionFactory_=p,this.retry=g,this.pendingConnection_=null,this.backoffId_=null,this.canceled_=!1,this.appDelete_=!1,this.promise_=new Promise((T,C)=>{this.resolve_=T,this.reject_=C,this.start_()})}start_(){const e=(r,i)=>{if(i){r(!1,new wo(!1,null,!0));return}const s=this.connectionFactory_();this.pendingConnection_=s;const o=c=>{const u=c.loaded,h=c.lengthComputable?c.total:-1;this.progressCallback_!==null&&this.progressCallback_(u,h)};this.progressCallback_!==null&&s.addUploadProgressListener(o),s.send(this.url_,this.method_,this.body_,this.headers_).then(()=>{this.progressCallback_!==null&&s.removeUploadProgressListener(o),this.pendingConnection_=null;const c=s.getErrorCode()===Jn.NO_ERROR,u=s.getStatus();if(!c||dy(u,this.additionalRetryCodes_)&&this.retry){const f=s.getErrorCode()===Jn.ABORT;r(!1,new wo(!1,null,f));return}const h=this.successCodes_.indexOf(u)!==-1;r(!0,new wo(h,s))})},t=(r,i)=>{const s=this.resolve_,o=this.reject_,c=i.connection;if(i.wasSuccessCode)try{const u=this.callback_(c,c.getResponse());WC(u)?s(u):s()}catch(u){o(u)}else if(c!==null){const u=Yl();u.serverResponse=c.getErrorText(),this.errorCallback_?o(this.errorCallback_(c,u)):o(u)}else if(i.canceled){const u=this.appDelete_?uy():ay();o(u)}else{const u=oy();o(u)}};this.canceled_?t(!1,new wo(!1,null,!0)):this.backoffId_=GC(e,t,this.timeout_)}getPromise(){return this.promise_}cancel(e){this.canceled_=!0,this.appDelete_=e||!1,this.backoffId_!==null&&KC(this.backoffId_),this.pendingConnection_!==null&&this.pendingConnection_.abort()}}class wo{constructor(e,t,r){this.wasSuccessCode=e,this.connection=t,this.canceled=!!r}}function YC(n,e){e!==null&&e.length>0&&(n.Authorization="Firebase "+e)}function XC(n,e){n["X-Firebase-Storage-Version"]="webjs/"+(e??"AppManager")}function ZC(n,e){e&&(n["X-Firebase-GMPID"]=e)}function e0(n,e){e!==null&&(n["X-Firebase-AppCheck"]=e)}function t0(n,e,t,r,i,s,o=!0){const c=hy(n.urlParams),u=n.url+c,h=Object.assign({},n.headers);return ZC(h,e),YC(h,t),XC(h,s),e0(h,r),new JC(u,n.method,h,n.body,n.successCodes,n.additionalRetryCodes,n.handler,n.errorHandler,n.timeout,n.progressCallback,i,o)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function n0(){return typeof BlobBuilder<"u"?BlobBuilder:typeof WebKitBlobBuilder<"u"?WebKitBlobBuilder:void 0}function r0(...n){const e=n0();if(e!==void 0){const t=new e;for(let r=0;r<n.length;r++)t.append(n[r]);return t.getBlob()}else{if(Xl())return new Blob(n);throw new me(ce.UNSUPPORTED_ENVIRONMENT,"This browser doesn't seem to support creating Blobs")}}function i0(n,e,t){return n.webkitSlice?n.webkitSlice(e,t):n.mozSlice?n.mozSlice(e,t):n.slice?n.slice(e,t):null}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function s0(n){if(typeof atob>"u")throw $C("base-64");return atob(n)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dt={RAW:"raw",BASE64:"base64",BASE64URL:"base64url",DATA_URL:"data_url"};class Dc{constructor(e,t){this.data=e,this.contentType=t||null}}function fy(n,e){switch(n){case dt.RAW:return new Dc(py(e));case dt.BASE64:case dt.BASE64URL:return new Dc(my(n,e));case dt.DATA_URL:return new Dc(a0(e),c0(e))}throw Yl()}function py(n){const e=[];for(let t=0;t<n.length;t++){let r=n.charCodeAt(t);if(r<=127)e.push(r);else if(r<=2047)e.push(192|r>>6,128|r&63);else if((r&64512)===55296)if(!(t<n.length-1&&(n.charCodeAt(t+1)&64512)===56320))e.push(239,191,189);else{const s=r,o=n.charCodeAt(++t);r=65536|(s&1023)<<10|o&1023,e.push(240|r>>18,128|r>>12&63,128|r>>6&63,128|r&63)}else(r&64512)===56320?e.push(239,191,189):e.push(224|r>>12,128|r>>6&63,128|r&63)}return new Uint8Array(e)}function o0(n){let e;try{e=decodeURIComponent(n)}catch{throw is(dt.DATA_URL,"Malformed data URL.")}return py(e)}function my(n,e){switch(n){case dt.BASE64:{const i=e.indexOf("-")!==-1,s=e.indexOf("_")!==-1;if(i||s)throw is(n,"Invalid character '"+(i?"-":"_")+"' found: is it base64url encoded?");break}case dt.BASE64URL:{const i=e.indexOf("+")!==-1,s=e.indexOf("/")!==-1;if(i||s)throw is(n,"Invalid character '"+(i?"+":"/")+"' found: is it base64 encoded?");e=e.replace(/-/g,"+").replace(/_/g,"/");break}}let t;try{t=s0(e)}catch(i){throw i.message.includes("polyfill")?i:is(n,"Invalid character found")}const r=new Uint8Array(t.length);for(let i=0;i<t.length;i++)r[i]=t.charCodeAt(i);return r}class gy{constructor(e){this.base64=!1,this.contentType=null;const t=e.match(/^data:([^,]+)?,/);if(t===null)throw is(dt.DATA_URL,"Must be formatted 'data:[<mediatype>][;base64],<data>");const r=t[1]||null;r!=null&&(this.base64=u0(r,";base64"),this.contentType=this.base64?r.substring(0,r.length-7):r),this.rest=e.substring(e.indexOf(",")+1)}}function a0(n){const e=new gy(n);return e.base64?my(dt.BASE64,e.rest):o0(e.rest)}function c0(n){return new gy(n).contentType}function u0(n,e){return n.length>=e.length?n.substring(n.length-e.length)===e:!1}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Lt{constructor(e,t){let r=0,i="";Zf(e)?(this.data_=e,r=e.size,i=e.type):e instanceof ArrayBuffer?(t?this.data_=new Uint8Array(e):(this.data_=new Uint8Array(e.byteLength),this.data_.set(new Uint8Array(e))),r=this.data_.length):e instanceof Uint8Array&&(t?this.data_=e:(this.data_=new Uint8Array(e.length),this.data_.set(e)),r=e.length),this.size_=r,this.type_=i}size(){return this.size_}type(){return this.type_}slice(e,t){if(Zf(this.data_)){const r=this.data_,i=i0(r,e,t);return i===null?null:new Lt(i)}else{const r=new Uint8Array(this.data_.buffer,e,t-e);return new Lt(r,!0)}}static getBlob(...e){if(Xl()){const t=e.map(r=>r instanceof Lt?r.data_:r);return new Lt(r0.apply(null,t))}else{const t=e.map(o=>Ba(o)?fy(dt.RAW,o).data:o.data_);let r=0;t.forEach(o=>{r+=o.byteLength});const i=new Uint8Array(r);let s=0;return t.forEach(o=>{for(let c=0;c<o.length;c++)i[s++]=o[c]}),new Lt(i,!0)}}uploadData(){return this.data_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Zl(n){let e;try{e=JSON.parse(n)}catch{return null}return QC(e)?e:null}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function l0(n){if(n.length===0)return null;const e=n.lastIndexOf("/");return e===-1?"":n.slice(0,e)}function h0(n,e){const t=e.split("/").filter(r=>r.length>0).join("/");return n.length===0?t:n+"/"+t}function _y(n){const e=n.lastIndexOf("/",n.length-2);return e===-1?n:n.slice(e+1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function d0(n,e){return e}class We{constructor(e,t,r,i){this.server=e,this.local=t||e,this.writable=!!r,this.xform=i||d0}}let To=null;function f0(n){return!Ba(n)||n.length<2?n:_y(n)}function qa(){if(To)return To;const n=[];n.push(new We("bucket")),n.push(new We("generation")),n.push(new We("metageneration")),n.push(new We("name","fullPath",!0));function e(s,o){return f0(o)}const t=new We("name");t.xform=e,n.push(t);function r(s,o){return o!==void 0?Number(o):o}const i=new We("size");return i.xform=r,n.push(i),n.push(new We("timeCreated")),n.push(new We("updated")),n.push(new We("md5Hash",null,!0)),n.push(new We("cacheControl",null,!0)),n.push(new We("contentDisposition",null,!0)),n.push(new We("contentEncoding",null,!0)),n.push(new We("contentLanguage",null,!0)),n.push(new We("contentType",null,!0)),n.push(new We("metadata","customMetadata",!0)),To=n,To}function p0(n,e){function t(){const r=n.bucket,i=n.fullPath,s=new $e(r,i);return e._makeStorageReference(s)}Object.defineProperty(n,"ref",{get:t})}function m0(n,e,t){const r={};r.type="file";const i=t.length;for(let s=0;s<i;s++){const o=t[s];r[o.local]=o.xform(r,e[o.server])}return p0(r,n),r}function yy(n,e,t){const r=Zl(e);return r===null?null:m0(n,r,t)}function g0(n,e,t,r){const i=Zl(e);if(i===null||!Ba(i.downloadTokens))return null;const s=i.downloadTokens;if(s.length===0)return null;const o=encodeURIComponent;return s.split(",").map(h=>{const f=n.bucket,p=n.fullPath,g="/b/"+o(f)+"/o/"+o(p),T=Dn(g,t,r),C=hy({alt:"media",token:h});return T+C})[0]}function eh(n,e){const t={},r=e.length;for(let i=0;i<r;i++){const s=e[i];s.writable&&(t[s.server]=n[s.local])}return JSON.stringify(t)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ep="prefixes",tp="items";function _0(n,e,t){const r={prefixes:[],items:[],nextPageToken:t.nextPageToken};if(t[ep])for(const i of t[ep]){const s=i.replace(/\/$/,""),o=n._makeStorageReference(new $e(e,s));r.prefixes.push(o)}if(t[tp])for(const i of t[tp]){const s=n._makeStorageReference(new $e(e,i.name));r.items.push(s)}return r}function y0(n,e,t){const r=Zl(t);return r===null?null:_0(n,e,r)}class en{constructor(e,t,r,i){this.url=e,this.method=t,this.handler=r,this.timeout=i,this.urlParams={},this.headers={},this.body=null,this.errorHandler=null,this.progressCallback=null,this.successCodes=[200],this.additionalRetryCodes=[]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Pt(n){if(!n)throw Yl()}function ja(n,e){function t(r,i){const s=yy(n,i,e);return Pt(s!==null),s}return t}function I0(n,e){function t(r,i){const s=y0(n,e,i);return Pt(s!==null),s}return t}function v0(n,e){function t(r,i){const s=yy(n,i,e);return Pt(s!==null),g0(s,i,n.host,n._protocol)}return t}function gi(n){function e(t,r){let i;return t.getStatus()===401?t.getErrorText().includes("Firebase App Check token is invalid")?i=LC():i=xC():t.getStatus()===402?i=OC(n.bucket):t.getStatus()===403?i=MC(n.path):i=r,i.status=t.getStatus(),i.serverResponse=r.serverResponse,i}return e}function $a(n){const e=gi(n);function t(r,i){let s=e(r,i);return r.getStatus()===404&&(s=VC(n.path)),s.serverResponse=i.serverResponse,s}return t}function Iy(n,e,t){const r=e.fullServerUrl(),i=Dn(r,n.host,n._protocol),s="GET",o=n.maxOperationRetryTime,c=new en(i,s,ja(n,t),o);return c.errorHandler=$a(e),c}function w0(n,e,t,r,i){const s={};e.isRoot?s.prefix="":s.prefix=e.path+"/",t.length>0&&(s.delimiter=t),r&&(s.pageToken=r),i&&(s.maxResults=i);const o=e.bucketOnlyServerUrl(),c=Dn(o,n.host,n._protocol),u="GET",h=n.maxOperationRetryTime,f=new en(c,u,I0(n,e.bucket),h);return f.urlParams=s,f.errorHandler=gi(e),f}function T0(n,e,t){const r=e.fullServerUrl(),i=Dn(r,n.host,n._protocol),s="GET",o=n.maxOperationRetryTime,c=new en(i,s,v0(n,t),o);return c.errorHandler=$a(e),c}function E0(n,e,t,r){const i=e.fullServerUrl(),s=Dn(i,n.host,n._protocol),o="PATCH",c=eh(t,r),u={"Content-Type":"application/json; charset=utf-8"},h=n.maxOperationRetryTime,f=new en(s,o,ja(n,r),h);return f.headers=u,f.body=c,f.errorHandler=$a(e),f}function A0(n,e){const t=e.fullServerUrl(),r=Dn(t,n.host,n._protocol),i="DELETE",s=n.maxOperationRetryTime;function o(u,h){}const c=new en(r,i,o,s);return c.successCodes=[200,204],c.errorHandler=$a(e),c}function b0(n,e){return n&&n.contentType||e&&e.type()||"application/octet-stream"}function vy(n,e,t){const r=Object.assign({},t);return r.fullPath=n.path,r.size=e.size(),r.contentType||(r.contentType=b0(null,e)),r}function R0(n,e,t,r,i){const s=e.bucketOnlyServerUrl(),o={"X-Goog-Upload-Protocol":"multipart"};function c(){let F="";for(let G=0;G<2;G++)F=F+Math.random().toString().slice(2);return F}const u=c();o["Content-Type"]="multipart/related; boundary="+u;const h=vy(e,r,i),f=eh(h,t),p="--"+u+`\r
Content-Type: application/json; charset=utf-8\r
\r
`+f+`\r
--`+u+`\r
Content-Type: `+h.contentType+`\r
\r
`,g=`\r
--`+u+"--",T=Lt.getBlob(p,r,g);if(T===null)throw cy();const C={name:h.fullPath},D=Dn(s,n.host,n._protocol),k="POST",j=n.maxUploadRetryTime,z=new en(D,k,ja(n,t),j);return z.urlParams=C,z.headers=o,z.body=T.uploadData(),z.errorHandler=gi(e),z}class ia{constructor(e,t,r,i){this.current=e,this.total=t,this.finalized=!!r,this.metadata=i||null}}function th(n,e){let t=null;try{t=n.getResponseHeader("X-Goog-Upload-Status")}catch{Pt(!1)}return Pt(!!t&&(e||["active"]).indexOf(t)!==-1),t}function P0(n,e,t,r,i){const s=e.bucketOnlyServerUrl(),o=vy(e,r,i),c={name:o.fullPath},u=Dn(s,n.host,n._protocol),h="POST",f={"X-Goog-Upload-Protocol":"resumable","X-Goog-Upload-Command":"start","X-Goog-Upload-Header-Content-Length":`${r.size()}`,"X-Goog-Upload-Header-Content-Type":o.contentType,"Content-Type":"application/json; charset=utf-8"},p=eh(o,t),g=n.maxUploadRetryTime;function T(D){th(D);let k;try{k=D.getResponseHeader("X-Goog-Upload-URL")}catch{Pt(!1)}return Pt(Ba(k)),k}const C=new en(u,h,T,g);return C.urlParams=c,C.headers=f,C.body=p,C.errorHandler=gi(e),C}function S0(n,e,t,r){const i={"X-Goog-Upload-Command":"query"};function s(h){const f=th(h,["active","final"]);let p=null;try{p=h.getResponseHeader("X-Goog-Upload-Size-Received")}catch{Pt(!1)}p||Pt(!1);const g=Number(p);return Pt(!isNaN(g)),new ia(g,r.size(),f==="final")}const o="POST",c=n.maxUploadRetryTime,u=new en(t,o,s,c);return u.headers=i,u.errorHandler=gi(e),u}const np=256*1024;function C0(n,e,t,r,i,s,o,c){const u=new ia(0,0);if(o?(u.current=o.current,u.total=o.total):(u.current=0,u.total=r.size()),r.size()!==u.total)throw qC();const h=u.total-u.current;let f=h;i>0&&(f=Math.min(f,i));const p=u.current,g=p+f;let T="";f===0?T="finalize":h===f?T="upload, finalize":T="upload";const C={"X-Goog-Upload-Command":T,"X-Goog-Upload-Offset":`${u.current}`},D=r.slice(p,g);if(D===null)throw cy();function k(G,J){const K=th(G,["active","final"]),v=u.current+f,_=r.size();let y;return K==="final"?y=ja(e,s)(G,J):y=null,new ia(v,_,K==="final",y)}const j="POST",z=e.maxUploadRetryTime,F=new en(t,j,k,z);return F.headers=C,F.body=D.uploadData(),F.progressCallback=c||null,F.errorHandler=gi(n),F}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const k0={STATE_CHANGED:"state_changed"},Je={RUNNING:"running",PAUSED:"paused",SUCCESS:"success",CANCELED:"canceled",ERROR:"error"};function Nc(n){switch(n){case"running":case"pausing":case"canceling":return Je.RUNNING;case"paused":return Je.PAUSED;case"success":return Je.SUCCESS;case"canceled":return Je.CANCELED;case"error":return Je.ERROR;default:return Je.ERROR}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class D0{constructor(e,t,r){if(HC(e)||t!=null||r!=null)this.next=e,this.error=t??void 0,this.complete=r??void 0;else{const s=e;this.next=s.next,this.error=s.error,this.complete=s.complete}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Rr(n){return(...e)=>{Promise.resolve().then(()=>n(...e))}}class N0{constructor(){this.sent_=!1,this.xhr_=new XMLHttpRequest,this.initXhr(),this.errorCode_=Jn.NO_ERROR,this.sendPromise_=new Promise(e=>{this.xhr_.addEventListener("abort",()=>{this.errorCode_=Jn.ABORT,e()}),this.xhr_.addEventListener("error",()=>{this.errorCode_=Jn.NETWORK_ERROR,e()}),this.xhr_.addEventListener("load",()=>{e()})})}send(e,t,r,i){if(this.sent_)throw ji("cannot .send() more than once");if(this.sent_=!0,this.xhr_.open(t,e,!0),i!==void 0)for(const s in i)i.hasOwnProperty(s)&&this.xhr_.setRequestHeader(s,i[s].toString());return r!==void 0?this.xhr_.send(r):this.xhr_.send(),this.sendPromise_}getErrorCode(){if(!this.sent_)throw ji("cannot .getErrorCode() before sending");return this.errorCode_}getStatus(){if(!this.sent_)throw ji("cannot .getStatus() before sending");try{return this.xhr_.status}catch{return-1}}getResponse(){if(!this.sent_)throw ji("cannot .getResponse() before sending");return this.xhr_.response}getErrorText(){if(!this.sent_)throw ji("cannot .getErrorText() before sending");return this.xhr_.statusText}abort(){this.xhr_.abort()}getResponseHeader(e){return this.xhr_.getResponseHeader(e)}addUploadProgressListener(e){this.xhr_.upload!=null&&this.xhr_.upload.addEventListener("progress",e)}removeUploadProgressListener(e){this.xhr_.upload!=null&&this.xhr_.upload.removeEventListener("progress",e)}}class V0 extends N0{initXhr(){this.xhr_.responseType="text"}}function wt(){return new V0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wy{constructor(e,t,r=null){this._transferred=0,this._needToFetchStatus=!1,this._needToFetchMetadata=!1,this._observers=[],this._error=void 0,this._uploadUrl=void 0,this._request=void 0,this._chunkMultiplier=1,this._resolve=void 0,this._reject=void 0,this._ref=e,this._blob=t,this._metadata=r,this._mappings=qa(),this._resumable=this._shouldDoResumable(this._blob),this._state="running",this._errorHandler=i=>{if(this._request=void 0,this._chunkMultiplier=1,i._codeEquals(ce.CANCELED))this._needToFetchStatus=!0,this.completeTransitions_();else{const s=this.isExponentialBackoffExpired();if(dy(i.status,[]))if(s)i=oy();else{this.sleepTime=Math.max(this.sleepTime*2,NC),this._needToFetchStatus=!0,this.completeTransitions_();return}this._error=i,this._transition("error")}},this._metadataErrorHandler=i=>{this._request=void 0,i._codeEquals(ce.CANCELED)?this.completeTransitions_():(this._error=i,this._transition("error"))},this.sleepTime=0,this.maxSleepTime=this._ref.storage.maxUploadRetryTime,this._promise=new Promise((i,s)=>{this._resolve=i,this._reject=s,this._start()}),this._promise.then(null,()=>{})}isExponentialBackoffExpired(){return this.sleepTime>this.maxSleepTime}_makeProgressCallback(){const e=this._transferred;return t=>this._updateProgress(e+t)}_shouldDoResumable(e){return e.size()>256*1024}_start(){this._state==="running"&&this._request===void 0&&(this._resumable?this._uploadUrl===void 0?this._createResumable():this._needToFetchStatus?this._fetchStatus():this._needToFetchMetadata?this._fetchMetadata():this.pendingTimeout=setTimeout(()=>{this.pendingTimeout=void 0,this._continueUpload()},this.sleepTime):this._oneShotUpload())}_resolveToken(e){Promise.all([this._ref.storage._getAuthToken(),this._ref.storage._getAppCheckToken()]).then(([t,r])=>{switch(this._state){case"running":e(t,r);break;case"canceling":this._transition("canceled");break;case"pausing":this._transition("paused");break}})}_createResumable(){this._resolveToken((e,t)=>{const r=P0(this._ref.storage,this._ref._location,this._mappings,this._blob,this._metadata),i=this._ref.storage._makeRequest(r,wt,e,t);this._request=i,i.getPromise().then(s=>{this._request=void 0,this._uploadUrl=s,this._needToFetchStatus=!1,this.completeTransitions_()},this._errorHandler)})}_fetchStatus(){const e=this._uploadUrl;this._resolveToken((t,r)=>{const i=S0(this._ref.storage,this._ref._location,e,this._blob),s=this._ref.storage._makeRequest(i,wt,t,r);this._request=s,s.getPromise().then(o=>{o=o,this._request=void 0,this._updateProgress(o.current),this._needToFetchStatus=!1,o.finalized&&(this._needToFetchMetadata=!0),this.completeTransitions_()},this._errorHandler)})}_continueUpload(){const e=np*this._chunkMultiplier,t=new ia(this._transferred,this._blob.size()),r=this._uploadUrl;this._resolveToken((i,s)=>{let o;try{o=C0(this._ref._location,this._ref.storage,r,this._blob,e,this._mappings,t,this._makeProgressCallback())}catch(u){this._error=u,this._transition("error");return}const c=this._ref.storage._makeRequest(o,wt,i,s,!1);this._request=c,c.getPromise().then(u=>{this._increaseMultiplier(),this._request=void 0,this._updateProgress(u.current),u.finalized?(this._metadata=u.metadata,this._transition("success")):this.completeTransitions_()},this._errorHandler)})}_increaseMultiplier(){np*this._chunkMultiplier*2<32*1024*1024&&(this._chunkMultiplier*=2)}_fetchMetadata(){this._resolveToken((e,t)=>{const r=Iy(this._ref.storage,this._ref._location,this._mappings),i=this._ref.storage._makeRequest(r,wt,e,t);this._request=i,i.getPromise().then(s=>{this._request=void 0,this._metadata=s,this._transition("success")},this._metadataErrorHandler)})}_oneShotUpload(){this._resolveToken((e,t)=>{const r=R0(this._ref.storage,this._ref._location,this._mappings,this._blob,this._metadata),i=this._ref.storage._makeRequest(r,wt,e,t);this._request=i,i.getPromise().then(s=>{this._request=void 0,this._metadata=s,this._updateProgress(this._blob.size()),this._transition("success")},this._errorHandler)})}_updateProgress(e){const t=this._transferred;this._transferred=e,this._transferred!==t&&this._notifyObservers()}_transition(e){if(this._state!==e)switch(e){case"canceling":case"pausing":this._state=e,this._request!==void 0?this._request.cancel():this.pendingTimeout&&(clearTimeout(this.pendingTimeout),this.pendingTimeout=void 0,this.completeTransitions_());break;case"running":const t=this._state==="paused";this._state=e,t&&(this._notifyObservers(),this._start());break;case"paused":this._state=e,this._notifyObservers();break;case"canceled":this._error=ay(),this._state=e,this._notifyObservers();break;case"error":this._state=e,this._notifyObservers();break;case"success":this._state=e,this._notifyObservers();break}}completeTransitions_(){switch(this._state){case"pausing":this._transition("paused");break;case"canceling":this._transition("canceled");break;case"running":this._start();break}}get snapshot(){const e=Nc(this._state);return{bytesTransferred:this._transferred,totalBytes:this._blob.size(),state:e,metadata:this._metadata,task:this,ref:this._ref}}on(e,t,r,i){const s=new D0(t||void 0,r||void 0,i||void 0);return this._addObserver(s),()=>{this._removeObserver(s)}}then(e,t){return this._promise.then(e,t)}catch(e){return this.then(null,e)}_addObserver(e){this._observers.push(e),this._notifyObserver(e)}_removeObserver(e){const t=this._observers.indexOf(e);t!==-1&&this._observers.splice(t,1)}_notifyObservers(){this._finishPromise(),this._observers.slice().forEach(t=>{this._notifyObserver(t)})}_finishPromise(){if(this._resolve!==void 0){let e=!0;switch(Nc(this._state)){case Je.SUCCESS:Rr(this._resolve.bind(null,this.snapshot))();break;case Je.CANCELED:case Je.ERROR:const t=this._reject;Rr(t.bind(null,this._error))();break;default:e=!1;break}e&&(this._resolve=void 0,this._reject=void 0)}}_notifyObserver(e){switch(Nc(this._state)){case Je.RUNNING:case Je.PAUSED:e.next&&Rr(e.next.bind(e,this.snapshot))();break;case Je.SUCCESS:e.complete&&Rr(e.complete.bind(e))();break;case Je.CANCELED:case Je.ERROR:e.error&&Rr(e.error.bind(e,this._error))();break;default:e.error&&Rr(e.error.bind(e,this._error))()}}resume(){const e=this._state==="paused"||this._state==="pausing";return e&&this._transition("running"),e}pause(){const e=this._state==="running";return e&&this._transition("pausing"),e}cancel(){const e=this._state==="running"||this._state==="pausing";return e&&this._transition("canceling"),e}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ur{constructor(e,t){this._service=e,t instanceof $e?this._location=t:this._location=$e.makeFromUrl(t,e.host)}toString(){return"gs://"+this._location.bucket+"/"+this._location.path}_newRef(e,t){return new ur(e,t)}get root(){const e=new $e(this._location.bucket,"");return this._newRef(this._service,e)}get bucket(){return this._location.bucket}get fullPath(){return this._location.path}get name(){return _y(this._location.path)}get storage(){return this._service}get parent(){const e=l0(this._location.path);if(e===null)return null;const t=new $e(this._location.bucket,e);return new ur(this._service,t)}_throwIfRoot(e){if(this._location.path==="")throw ly(e)}}function O0(n,e,t){return n._throwIfRoot("uploadBytesResumable"),new wy(n,new Lt(e),t)}function x0(n){const e={prefixes:[],items:[]};return Ty(n,e).then(()=>e)}async function Ty(n,e,t){const i=await Ey(n,{pageToken:t});e.prefixes.push(...i.prefixes),e.items.push(...i.items),i.nextPageToken!=null&&await Ty(n,e,i.nextPageToken)}function Ey(n,e){e!=null&&typeof e.maxResults=="number"&&yu("options.maxResults",1,1e3,e.maxResults);const t=e||{},r=w0(n.storage,n._location,"/",t.pageToken,t.maxResults);return n.storage.makeRequestWithTokens(r,wt)}function L0(n){n._throwIfRoot("getMetadata");const e=Iy(n.storage,n._location,qa());return n.storage.makeRequestWithTokens(e,wt)}function M0(n,e){n._throwIfRoot("updateMetadata");const t=E0(n.storage,n._location,e,qa());return n.storage.makeRequestWithTokens(t,wt)}function F0(n){n._throwIfRoot("getDownloadURL");const e=T0(n.storage,n._location,qa());return n.storage.makeRequestWithTokens(e,wt).then(t=>{if(t===null)throw jC();return t})}function U0(n){n._throwIfRoot("deleteObject");const e=A0(n.storage,n._location);return n.storage.makeRequestWithTokens(e,wt)}function Ay(n,e){const t=h0(n._location.path,e),r=new $e(n._location.bucket,t);return new ur(n.storage,r)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function B0(n){return/^[A-Za-z]+:\/\//.test(n)}function q0(n,e){return new ur(n,e)}function by(n,e){if(n instanceof nh){const t=n;if(t._bucket==null)throw BC();const r=new ur(t,t._bucket);return e!=null?by(r,e):r}else return e!==void 0?Ay(n,e):n}function j0(n,e){if(e&&B0(e)){if(n instanceof nh)return q0(n,e);throw Br("To use ref(service, url), the first argument must be a Storage instance.")}else return by(n,e)}function rp(n,e){const t=e==null?void 0:e[sy];return t==null?null:$e.makeFromBucketSpec(t,n)}function $0(n,e,t,r={}){n.host=`${e}:${t}`,n._protocol="http";const{mockUserToken:i}=r;i&&(n._overrideAuthToken=typeof i=="string"?i:mp(i,n.app.options.projectId))}class nh{constructor(e,t,r,i,s){this.app=e,this._authProvider=t,this._appCheckProvider=r,this._url=i,this._firebaseVersion=s,this._bucket=null,this._host=iy,this._protocol="https",this._appId=null,this._deleted=!1,this._maxOperationRetryTime=kC,this._maxUploadRetryTime=DC,this._requests=new Set,i!=null?this._bucket=$e.makeFromBucketSpec(i,this._host):this._bucket=rp(this._host,this.app.options)}get host(){return this._host}set host(e){this._host=e,this._url!=null?this._bucket=$e.makeFromBucketSpec(this._url,e):this._bucket=rp(e,this.app.options)}get maxUploadRetryTime(){return this._maxUploadRetryTime}set maxUploadRetryTime(e){yu("time",0,Number.POSITIVE_INFINITY,e),this._maxUploadRetryTime=e}get maxOperationRetryTime(){return this._maxOperationRetryTime}set maxOperationRetryTime(e){yu("time",0,Number.POSITIVE_INFINITY,e),this._maxOperationRetryTime=e}async _getAuthToken(){if(this._overrideAuthToken)return this._overrideAuthToken;const e=this._authProvider.getImmediate({optional:!0});if(e){const t=await e.getToken();if(t!==null)return t.accessToken}return null}async _getAppCheckToken(){const e=this._appCheckProvider.getImmediate({optional:!0});return e?(await e.getToken()).token:null}_delete(){return this._deleted||(this._deleted=!0,this._requests.forEach(e=>e.cancel()),this._requests.clear()),Promise.resolve()}_makeStorageReference(e){return new ur(this,e)}_makeRequest(e,t,r,i,s=!0){if(this._deleted)return new zC(uy());{const o=t0(e,this._appId,r,i,t,this._firebaseVersion,s);return this._requests.add(o),o.getPromise().then(()=>this._requests.delete(o),()=>this._requests.delete(o)),o}}async makeRequestWithTokens(e,t){const[r,i]=await Promise.all([this._getAuthToken(),this._getAppCheckToken()]);return this._makeRequest(e,t,r,i).getPromise()}}const ip="@firebase/storage",sp="0.13.2";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const z0="storage";function G0(n,e,t){return n=B(n),O0(n,e,t)}function K0(n){return n=B(n),L0(n)}function W0(n,e){return n=B(n),M0(n,e)}function H0(n,e){return n=B(n),Ey(n,e)}function Q0(n){return n=B(n),x0(n)}function J0(n){return n=B(n),F0(n)}function Y0(n){return n=B(n),U0(n)}function op(n,e){return n=B(n),j0(n,e)}function X0(n,e){return Ay(n,e)}function Z0(n,e,t,r={}){$0(n,e,t,r)}function ek(n,{instanceIdentifier:e}){const t=n.getProvider("app").getImmediate(),r=n.getProvider("auth-internal"),i=n.getProvider("app-check-internal");return new nh(t,r,i,e,Ht)}function tk(){St(new ot(z0,ek,"PUBLIC").setMultipleInstances(!0)),Ye(ip,sp,""),Ye(ip,sp,"esm2017")}tk();/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Eo{constructor(e,t,r){this._delegate=e,this.task=t,this.ref=r}get bytesTransferred(){return this._delegate.bytesTransferred}get metadata(){return this._delegate.metadata}get state(){return this._delegate.state}get totalBytes(){return this._delegate.totalBytes}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ap{constructor(e,t){this._delegate=e,this._ref=t,this.cancel=this._delegate.cancel.bind(this._delegate),this.catch=this._delegate.catch.bind(this._delegate),this.pause=this._delegate.pause.bind(this._delegate),this.resume=this._delegate.resume.bind(this._delegate)}get snapshot(){return new Eo(this._delegate.snapshot,this,this._ref)}then(e,t){return this._delegate.then(r=>{if(e)return e(new Eo(r,this,this._ref))},t)}on(e,t,r,i){let s;return t&&(typeof t=="function"?s=o=>t(new Eo(o,this,this._ref)):s={next:t.next?o=>t.next(new Eo(o,this,this._ref)):void 0,complete:t.complete||void 0,error:t.error||void 0}),this._delegate.on(e,s,r||void 0,i||void 0)}}class cp{constructor(e,t){this._delegate=e,this._service=t}get prefixes(){return this._delegate.prefixes.map(e=>new $t(e,this._service))}get items(){return this._delegate.items.map(e=>new $t(e,this._service))}get nextPageToken(){return this._delegate.nextPageToken||null}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $t{constructor(e,t){this._delegate=e,this.storage=t}get name(){return this._delegate.name}get bucket(){return this._delegate.bucket}get fullPath(){return this._delegate.fullPath}toString(){return this._delegate.toString()}child(e){const t=X0(this._delegate,e);return new $t(t,this.storage)}get root(){return new $t(this._delegate.root,this.storage)}get parent(){const e=this._delegate.parent;return e==null?null:new $t(e,this.storage)}put(e,t){return this._throwIfRoot("put"),new ap(G0(this._delegate,e,t),this)}putString(e,t=dt.RAW,r){this._throwIfRoot("putString");const i=fy(t,e),s=Object.assign({},r);return s.contentType==null&&i.contentType!=null&&(s.contentType=i.contentType),new ap(new wy(this._delegate,new Lt(i.data,!0),s),this)}listAll(){return Q0(this._delegate).then(e=>new cp(e,this.storage))}list(e){return H0(this._delegate,e||void 0).then(t=>new cp(t,this.storage))}getMetadata(){return K0(this._delegate)}updateMetadata(e){return W0(this._delegate,e)}getDownloadURL(){return J0(this._delegate)}delete(){return this._throwIfRoot("delete"),Y0(this._delegate)}_throwIfRoot(e){if(this._delegate._location.path==="")throw ly(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ry{constructor(e,t){this.app=e,this._delegate=t}get maxOperationRetryTime(){return this._delegate.maxOperationRetryTime}get maxUploadRetryTime(){return this._delegate.maxUploadRetryTime}ref(e){if(up(e))throw Br("ref() expected a child path but got a URL, use refFromURL instead.");return new $t(op(this._delegate,e),this)}refFromURL(e){if(!up(e))throw Br("refFromURL() expected a full URL but got a child path, use ref() instead.");try{$e.makeFromUrl(e,this._delegate.host)}catch{throw Br("refFromUrl() expected a valid full URL but got an invalid one.")}return new $t(op(this._delegate,e),this)}setMaxUploadRetryTime(e){this._delegate.maxUploadRetryTime=e}setMaxOperationRetryTime(e){this._delegate.maxOperationRetryTime=e}useEmulator(e,t,r={}){Z0(this._delegate,e,t,r)}}function up(n){return/^[A-Za-z]+:\/\//.test(n)}const nk="@firebase/storage-compat",rk="0.3.12";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ik="storage-compat";function sk(n,{instanceIdentifier:e}){const t=n.getProvider("app-compat").getImmediate(),r=n.getProvider("storage").getImmediate({identifier:e});return new Ry(t,r)}function ok(n){const e={TaskState:Je,TaskEvent:k0,StringFormat:dt,Storage:Ry,Reference:$t};n.INTERNAL.registerComponent(new ot(ik,sk,"PUBLIC").setServiceProps(e).setMultipleInstances(!0)),n.registerVersion(nk,rk)}ok(bn);export{ot as C,lr as E,Pe as F,St as _,MA as a,FA as b,xg as c,Jo as d,Eu as e,bn as f,bk as g,EC as h,GI as i,ck as j,B as k,ss as l,ak as m,_u as n,Yg as o,AC as p,cn as q,Ye as r,Rf as s,EA as t,Pf as u,TA as v};
