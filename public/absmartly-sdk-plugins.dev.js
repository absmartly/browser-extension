(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["ABsmartlySDKPlugins"] = factory();
	else
		root["ABsmartlySDKPlugins"] = factory();
})(this, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/web-vitals/dist/web-vitals.umd.cjs":
/*!*********************************************************!*\
  !*** ./node_modules/web-vitals/dist/web-vitals.umd.cjs ***!
  \*********************************************************/
/***/ (function(__unused_webpack_module, exports) {

!function(e,t){ true?t(exports):0}(this,(function(e){"use strict";let t=-1;const n=e=>{addEventListener("pageshow",(n=>{n.persisted&&(t=n.timeStamp,e(n))}),!0)},i=(e,t,n,i)=>{let o,s;return r=>{t.value>=0&&(r||i)&&(s=t.value-(o??0),(s||void 0===o)&&(o=t.value,t.delta=s,t.rating=((e,t)=>e>t[1]?"poor":e>t[0]?"needs-improvement":"good")(t.value,n),e(t)))}},o=e=>{requestAnimationFrame((()=>requestAnimationFrame((()=>e()))))},s=()=>{const e=performance.getEntriesByType("navigation")[0];if(e&&e.responseStart>0&&e.responseStart<performance.now())return e},r=()=>{const e=s();return e?.activationStart??0},c=(e,n=-1)=>{const i=s();let o="navigate";t>=0?o="back-forward-cache":i&&(document.prerendering||r()>0?o="prerender":document.wasDiscarded?o="restore":i.type&&(o=i.type.replace(/_/g,"-")));return{name:e,value:n,rating:"good",delta:0,entries:[],id:`v5-${Date.now()}-${Math.floor(8999999999999*Math.random())+1e12}`,navigationType:o}},a=new WeakMap;function d(e,t){return a.get(e)||a.set(e,new t),a.get(e)}class f{t;i=0;o=[];h(e){if(e.hadRecentInput)return;const t=this.o[0],n=this.o.at(-1);this.i&&t&&n&&e.startTime-n.startTime<1e3&&e.startTime-t.startTime<5e3?(this.i+=e.value,this.o.push(e)):(this.i=e.value,this.o=[e]),this.t?.(e)}}const h=(e,t,n={})=>{try{if(PerformanceObserver.supportedEntryTypes.includes(e)){const i=new PerformanceObserver((e=>{Promise.resolve().then((()=>{t(e.getEntries())}))}));return i.observe({type:e,buffered:!0,...n}),i}}catch{}},u=e=>{let t=!1;return()=>{t||(e(),t=!0)}};let l=-1;const p=new Set,m=()=>"hidden"!==document.visibilityState||document.prerendering?1/0:0,g=e=>{if("hidden"===document.visibilityState){if("visibilitychange"===e.type)for(const e of p)e();isFinite(l)||(l="visibilitychange"===e.type?e.timeStamp:0,removeEventListener("prerenderingchange",g,!0))}},v=()=>{if(l<0){const e=r(),t=document.prerendering?void 0:globalThis.performance.getEntriesByType("visibility-state").filter((t=>"hidden"===t.name&&t.startTime>e))[0]?.startTime;l=t??m(),addEventListener("visibilitychange",g,!0),addEventListener("prerenderingchange",g,!0),n((()=>{setTimeout((()=>{l=m()}))}))}return{get firstHiddenTime(){return l},onHidden(e){p.add(e)}}},y=e=>{document.prerendering?addEventListener("prerenderingchange",(()=>e()),!0):e()},b=[1800,3e3],T=(e,t={})=>{y((()=>{const s=v();let a,d=c("FCP");const f=h("paint",(e=>{for(const t of e)"first-contentful-paint"===t.name&&(f.disconnect(),t.startTime<s.firstHiddenTime&&(d.value=Math.max(t.startTime-r(),0),d.entries.push(t),a(!0)))}));f&&(a=i(e,d,b,t.reportAllChanges),n((n=>{d=c("FCP"),a=i(e,d,b,t.reportAllChanges),o((()=>{d.value=performance.now()-n.timeStamp,a(!0)}))})))}))},E=[.1,.25];let L=0,P=1/0,_=0;const M=e=>{for(const t of e)t.interactionId&&(P=Math.min(P,t.interactionId),_=Math.max(_,t.interactionId),L=_?(_-P)/7+1:0)};let w;const C=()=>w?L:performance.interactionCount??0,I=()=>{"interactionCount"in performance||w||(w=h("event",M,{type:"event",buffered:!0,durationThreshold:0}))};let F=0;class k{u=[];l=new Map;p;m;v(){F=C(),this.u.length=0,this.l.clear()}T(){const e=Math.min(this.u.length-1,Math.floor((C()-F)/50));return this.u[e]}h(e){if(this.p?.(e),!e.interactionId&&"first-input"!==e.entryType)return;const t=this.u.at(-1);let n=this.l.get(e.interactionId);if(n||this.u.length<10||e.duration>t.L){if(n?e.duration>n.L?(n.entries=[e],n.L=e.duration):e.duration===n.L&&e.startTime===n.entries[0].startTime&&n.entries.push(e):(n={id:e.interactionId,entries:[e],L:e.duration},this.l.set(n.id,n),this.u.push(n)),this.u.sort(((e,t)=>t.L-e.L)),this.u.length>10){const e=this.u.splice(10);for(const t of e)this.l.delete(t.id)}this.m?.(n)}}}const x=e=>{const t=globalThis.requestIdleCallback||setTimeout;"hidden"===document.visibilityState?e():(e=u(e),addEventListener("visibilitychange",e,{once:!0,capture:!0}),t((()=>{e(),removeEventListener("visibilitychange",e,{capture:!0})})))},A=[200,500];class B{p;h(e){this.p?.(e)}}const S=[2500,4e3],N=[800,1800],q=e=>{document.prerendering?y((()=>q(e))):"complete"!==document.readyState?addEventListener("load",(()=>q(e)),!0):setTimeout(e)};e.CLSThresholds=E,e.FCPThresholds=b,e.INPThresholds=A,e.LCPThresholds=S,e.TTFBThresholds=N,e.onCLS=(e,t={})=>{const s=v();T(u((()=>{let r,a=c("CLS",0);const u=d(t,f),l=e=>{for(const t of e)u.h(t);u.i>a.value&&(a.value=u.i,a.entries=u.o,r())},p=h("layout-shift",l);p&&(r=i(e,a,E,t.reportAllChanges),s.onHidden((()=>{l(p.takeRecords()),r(!0)})),n((()=>{u.i=0,a=c("CLS",0),r=i(e,a,E,t.reportAllChanges),o((()=>r()))})),setTimeout(r))})))},e.onFCP=T,e.onINP=(e,t={})=>{if(!globalThis.PerformanceEventTiming||!("interactionId"in PerformanceEventTiming.prototype))return;const o=v();y((()=>{I();let s,r=c("INP");const a=d(t,k),f=e=>{x((()=>{for(const t of e)a.h(t);const t=a.T();t&&t.L!==r.value&&(r.value=t.L,r.entries=t.entries,s())}))},u=h("event",f,{durationThreshold:t.durationThreshold??40});s=i(e,r,A,t.reportAllChanges),u&&(u.observe({type:"first-input",buffered:!0}),o.onHidden((()=>{f(u.takeRecords()),s(!0)})),n((()=>{a.v(),r=c("INP"),s=i(e,r,A,t.reportAllChanges)})))}))},e.onLCP=(e,t={})=>{y((()=>{const s=v();let a,f=c("LCP");const l=d(t,B),p=e=>{t.reportAllChanges||(e=e.slice(-1));for(const t of e)l.h(t),t.startTime<s.firstHiddenTime&&(f.value=Math.max(t.startTime-r(),0),f.entries=[t],a())},m=h("largest-contentful-paint",p);if(m){a=i(e,f,S,t.reportAllChanges);const s=u((()=>{p(m.takeRecords()),m.disconnect(),a(!0)})),r=e=>{e.isTrusted&&(x(s),removeEventListener(e.type,r,{capture:!0}))};for(const e of["keydown","click","visibilitychange"])addEventListener(e,r,{capture:!0});n((n=>{f=c("LCP"),a=i(e,f,S,t.reportAllChanges),o((()=>{f.value=performance.now()-n.timeStamp,a(!0)}))}))}}))},e.onTTFB=(e,t={})=>{let o=c("TTFB"),a=i(e,o,N,t.reportAllChanges);q((()=>{const d=s();d&&(o.value=Math.max(d.responseStart-r(),0),o.entries=[d],a(!0),n((()=>{o=c("TTFB",0),a=i(e,o,N,t.reportAllChanges),a(!0)})))}))}}));


/***/ }),

/***/ "./src/cookies/CookiePlugin.ts":
/*!*************************************!*\
  !*** ./src/cookies/CookiePlugin.ts ***!
  \*************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CookiePlugin = void 0;
var debug_1 = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
var cookieUtils_1 = __webpack_require__(/*! ./cookieUtils */ "./src/cookies/cookieUtils.ts");
var CookiePlugin = /** @class */ (function () {
    function CookiePlugin(options) {
        if (options === void 0) { options = {}; }
        this.context = options.context;
        this.debug = options.debug || false;
        this.cookieDomain = options.cookieDomain || '.absmartly.com';
        this.cookiePath = options.cookiePath || '/';
        this.sameSite = options.sameSite || 'Lax';
        this.secure = options.secure || false;
        this.cookieExpiryDays = options.cookieExpiryDays || 730;
        this.unitIdCookieName = options.unitIdCookieName || 'abs';
        this.publicIdCookieName = options.publicIdCookieName || 'abs_public';
        this.expiryCookieName = options.expiryCookieName || 'abs_expiry';
        this.utmCookieName = options.utmCookieName || 'abs_utm_params';
        this.utmParams = options.utmParamsList || [
            'utm_source',
            'utm_medium',
            'utm_campaign',
            'utm_term',
            'utm_content',
        ];
        this.autoUpdateExpiry = options.autoUpdateExpiry !== false;
        this.expiryCheckInterval = options.expiryCheckInterval || 30;
    }
    CookiePlugin.prototype.debugLog = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (this.debug) {
            debug_1.logDebug.apply(void 0, __spreadArray(['[CookiePlugin]'], __read(args), false));
        }
    };
    CookiePlugin.prototype.setCookie = function (name, value, days) {
        var expiryDays = days !== undefined ? days : this.cookieExpiryDays;
        var success = (0, cookieUtils_1.setCookie)(name, value, expiryDays, {
            domain: this.cookieDomain,
            path: this.cookiePath,
            sameSite: this.sameSite,
            secure: this.secure,
        });
        if (success) {
            this.debugLog("Set cookie ".concat(name, ":"), value);
        }
        return success;
    };
    CookiePlugin.prototype.deleteCookie = function (name) {
        (0, cookieUtils_1.deleteCookie)(name, {
            domain: this.cookieDomain,
            path: this.cookiePath,
        });
    };
    CookiePlugin.prototype.getUnitId = function () {
        if (this.unitId) {
            return this.unitId;
        }
        var cookiesEnabled = navigator.cookieEnabled;
        var localStorageAvailable = (0, cookieUtils_1.isLocalStorageAvailable)();
        var unitId = null;
        if (cookiesEnabled) {
            unitId = (0, cookieUtils_1.getCookie)(this.unitIdCookieName) || (0, cookieUtils_1.getCookie)(this.publicIdCookieName);
        }
        if (!unitId && localStorageAvailable) {
            unitId = localStorage.getItem('abs_id');
        }
        if (unitId) {
            this.unitId = unitId;
        }
        return unitId;
    };
    CookiePlugin.prototype.setUnitId = function (unitId) {
        this.unitId = unitId;
        var cookiesEnabled = navigator.cookieEnabled;
        var localStorageAvailable = (0, cookieUtils_1.isLocalStorageAvailable)();
        if (cookiesEnabled) {
            this.setCookie(this.unitIdCookieName, unitId);
            this.setCookie(this.publicIdCookieName, unitId);
            if (this.autoUpdateExpiry) {
                this.updateExpiryTimestamp();
            }
        }
        if (localStorageAvailable) {
            localStorage.setItem('abs_id', unitId);
        }
        this.debugLog('Unit ID set:', unitId);
    };
    CookiePlugin.prototype.generateAndSetUnitId = function () {
        var unitId = (0, cookieUtils_1.generateUniqueId)();
        this.setUnitId(unitId);
        return unitId;
    };
    CookiePlugin.prototype.updateExpiryTimestamp = function () {
        if (navigator.cookieEnabled) {
            var now = Date.now();
            this.setCookie(this.expiryCookieName, now.toString());
            this.debugLog('Updated expiry timestamp:', now);
        }
    };
    CookiePlugin.prototype.isExpiryFresh = function () {
        if (!navigator.cookieEnabled) {
            return false;
        }
        var expiryCookie = (0, cookieUtils_1.getCookie)(this.expiryCookieName);
        if (!expiryCookie) {
            return false;
        }
        try {
            var expiryTimestamp = parseInt(expiryCookie, 10);
            var now = Date.now();
            var daysSinceSet = (now - expiryTimestamp) / (1000 * 60 * 60 * 24);
            var isFresh = daysSinceSet <= this.expiryCheckInterval;
            this.debugLog('Expiry check:', { daysSinceSet: daysSinceSet, isFresh: isFresh });
            return isFresh;
        }
        catch (e) {
            this.debugLog('Error parsing expiry cookie:', e);
            return false;
        }
    };
    CookiePlugin.prototype.getUtmParams = function () {
        var params = {};
        var searchParams = new URLSearchParams(window.location.search);
        this.utmParams.forEach(function (param) {
            var value = searchParams.get(param);
            if (value) {
                params[param] = value;
            }
        });
        if (Object.keys(params).length === 0 && document.referrer) {
            try {
                var referrerUrl_1 = new URL(document.referrer);
                this.utmParams.forEach(function (param) {
                    var value = referrerUrl_1.searchParams.get(param);
                    if (value) {
                        params[param] = value;
                    }
                });
            }
            catch (e) {
                this.debugLog('Error parsing referrer URL:', e);
            }
        }
        if (Object.keys(params).length === 0) {
            var storedParams = this.getStoredUtmParams();
            if (storedParams) {
                return storedParams;
            }
        }
        return params;
    };
    CookiePlugin.prototype.storeUtmParams = function (params) {
        if (Object.keys(params).length === 0)
            return;
        var storage = {
            params: params,
            timestamp: Date.now(),
        };
        var cookiesEnabled = navigator.cookieEnabled;
        var localStorageAvailable = (0, cookieUtils_1.isLocalStorageAvailable)();
        if (localStorageAvailable) {
            try {
                localStorage.setItem(this.utmCookieName, JSON.stringify(storage));
                this.debugLog('Stored UTM params in localStorage:', params);
            }
            catch (e) {
                this.debugLog('Failed to store UTM params in localStorage:', e);
            }
        }
        if (cookiesEnabled) {
            this.setCookie(this.utmCookieName, JSON.stringify(storage), 30);
            this.debugLog('Stored UTM params in cookie:', params);
        }
    };
    CookiePlugin.prototype.getStoredUtmParams = function () {
        var stored = null;
        var localStorageAvailable = (0, cookieUtils_1.isLocalStorageAvailable)();
        var cookiesEnabled = navigator.cookieEnabled;
        if (localStorageAvailable) {
            try {
                stored = localStorage.getItem(this.utmCookieName);
            }
            catch (e) {
                this.debugLog('Failed to get UTM params from localStorage:', e);
            }
        }
        if (!stored && cookiesEnabled) {
            stored = (0, cookieUtils_1.getCookie)(this.utmCookieName);
        }
        if (stored) {
            try {
                var parsed = JSON.parse(stored);
                if (Date.now() - parsed.timestamp < 30 * 24 * 60 * 60 * 1000) {
                    return parsed.params;
                }
            }
            catch (e) {
                this.debugLog('Failed to parse stored UTM params:', e);
            }
        }
        return null;
    };
    CookiePlugin.prototype.applyUtmAttributesToContext = function (context) {
        var _this = this;
        var ctx = context || this.context;
        if (!ctx) {
            (0, debug_1.logDebug)('[CookiePlugin] No context available to apply UTM attributes');
            return;
        }
        var utmParams = this.getUtmParams();
        if (Object.keys(utmParams).length > 0) {
            this.storeUtmParams(utmParams);
        }
        Object.entries(utmParams).forEach(function (_a) {
            var _b = __read(_a, 2), param = _b[0], value = _b[1];
            var attributeName = param.slice(4);
            ctx.attribute(attributeName, value);
            _this.debugLog("Set attribute ".concat(attributeName, ":"), value);
        });
    };
    CookiePlugin.prototype.clearAllCookies = function () {
        this.deleteCookie(this.unitIdCookieName);
        this.deleteCookie(this.publicIdCookieName);
        this.deleteCookie(this.expiryCookieName);
        this.deleteCookie(this.utmCookieName);
        var localStorageAvailable = (0, cookieUtils_1.isLocalStorageAvailable)();
        if (localStorageAvailable) {
            localStorage.removeItem('abs_id');
            localStorage.removeItem(this.utmCookieName);
        }
        this.unitId = undefined;
        this.debugLog('All cookies and storage cleared');
    };
    CookiePlugin.prototype.ready = function () {
        return __awaiter(this, void 0, void 0, function () {
            var unitId;
            return __generator(this, function (_a) {
                this.debugLog('Initializing CookiePlugin');
                unitId = this.getUnitId();
                if (!unitId) {
                    unitId = this.generateAndSetUnitId();
                    this.debugLog('Generated new unit ID:', unitId);
                }
                else {
                    this.debugLog('Using existing unit ID:', unitId);
                    if (this.autoUpdateExpiry && !this.isExpiryFresh()) {
                        this.updateExpiryTimestamp();
                    }
                }
                if (this.context) {
                    this.applyUtmAttributesToContext();
                }
                this.debugLog('CookiePlugin initialized successfully');
                return [2 /*return*/];
            });
        });
    };
    // Alias for backwards compatibility
    CookiePlugin.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.ready()];
            });
        });
    };
    CookiePlugin.prototype.setContext = function (context) {
        this.context = context;
        this.debugLog('Context set for CookiePlugin');
    };
    CookiePlugin.prototype.needsServerSideCookie = function () {
        var unitId = this.getUnitId();
        var cookiesEnabled = navigator.cookieEnabled;
        var localStorageAvailable = (0, cookieUtils_1.isLocalStorageAvailable)();
        if (!unitId) {
            if (cookiesEnabled || localStorageAvailable) {
                var expiryCookie = (0, cookieUtils_1.getCookie)(this.expiryCookieName);
                this.debugLog(expiryCookie
                    ? 'No existing ID but expiry cookie exists - need worker call'
                    : 'No existing ID and no expiry cookie - need worker call');
                return true;
            }
        }
        else if (cookiesEnabled && !this.isExpiryFresh()) {
            this.debugLog('Existing ID present but expiry not fresh - need worker call');
            return true;
        }
        return false;
    };
    CookiePlugin.prototype.trackLanding = function (context) {
        var ctx = context || this.context;
        if (!ctx) {
            (0, debug_1.logDebug)('[CookiePlugin] No context available for tracking landing');
            return;
        }
        var searchParams = new URLSearchParams(window.location.search);
        var hasUtmParams = this.utmParams.some(function (param) { return searchParams.get(param); });
        var referrerUrl = document.referrer;
        var isExternalReferrer = referrerUrl && !referrerUrl.includes(this.cookieDomain.replace('.', ''));
        var acceptsStorage = navigator.cookieEnabled || (0, cookieUtils_1.isLocalStorageAvailable)();
        var hasCookies = !!((0, cookieUtils_1.getCookie)(this.unitIdCookieName) ||
            (0, cookieUtils_1.getCookie)(this.publicIdCookieName) ||
            (0, cookieUtils_1.getCookie)(this.expiryCookieName) ||
            ((0, cookieUtils_1.isLocalStorageAvailable)() && localStorage.getItem('abs_id')));
        var isFirstVisit = acceptsStorage && !hasCookies;
        if (hasUtmParams || isExternalReferrer || isFirstVisit) {
            var properties = {
                referrer_url: referrerUrl || '',
                landing_url: window.location.href,
                accepts_cookies: navigator.cookieEnabled,
                accepts_storage: (0, cookieUtils_1.isLocalStorageAvailable)(),
                has_utm: hasUtmParams,
            };
            this.debugLog('Tracking landing:', properties);
            ctx.track('landing', properties);
        }
    };
    return CookiePlugin;
}());
exports.CookiePlugin = CookiePlugin;


/***/ }),

/***/ "./src/cookies/cookieUtils.ts":
/*!************************************!*\
  !*** ./src/cookies/cookieUtils.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/**
 * Cookie utility functions extracted from CookiePlugin
 * These can be used independently for lightweight cookie operations
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getCookie = getCookie;
exports.setCookie = setCookie;
exports.deleteCookie = deleteCookie;
exports.generateUniqueId = generateUniqueId;
exports.generateUUID = generateUUID;
exports.isLocalStorageAvailable = isLocalStorageAvailable;
/**
 * Get a cookie value by name
 */
function getCookie(name) {
    var _a;
    var value = "; ".concat(document.cookie);
    var parts = value.split("; ".concat(name, "="));
    if (parts.length === 2) {
        var cookieValue = (_a = parts.pop()) === null || _a === void 0 ? void 0 : _a.split(';').shift();
        return cookieValue || null;
    }
    return null;
}
/**
 * Set a cookie with expiry and options
 */
function setCookie(name, value, days, options) {
    if (options === void 0) { options = {}; }
    try {
        var date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        var expires = "expires=".concat(date.toUTCString());
        var path = options.path || '/';
        var cookieString = "".concat(name, "=").concat(value, ";").concat(expires, ";path=").concat(path);
        if (options.domain && options.domain !== 'localhost') {
            cookieString += ";domain=".concat(options.domain);
        }
        var sameSite = options.sameSite || 'Lax';
        cookieString += ";SameSite=".concat(sameSite);
        if (options.secure) {
            cookieString += ';Secure';
        }
        document.cookie = cookieString;
        return true;
    }
    catch (e) {
        console.error("Unable to set cookie ".concat(name, ":"), e);
        return false;
    }
}
/**
 * Delete a cookie by name
 */
function deleteCookie(name, options) {
    if (options === void 0) { options = {}; }
    setCookie(name, '', -1, options);
}
/**
 * Generate a fast unique ID (timestamp + random)
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
/**
 * Generate a UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable() {
    try {
        var test_1 = '__localStorage_test__';
        localStorage.setItem(test_1, test_1);
        localStorage.removeItem(test_1);
        return true;
    }
    catch (e) {
        return false;
    }
}


/***/ }),

/***/ "./src/core/DOMChangesPluginLite.ts":
/*!******************************************!*\
  !*** ./src/core/DOMChangesPluginLite.ts ***!
  \******************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DOMChangesPluginLite = void 0;
var DOMManipulatorLite_1 = __webpack_require__(/*! ./DOMManipulatorLite */ "./src/core/DOMManipulatorLite.ts");
var VariantExtractor_1 = __webpack_require__(/*! ../parsers/VariantExtractor */ "./src/parsers/VariantExtractor.ts");
var StyleSheetManager_1 = __webpack_require__(/*! ./StyleSheetManager */ "./src/core/StyleSheetManager.ts");
var ExposureTracker_1 = __webpack_require__(/*! ./ExposureTracker */ "./src/core/ExposureTracker.ts");
var HTMLInjector_1 = __webpack_require__(/*! ./HTMLInjector */ "./src/core/HTMLInjector.ts");
var debug_1 = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
var URLMatcher_1 = __webpack_require__(/*! ../utils/URLMatcher */ "./src/utils/URLMatcher.ts");
var persistence_1 = __webpack_require__(/*! ../utils/persistence */ "./src/utils/persistence.ts");
var plugin_registry_1 = __webpack_require__(/*! ../utils/plugin-registry */ "./src/utils/plugin-registry.ts");
var DOMChangesPluginLite = /** @class */ (function () {
    function DOMChangesPluginLite(config) {
        var _this = this;
        var _a, _b, _c, _d, _e, _f, _g, _h;
        this.mutationObserver = null;
        this.exposedExperiments = new Set();
        this.eventListeners = new Map();
        this.styleManagers = new Map();
        this.initialized = false;
        this.persistenceManager = null;
        this.antiFlickerTimeout = null;
        this.antiFlickerStyleId = 'absmartly-antiflicker';
        this.config = {
            context: config.context,
            autoApply: (_a = config.autoApply) !== null && _a !== void 0 ? _a : true,
            spa: (_b = config.spa) !== null && _b !== void 0 ? _b : true,
            visibilityTracking: (_c = config.visibilityTracking) !== null && _c !== void 0 ? _c : true,
            variableName: (_d = config.variableName) !== null && _d !== void 0 ? _d : '__dom_changes',
            debug: (_e = config.debug) !== null && _e !== void 0 ? _e : false,
            hideUntilReady: (_f = config.hideUntilReady) !== null && _f !== void 0 ? _f : false,
            hideTimeout: (_g = config.hideTimeout) !== null && _g !== void 0 ? _g : 3000,
            hideTransition: (_h = config.hideTransition) !== null && _h !== void 0 ? _h : false,
        };
        if (!this.config.context) {
            throw new Error('[ABsmartly] Context is required');
        }
        console.log("[ABsmartly] DOMChangesPluginLite v".concat(DOMChangesPluginLite.VERSION, " initialized"));
        if (this.config.hideUntilReady) {
            this.hideContent();
        }
        this.domManipulator = new DOMManipulatorLite_1.DOMManipulatorLite(this.config.debug, this);
        this.variantExtractor = new VariantExtractor_1.VariantExtractor(this.config.context, this.config.variableName, this.config.debug);
        this.exposureTracker = new ExposureTracker_1.ExposureTracker(this.config.context, this.config.debug);
        this.htmlInjector = new HTMLInjector_1.HTMLInjector(this.config.debug);
        this.persistenceManager = new persistence_1.DOMPersistenceManager({
            debug: this.config.debug,
            onReapply: function (change, experimentName) {
                (0, debug_1.logDebug)('[DOMChangesPluginLite] Re-applying change due to mutation', {
                    experimentName: experimentName,
                    selector: change.selector,
                    type: change.type,
                });
                _this.domManipulator.applyChange(change, experimentName);
            },
        });
        // Auto-initialize when context is ready
        this.readyPromise = this.config.context
            .ready()
            .then(function () {
            (0, debug_1.logDebug)('[DOMChangesPluginLite] Context is ready, starting initialization');
            return _this.initialize();
        })
            .catch(function (error) {
            (0, debug_1.logDebug)('[DOMChangesPluginLite] ERROR during initialization:', error);
            throw error;
        });
    }
    DOMChangesPluginLite.prototype.ready = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.readyPromise];
            });
        });
    };
    DOMChangesPluginLite.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, duration, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.initialized) {
                            (0, debug_1.logDebug)('Plugin already initialized');
                            return [2 /*return*/];
                        }
                        startTime = performance.now();
                        (0, debug_1.logDebug)('Initializing ABsmartly DOM Changes Plugin Lite', {
                            version: DOMChangesPluginLite.VERSION,
                            config: {
                                autoApply: this.config.autoApply,
                                spa: this.config.spa,
                                visibilityTracking: this.config.visibilityTracking,
                                DEBUG: debug_1.DEBUG,
                            },
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        if (this.config.spa) {
                            // SPA mode: observe body for React/Vue hydration recovery
                            // and listen for URL changes to re-apply changes on navigation
                            this.setupMutationObserver();
                            this.setupURLChangeListener();
                        }
                        else {
                            (0, debug_1.logDebug)('[DOMChangesPluginLite] SPA mode disabled - skipping body observer');
                        }
                        if (!this.config.autoApply) return [3 /*break*/, 3];
                        // Apply HTML injections and DOM changes in parallel to minimize flickering
                        return [4 /*yield*/, this.applyInjectionsAndChanges()];
                    case 2:
                        // Apply HTML injections and DOM changes in parallel to minimize flickering
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        this.initialized = true;
                        this.registerWithContext();
                        this.registerGlobally();
                        this.emit('initialized');
                        duration = performance.now() - startTime;
                        (0, debug_1.logPerformance)('Plugin initialization', duration);
                        (0, debug_1.logDebug)("[ABsmartly] DOM plugin lite loaded successfully (v".concat(DOMChangesPluginLite.VERSION, ")"));
                        if (this.config.debug) {
                            (0, debug_1.logDebug)('[ABsmartly] DOM Changes Plugin Lite initialized with debug mode');
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        (0, debug_1.logDebug)('[ABsmartly] Failed to initialize plugin:', error_1);
                        throw error_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    DOMChangesPluginLite.prototype.setupMutationObserver = function () {
        var _this = this;
        var observer = new MutationObserver(function (mutations) {
            // Re-apply ALL changes to elements that were replaced by React (hydration mismatch)
            mutations.forEach(function (mutation) {
                if (mutation.type === 'childList') {
                    // Check if any added nodes match our applied change selectors
                    mutation.addedNodes.forEach(function (node) {
                        var _a;
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            var element_1 = node;
                            // Check all experiments with applied changes (not just style changes)
                            var appliedChanges = ((_a = _this.persistenceManager) === null || _a === void 0 ? void 0 : _a.getAppliedChanges()) || new Map();
                            appliedChanges.forEach(function (changes, experimentName) {
                                changes.forEach(function (change) {
                                    try {
                                        // Check if this new element or any of its descendants match the selector
                                        var matchingElements = element_1.matches(change.selector)
                                            ? [element_1]
                                            : Array.from(element_1.querySelectorAll(change.selector));
                                        matchingElements.forEach(function (matchingEl) {
                                            if (_this.config.debug) {
                                                (0, debug_1.logDebug)('[SPA-REAPPLY] Re-applying change to newly added element (React hydration recovery)', {
                                                    experimentName: experimentName,
                                                    selector: change.selector,
                                                    element: matchingEl.tagName,
                                                    changeType: change.type,
                                                });
                                            }
                                            // Re-apply the change to the new element (ALL types: style, class, attribute, html, text, etc.)
                                            _this.domManipulator.applyChange(change, experimentName);
                                        });
                                    }
                                    catch (e) {
                                        // Invalid selector, skip
                                    }
                                });
                            });
                        }
                    });
                }
            });
        });
        // Wait for document.body to exist before observing
        // This prevents "parameter 1 is not of type 'Node'" errors when SDK loads in <head>
        var startObserving = function () {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
            _this.mutationObserver = observer;
            (0, debug_1.logDebug)('[DOMChangesPluginLite] MutationObserver started on document.body');
        };
        if (document.body) {
            startObserving();
        }
        else {
            // Use MutationObserver on documentElement to detect when body is added
            var bodyObserver = new MutationObserver(function (_mutations, obs) {
                if (document.body) {
                    obs.disconnect();
                    startObserving();
                }
            });
            bodyObserver.observe(document.documentElement, { childList: true });
            (0, debug_1.logDebug)('[DOMChangesPluginLite] Waiting for document.body...');
        }
    };
    /**
     * Set up URL change listener for SPA mode
     * Re-evaluates URL filters when URL changes and applies/removes changes accordingly
     */
    DOMChangesPluginLite.prototype.setupURLChangeListener = function () {
        var _this = this;
        var handleURLChange = function () { return __awaiter(_this, void 0, void 0, function () {
            var newURL;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        newURL = window.location.href;
                        (0, debug_1.logDebug)('[ABsmartly] URL changed, re-evaluating experiments:', newURL);
                        // Remove all current changes
                        return [4 /*yield*/, this.removeAllChanges()];
                    case 1:
                        // Remove all current changes
                        _a.sent();
                        // Re-apply changes and injections with new URL (in parallel)
                        return [4 /*yield*/, this.applyInjectionsAndChanges()];
                    case 2:
                        // Re-apply changes and injections with new URL (in parallel)
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); };
        // Listen to popstate (back/forward navigation)
        window.addEventListener('popstate', handleURLChange);
        // Intercept pushState and replaceState
        var originalPushState = history.pushState;
        var originalReplaceState = history.replaceState;
        history.pushState = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            originalPushState.apply(history, args);
            handleURLChange();
        };
        history.replaceState = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            originalReplaceState.apply(history, args);
            handleURLChange();
        };
        if (this.config.debug) {
            (0, debug_1.logDebug)('[ABsmartly] URL change listener set up for SPA mode');
        }
    };
    /**
     * Remove all currently applied changes
     * Used when URL changes in SPA mode
     */
    DOMChangesPluginLite.prototype.removeAllChanges = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Clear exposed experiments - ExposureTracker will re-register on next applyChanges
                this.exposedExperiments.clear();
                // Clear style managers - StyleSheetManager doesn't have a remove method
                // The stylesheets will be reused or cleared on next applyChanges
                this.styleManagers.clear();
                // Clear applied changes
                if (this.persistenceManager) {
                    this.persistenceManager.clearAll();
                }
                // Clear HTML injections
                this.htmlInjector.destroy();
                // Clear variant extractor cache to force re-extraction
                this.variantExtractor.clearCache();
                if (this.config.debug) {
                    (0, debug_1.logDebug)('[ABsmartly] All change tracking cleared for URL change');
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Apply HTML injections and DOM changes in parallel to minimize flickering
     */
    DOMChangesPluginLite.prototype.applyInjectionsAndChanges = function () {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, currentURL, error_2, allInjectHTML, duration;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = performance.now();
                        currentURL = window.location.href;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.config.context.ready()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        (0, debug_1.logDebug)('[ABsmartly] Failed to wait for context ready:', error_2);
                        return [2 /*return*/];
                    case 4:
                        allInjectHTML = this.variantExtractor.extractAllInjectHTML();
                        // Apply injections and DOM changes in parallel for minimal flickering
                        return [4 /*yield*/, Promise.all([this.applyHTMLInjections(allInjectHTML, currentURL), this.applyChanges()])];
                    case 5:
                        // Apply injections and DOM changes in parallel for minimal flickering
                        _a.sent();
                        duration = performance.now() - startTime;
                        (0, debug_1.logPerformance)('Apply injections and changes (parallel)', duration);
                        if (this.config.debug) {
                            (0, debug_1.logDebug)('[ABsmartly] HTML injections and DOM changes applied in parallel', {
                                duration: "".concat(duration.toFixed(2), "ms"),
                                currentURL: currentURL,
                            });
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Apply HTML injections from all variants
     */
    DOMChangesPluginLite.prototype.applyHTMLInjections = function (allInjectHTML_1) {
        return __awaiter(this, arguments, void 0, function (allInjectHTML, currentUrl) {
            var injectionsByLocation;
            if (currentUrl === void 0) { currentUrl = window.location.href; }
            return __generator(this, function (_a) {
                if (allInjectHTML.size === 0) {
                    if (this.config.debug) {
                        (0, debug_1.logDebug)('[ABsmartly] No HTML injections found');
                    }
                    return [2 /*return*/];
                }
                injectionsByLocation = this.htmlInjector.collectInjections(allInjectHTML, currentUrl);
                this.htmlInjector.inject(injectionsByLocation);
                if (this.config.debug) {
                    (0, debug_1.logDebug)('[ABsmartly] HTML injections complete', {
                        experimentsWithInjections: allInjectHTML.size,
                        totalLocations: injectionsByLocation.size,
                        currentUrl: currentUrl,
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    DOMChangesPluginLite.prototype.applyChanges = function (experimentName) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, currentURL, error_3, allExperiments, totalApplied, experimentStats, allExperiments_1, allExperiments_1_1, _a, expName, experimentData, currentVariant, variantData, urlFilter, globalDefaults, anyVariantMatchesURL, shouldApplyVisualChanges, changes, allVariantChanges, hasAnyChangesInAnyVariant, stats, changes_1, changes_1_1, change, success, elements, hasAnyViewportTriggerInAnyVariant, hasAnyImmediateTriggerInAnyVariant, allVariantsData, allVariantsData_1, allVariantsData_1_1, _b, variantIndex, variantData_1, variantChanges, variantMatchesURL, config, urlFilterConfig, variantChanges_1, variantChanges_1_1, change, duration;
            var e_1, _c, e_2, _d, e_3, _e, e_4, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        startTime = performance.now();
                        currentURL = window.location.href;
                        (0, debug_1.logDebug)('Starting to apply changes', {
                            specificExperiment: experimentName || 'all',
                            url: currentURL,
                            action: 'apply_start',
                        });
                        if (this.config.debug) {
                            (0, debug_1.logDebug)('[ABsmartly] === DOM Changes Application Starting ===');
                            (0, debug_1.logDebug)('[ABsmartly] Target:', experimentName || 'all experiments');
                            (0, debug_1.logDebug)('[ABsmartly] Current URL:', currentURL);
                            (0, debug_1.logDebug)('[ABsmartly] Context ready:', true);
                        }
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.config.context.ready()];
                    case 2:
                        _g.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _g.sent();
                        (0, debug_1.logDebug)('[ABsmartly] Failed to wait for context ready:', error_3);
                        return [2 /*return*/];
                    case 4:
                        this.variantExtractor.clearCache();
                        allExperiments = this.getAllExperimentsData();
                        totalApplied = 0;
                        experimentStats = new Map();
                        (0, debug_1.logDebug)('[ABsmartly] Experiments to process:', Array.from(allExperiments.keys()));
                        (0, debug_1.logDebug)('[ABsmartly] Total experiments with changes:', allExperiments.size);
                        try {
                            for (allExperiments_1 = __values(allExperiments), allExperiments_1_1 = allExperiments_1.next(); !allExperiments_1_1.done; allExperiments_1_1 = allExperiments_1.next()) {
                                _a = __read(allExperiments_1_1.value, 2), expName = _a[0], experimentData = _a[1];
                                // Skip if filtering by specific experiment
                                if (experimentName && expName !== experimentName) {
                                    continue;
                                }
                                currentVariant = this.config.context.peek(expName);
                                variantData = experimentData.variantData, urlFilter = experimentData.urlFilter, globalDefaults = experimentData.globalDefaults;
                                anyVariantMatchesURL = this.variantExtractor.anyVariantMatchesURL(expName, currentURL);
                                if (!anyVariantMatchesURL) {
                                    (0, debug_1.logDebug)("[ABsmartly] Skipping experiment '".concat(expName, "' - no variant matches URL: ").concat(currentURL));
                                    continue;
                                }
                                shouldApplyVisualChanges = this.shouldApplyVisualChanges(variantData, urlFilter, currentURL);
                                changes = this.extractChangesFromData(variantData, globalDefaults);
                                allVariantChanges = this.extractAllVariantChanges(expName);
                                hasAnyChangesInAnyVariant = allVariantChanges.some(function (variantChanges) { return variantChanges && variantChanges.length > 0; });
                                if (!hasAnyChangesInAnyVariant) {
                                    // If NO variant has ANY changes, skip the entire experiment
                                    if (this.config.debug) {
                                        (0, debug_1.logDebug)("[ABsmartly] Skipping experiment '".concat(expName, "' - no variants have changes"));
                                    }
                                    continue;
                                }
                                stats = { total: (changes === null || changes === void 0 ? void 0 : changes.length) || 0, success: 0, pending: 0 };
                                if (this.config.debug) {
                                    (0, debug_1.logDebug)("[ABsmartly] Processing experiment '".concat(expName, "' (variant ").concat(currentVariant, "):"), {
                                        urlMatches: shouldApplyVisualChanges,
                                        changeCount: (changes === null || changes === void 0 ? void 0 : changes.length) || 0,
                                        userVariantHasChanges: ((changes === null || changes === void 0 ? void 0 : changes.length) || 0) > 0,
                                        changes: (changes === null || changes === void 0 ? void 0 : changes.map(function (c) { return ({
                                            type: c.type,
                                            selector: c.selector,
                                            trigger: c.trigger_on_view ? 'viewport' : 'immediate',
                                        }); })) || [],
                                    });
                                }
                                // Apply visual changes only if URL matches for user's variant AND user has changes
                                if (shouldApplyVisualChanges && changes && changes.length > 0) {
                                    try {
                                        for (changes_1 = (e_2 = void 0, __values(changes)), changes_1_1 = changes_1.next(); !changes_1_1.done; changes_1_1 = changes_1.next()) {
                                            change = changes_1_1.value;
                                            success = this.domManipulator.applyChange(change, expName);
                                            if (success) {
                                                totalApplied++;
                                                stats.success++;
                                            }
                                            else if (change.type !== 'create' && change.type !== 'styleRules') {
                                                // Track pending changes for stats
                                                try {
                                                    elements = document.querySelectorAll(change.selector);
                                                    if (elements.length === 0 && (this.config.spa || change.waitForElement)) {
                                                        stats.pending++;
                                                    }
                                                }
                                                catch (error) {
                                                    if (this.config.debug) {
                                                        (0, debug_1.logDebug)("[ABsmartly] Invalid selector: ".concat(change.selector), error);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                                    finally {
                                        try {
                                            if (changes_1_1 && !changes_1_1.done && (_d = changes_1.return)) _d.call(changes_1);
                                        }
                                        finally { if (e_2) throw e_2.error; }
                                    }
                                }
                                else if (changes && changes.length > 0) {
                                    (0, debug_1.logDebug)("[ABsmartly] Experiment '".concat(expName, "' variant ").concat(currentVariant, " doesn't match URL filter or has no changes, but setting up tracking for SRM prevention"));
                                }
                                hasAnyViewportTriggerInAnyVariant = false;
                                hasAnyImmediateTriggerInAnyVariant = false;
                                allVariantsData = this.variantExtractor.getAllVariantsData(expName);
                                if (this.config.debug) {
                                    (0, debug_1.logDebug)("[ABsmartly] Checking trigger types for experiment '".concat(expName, "' on URL: ").concat(currentURL), {
                                        allVariantsDataSize: allVariantsData.size,
                                        allVariantChangesLength: allVariantChanges.length,
                                    });
                                    // Log the structure of each variant's data
                                    allVariantsData.forEach(function (data, idx) {
                                        (0, debug_1.logDebug)("[ABsmartly] Variant ".concat(idx, " data structure:"), {
                                            isArray: Array.isArray(data),
                                            isObject: typeof data === 'object',
                                            hasUrlFilter: data && typeof data === 'object' && !Array.isArray(data) && 'urlFilter' in data,
                                            keys: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : 'N/A',
                                        });
                                    });
                                }
                                try {
                                    // Loop through ALL variants (not just ones with changes)
                                    // We need to check URL filters from the raw data, which includes variants without changes
                                    for (allVariantsData_1 = (e_3 = void 0, __values(allVariantsData)), allVariantsData_1_1 = allVariantsData_1.next(); !allVariantsData_1_1.done; allVariantsData_1_1 = allVariantsData_1.next()) {
                                        _b = __read(allVariantsData_1_1.value, 2), variantIndex = _b[0], variantData_1 = _b[1];
                                        variantChanges = allVariantChanges[variantIndex];
                                        if (!variantChanges || variantChanges.length === 0) {
                                            continue;
                                        }
                                        variantMatchesURL = true;
                                        if (variantData_1 && typeof variantData_1 === 'object' && !Array.isArray(variantData_1)) {
                                            config = variantData_1;
                                            if ('urlFilter' in config && config.urlFilter) {
                                                urlFilterConfig = config;
                                                variantMatchesURL = URLMatcher_1.URLMatcher.matches(urlFilterConfig.urlFilter, currentURL);
                                                if (this.config.debug) {
                                                    (0, debug_1.logDebug)("[ABsmartly] Variant ".concat(variantIndex, " has URL filter, matches: ").concat(variantMatchesURL));
                                                }
                                            }
                                            // If no urlFilter property, variantMatchesURL stays true (legacy behavior)
                                        }
                                        // Only collect trigger types from variants whose URL filters match
                                        if (variantMatchesURL) {
                                            try {
                                                for (variantChanges_1 = (e_4 = void 0, __values(variantChanges)), variantChanges_1_1 = variantChanges_1.next(); !variantChanges_1_1.done; variantChanges_1_1 = variantChanges_1.next()) {
                                                    change = variantChanges_1_1.value;
                                                    if (change.trigger_on_view) {
                                                        hasAnyViewportTriggerInAnyVariant = true;
                                                    }
                                                    else {
                                                        hasAnyImmediateTriggerInAnyVariant = true;
                                                    }
                                                    // Early exit if we found both types
                                                    if (hasAnyViewportTriggerInAnyVariant && hasAnyImmediateTriggerInAnyVariant) {
                                                        break;
                                                    }
                                                }
                                            }
                                            catch (e_4_1) { e_4 = { error: e_4_1 }; }
                                            finally {
                                                try {
                                                    if (variantChanges_1_1 && !variantChanges_1_1.done && (_f = variantChanges_1.return)) _f.call(variantChanges_1);
                                                }
                                                finally { if (e_4) throw e_4.error; }
                                            }
                                            if (this.config.debug) {
                                                (0, debug_1.logDebug)("[ABsmartly] Variant ".concat(variantIndex, " matches URL - hasImmediate: ").concat(hasAnyImmediateTriggerInAnyVariant, ", hasViewport: ").concat(hasAnyViewportTriggerInAnyVariant));
                                            }
                                        }
                                        else {
                                            if (this.config.debug) {
                                                (0, debug_1.logDebug)("[ABsmartly] Variant ".concat(variantIndex, " does NOT match URL - skipping"));
                                            }
                                        }
                                        if (hasAnyViewportTriggerInAnyVariant && hasAnyImmediateTriggerInAnyVariant) {
                                            break;
                                        }
                                    }
                                }
                                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                                finally {
                                    try {
                                        if (allVariantsData_1_1 && !allVariantsData_1_1.done && (_e = allVariantsData_1.return)) _e.call(allVariantsData_1);
                                    }
                                    finally { if (e_3) throw e_3.error; }
                                }
                                if (this.config.debug) {
                                    (0, debug_1.logDebug)("[ABsmartly] Final trigger decision for '".concat(expName, "': hasImmediate=").concat(hasAnyImmediateTriggerInAnyVariant, ", hasViewport=").concat(hasAnyViewportTriggerInAnyVariant));
                                }
                                // CRITICAL: Always register experiment for tracking if ANY variant has ANY trigger type
                                // This prevents SRM even when user's variant doesn't match URL filter
                                // Pass the URL-filtered trigger flags to ExposureTracker
                                if (hasAnyViewportTriggerInAnyVariant || hasAnyImmediateTriggerInAnyVariant) {
                                    this.exposureTracker.registerExperiment(expName, currentVariant || 0, changes || [], allVariantChanges, hasAnyImmediateTriggerInAnyVariant, hasAnyViewportTriggerInAnyVariant);
                                }
                                // Note: We do NOT call treatment() here anymore to avoid duplicate calls.
                                // The ExposureTracker.registerExperiment() will call triggerExposure() internally
                                // when hasImmediateTrigger is true (see ExposureTracker line 169-174).
                                // This prevents double treatment() calls that were causing test failures.
                                experimentStats.set(expName, stats);
                                (0, debug_1.logExperimentSummary)(expName, stats.total, stats.success, stats.pending);
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (allExperiments_1_1 && !allExperiments_1_1.done && (_c = allExperiments_1.return)) _c.call(allExperiments_1);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                        duration = performance.now() - startTime;
                        (0, debug_1.logPerformance)('Apply changes', duration, {
                            totalApplied: totalApplied,
                            experiments: experimentStats.size,
                        });
                        if (this.config.debug) {
                            (0, debug_1.logDebug)('[ABsmartly] === DOM Changes Application Complete ===');
                            (0, debug_1.logDebug)('[ABsmartly] Summary:', {
                                totalChangesApplied: totalApplied,
                                experimentsProcessed: experimentStats.size,
                                duration: "".concat(duration.toFixed(2), "ms"),
                                experiments: Array.from(experimentStats.entries()).map(function (_a) {
                                    var _b = __read(_a, 2), name = _b[0], stats = _b[1];
                                    return ({
                                        name: name,
                                        total: stats.total,
                                        success: stats.success,
                                        pending: stats.pending,
                                        pendingReason: stats.pending > 0 ? 'Elements not found yet (SPA mode will retry)' : undefined,
                                    });
                                }),
                            });
                        }
                        // Show hidden content after changes are applied
                        if (this.config.hideUntilReady) {
                            this.showContent();
                        }
                        this.emit('changes-applied', { count: totalApplied, experimentName: experimentName });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all experiments with their variant data and metadata
     */
    DOMChangesPluginLite.prototype.getAllExperimentsData = function () {
        var e_5, _a;
        var experiments = new Map();
        var allVariants = this.variantExtractor.extractAllChanges();
        try {
            for (var allVariants_1 = __values(allVariants), allVariants_1_1 = allVariants_1.next(); !allVariants_1_1.done; allVariants_1_1 = allVariants_1.next()) {
                var _b = __read(allVariants_1_1.value, 1), expName = _b[0];
                var currentVariant = this.config.context.peek(expName);
                if (currentVariant === undefined || currentVariant === null) {
                    continue;
                }
                var variantsData = this.variantExtractor.getAllVariantsData(expName);
                var variantData = variantsData.get(currentVariant);
                if (!variantData) {
                    continue;
                }
                // Extract URL filter and global defaults if using wrapped format
                var urlFilter = null;
                var globalDefaults = {};
                if (variantData &&
                    typeof variantData === 'object' &&
                    !Array.isArray(variantData) &&
                    'changes' in variantData) {
                    var config = variantData;
                    urlFilter = config.urlFilter;
                    globalDefaults = {
                        waitForElement: config.waitForElement,
                        persistStyle: config.persistStyle,
                        important: config.important,
                        observerRoot: config.observerRoot,
                    };
                }
                experiments.set(expName, { variantData: variantData, urlFilter: urlFilter, globalDefaults: globalDefaults });
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (allVariants_1_1 && !allVariants_1_1.done && (_a = allVariants_1.return)) _a.call(allVariants_1);
            }
            finally { if (e_5) throw e_5.error; }
        }
        return experiments;
    };
    /**
     * Extract changes from DOMChangesData and apply global defaults
     */
    DOMChangesPluginLite.prototype.extractChangesFromData = function (data, globalDefaults) {
        var changes = null;
        // Extract changes array
        if (Array.isArray(data)) {
            changes = data;
        }
        else if (data && typeof data === 'object' && 'changes' in data) {
            changes = data.changes;
        }
        if (!changes || changes.length === 0) {
            return null;
        }
        // Apply global defaults to each change
        return changes.map(function (change) {
            var _a, _b, _c, _d;
            return (__assign(__assign({}, change), { waitForElement: (_a = change.waitForElement) !== null && _a !== void 0 ? _a : globalDefaults.waitForElement, persistStyle: (_b = change.persistStyle) !== null && _b !== void 0 ? _b : globalDefaults.persistStyle, important: (_c = change.important) !== null && _c !== void 0 ? _c : globalDefaults.important, observerRoot: (_d = change.observerRoot) !== null && _d !== void 0 ? _d : globalDefaults.observerRoot }));
        });
    };
    /**
     * Extract all variant changes for cross-variant tracking
     */
    DOMChangesPluginLite.prototype.extractAllVariantChanges = function (experimentName) {
        var allVariantChanges = this.variantExtractor.getAllVariantChanges(experimentName);
        var variantsData = this.variantExtractor.getAllVariantsData(experimentName);
        // Apply global defaults to each variant's changes
        var processedVariants = [];
        var _loop_1 = function (i) {
            var variantChanges = allVariantChanges[i];
            var variantData = variantsData.get(i);
            if (!variantChanges || variantChanges.length === 0) {
                processedVariants.push([]);
                return "continue";
            }
            // Extract global defaults if using wrapped format
            var globalDefaults = {};
            if (variantData &&
                typeof variantData === 'object' &&
                !Array.isArray(variantData) &&
                'changes' in variantData) {
                var config = variantData;
                globalDefaults = {
                    waitForElement: config.waitForElement,
                    persistStyle: config.persistStyle,
                    important: config.important,
                    observerRoot: config.observerRoot,
                };
            }
            // Apply global defaults
            var processedChanges = variantChanges.map(function (change) {
                var _a, _b, _c, _d;
                return (__assign(__assign({}, change), { waitForElement: (_a = change.waitForElement) !== null && _a !== void 0 ? _a : globalDefaults.waitForElement, persistStyle: (_b = change.persistStyle) !== null && _b !== void 0 ? _b : globalDefaults.persistStyle, important: (_c = change.important) !== null && _c !== void 0 ? _c : globalDefaults.important, observerRoot: (_d = change.observerRoot) !== null && _d !== void 0 ? _d : globalDefaults.observerRoot }));
            });
            processedVariants.push(processedChanges);
        };
        for (var i = 0; i < allVariantChanges.length; i++) {
            _loop_1(i);
        }
        return processedVariants;
    };
    /**
     * Determine if visual changes should be applied based on URL filter
     */
    DOMChangesPluginLite.prototype.shouldApplyVisualChanges = function (variantData, urlFilter, url) {
        // Legacy array format has no URL filter - always apply
        if (Array.isArray(variantData)) {
            return true;
        }
        // Wrapped format without URL filter - always apply
        if (!urlFilter) {
            return true;
        }
        // Check URL filter
        return URLMatcher_1.URLMatcher.matches(urlFilter, url);
    };
    DOMChangesPluginLite.prototype.hasChanges = function (experimentName) {
        return this.domManipulator.hasChanges(experimentName);
    };
    DOMChangesPluginLite.prototype.applyChange = function (change, experimentName) {
        (0, debug_1.logDebug)('Applying single change via public API', {
            experimentName: experimentName,
            selector: change.selector,
            changeType: change.type,
        });
        try {
            var success = this.domManipulator.applyChange(change, experimentName);
            if (success) {
                this.emit('change_applied', {
                    experimentName: experimentName,
                    change: change,
                });
            }
            return success;
        }
        catch (error) {
            if (this.config.debug) {
                (0, debug_1.logDebug)('[ABsmartly] Error applying change:', error);
            }
            return false;
        }
    };
    DOMChangesPluginLite.prototype.on = function (event, callback) {
        var listeners = this.eventListeners.get(event) || [];
        listeners.push(callback);
        this.eventListeners.set(event, listeners);
    };
    DOMChangesPluginLite.prototype.off = function (event, callback) {
        if (!callback) {
            this.eventListeners.delete(event);
        }
        else {
            var listeners = this.eventListeners.get(event) || [];
            var index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    };
    DOMChangesPluginLite.prototype.emit = function (event, data) {
        var e_6, _a;
        var listeners = this.eventListeners.get(event) || [];
        try {
            for (var listeners_1 = __values(listeners), listeners_1_1 = listeners_1.next(); !listeners_1_1.done; listeners_1_1 = listeners_1.next()) {
                var callback = listeners_1_1.value;
                try {
                    callback(data);
                }
                catch (error) {
                    (0, debug_1.logDebug)("[ABsmartly] Error in event listener for ".concat(event, ":"), error);
                }
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (listeners_1_1 && !listeners_1_1.done && (_a = listeners_1.return)) _a.call(listeners_1);
            }
            finally { if (e_6) throw e_6.error; }
        }
    };
    DOMChangesPluginLite.prototype.getStyleManager = function (experimentName) {
        var id = "absmartly-styles-".concat(experimentName);
        var manager = this.styleManagers.get(experimentName);
        if (!manager) {
            manager = new StyleSheetManager_1.StyleSheetManager(id, this.config.debug);
            this.styleManagers.set(experimentName, manager);
        }
        return manager;
    };
    DOMChangesPluginLite.prototype.buildCssRule = function (selector, properties, important) {
        if (important === void 0) { important = true; }
        var declarations = Object.entries(properties)
            .map(function (_a) {
            var _b = __read(_a, 2), prop = _b[0], value = _b[1];
            var cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            var bang = important ? ' !important' : '';
            return "  ".concat(cssProp, ": ").concat(value).concat(bang, ";");
        })
            .join('\n');
        return "".concat(selector, " {\n").concat(declarations, "\n}");
    };
    DOMChangesPluginLite.prototype.buildStateRules = function (selector, states, important) {
        if (important === void 0) { important = true; }
        var rules = [];
        if (states.normal) {
            rules.push(this.buildCssRule(selector, states.normal, important));
        }
        if (states.hover) {
            rules.push(this.buildCssRule("".concat(selector, ":hover"), states.hover, important));
        }
        if (states.active) {
            rules.push(this.buildCssRule("".concat(selector, ":active"), states.active, important));
        }
        if (states.focus) {
            rules.push(this.buildCssRule("".concat(selector, ":focus"), states.focus, important));
        }
        return rules.join('\n\n');
    };
    DOMChangesPluginLite.prototype.refreshExperiments = function () {
        if (this.config.debug) {
            (0, debug_1.logDebug)('[ABsmartly] Refreshing experiments and clearing cache');
        }
        this.variantExtractor.clearCache();
        if (this.config.autoApply) {
            this.applyInjectionsAndChanges();
        }
    };
    DOMChangesPluginLite.prototype.destroy = function () {
        this.domManipulator.destroy();
        this.exposureTracker.destroy();
        this.htmlInjector.destroy();
        this.styleManagers.forEach(function (manager) { return manager.destroy(); });
        this.styleManagers.clear();
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        if (this.persistenceManager) {
            this.persistenceManager.destroy();
            this.persistenceManager = null;
        }
        // Clean up anti-flicker timeout and style
        if (this.antiFlickerTimeout !== null) {
            clearTimeout(this.antiFlickerTimeout);
            this.antiFlickerTimeout = null;
        }
        var antiFlickerStyle = document.getElementById(this.antiFlickerStyleId);
        if (antiFlickerStyle) {
            antiFlickerStyle.remove();
        }
        this.eventListeners.clear();
        this.exposedExperiments.clear();
        this.unregisterFromContext();
        this.unregisterGlobally();
        this.initialized = false;
        if (this.config.debug) {
            (0, debug_1.logDebug)('[ABsmartly] DOM Changes Plugin Lite destroyed');
        }
    };
    DOMChangesPluginLite.prototype.registerWithContext = function () {
        if (this.config.context) {
            if (!this.config.context.__plugins) {
                this.config.context.__plugins = {};
            }
            this.config.context.__plugins.domPlugin = {
                name: 'DOMChangesPluginLite',
                version: DOMChangesPluginLite.VERSION,
                initialized: true,
                capabilities: ['spa', 'visibility'],
                instance: this,
                timestamp: Date.now(),
            };
            this.config.context.__domPlugin = this.config.context.__plugins.domPlugin;
            if (this.config.debug) {
                (0, debug_1.logDebug)('[ABsmartly] DOMChangesPluginLite registered with context at __plugins.domPlugin');
            }
        }
    };
    DOMChangesPluginLite.prototype.unregisterFromContext = function () {
        var _a;
        if (this.config.context) {
            if ((_a = this.config.context.__plugins) === null || _a === void 0 ? void 0 : _a.domPlugin) {
                delete this.config.context.__plugins.domPlugin;
            }
            if (this.config.context.__domPlugin) {
                delete this.config.context.__domPlugin;
            }
            if (this.config.debug) {
                (0, debug_1.logDebug)('[ABsmartly] DOMChangesPluginLite unregistered from context');
            }
        }
    };
    /**
     * Register plugin in global registry for detection
     */
    DOMChangesPluginLite.prototype.registerGlobally = function () {
        (0, plugin_registry_1.registerPlugin)('dom', {
            name: 'DOMChangesPluginLite',
            version: DOMChangesPluginLite.VERSION,
            initialized: true,
            timestamp: Date.now(),
            capabilities: ['spa', 'visibility', 'auto-apply'],
            instance: this,
        });
        if (this.config.debug) {
            (0, debug_1.logDebug)('[ABsmartly] DOMChangesPluginLite registered in global window.__ABSMARTLY_PLUGINS__');
        }
    };
    /**
     * Unregister plugin from global registry
     */
    DOMChangesPluginLite.prototype.unregisterGlobally = function () {
        (0, plugin_registry_1.unregisterPlugin)('dom');
        if (this.config.debug) {
            (0, debug_1.logDebug)('[ABsmartly] DOMChangesPluginLite unregistered from global registry');
        }
    };
    /**
     * Hide content to prevent flicker before experiments are applied
     */
    DOMChangesPluginLite.prototype.hideContent = function () {
        var _this = this;
        var selector = this.config.hideUntilReady;
        if (!selector)
            return;
        // Check if style already exists (prevent duplicate injection)
        if (document.getElementById(this.antiFlickerStyleId)) {
            return;
        }
        var style = document.createElement('style');
        style.id = this.antiFlickerStyleId;
        var hasTransition = this.config.hideTransition !== false;
        if (hasTransition) {
            // Use both visibility:hidden and opacity:0 for smooth transition
            style.textContent = "\n        ".concat(selector, " {\n          visibility: hidden !important;\n          opacity: 0 !important;\n        }\n      ");
        }
        else {
            // Use only visibility:hidden for instant reveal (no layout shift)
            style.textContent = "\n        ".concat(selector, " {\n          visibility: hidden !important;\n        }\n      ");
        }
        document.head.appendChild(style);
        // Set timeout to show content even if experiments fail to load or timeout expires
        this.antiFlickerTimeout = window.setTimeout(function () {
            if (_this.config.debug) {
                (0, debug_1.logDebug)("[ABsmartly] Anti-flicker timeout reached (".concat(_this.config.hideTimeout, "ms), showing content"));
            }
            _this.showContent();
        }, this.config.hideTimeout);
        if (this.config.debug) {
            (0, debug_1.logDebug)("[ABsmartly] Anti-flicker enabled (selector: '".concat(selector, "', transition: ").concat(hasTransition ? this.config.hideTransition : 'none', ", timeout: ").concat(this.config.hideTimeout, "ms)"));
        }
    };
    /**
     * Show hidden content after experiments are applied or timeout expires
     */
    DOMChangesPluginLite.prototype.showContent = function () {
        var _this = this;
        // Clear timeout if still pending
        if (this.antiFlickerTimeout !== null) {
            clearTimeout(this.antiFlickerTimeout);
            this.antiFlickerTimeout = null;
        }
        var style = document.getElementById(this.antiFlickerStyleId);
        if (!style)
            return;
        var hasTransition = this.config.hideTransition !== false;
        if (hasTransition) {
            // Smooth fade-in: remove visibility, add transition, then animate opacity
            var selector = this.config.hideUntilReady;
            // Step 1: Remove visibility:hidden, keep opacity:0, add transition
            style.textContent = "\n        ".concat(selector, " {\n          opacity: 0 !important;\n          transition: opacity ").concat(this.config.hideTransition, " !important;\n        }\n      ");
            // Step 2: Force reflow to ensure transition applies
            style.offsetHeight;
            // Step 3: Trigger fade-in by setting opacity to 1
            style.textContent = "\n        ".concat(selector, " {\n          opacity: 1 !important;\n          transition: opacity ").concat(this.config.hideTransition, " !important;\n        }\n      ");
            // Step 4: Remove style after transition completes
            var transitionDuration = parseFloat(this.config.hideTransition) * 1000;
            setTimeout(function () {
                style.remove();
                if (_this.config.debug) {
                    (0, debug_1.logDebug)('[ABsmartly] Anti-flicker fade-in complete, style removed');
                }
            }, transitionDuration);
            if (this.config.debug) {
                (0, debug_1.logDebug)("[ABsmartly] Anti-flicker fading in with transition: ".concat(this.config.hideTransition));
            }
        }
        else {
            // Instant reveal: just remove the style
            style.remove();
            if (this.config.debug) {
                (0, debug_1.logDebug)('[ABsmartly] Anti-flicker removed, content now visible');
            }
        }
    };
    DOMChangesPluginLite.prototype.watchElement = function (element, experimentName, change) {
        if (this.persistenceManager) {
            this.persistenceManager.watchElement(element, experimentName, change);
        }
    };
    DOMChangesPluginLite.prototype.unwatchElement = function (element, experimentName) {
        if (this.persistenceManager) {
            this.persistenceManager.unwatchElement(element, experimentName);
        }
    };
    DOMChangesPluginLite.VERSION =  true ? "1.1.3" : 0;
    return DOMChangesPluginLite;
}());
exports.DOMChangesPluginLite = DOMChangesPluginLite;


/***/ }),

/***/ "./src/core/DOMManipulatorLite.ts":
/*!****************************************!*\
  !*** ./src/core/DOMManipulatorLite.ts ***!
  \****************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DOMManipulatorLite = void 0;
var debug_1 = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
var PendingChangeManager_1 = __webpack_require__(/*! ./PendingChangeManager */ "./src/core/PendingChangeManager.ts");
var DOMManipulatorLite = /** @class */ (function () {
    function DOMManipulatorLite(debug, plugin) {
        if (debug === void 0) { debug = false; }
        var _this = this;
        this.appliedChanges = new Map();
        this.debug = debug;
        this.plugin = plugin;
        this.pendingManager = new PendingChangeManager_1.PendingChangeManager(function (change, experimentName, element) {
            if (element) {
                return _this.applyChangeToSpecificElement(change, experimentName, element);
            }
            return _this.applyChange(change, experimentName);
        }, debug);
    }
    DOMManipulatorLite.prototype.applyChange = function (change, experimentName) {
        var _this = this;
        var _a, _b;
        if (!change.enabled && change.enabled !== undefined) {
            (0, debug_1.logDebug)("Skipping disabled change for experiment: ".concat(experimentName), {
                experimentName: experimentName,
                selector: change.selector,
                changeType: change.type,
            });
            return false;
        }
        var isReapplying = !!this.plugin.reapplyingElements &&
            Array.from(this.plugin.reapplyingElements).length > 0;
        if (this.debug) {
            (0, debug_1.logDebug)("[DOM-APPLY] ".concat(isReapplying ? 'RE-APPLYING' : 'APPLYING', " change"), {
                experimentName: experimentName,
                selector: change.selector,
                type: change.type,
                timestamp: Date.now(),
                callStack: (_a = new Error().stack) === null || _a === void 0 ? void 0 : _a.split('\n').slice(2, 4).join('\n'),
            });
        }
        try {
            if (change.type === 'styleRules') {
                return this.applyStyleRules(change, experimentName);
            }
            // Handle create changes separately as they don't require a selector
            if (change.type === 'create') {
                if (change.element && change.targetSelector) {
                    var created = this.createElement(change, experimentName);
                    if (created) {
                        this.trackAppliedChange(experimentName, change);
                        (0, debug_1.logChangeApplication)(experimentName, change.targetSelector, change.type, 1, true);
                        return true;
                    }
                }
                return false;
            }
            var elements = document.querySelectorAll(change.selector);
            var appliedElements_1 = [];
            if (elements.length === 0) {
                // Add to pending if waitForElement is explicitly true OR if SPA mode is enabled
                var shouldWaitForElement = change.waitForElement || ((_b = this.plugin.config) === null || _b === void 0 ? void 0 : _b.spa);
                if (shouldWaitForElement) {
                    if (this.debug) {
                        (0, debug_1.logDebug)("[ABsmartly] Element not found, adding to pending: ".concat(change.selector));
                    }
                    this.pendingManager.addPending({
                        change: change,
                        experimentName: experimentName,
                        observerRoot: change.observerRoot,
                    });
                    return true;
                }
                if (this.debug) {
                    (0, debug_1.logDebug)("[ABsmartly] No elements found for selector: ".concat(change.selector));
                }
                (0, debug_1.logDebug)("No elements found for selector", {
                    experimentName: experimentName,
                    selector: change.selector,
                    changeType: change.type,
                });
                return false;
            }
            elements.forEach(function (element) {
                var _a, _b;
                if (_this.debug && change.type === 'style') {
                    var oldStyles_1 = {};
                    if (change.value && typeof change.value === 'object') {
                        Object.keys(change.value).forEach(function (prop) {
                            var cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                            oldStyles_1[cssProp] = element.style.getPropertyValue(cssProp);
                        });
                    }
                    (0, debug_1.logDebug)("[DOM-BEFORE-APPLY] Element styles before change", {
                        experimentName: experimentName,
                        selector: change.selector,
                        element: element.tagName,
                        oldStyles: oldStyles_1,
                        newStyles: change.value,
                    });
                }
                _this.applyChangeToElement(element, change);
                if (_this.debug && change.type === 'style') {
                    var appliedStyles_1 = {};
                    if (change.value && typeof change.value === 'object') {
                        Object.keys(change.value).forEach(function (prop) {
                            var cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                            appliedStyles_1[cssProp] = element.style.getPropertyValue(cssProp);
                        });
                    }
                    (0, debug_1.logDebug)("[DOM-AFTER-APPLY] Element styles after change", {
                        experimentName: experimentName,
                        selector: change.selector,
                        element: element.tagName,
                        appliedStyles: appliedStyles_1,
                    });
                }
                if (change.type === 'javascript') {
                    if (change.value) {
                        try {
                            var fn = new Function('element', String(change.value));
                            fn(element);
                            appliedElements_1.push(element);
                        }
                        catch (error) {
                            (0, debug_1.logDebug)('[ABsmartly] JavaScript execution error:', error);
                        }
                    }
                }
                else if (change.type === 'move') {
                    var targetSelector = change.targetSelector ||
                        (change.value && typeof change.value === 'object'
                            ? change.value.targetSelector
                            : null);
                    var position = change.position ||
                        (change.value && typeof change.value === 'object'
                            ? change.value.position
                            : null);
                    if (targetSelector) {
                        var target = document.querySelector(targetSelector);
                        if (target) {
                            _this.moveElement(element, target, position);
                            appliedElements_1.push(element);
                        }
                        else if (_this.debug) {
                            (0, debug_1.logDebug)("[ABsmartly] Move target not found: ".concat(targetSelector));
                        }
                    }
                }
                else {
                    appliedElements_1.push(element);
                }
                // Watch element for React hydration recovery (ALL types) OR style persistence (styles only)
                var shouldWatch = (change.type === 'style' && change.persistStyle) || // Explicit style persistence
                    ((_a = _this.plugin.config) === null || _a === void 0 ? void 0 : _a.spa); // SPA mode watches ALL types for hydration recovery
                if (shouldWatch) {
                    _this.plugin.watchElement(element, experimentName, change);
                }
                else if (change.type === 'style' && _this.debug) {
                    (0, debug_1.logDebug)("[WATCH-SKIP] NOT watching element - persistStyle and SPA both disabled", {
                        experimentName: experimentName,
                        selector: change.selector,
                        element: element.tagName,
                        persistStyle: change.persistStyle,
                        spaMode: (_b = _this.plugin.config) === null || _b === void 0 ? void 0 : _b.spa,
                    });
                }
            });
            if (appliedElements_1.length > 0) {
                this.trackAppliedChange(experimentName, change);
                if (change.waitForElement) {
                    this.pendingManager.removePending(change.selector, experimentName, change.observerRoot);
                }
                // Throttle logs during style persistence reapplies (animations can trigger many times per second)
                var isReapplying_1 = appliedElements_1.some(function (el) { var _a; return (_a = _this.plugin.reapplyingElements) === null || _a === void 0 ? void 0 : _a.has(el); });
                if (!isReapplying_1) {
                    (0, debug_1.logChangeApplication)(experimentName, change.selector, change.type, appliedElements_1.length, true);
                }
                return true;
            }
            (0, debug_1.logChangeApplication)(experimentName, change.selector, change.type, 0, false);
            return false;
        }
        catch (error) {
            if (this.debug) {
                (0, debug_1.logDebug)('[ABsmartly] Error applying DOM change:', error, change);
            }
            (0, debug_1.logDebug)("Error applying DOM change", {
                experimentName: experimentName,
                selector: change.selector,
                changeType: change.type,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    };
    DOMManipulatorLite.prototype.moveElement = function (element, target, position) {
        var _a, _b, _c;
        switch (position) {
            case 'before':
                (_a = target.parentElement) === null || _a === void 0 ? void 0 : _a.insertBefore(element, target);
                break;
            case 'after':
                if (target.nextSibling) {
                    (_b = target.parentElement) === null || _b === void 0 ? void 0 : _b.insertBefore(element, target.nextSibling);
                }
                else {
                    (_c = target.parentElement) === null || _c === void 0 ? void 0 : _c.appendChild(element);
                }
                break;
            case 'firstChild':
                if (target.firstChild) {
                    target.insertBefore(element, target.firstChild);
                }
                else {
                    target.appendChild(element);
                }
                break;
            case 'lastChild':
            default:
                target.appendChild(element);
                break;
        }
    };
    DOMManipulatorLite.prototype.createElement = function (change, _experimentName) {
        var e_1, _a;
        if (!change.element || !change.targetSelector) {
            return null;
        }
        var target = document.querySelector(change.targetSelector);
        if (!target) {
            if (this.debug) {
                (0, debug_1.logDebug)("[ABsmartly] Create target not found: ".concat(change.targetSelector));
            }
            return null;
        }
        var tempContainer = document.createElement('div');
        tempContainer.innerHTML = change.element;
        // Move all children (not just the first one) to support multiple elements
        var children = Array.from(tempContainer.children);
        if (children.length === 0) {
            return null;
        }
        try {
            for (var children_1 = __values(children), children_1_1 = children_1.next(); !children_1_1.done; children_1_1 = children_1.next()) {
                var child = children_1_1.value;
                this.moveElement(child, target, change.position);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (children_1_1 && !children_1_1.done && (_a = children_1.return)) _a.call(children_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // Return the first element for compatibility
        return children[0];
    };
    DOMManipulatorLite.prototype.applyStyleRules = function (change, experimentName) {
        try {
            var manager = this.plugin.getStyleManager(experimentName);
            var ruleKey = "".concat(change.selector, "::states");
            var css = void 0;
            // Support both raw CSS string in value and structured states
            if (typeof change.value === 'string' && change.value.trim()) {
                // Raw CSS provided in value
                css = change.value;
            }
            else if (change.states) {
                // Structured states provided
                css = this.plugin.buildStateRules(change.selector, change.states, change.important !== false);
            }
            else {
                // No CSS provided
                return false;
            }
            manager.setRule(ruleKey, css);
            if (this.debug) {
                (0, debug_1.logDebug)("[ABsmartly] Applied style rule: ".concat(ruleKey));
                (0, debug_1.logDebug)("[ABsmartly] CSS: ".concat(css));
            }
            this.trackAppliedChange(experimentName, change);
            (0, debug_1.logChangeApplication)(experimentName, change.selector, 'styleRules', 1, true);
            return true;
        }
        catch (error) {
            if (this.debug) {
                (0, debug_1.logDebug)('[ABsmartly] Error applying style rules:', error);
            }
            return false;
        }
    };
    DOMManipulatorLite.prototype.applyChangeToElement = function (element, change) {
        var _a, _b;
        switch (change.type) {
            case 'text':
                if (change.value !== undefined) {
                    element.textContent = String(change.value);
                }
                break;
            case 'html':
                if (change.value !== undefined) {
                    element.innerHTML = String(change.value);
                }
                break;
            case 'style':
                if (change.value && typeof change.value === 'object') {
                    Object.entries(change.value).forEach(function (_a) {
                        var _b = __read(_a, 2), property = _b[0], value = _b[1];
                        var cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
                        var priority = change.important === true ? 'important' : '';
                        element.style.setProperty(cssProperty, String(value), priority);
                    });
                }
                break;
            case 'class':
                if (change.add && Array.isArray(change.add)) {
                    (_a = element.classList).add.apply(_a, __spreadArray([], __read(change.add), false));
                }
                if (change.remove && Array.isArray(change.remove)) {
                    (_b = element.classList).remove.apply(_b, __spreadArray([], __read(change.remove), false));
                }
                break;
            case 'attribute':
                if (change.value && typeof change.value === 'object') {
                    Object.entries(change.value).forEach(function (_a) {
                        var _b = __read(_a, 2), attr = _b[0], value = _b[1];
                        if (value === null || value === undefined) {
                            element.removeAttribute(attr);
                        }
                        else {
                            element.setAttribute(attr, String(value));
                        }
                    });
                }
                break;
            case 'move':
                if (change.value && typeof change.value === 'object') {
                    var moveValue = change.value;
                    var target = document.querySelector(moveValue.targetSelector);
                    if (target) {
                        this.moveElement(element, target, moveValue.position);
                    }
                    else if (this.debug) {
                        (0, debug_1.logDebug)("[ABsmartly] Move target not found: ".concat(moveValue.targetSelector));
                    }
                }
                break;
            case 'delete':
                element.remove();
                break;
        }
    };
    DOMManipulatorLite.prototype.applyChangeToSpecificElement = function (change, experimentName, element) {
        var _a;
        try {
            this.applyChangeToElement(element, change);
            if (change.type === 'javascript' && change.value) {
                try {
                    var fn = new Function('element', String(change.value));
                    fn(element);
                }
                catch (error) {
                    (0, debug_1.logDebug)('[ABsmartly] JavaScript execution error:', error);
                    return false;
                }
            }
            else if (change.type === 'move') {
                var targetSelector = change.targetSelector ||
                    (change.value && typeof change.value === 'object'
                        ? change.value.targetSelector
                        : null);
                var position = change.position ||
                    (change.value && typeof change.value === 'object'
                        ? change.value.position
                        : null);
                if (targetSelector) {
                    var target = document.querySelector(targetSelector);
                    if (target) {
                        this.moveElement(element, target, position);
                    }
                    else {
                        return false;
                    }
                }
            }
            // Watch element for React hydration recovery (ALL types) OR style persistence (styles only)
            var shouldWatch = (change.type === 'style' && change.persistStyle) || // Explicit style persistence
                ((_a = this.plugin.config) === null || _a === void 0 ? void 0 : _a.spa); // SPA mode watches ALL types for hydration recovery
            if (shouldWatch) {
                this.plugin.watchElement(element, experimentName, change);
            }
            return true;
        }
        catch (error) {
            if (this.debug) {
                (0, debug_1.logDebug)('[ABsmartly] Error applying change to specific element:', error);
            }
            return false;
        }
    };
    DOMManipulatorLite.prototype.trackAppliedChange = function (experimentName, change) {
        var changes = this.appliedChanges.get(experimentName);
        if (!changes) {
            changes = new Set();
            this.appliedChanges.set(experimentName, changes);
        }
        var changeKey = "".concat(change.selector, "-").concat(change.type);
        changes.add(changeKey);
    };
    DOMManipulatorLite.prototype.hasChanges = function (experimentName) {
        return this.appliedChanges.has(experimentName);
    };
    DOMManipulatorLite.prototype.clearTracking = function (experimentName) {
        if (experimentName) {
            this.appliedChanges.delete(experimentName);
        }
        else {
            this.appliedChanges.clear();
        }
    };
    DOMManipulatorLite.prototype.removeAllPending = function (experimentName) {
        this.pendingManager.removeAllPending(experimentName);
    };
    DOMManipulatorLite.prototype.destroy = function () {
        this.pendingManager.destroy();
        this.appliedChanges.clear();
    };
    return DOMManipulatorLite;
}());
exports.DOMManipulatorLite = DOMManipulatorLite;


/***/ }),

/***/ "./src/core/ExposureTracker.ts":
/*!*************************************!*\
  !*** ./src/core/ExposureTracker.ts ***!
  \*************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ExposureTracker = void 0;
var debug_1 = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
var ExposureTracker = /** @class */ (function () {
    function ExposureTracker(context, debug) {
        if (debug === void 0) { debug = false; }
        this.context = context;
        this.experiments = new Map();
        this.trackedElements = new Map();
        this.mutationObserver = null;
        this.placeholders = new Map(); // experimentName-selector -> placeholder
        this.debug = debug;
        this.setupIntersectionObserver();
    }
    /**
     * Register an experiment with all its variants' changes for comprehensive tracking
     *
     * @param hasImmediateTrigger - Whether ANY variant matching URL filter has immediate trigger
     * @param hasViewportTrigger - Whether ANY variant matching URL filter has viewport trigger
     */
    ExposureTracker.prototype.registerExperiment = function (experimentName, currentVariant, currentChanges, allVariantsChanges, hasImmediateTrigger, hasViewportTrigger) {
        var _this = this;
        if (this.debug) {
            (0, debug_1.logDebug)("[ABsmartly] Registering experiment ".concat(experimentName, " for exposure tracking"));
        }
        // Collect all unique selectors that need viewport tracking across ALL variants
        var viewportSelectors = new Set();
        var moveParentSelectors = new Set(); // Parent containers for move changes
        // First pass: collect all move changes across all variants
        // We need to track ALL possible positions where elements could be
        var moveElements = new Map(); // selector -> Set of target parent positions
        allVariantsChanges.forEach(function (variantChanges) {
            variantChanges.forEach(function (change) {
                if (change.trigger_on_view) {
                    if (change.type === 'move') {
                        if (!moveElements.has(change.selector)) {
                            moveElements.set(change.selector, new Set());
                        }
                        // Add the target parent for this move
                        if (change.targetSelector) {
                            moveElements.get(change.selector).add(change.targetSelector);
                        }
                    }
                    else {
                        // For non-move changes, track the selector directly
                        viewportSelectors.add(change.selector);
                    }
                }
            });
        });
        // For cross-variant move tracking, we need to track the EXACT POSITION where
        // elements would appear in other variants. We use container-based invisible elements
        // positioned exactly where the element would be, using CSS positioning.
        moveElements.forEach(function (_targetParents, selector) {
            // Collect all move changes for this element across ALL variants
            var allMovesForElement = [];
            allVariantsChanges.forEach(function (variantChanges, variantIndex) {
                var moveChange = variantChanges.find(function (c) { return c.type === 'move' && c.selector === selector && c.trigger_on_view; });
                if (moveChange === null || moveChange === void 0 ? void 0 : moveChange.targetSelector) {
                    allMovesForElement.push({
                        targetSelector: moveChange.targetSelector,
                        position: moveChange.position || 'lastChild',
                        variantIndex: variantIndex,
                    });
                }
            });
            // Check if current variant has a move for this element
            var currentMoveIndex = allMovesForElement.findIndex(function (m) { return m.variantIndex === currentVariant; });
            if (currentMoveIndex >= 0) {
                // Current variant HAS a move - track the element in its moved position
                viewportSelectors.add(selector);
                // For all OTHER variant positions, create container-based placeholders
                allMovesForElement.forEach(function (move, index) {
                    if (index !== currentMoveIndex) {
                        // Create placeholder at the position where element WOULD be in another variant
                        _this.createContainerPlaceholder(experimentName, selector, move.targetSelector, move.position);
                    }
                });
            }
            else {
                // Current variant does NOT have a move - element stays in original position
                viewportSelectors.add(selector);
                // For ALL variant moves, create placeholders at those positions
                allMovesForElement.forEach(function (move) {
                    _this.createContainerPlaceholder(experimentName, selector, move.targetSelector, move.position);
                });
            }
        });
        // Trigger flags are now passed in from DOMChangesPluginLite after URL filtering
        // This ensures only variants matching the current URL determine trigger behavior
        // Store experiment tracking info
        var tracking = {
            experimentName: experimentName,
            variant: currentVariant,
            changes: currentChanges,
            allPossibleSelectors: new Set(__spreadArray(__spreadArray([], __read(viewportSelectors), false), __read(moveParentSelectors), false)),
            triggered: false,
            hasImmediateTrigger: hasImmediateTrigger,
            hasViewportTrigger: hasViewportTrigger,
        };
        this.experiments.set(experimentName, tracking);
        if (this.debug) {
            (0, debug_1.logDebug)("[ABsmartly] Experiment ".concat(experimentName, " will track selectors:"), Array.from(tracking.allPossibleSelectors));
        }
        // Trigger immediately if needed
        if (hasImmediateTrigger) {
            // Don't await here to avoid blocking the tracking setup
            this.triggerExposure(experimentName).catch(function (error) {
                (0, debug_1.logDebug)("[ABsmartly] Failed to trigger exposure for ".concat(experimentName, ":"), error);
            });
        }
        else if (hasViewportTrigger) {
            // Only set up viewport observers if there's NO immediate trigger
            // If there's an immediate trigger, the experiment will be triggered and cleaned up right away
            this.observeSelectors(experimentName, tracking.allPossibleSelectors);
        }
    };
    /**
     * Create a container-based placeholder at the hypothetical position
     * Uses inline-block with minimal dimensions to be observable but not affect layout
     */
    ExposureTracker.prototype.createContainerPlaceholder = function (experimentName, originalSelector, targetSelector, position) {
        var _a, _b;
        if (position === void 0) { position = 'lastChild'; }
        var targetElement = document.querySelector(targetSelector);
        if (!targetElement)
            return;
        var placeholderKey = "".concat(experimentName, "-").concat(originalSelector, "-").concat(targetSelector, "-").concat(position);
        // Check if placeholder already exists
        if (this.placeholders.has(placeholderKey)) {
            return;
        }
        // Create minimal placeholder using inline styles
        // This will be observable by IntersectionObserver but won't affect layout
        var placeholder = document.createElement('span');
        placeholder.style.cssText = "\n      display: inline-block;\n      width: 1px;\n      height: 1px;\n      position: relative;\n      left: -1px;\n      visibility: hidden;\n      pointer-events: none;\n      font-size: 0;\n      line-height: 0;\n      overflow: hidden;\n    ";
        placeholder.setAttribute('data-absmartly-placeholder', 'true');
        placeholder.setAttribute('data-absmartly-original-selector', originalSelector);
        placeholder.setAttribute('data-absmartly-experiment', experimentName);
        placeholder.setAttribute('aria-hidden', 'true');
        // Insert placeholder at the hypothetical position
        switch (position) {
            case 'firstChild':
                targetElement.insertBefore(placeholder, targetElement.firstChild);
                break;
            case 'lastChild':
                targetElement.appendChild(placeholder);
                break;
            case 'before':
                (_a = targetElement.parentElement) === null || _a === void 0 ? void 0 : _a.insertBefore(placeholder, targetElement);
                break;
            case 'after':
                (_b = targetElement.parentElement) === null || _b === void 0 ? void 0 : _b.insertBefore(placeholder, targetElement.nextSibling);
                break;
            default:
                targetElement.appendChild(placeholder);
        }
        this.placeholders.set(placeholderKey, placeholder);
        // Track the placeholder for viewport visibility
        this.trackElement(placeholder, experimentName);
        if (this.debug) {
            (0, debug_1.logDebug)("[ABsmartly] Created placeholder for ".concat(originalSelector, " at ").concat(targetSelector, " (").concat(position, ")"));
        }
    };
    /**
     * Get the original parent selector for move changes
     * This should be called BEFORE the move is applied
     */
    ExposureTracker.prototype.getOriginalParentForMove = function (selector) {
        var element = document.querySelector(selector);
        if (!(element === null || element === void 0 ? void 0 : element.parentElement))
            return null;
        return this.getStableParentSelector(element.parentElement);
    };
    /**
     * Get a stable selector for a parent element
     */
    ExposureTracker.prototype.getStableParentSelector = function (element) {
        // Try to get a good selector for the parent
        if (element.id) {
            return "#".concat(element.id);
        }
        if (element.className) {
            var classes = element.className.split(' ').filter(function (c) { return c && !c.startsWith('absmartly'); });
            if (classes.length > 0) {
                return ".".concat(classes[0]);
            }
        }
        // Fallback to tag name with positional info
        var parent = element.parentElement;
        if (parent) {
            var siblings = Array.from(parent.children);
            var index = siblings.indexOf(element);
            return "".concat(element.tagName.toLowerCase(), ":nth-child(").concat(index + 1, ")");
        }
        return null;
    };
    /**
     * Set up observers for the given selectors
     */
    ExposureTracker.prototype.observeSelectors = function (experimentName, selectors) {
        var _this = this;
        selectors.forEach(function (selector) {
            // Try to find existing elements
            var elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                elements.forEach(function (element) {
                    _this.trackElement(element, experimentName);
                });
            }
            else {
                // Element doesn't exist yet, set up mutation observer to watch for it
                _this.watchForSelector(selector, experimentName);
            }
        });
    };
    /**
     * Track an element for viewport visibility
     */
    ExposureTracker.prototype.trackElement = function (element, experimentName) {
        if (!this.trackedElements.has(element)) {
            this.trackedElements.set(element, {
                element: element,
                experiments: new Set([experimentName]),
                isPlaceholder: element.hasAttribute('data-absmartly-placeholder'),
            });
            this.observer.observe(element);
        }
        else {
            this.trackedElements.get(element).experiments.add(experimentName);
        }
    };
    /**
     * Watch for elements matching a selector to appear
     */
    ExposureTracker.prototype.watchForSelector = function (_selector, _experimentName) {
        if (!this.mutationObserver) {
            this.setupMutationObserver();
        }
        // Store pending selector (implementation would need a Map for this)
        // For now, we'll rely on checking in mutation callback
    };
    /**
     * Set up the IntersectionObserver for viewport tracking
     */
    ExposureTracker.prototype.setupIntersectionObserver = function () {
        var _this = this;
        this.observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    _this.handleElementVisible(entry.target);
                }
            });
        }, {
            threshold: 0.01, // Trigger when even 1% is visible
            rootMargin: '0px',
        });
    };
    /**
     * Set up MutationObserver for dynamic elements
     */
    ExposureTracker.prototype.setupMutationObserver = function () {
        var _this = this;
        this.mutationObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node instanceof Element) {
                        // Check if this element or its children match any tracked selectors
                        _this.checkNewElement(node);
                    }
                });
            });
        });
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    };
    /**
     * Check if a newly added element needs tracking
     */
    ExposureTracker.prototype.checkNewElement = function (element) {
        var _this = this;
        this.experiments.forEach(function (tracking, experimentName) {
            tracking.allPossibleSelectors.forEach(function (selector) {
                if (element.matches(selector)) {
                    _this.trackElement(element, experimentName);
                }
                // Also check children
                element.querySelectorAll(selector).forEach(function (child) {
                    _this.trackElement(child, experimentName);
                });
            });
        });
    };
    /**
     * Handle when an element becomes visible
     */
    ExposureTracker.prototype.handleElementVisible = function (element) {
        var _this = this;
        var tracked = this.trackedElements.get(element);
        if (!tracked)
            return;
        tracked.experiments.forEach(function (experimentName) {
            var experiment = _this.experiments.get(experimentName);
            if (experiment && !experiment.triggered) {
                // Don't await here to avoid blocking the visibility handler
                _this.triggerExposure(experimentName).catch(function (error) {
                    (0, debug_1.logDebug)("[ABsmartly] Failed to trigger exposure for ".concat(experimentName, ":"), error);
                });
                if (_this.debug) {
                    var selector = tracked.isPlaceholder
                        ? element.getAttribute('data-absmartly-original-selector')
                        : _this.getElementSelector(element);
                    (0, debug_1.logDebug)("[ABsmartly] Triggering exposure for ".concat(experimentName, " via ").concat(selector));
                }
            }
        });
    };
    /**
     * Trigger exposure for an experiment
     */
    ExposureTracker.prototype.triggerExposure = function (experimentName) {
        return __awaiter(this, void 0, void 0, function () {
            var experiment;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        experiment = this.experiments.get(experimentName);
                        if (!experiment || experiment.triggered)
                            return [2 /*return*/];
                        // Ensure context is ready before calling treatment
                        return [4 /*yield*/, this.context.ready()];
                    case 1:
                        // Ensure context is ready before calling treatment
                        _a.sent();
                        // Call treatment to trigger exposure
                        this.context.treatment(experimentName);
                        experiment.triggered = true;
                        if (this.debug) {
                            (0, debug_1.logDebug)("[ABsmartly] Exposure triggered for experiment: ".concat(experimentName));
                        }
                        // Clean up tracking for this experiment
                        this.cleanupExperiment(experimentName);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clean up tracking for an experiment that has been triggered
     */
    ExposureTracker.prototype.cleanupExperiment = function (experimentName) {
        var _this = this;
        // Remove from tracked elements
        this.trackedElements.forEach(function (tracked, element) {
            tracked.experiments.delete(experimentName);
            if (tracked.experiments.size === 0) {
                _this.observer.unobserve(element);
                _this.trackedElements.delete(element);
            }
        });
        // Remove placeholders
        this.placeholders.forEach(function (placeholder, key) {
            if (key.startsWith("".concat(experimentName, "-"))) {
                placeholder.remove();
                _this.placeholders.delete(key);
            }
        });
        // Don't delete the experiment - keep it in the map so isTriggered() can still return true
        // Just clear the selectors since we don't need to track them anymore
        var experiment = this.experiments.get(experimentName);
        if (experiment) {
            experiment.allPossibleSelectors.clear();
        }
        // Clean up mutation observer if no experiments left
        if (this.experiments.size === 0 && this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
    };
    /**
     * Get a selector string for an element (for debugging)
     */
    ExposureTracker.prototype.getElementSelector = function (element) {
        if (element.id)
            return "#".concat(element.id);
        if (element.className) {
            var classes = element.className.split(' ').filter(function (c) { return c && !c.startsWith('absmartly'); });
            if (classes.length > 0)
                return ".".concat(classes.join('.'));
        }
        return element.tagName.toLowerCase();
    };
    /**
     * Check if an experiment needs viewport tracking
     */
    ExposureTracker.prototype.needsViewportTracking = function (experimentName) {
        var _a;
        var experiment = this.experiments.get(experimentName);
        return (_a = experiment === null || experiment === void 0 ? void 0 : experiment.hasViewportTrigger) !== null && _a !== void 0 ? _a : false;
    };
    /**
     * Check if an experiment has been triggered
     */
    ExposureTracker.prototype.isTriggered = function (experimentName) {
        var _a;
        var experiment = this.experiments.get(experimentName);
        return (_a = experiment === null || experiment === void 0 ? void 0 : experiment.triggered) !== null && _a !== void 0 ? _a : false;
    };
    /**
     * Clean up all resources
     */
    ExposureTracker.prototype.destroy = function () {
        // Disconnect observers
        this.observer.disconnect();
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        // Remove all placeholders
        this.placeholders.forEach(function (placeholder) { return placeholder.remove(); });
        // Clear all tracking
        this.experiments.clear();
        this.trackedElements.clear();
        this.placeholders.clear();
        if (this.debug) {
            (0, debug_1.logDebug)('[ABsmartly] ExposureTracker destroyed');
        }
    };
    return ExposureTracker;
}());
exports.ExposureTracker = ExposureTracker;


/***/ }),

/***/ "./src/core/HTMLInjector.ts":
/*!**********************************!*\
  !*** ./src/core/HTMLInjector.ts ***!
  \**********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HTMLInjector = void 0;
var debug_1 = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
var URLMatcher_1 = __webpack_require__(/*! ../utils/URLMatcher */ "./src/utils/URLMatcher.ts");
var HTMLInjector = /** @class */ (function () {
    function HTMLInjector(debug) {
        if (debug === void 0) { debug = false; }
        this.injectedIds = new Set();
        this.debug = debug;
    }
    HTMLInjector.prototype.parseInjectionKey = function (key) {
        var e_1, _a;
        var validLocations = ['headStart', 'headEnd', 'bodyStart', 'bodyEnd'];
        try {
            for (var validLocations_1 = __values(validLocations), validLocations_1_1 = validLocations_1.next(); !validLocations_1_1.done; validLocations_1_1 = validLocations_1.next()) {
                var location_1 = validLocations_1_1.value;
                if (key === location_1) {
                    return { location: location_1, priority: 0 };
                }
                if (key.startsWith(location_1)) {
                    var priorityStr = key.substring(location_1.length);
                    var priority = parseInt(priorityStr, 10);
                    if (!isNaN(priority)) {
                        return { location: location_1, priority: priority };
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (validLocations_1_1 && !validLocations_1_1.done && (_a = validLocations_1.return)) _a.call(validLocations_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (this.debug) {
            (0, debug_1.logDebug)('[HTMLInjector] Invalid injection key:', key);
        }
        return null;
    };
    HTMLInjector.prototype.collectInjections = function (allInjectHTML, currentUrl) {
        var e_2, _a, e_3, _b, e_4, _c, e_5, _d;
        if (currentUrl === void 0) { currentUrl = window.location.href; }
        var injectionsByLocation = new Map();
        try {
            for (var allInjectHTML_1 = __values(allInjectHTML), allInjectHTML_1_1 = allInjectHTML_1.next(); !allInjectHTML_1_1.done; allInjectHTML_1_1 = allInjectHTML_1.next()) {
                var _e = __read(allInjectHTML_1_1.value, 2), experimentName = _e[0], variantMap = _e[1];
                try {
                    for (var variantMap_1 = (e_3 = void 0, __values(variantMap)), variantMap_1_1 = variantMap_1.next(); !variantMap_1_1.done; variantMap_1_1 = variantMap_1.next()) {
                        var _f = __read(variantMap_1_1.value, 2), variantIndex = _f[0], dataWithFilter = _f[1];
                        if (!dataWithFilter || typeof dataWithFilter !== 'object') {
                            if (this.debug) {
                                (0, debug_1.logDebug)("[HTMLInjector] Invalid injection data for ".concat(experimentName, " variant ").concat(variantIndex, ":"), dataWithFilter);
                            }
                            continue;
                        }
                        // Check URL filter if present
                        if (dataWithFilter.urlFilter) {
                            var matches = URLMatcher_1.URLMatcher.matches(dataWithFilter.urlFilter, currentUrl);
                            if (!matches) {
                                if (this.debug) {
                                    (0, debug_1.logDebug)("[HTMLInjector] Skipping ".concat(experimentName, " variant ").concat(variantIndex, " - URL filter doesn't match:"), {
                                        currentUrl: currentUrl,
                                        urlFilter: dataWithFilter.urlFilter,
                                    });
                                }
                                continue;
                            }
                        }
                        var rawData = dataWithFilter.data;
                        if (!rawData || typeof rawData !== 'object') {
                            if (this.debug) {
                                (0, debug_1.logDebug)("[HTMLInjector] Invalid injection data for ".concat(experimentName, " variant ").concat(variantIndex, ":"), rawData);
                            }
                            continue;
                        }
                        try {
                            for (var _g = (e_4 = void 0, __values(Object.entries(rawData))), _h = _g.next(); !_h.done; _h = _g.next()) {
                                var _j = __read(_h.value, 2), key = _j[0], code = _j[1];
                                if (typeof code !== 'string') {
                                    if (this.debug) {
                                        (0, debug_1.logDebug)("[HTMLInjector] Skipping non-string injection code for key ".concat(key, ":"), code);
                                    }
                                    continue;
                                }
                                var parsed = this.parseInjectionKey(key);
                                if (parsed) {
                                    var item = {
                                        code: code,
                                        priority: parsed.priority,
                                        location: parsed.location,
                                    };
                                    if (!injectionsByLocation.has(parsed.location)) {
                                        injectionsByLocation.set(parsed.location, []);
                                    }
                                    injectionsByLocation.get(parsed.location).push(item);
                                    if (this.debug) {
                                        (0, debug_1.logDebug)("[HTMLInjector] Collected injection:", {
                                            experiment: experimentName,
                                            variant: variantIndex,
                                            location: parsed.location,
                                            priority: parsed.priority,
                                            codeLength: code.length,
                                        });
                                    }
                                }
                            }
                        }
                        catch (e_4_1) { e_4 = { error: e_4_1 }; }
                        finally {
                            try {
                                if (_h && !_h.done && (_c = _g.return)) _c.call(_g);
                            }
                            finally { if (e_4) throw e_4.error; }
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (variantMap_1_1 && !variantMap_1_1.done && (_b = variantMap_1.return)) _b.call(variantMap_1);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (allInjectHTML_1_1 && !allInjectHTML_1_1.done && (_a = allInjectHTML_1.return)) _a.call(allInjectHTML_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        try {
            for (var injectionsByLocation_1 = __values(injectionsByLocation), injectionsByLocation_1_1 = injectionsByLocation_1.next(); !injectionsByLocation_1_1.done; injectionsByLocation_1_1 = injectionsByLocation_1.next()) {
                var _k = __read(injectionsByLocation_1_1.value, 2), location_2 = _k[0], items = _k[1];
                items.sort(function (a, b) { return b.priority - a.priority; });
                if (this.debug) {
                    (0, debug_1.logDebug)("[HTMLInjector] Sorted ".concat(location_2, " injections by priority:"), {
                        location: location_2,
                        count: items.length,
                        priorities: items.map(function (item) { return item.priority; }),
                    });
                }
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (injectionsByLocation_1_1 && !injectionsByLocation_1_1.done && (_d = injectionsByLocation_1.return)) _d.call(injectionsByLocation_1);
            }
            finally { if (e_5) throw e_5.error; }
        }
        return injectionsByLocation;
    };
    HTMLInjector.prototype.inject = function (injectionsByLocation) {
        var e_6, _a, e_7, _b;
        try {
            for (var injectionsByLocation_2 = __values(injectionsByLocation), injectionsByLocation_2_1 = injectionsByLocation_2.next(); !injectionsByLocation_2_1.done; injectionsByLocation_2_1 = injectionsByLocation_2.next()) {
                var _c = __read(injectionsByLocation_2_1.value, 2), location_3 = _c[0], items = _c[1];
                // For headStart and bodyStart, we insert at the beginning (firstChild)
                // Each insertion pushes previous ones down, so we need to reverse
                // to maintain priority order (higher priority = earlier in DOM)
                var orderedItems = location_3 === 'headStart' || location_3 === 'bodyStart' ? __spreadArray([], __read(items), false).reverse() : items;
                try {
                    for (var orderedItems_1 = (e_7 = void 0, __values(orderedItems)), orderedItems_1_1 = orderedItems_1.next(); !orderedItems_1_1.done; orderedItems_1_1 = orderedItems_1.next()) {
                        var item = orderedItems_1_1.value;
                        this.injectAtLocation(location_3, item.code);
                    }
                }
                catch (e_7_1) { e_7 = { error: e_7_1 }; }
                finally {
                    try {
                        if (orderedItems_1_1 && !orderedItems_1_1.done && (_b = orderedItems_1.return)) _b.call(orderedItems_1);
                    }
                    finally { if (e_7) throw e_7.error; }
                }
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (injectionsByLocation_2_1 && !injectionsByLocation_2_1.done && (_a = injectionsByLocation_2.return)) _a.call(injectionsByLocation_2);
            }
            finally { if (e_6) throw e_6.error; }
        }
        if (this.debug) {
            (0, debug_1.logDebug)('[HTMLInjector] All injections complete');
        }
    };
    HTMLInjector.prototype.injectAtLocation = function (location, code) {
        var injectionId = "absmartly-inject-".concat(location, "-").concat(Date.now(), "-").concat(Math.random());
        if (this.injectedIds.has(injectionId)) {
            return;
        }
        try {
            switch (location) {
                case 'headStart':
                    this.injectHeadStart(code, injectionId);
                    break;
                case 'headEnd':
                    this.injectHeadEnd(code, injectionId);
                    break;
                case 'bodyStart':
                    this.injectBodyStart(code, injectionId);
                    break;
                case 'bodyEnd':
                    this.injectBodyEnd(code, injectionId);
                    break;
            }
            this.injectedIds.add(injectionId);
            if (this.debug) {
                (0, debug_1.logDebug)("[HTMLInjector] Injected at ".concat(location, ":"), {
                    location: location,
                    codeLength: code.length,
                    injectionId: injectionId,
                });
            }
        }
        catch (error) {
            if (this.debug) {
                (0, debug_1.logDebug)("[HTMLInjector] Error injecting at ".concat(location, ":"), error);
            }
        }
    };
    HTMLInjector.prototype.injectHeadStart = function (code, id) {
        if (!document.head) {
            if (this.debug) {
                (0, debug_1.logDebug)('[HTMLInjector] <head> element not found for headStart injection');
            }
            return;
        }
        var container = this.createContainer(code, id);
        document.head.insertBefore(container, document.head.firstChild);
    };
    HTMLInjector.prototype.injectHeadEnd = function (code, id) {
        if (!document.head) {
            if (this.debug) {
                (0, debug_1.logDebug)('[HTMLInjector] <head> element not found for headEnd injection');
            }
            return;
        }
        var container = this.createContainer(code, id);
        document.head.appendChild(container);
    };
    HTMLInjector.prototype.injectBodyStart = function (code, id) {
        if (!document.body) {
            if (this.debug) {
                (0, debug_1.logDebug)('[HTMLInjector] <body> element not found for bodyStart injection');
            }
            return;
        }
        var container = this.createContainer(code, id);
        document.body.insertBefore(container, document.body.firstChild);
    };
    HTMLInjector.prototype.injectBodyEnd = function (code, id) {
        if (!document.body) {
            if (this.debug) {
                (0, debug_1.logDebug)('[HTMLInjector] <body> element not found for bodyEnd injection');
            }
            return;
        }
        var container = this.createContainer(code, id);
        document.body.appendChild(container);
    };
    HTMLInjector.prototype.createContainer = function (code, id) {
        var container = document.createElement('div');
        container.id = id;
        container.setAttribute('data-absmartly-injection', 'true');
        container.innerHTML = code;
        return container;
    };
    HTMLInjector.prototype.destroy = function () {
        var e_8, _a;
        try {
            for (var _b = __values(this.injectedIds), _c = _b.next(); !_c.done; _c = _b.next()) {
                var id = _c.value;
                var element = document.getElementById(id);
                if (element) {
                    element.remove();
                }
            }
        }
        catch (e_8_1) { e_8 = { error: e_8_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_8) throw e_8.error; }
        }
        this.injectedIds.clear();
        if (this.debug) {
            (0, debug_1.logDebug)('[HTMLInjector] Destroyed and cleaned up all injections');
        }
    };
    return HTMLInjector;
}());
exports.HTMLInjector = HTMLInjector;


/***/ }),

/***/ "./src/core/PendingChangeManager.ts":
/*!******************************************!*\
  !*** ./src/core/PendingChangeManager.ts ***!
  \******************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PendingChangeManager = void 0;
var debug_1 = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
var PendingChangeManager = /** @class */ (function () {
    function PendingChangeManager(applyFn, debug) {
        if (debug === void 0) { debug = false; }
        this.applyFn = applyFn;
        this.pending = new Map();
        this.observers = new Map();
        this.appliedSelectors = new Set();
        this.batchTimer = null;
        this.batchedWork = new Set();
        this.debug = debug;
    }
    PendingChangeManager.prototype.addPending = function (pendingChange) {
        var change = pendingChange.change, observerRoot = pendingChange.observerRoot;
        // If observerRoot is specified but doesn't exist, treat as no observerRoot
        var effectiveRoot = observerRoot;
        if (observerRoot && !document.querySelector(observerRoot)) {
            if (this.debug) {
                (0, debug_1.logDebug)('[ABsmartly] Observer root not found, using document:', observerRoot);
            }
            effectiveRoot = undefined;
        }
        var key = "".concat(change.selector, "-").concat(effectiveRoot || 'document');
        if (this.debug) {
            (0, debug_1.logDebug)('[ABsmartly] Adding pending change for selector:', change.selector);
        }
        // Check if element already exists
        var root = this.getObserverRoot(effectiveRoot);
        var existing = root.querySelector(change.selector);
        if (existing) {
            // Apply immediately if element exists
            this.applyChange(existing, __assign(__assign({}, pendingChange), { observerRoot: effectiveRoot }));
            return;
        }
        // Add to pending
        var list = this.pending.get(key) || [];
        list.push(__assign(__assign({}, pendingChange), { observerRoot: effectiveRoot }));
        this.pending.set(key, list);
        // Ensure observer for this root
        this.ensureObserver(effectiveRoot);
    };
    PendingChangeManager.prototype.removePending = function (selector, experimentName, observerRoot) {
        var key = "".concat(selector, "-").concat(observerRoot || 'document');
        var list = this.pending.get(key);
        if (list) {
            var filtered = list.filter(function (p) { return p.experimentName !== experimentName; });
            if (filtered.length === 0) {
                this.pending.delete(key);
            }
            else {
                this.pending.set(key, filtered);
            }
        }
        // Check if we should disconnect observer
        this.checkObserverCleanup(observerRoot);
    };
    PendingChangeManager.prototype.removeAllPending = function (experimentName) {
        var e_1, _a;
        try {
            // Remove all pending changes for this experiment
            for (var _b = __values(this.pending.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), key = _d[0], list = _d[1];
                var filtered = list.filter(function (p) { return p.experimentName !== experimentName; });
                if (filtered.length === 0) {
                    this.pending.delete(key);
                }
                else {
                    this.pending.set(key, filtered);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // Clean up observers if needed
        this.cleanupObservers();
    };
    PendingChangeManager.prototype.ensureObserver = function (observerRoot) {
        var _this = this;
        var rootKey = observerRoot || 'document';
        if (this.observers.has(rootKey)) {
            return;
        }
        var root = this.getObserverRoot(observerRoot);
        var observer = new MutationObserver(function (mutations) {
            _this.handleMutations(mutations, observerRoot);
        });
        observer.observe(root, {
            childList: true,
            subtree: true,
        });
        this.observers.set(rootKey, observer);
        if (this.debug) {
            (0, debug_1.logDebug)('[ABsmartly] Started observer for root:', rootKey);
        }
    };
    PendingChangeManager.prototype.handleMutations = function (mutations, observerRoot) {
        var e_2, _a, e_3, _b;
        var _this = this;
        var work = [];
        try {
            for (var mutations_1 = __values(mutations), mutations_1_1 = mutations_1.next(); !mutations_1_1.done; mutations_1_1 = mutations_1.next()) {
                var mutation = mutations_1_1.value;
                var _loop_1 = function (node) {
                    var e_4, _e, e_5, _f;
                    if (!(node instanceof Element))
                        return "continue";
                    // Check all pending selectors for this root
                    var rootKey = observerRoot || 'document';
                    try {
                        for (var _g = (e_4 = void 0, __values(this_1.pending.entries())), _h = _g.next(); !_h.done; _h = _g.next()) {
                            var _j = __read(_h.value, 2), key = _j[0], pendingList = _j[1];
                            if (!key.endsWith("-".concat(rootKey)))
                                continue;
                            var _loop_2 = function (pending_1) {
                                var change = pending_1.change;
                                // Check if node matches selector
                                if (node.matches(change.selector)) {
                                    work.push(function () { return _this.applyChange(node, pending_1); });
                                    return "continue";
                                }
                                // Check descendants
                                var found = node.querySelectorAll(change.selector);
                                found.forEach(function (el) {
                                    work.push(function () { return _this.applyChange(el, pending_1); });
                                });
                            };
                            try {
                                for (var pendingList_1 = (e_5 = void 0, __values(pendingList)), pendingList_1_1 = pendingList_1.next(); !pendingList_1_1.done; pendingList_1_1 = pendingList_1.next()) {
                                    var pending_1 = pendingList_1_1.value;
                                    _loop_2(pending_1);
                                }
                            }
                            catch (e_5_1) { e_5 = { error: e_5_1 }; }
                            finally {
                                try {
                                    if (pendingList_1_1 && !pendingList_1_1.done && (_f = pendingList_1.return)) _f.call(pendingList_1);
                                }
                                finally { if (e_5) throw e_5.error; }
                            }
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (_h && !_h.done && (_e = _g.return)) _e.call(_g);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                };
                var this_1 = this;
                try {
                    for (var _c = (e_3 = void 0, __values(mutation.addedNodes)), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var node = _d.value;
                        _loop_1(node);
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (mutations_1_1 && !mutations_1_1.done && (_a = mutations_1.return)) _a.call(mutations_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        // Batch the work
        if (work.length > 0) {
            this.batchWork(work);
        }
    };
    PendingChangeManager.prototype.batchWork = function (work) {
        var _this = this;
        // Add work to batch
        work.forEach(function (fn) { return _this.batchedWork.add(fn); });
        // Clear existing timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        // Set new timer (32ms for ~2 frames)
        this.batchTimer = setTimeout(function () {
            _this.processBatchedWork();
        }, 32);
    };
    PendingChangeManager.prototype.processBatchedWork = function () {
        var work = Array.from(this.batchedWork);
        this.batchedWork.clear();
        this.batchTimer = null;
        if (this.debug && work.length > 0) {
            (0, debug_1.logDebug)('[ABsmartly] Processing batched work:', work.length, 'items');
        }
        // Apply all changes
        work.forEach(function (fn) { return fn(); });
    };
    PendingChangeManager.prototype.applyChange = function (element, pendingChange) {
        var change = pendingChange.change, experimentName = pendingChange.experimentName, observerRoot = pendingChange.observerRoot;
        var key = "".concat(change.selector, "-").concat(observerRoot || 'document', "-").concat(experimentName);
        // Skip if already applied
        if (this.appliedSelectors.has(key)) {
            return;
        }
        if (this.debug) {
            (0, debug_1.logDebug)('[ABsmartly] Applying pending change to element:', change.selector);
        }
        // Apply the change
        var success = this.applyFn(change, experimentName, element);
        if (success) {
            // Mark as applied
            this.appliedSelectors.add(key);
            // Remove from pending
            var pendingKey = "".concat(change.selector, "-").concat(observerRoot || 'document');
            var list = this.pending.get(pendingKey);
            if (list) {
                var filtered = list.filter(function (p) { return p.experimentName !== experimentName || p.change.selector !== change.selector; });
                if (filtered.length === 0) {
                    this.pending.delete(pendingKey);
                }
                else {
                    this.pending.set(pendingKey, filtered);
                }
            }
            // Check if observer should be cleaned up
            this.checkObserverCleanup(observerRoot);
        }
    };
    PendingChangeManager.prototype.getObserverRoot = function (observerRoot) {
        if (!observerRoot) {
            return document.documentElement;
        }
        var root = document.querySelector(observerRoot);
        if (!root) {
            // If observer root doesn't exist, fall back to document
            return document.documentElement;
        }
        return root;
    };
    PendingChangeManager.prototype.checkObserverCleanup = function (observerRoot) {
        var e_6, _a;
        var rootKey = observerRoot || 'document';
        // Check if there are any pending changes for this root
        var hasPending = false;
        try {
            for (var _b = __values(this.pending.keys()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                if (key.endsWith("-".concat(rootKey))) {
                    hasPending = true;
                    break;
                }
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_6) throw e_6.error; }
        }
        // Disconnect observer if no pending changes
        if (!hasPending) {
            var observer = this.observers.get(rootKey);
            if (observer) {
                observer.disconnect();
                this.observers.delete(rootKey);
                if (this.debug) {
                    (0, debug_1.logDebug)('[ABsmartly] Disconnected observer for root:', rootKey);
                }
            }
        }
    };
    PendingChangeManager.prototype.cleanupObservers = function () {
        var e_7, _a, e_8, _b;
        var _this = this;
        // Check each observer
        var rootsToClean = [];
        try {
            for (var _c = __values(this.observers.keys()), _d = _c.next(); !_d.done; _d = _c.next()) {
                var rootKey = _d.value;
                var hasPending = false;
                try {
                    for (var _e = (e_8 = void 0, __values(this.pending.keys())), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var key = _f.value;
                        if (key.endsWith("-".concat(rootKey))) {
                            hasPending = true;
                            break;
                        }
                    }
                }
                catch (e_8_1) { e_8 = { error: e_8_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_8) throw e_8.error; }
                }
                if (!hasPending) {
                    rootsToClean.push(rootKey);
                }
            }
        }
        catch (e_7_1) { e_7 = { error: e_7_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_7) throw e_7.error; }
        }
        // Clean up observers with no pending changes
        rootsToClean.forEach(function (rootKey) {
            var observer = _this.observers.get(rootKey);
            if (observer) {
                observer.disconnect();
                _this.observers.delete(rootKey);
                if (_this.debug) {
                    (0, debug_1.logDebug)('[ABsmartly] Cleaned up observer for root:', rootKey);
                }
            }
        });
    };
    PendingChangeManager.prototype.destroy = function () {
        var e_9, _a;
        // Clear batch timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        try {
            // Disconnect all observers
            for (var _b = __values(this.observers.values()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var observer = _c.value;
                observer.disconnect();
            }
        }
        catch (e_9_1) { e_9 = { error: e_9_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_9) throw e_9.error; }
        }
        this.observers.clear();
        this.pending.clear();
        this.appliedSelectors.clear();
        this.batchedWork.clear();
        if (this.debug) {
            (0, debug_1.logDebug)('[ABsmartly] PendingChangeManager destroyed');
        }
    };
    PendingChangeManager.prototype.getPendingCount = function () {
        var e_10, _a;
        var count = 0;
        try {
            for (var _b = __values(this.pending.values()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var list = _c.value;
                count += list.length;
            }
        }
        catch (e_10_1) { e_10 = { error: e_10_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_10) throw e_10.error; }
        }
        return count;
    };
    PendingChangeManager.prototype.getAppliedCount = function () {
        return this.appliedSelectors.size;
    };
    PendingChangeManager.prototype.hasPendingForExperiment = function (experimentName) {
        var e_11, _a;
        try {
            for (var _b = __values(this.pending.values()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var list = _c.value;
                if (list.some(function (p) { return p.experimentName === experimentName; })) {
                    return true;
                }
            }
        }
        catch (e_11_1) { e_11 = { error: e_11_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_11) throw e_11.error; }
        }
        return false;
    };
    return PendingChangeManager;
}());
exports.PendingChangeManager = PendingChangeManager;


/***/ }),

/***/ "./src/core/StyleSheetManager.ts":
/*!***************************************!*\
  !*** ./src/core/StyleSheetManager.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StyleSheetManager = void 0;
var debug_1 = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
var StyleSheetManager = /** @class */ (function () {
    function StyleSheetManager(id, debug) {
        if (debug === void 0) { debug = false; }
        this.id = id;
        this.styleEl = null;
        this.rules = new Map(); // ruleKey -> css text
        this.debug = debug;
    }
    StyleSheetManager.prototype.ensure = function () {
        if (!this.styleEl || !document.head.contains(this.styleEl)) {
            this.styleEl = document.getElementById(this.id);
            if (!this.styleEl) {
                var el = document.createElement('style');
                el.id = this.id;
                el.setAttribute('data-absmartly-styles', 'true');
                document.head.appendChild(el);
                this.styleEl = el;
                if (this.debug) {
                    (0, debug_1.logDebug)("[ABsmartly] Created stylesheet: ".concat(this.id));
                }
            }
        }
        return this.styleEl;
    };
    StyleSheetManager.prototype.setRule = function (key, css) {
        this.rules.set(key, css);
        this.render();
        if (this.debug) {
            (0, debug_1.logDebug)("[ABsmartly] Set CSS rule for ".concat(key));
        }
    };
    StyleSheetManager.prototype.deleteRule = function (key) {
        if (this.rules.delete(key)) {
            this.render();
            if (this.debug) {
                (0, debug_1.logDebug)("[ABsmartly] Deleted CSS rule for ".concat(key));
            }
        }
    };
    StyleSheetManager.prototype.hasRule = function (key) {
        return this.rules.has(key);
    };
    StyleSheetManager.prototype.clear = function () {
        var hadRules = this.rules.size > 0;
        this.rules.clear();
        if (hadRules) {
            this.render();
            if (this.debug) {
                (0, debug_1.logDebug)("[ABsmartly] Cleared all CSS rules from ".concat(this.id));
            }
        }
    };
    StyleSheetManager.prototype.destroy = function () {
        this.clear();
        if (this.styleEl && document.head.contains(this.styleEl)) {
            this.styleEl.remove();
            this.styleEl = null;
            if (this.debug) {
                (0, debug_1.logDebug)("[ABsmartly] Destroyed stylesheet: ".concat(this.id));
            }
        }
    };
    StyleSheetManager.prototype.render = function () {
        var el = this.ensure();
        var cssText = Array.from(this.rules.values()).join('\n\n');
        el.textContent = cssText;
    };
    StyleSheetManager.prototype.getRulesCount = function () {
        return this.rules.size;
    };
    StyleSheetManager.prototype.getCssText = function () {
        return Array.from(this.rules.values()).join('\n\n');
    };
    return StyleSheetManager;
}());
exports.StyleSheetManager = StyleSheetManager;


/***/ }),

/***/ "./src/entries/dom-with-overrides-full.ts":
/*!************************************************!*\
  !*** ./src/entries/dom-with-overrides-full.ts ***!
  \************************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WebVitalsPlugin = exports.CookiePlugin = exports.BrowserCookieAdapter = exports.OverridesPlugin = exports.OverridesPluginFull = exports.DOMChangesPlugin = exports.DOMChangesPluginLite = void 0;
/**
 * Entry point for DOM Changes Plugin + Overrides Full
 * Full bundle - DOM manipulation + full override capabilities with API support
 */
var DOMChangesPluginLite_1 = __webpack_require__(/*! ../core/DOMChangesPluginLite */ "./src/core/DOMChangesPluginLite.ts");
Object.defineProperty(exports, "DOMChangesPluginLite", ({ enumerable: true, get: function () { return DOMChangesPluginLite_1.DOMChangesPluginLite; } }));
Object.defineProperty(exports, "DOMChangesPlugin", ({ enumerable: true, get: function () { return DOMChangesPluginLite_1.DOMChangesPluginLite; } }));
var OverridesPluginFull_1 = __webpack_require__(/*! ../overrides/OverridesPluginFull */ "./src/overrides/OverridesPluginFull.ts");
Object.defineProperty(exports, "OverridesPluginFull", ({ enumerable: true, get: function () { return OverridesPluginFull_1.OverridesPluginFull; } }));
Object.defineProperty(exports, "OverridesPlugin", ({ enumerable: true, get: function () { return OverridesPluginFull_1.OverridesPluginFull; } }));
var BrowserCookieAdapter_1 = __webpack_require__(/*! ../overrides/BrowserCookieAdapter */ "./src/overrides/BrowserCookieAdapter.ts");
Object.defineProperty(exports, "BrowserCookieAdapter", ({ enumerable: true, get: function () { return BrowserCookieAdapter_1.BrowserCookieAdapter; } }));
var CookiePlugin_1 = __webpack_require__(/*! ../cookies/CookiePlugin */ "./src/cookies/CookiePlugin.ts");
Object.defineProperty(exports, "CookiePlugin", ({ enumerable: true, get: function () { return CookiePlugin_1.CookiePlugin; } }));
var WebVitalsPlugin_1 = __webpack_require__(/*! ../vitals/WebVitalsPlugin */ "./src/vitals/WebVitalsPlugin.ts");
Object.defineProperty(exports, "WebVitalsPlugin", ({ enumerable: true, get: function () { return WebVitalsPlugin_1.WebVitalsPlugin; } }));
// Re-export types
__exportStar(__webpack_require__(/*! ../types */ "./src/types/index.ts"), exports);
__exportStar(__webpack_require__(/*! ../overrides/types */ "./src/overrides/types.ts"), exports);
// Default export for UMD builds
exports["default"] = DOMChangesPluginLite_1.DOMChangesPluginLite;


/***/ }),

/***/ "./src/overrides/BrowserCookieAdapter.ts":
/*!***********************************************!*\
  !*** ./src/overrides/BrowserCookieAdapter.ts ***!
  \***********************************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BrowserCookieAdapter = void 0;
var BrowserCookieAdapter = /** @class */ (function () {
    function BrowserCookieAdapter() {
    }
    BrowserCookieAdapter.prototype.get = function (name) {
        var e_1, _a;
        var nameEQ = name + '=';
        var cookies = document.cookie.split(';');
        try {
            for (var cookies_1 = __values(cookies), cookies_1_1 = cookies_1.next(); !cookies_1_1.done; cookies_1_1 = cookies_1.next()) {
                var cookie = cookies_1_1.value;
                cookie = cookie.trim();
                if (cookie.indexOf(nameEQ) === 0) {
                    return decodeURIComponent(cookie.substring(nameEQ.length));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (cookies_1_1 && !cookies_1_1.done && (_a = cookies_1.return)) _a.call(cookies_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return null;
    };
    BrowserCookieAdapter.prototype.set = function (name, value, options) {
        var cookieString = "".concat(name, "=").concat(encodeURIComponent(value));
        if (options) {
            if (options.path) {
                cookieString += "; path=".concat(options.path);
            }
            if (options.domain) {
                cookieString += "; domain=".concat(options.domain);
            }
            if (options.maxAge !== undefined) {
                cookieString += "; max-age=".concat(options.maxAge);
            }
            if (options.secure) {
                cookieString += '; secure';
            }
            if (options.sameSite) {
                cookieString += "; samesite=".concat(options.sameSite);
            }
            // Note: httpOnly cannot be set from browser JavaScript
        }
        document.cookie = cookieString;
    };
    BrowserCookieAdapter.prototype.delete = function (name, options) {
        this.set(name, '', __assign(__assign({}, options), { maxAge: 0 }));
    };
    return BrowserCookieAdapter;
}());
exports.BrowserCookieAdapter = BrowserCookieAdapter;


/***/ }),

/***/ "./src/overrides/OverridesPlugin.ts":
/*!******************************************!*\
  !*** ./src/overrides/OverridesPlugin.ts ***!
  \******************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Full-featured version of OverridesPlugin
 * Extends OverridesPluginLite with API fetching for non-running experiments
 * Supports server-side rendering, cookie adapters, and dev environments
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OverridesPlugin = void 0;
var OverridesPluginLite_1 = __webpack_require__(/*! ./OverridesPluginLite */ "./src/overrides/OverridesPluginLite.ts");
var debug_1 = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
var OverridesPlugin = /** @class */ (function (_super) {
    __extends(OverridesPlugin, _super);
    function OverridesPlugin(config) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
        // Pass a simplified config to the base class
        var _this = _super.call(this, {
            context: config.context,
            cookieName: config.cookieName,
            useQueryString: (_a = config.useQueryString) !== null && _a !== void 0 ? _a : typeof window !== 'undefined',
            queryPrefix: (_b = config.queryPrefix) !== null && _b !== void 0 ? _b : 'exp_',
            persistQueryToCookie: (_c = config.persistQueryToCookie) !== null && _c !== void 0 ? _c : false,
            debug: (_d = config.debug) !== null && _d !== void 0 ? _d : false,
        }) || this;
        _this.onExperimentsAddedCallbacks = [];
        if (!config.context) {
            throw new Error('[OverridesPlugin] Context is required');
        }
        // Detect environment
        _this.isServerSide = typeof window === 'undefined';
        // Get SDK endpoint from context if not provided
        var sdkEndpoint = config.sdkEndpoint;
        if (!sdkEndpoint) {
            var contextInternal = config.context;
            if (contextInternal._endpoint) {
                sdkEndpoint = contextInternal._endpoint;
            }
            else if ((_e = contextInternal._config) === null || _e === void 0 ? void 0 : _e.endpoint) {
                sdkEndpoint = contextInternal._config.endpoint;
            }
            else if ((_f = contextInternal._dataProvider) === null || _f === void 0 ? void 0 : _f._endpoint) {
                sdkEndpoint = contextInternal._dataProvider._endpoint;
            }
            else if ((_g = contextInternal._options) === null || _g === void 0 ? void 0 : _g.endpoint) {
                sdkEndpoint = contextInternal._options.endpoint.replace('/v1', '');
            }
        }
        // For the full plugin, we should have an endpoint available
        if (!sdkEndpoint && !config.absmartlyEndpoint) {
            // Try one more time to get from context
            var contextInternal = config.context;
            if (!contextInternal._endpoint &&
                !((_h = contextInternal._config) === null || _h === void 0 ? void 0 : _h.endpoint) &&
                !((_j = contextInternal._dataProvider) === null || _j === void 0 ? void 0 : _j._endpoint) &&
                !((_k = contextInternal._options) === null || _k === void 0 ? void 0 : _k.endpoint)) {
                throw new Error('[OverridesPlugin] SDK endpoint must be provided if not available from context');
            }
        }
        // Setup full configuration
        _this.fullConfig = {
            context: config.context,
            cookieName: config.cookieName,
            cookieAdapter: config.cookieAdapter,
            cookieOptions: (_l = config.cookieOptions) !== null && _l !== void 0 ? _l : { path: '/' },
            useQueryString: (_m = config.useQueryString) !== null && _m !== void 0 ? _m : !_this.isServerSide,
            queryPrefix: (_o = config.queryPrefix) !== null && _o !== void 0 ? _o : 'exp_',
            envParam: (_p = config.envParam) !== null && _p !== void 0 ? _p : 'env',
            persistQueryToCookie: (_q = config.persistQueryToCookie) !== null && _q !== void 0 ? _q : false,
            url: config.url,
            absmartlyEndpoint: (_r = config.absmartlyEndpoint) !== null && _r !== void 0 ? _r : '',
            sdkEndpoint: sdkEndpoint || '',
            domChangesFieldName: (_s = config.domChangesFieldName) !== null && _s !== void 0 ? _s : '__dom_changes',
            sdkApiKey: (_t = config.sdkApiKey) !== null && _t !== void 0 ? _t : '',
            application: (_u = config.application) !== null && _u !== void 0 ? _u : '',
            environment: (_v = config.environment) !== null && _v !== void 0 ? _v : '',
            debug: (_w = config.debug) !== null && _w !== void 0 ? _w : false,
        };
        if (_this.fullConfig.debug) {
            (0, debug_1.logDebug)('[OverridesPlugin] Initialized with config:', {
                isServerSide: _this.isServerSide,
                cookieName: _this.fullConfig.cookieName,
                useQueryString: _this.fullConfig.useQueryString,
                queryPrefix: _this.fullConfig.queryPrefix,
                envParam: _this.fullConfig.envParam,
                persistQueryToCookie: _this.fullConfig.persistQueryToCookie,
                sdkEndpoint: _this.fullConfig.sdkEndpoint,
                absmartlyEndpoint: _this.fullConfig.absmartlyEndpoint,
            });
        }
        return _this;
    }
    OverridesPlugin.prototype.ready = function () {
        return __awaiter(this, void 0, void 0, function () {
            var overridesData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Check if already initialized (use base class property)
                        if (this.initialized) {
                            if (this.fullConfig.debug) {
                                (0, debug_1.logDebug)('[OverridesPlugin] Already initialized, skipping re-initialization');
                            }
                            return [2 /*return*/];
                        }
                        // Mark as initialized immediately to prevent concurrent calls
                        this.initialized = true;
                        // Register with context
                        this.registerWithContext();
                        overridesData = this.getOverrides();
                        if (Object.keys(overridesData.overrides).length === 0) {
                            if (this.fullConfig.debug) {
                                (0, debug_1.logDebug)('[OverridesPlugin] No overrides found');
                            }
                            return [2 /*return*/];
                        }
                        // Apply overrides with API fetching
                        return [4 /*yield*/, this.applyOverridesWithFetching(overridesData.overrides, overridesData.devEnv)];
                    case 1:
                        // Apply overrides with API fetching
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Alias for backwards compatibility
    OverridesPlugin.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.ready()];
            });
        });
    };
    OverridesPlugin.prototype.getOverrides = function () {
        var overridesData = { overrides: {}, devEnv: null };
        // First get cookie overrides if enabled
        if (this.fullConfig.cookieName) {
            var cookieData = this.getEnhancedCookieOverrides();
            overridesData.overrides = __assign({}, cookieData.overrides);
            overridesData.devEnv = cookieData.devEnv;
        }
        // Then check query string and merge/override if enabled
        if (this.fullConfig.useQueryString) {
            var queryData = this.getEnhancedQueryStringOverrides();
            // Query string overrides take precedence over cookies
            if (Object.keys(queryData.overrides).length > 0) {
                // Merge overrides, with query string taking precedence
                overridesData.overrides = __assign(__assign({}, overridesData.overrides), queryData.overrides);
                // Query string env takes precedence if specified
                if (queryData.devEnv !== null) {
                    overridesData.devEnv = queryData.devEnv;
                }
                // Persist merged overrides to cookie if requested
                if (this.fullConfig.persistQueryToCookie && this.fullConfig.cookieName) {
                    this.persistEnhancedOverridesToCookie(overridesData);
                }
            }
        }
        return overridesData;
    };
    OverridesPlugin.prototype.getEnhancedQueryStringOverrides = function () {
        var e_1, _a;
        try {
            var urlParams = void 0;
            if (this.isServerSide) {
                // Server-side: use provided URL
                if (!this.fullConfig.url) {
                    return { overrides: {}, devEnv: null };
                }
                var url = typeof this.fullConfig.url === 'string'
                    ? new URL(this.fullConfig.url)
                    : this.fullConfig.url;
                urlParams = new URLSearchParams(url.search);
            }
            else {
                // Client-side: use window.location
                urlParams = new URLSearchParams(window.location.search);
            }
            var overrides = {};
            var devEnv = null;
            // Get environment from query param
            if (this.fullConfig.envParam) {
                var env = urlParams.get(this.fullConfig.envParam);
                if (env) {
                    devEnv = env;
                }
            }
            // Check for experiment parameters with prefix
            var prefix = this.fullConfig.queryPrefix;
            try {
                for (var _b = __values(urlParams.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var _d = __read(_c.value, 2), key = _d[0], value = _d[1];
                    if (key.startsWith(prefix)) {
                        var experimentName = key.substring(prefix.length);
                        if (experimentName) {
                            var parts = value.split(',');
                            var variant = parseInt(parts[0], 10);
                            if (!isNaN(variant)) {
                                if (parts.length === 1) {
                                    overrides[experimentName] = variant;
                                }
                                else {
                                    overrides[experimentName] = {
                                        variant: variant,
                                        env: parts[1] ? parseInt(parts[1], 10) : undefined,
                                        id: parts[2] ? parseInt(parts[2], 10) : undefined,
                                    };
                                }
                            }
                        }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            if (this.fullConfig.debug && Object.keys(overrides).length > 0) {
                (0, debug_1.logDebug)('[OverridesPlugin] Query string overrides:', overrides, 'env:', devEnv);
            }
            return { overrides: overrides, devEnv: devEnv };
        }
        catch (error) {
            (0, debug_1.logDebug)('[OverridesPlugin] Error parsing query string:', error);
            return { overrides: {}, devEnv: null };
        }
    };
    OverridesPlugin.prototype.getEnhancedCookieOverrides = function () {
        var e_2, _a;
        if (!this.fullConfig.cookieName) {
            return { overrides: {}, devEnv: null };
        }
        var cookieValue = null;
        if (this.fullConfig.cookieAdapter) {
            // Server-side or custom adapter
            cookieValue = this.fullConfig.cookieAdapter.get(this.fullConfig.cookieName);
        }
        else if (typeof document !== 'undefined') {
            // Client-side: read directly from document.cookie
            var nameEQ = this.fullConfig.cookieName + '=';
            var cookies = document.cookie.split(';');
            try {
                for (var cookies_1 = __values(cookies), cookies_1_1 = cookies_1.next(); !cookies_1_1.done; cookies_1_1 = cookies_1.next()) {
                    var cookie = cookies_1_1.value;
                    cookie = cookie.trim();
                    if (cookie.indexOf(nameEQ) === 0) {
                        cookieValue = decodeURIComponent(cookie.substring(nameEQ.length));
                        break;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (cookies_1_1 && !cookies_1_1.done && (_a = cookies_1.return)) _a.call(cookies_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        if (this.fullConfig.debug && cookieValue) {
            (0, debug_1.logDebug)('[OverridesPlugin] Raw cookie value:', cookieValue);
        }
        var parsed = this.parseEnhancedCookieValue(cookieValue);
        if (this.fullConfig.debug && Object.keys(parsed.overrides).length > 0) {
            (0, debug_1.logDebug)('[OverridesPlugin] Parsed cookie overrides:', parsed);
        }
        return parsed;
    };
    OverridesPlugin.prototype.parseEnhancedCookieValue = function (value) {
        var e_3, _a;
        if (!value)
            return { overrides: {}, devEnv: null };
        try {
            var devEnv = null;
            var experimentsStr = value;
            // Check if dev environment is included
            if (value.startsWith('devEnv=')) {
                var parts = value.split('|');
                devEnv = decodeURIComponent(parts[0].substring(7));
                experimentsStr = parts[1] || '';
            }
            var overrides = {};
            if (experimentsStr) {
                var experiments = experimentsStr.split(',');
                try {
                    for (var experiments_1 = __values(experiments), experiments_1_1 = experiments_1.next(); !experiments_1_1.done; experiments_1_1 = experiments_1.next()) {
                        var exp = experiments_1_1.value;
                        var _b = __read(exp.split(':'), 2), name_1 = _b[0], values = _b[1];
                        if (!name_1 || !values)
                            continue;
                        var decodedName = decodeURIComponent(name_1);
                        var parts = values.split('.');
                        var variant = parseInt(parts[0], 10);
                        // Skip if variant is not a valid number
                        if (isNaN(variant))
                            continue;
                        if (parts.length === 1) {
                            overrides[decodedName] = variant;
                        }
                        else {
                            overrides[decodedName] = {
                                variant: variant,
                                env: parts[1] ? parseInt(parts[1], 10) : undefined,
                                id: parts[2] ? parseInt(parts[2], 10) : undefined,
                            };
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (experiments_1_1 && !experiments_1_1.done && (_a = experiments_1.return)) _a.call(experiments_1);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
            return { overrides: overrides, devEnv: devEnv };
        }
        catch (error) {
            (0, debug_1.logDebug)('[OverridesPlugin] Error parsing overrides:', error);
            return { overrides: {}, devEnv: null };
        }
    };
    OverridesPlugin.prototype.persistEnhancedOverridesToCookie = function (data) {
        var e_4, _a;
        if (!this.fullConfig.cookieName)
            return;
        var parts = [];
        // Add dev environment if present
        if (data.devEnv) {
            parts.push("devEnv=".concat(encodeURIComponent(data.devEnv)));
        }
        // Add experiments
        var expParts = [];
        try {
            for (var _b = __values(Object.entries(data.overrides)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), name_2 = _d[0], value = _d[1];
                var encodedName = encodeURIComponent(name_2);
                if (typeof value === 'number') {
                    expParts.push("".concat(encodedName, ":").concat(value));
                }
                else {
                    var v = value;
                    var str = "".concat(encodedName, ":").concat(v.variant);
                    if (v.env !== undefined)
                        str += ".".concat(v.env);
                    if (v.id !== undefined)
                        str += ".".concat(v.id);
                    expParts.push(str);
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
        var cookieValue = parts.length > 0 ? "".concat(parts.join('|'), "|").concat(expParts.join(',')) : expParts.join(',');
        if (this.fullConfig.cookieAdapter) {
            // Server-side or custom adapter
            var options = __assign({}, this.fullConfig.cookieOptions);
            // Server-side defaults
            if (this.isServerSide) {
                if (options.httpOnly === undefined) {
                    options.httpOnly = true;
                }
                if (options.secure === undefined) {
                    options.secure = true;
                }
                if (options.sameSite === undefined) {
                    options.sameSite = 'lax';
                }
            }
            this.fullConfig.cookieAdapter.set(this.fullConfig.cookieName, cookieValue, options);
        }
        else if (typeof document !== 'undefined') {
            // Client-side: write directly to document.cookie
            var options = this.fullConfig.cookieOptions || {};
            var cookieString = "".concat(this.fullConfig.cookieName, "=").concat(encodeURIComponent(cookieValue));
            if (options.path)
                cookieString += ";path=".concat(options.path);
            if (options.maxAge)
                cookieString += ";max-age=".concat(options.maxAge);
            var optionsWithExpires = options;
            if (optionsWithExpires.expires) {
                var expiresDate = optionsWithExpires.expires instanceof Date
                    ? optionsWithExpires.expires.toUTCString()
                    : optionsWithExpires.expires;
                cookieString += ";expires=".concat(expiresDate);
            }
            if (options.domain)
                cookieString += ";domain=".concat(options.domain);
            if (options.secure)
                cookieString += ';secure';
            if (options.sameSite)
                cookieString += ";samesite=".concat(options.sameSite);
            document.cookie = cookieString;
        }
        if (this.fullConfig.debug) {
            (0, debug_1.logDebug)('[OverridesPlugin] Persisted to cookie:', cookieValue);
        }
    };
    OverridesPlugin.prototype.applyOverridesWithFetching = function (overrides, devEnv) {
        return __awaiter(this, void 0, void 0, function () {
            var devExperiments, apiExperimentIds, _a, _b, _c, name_3, value, override, effectiveDevEnv, _d, _e, _f, experimentName, value, variant;
            var e_5, _g, e_6, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        // Log all overrides at initialization
                        (0, debug_1.logDebug)('[OverridesPlugin] Initializing with overrides:', overrides);
                        (0, debug_1.logDebug)('[OverridesPlugin] Dev environment:', devEnv);
                        devExperiments = [];
                        apiExperimentIds = new Set();
                        try {
                            // Categorize experiments
                            for (_a = __values(Object.entries(overrides)), _b = _a.next(); !_b.done; _b = _a.next()) {
                                _c = __read(_b.value, 2), name_3 = _c[0], value = _c[1];
                                override = typeof value === 'number' ? { variant: value } : value;
                                if (override.env === 1) {
                                    // Development environment experiment
                                    (0, debug_1.logDebug)("[OverridesPlugin] ".concat(name_3, " categorized as DEV experiment (env=1)"));
                                    devExperiments.push([name_3, override]);
                                }
                                else if (override.env === 2 && override.id) {
                                    // Draft experiment with ID
                                    (0, debug_1.logDebug)("[OverridesPlugin] ".concat(name_3, " categorized as DRAFT experiment (env=2, id=").concat(override.id, ")"));
                                    apiExperimentIds.add(override.id);
                                }
                                else {
                                    // Running experiment (env=0 or undefined)
                                    (0, debug_1.logDebug)("[OverridesPlugin] ".concat(name_3, " categorized as RUNNING experiment (env=").concat(override.env || 0, ")"));
                                }
                            }
                        }
                        catch (e_5_1) { e_5 = { error: e_5_1 }; }
                        finally {
                            try {
                                if (_b && !_b.done && (_g = _a.return)) _g.call(_a);
                            }
                            finally { if (e_5) throw e_5.error; }
                        }
                        // Log summary
                        (0, debug_1.logDebug)('[OverridesPlugin] Categorization summary:', {
                            total_overrides: Object.keys(overrides).length,
                            dev_experiments: devExperiments.length,
                            draft_experiments: apiExperimentIds.size,
                            running_experiments: Object.keys(overrides).length - devExperiments.length - apiExperimentIds.size,
                            dev_environment: devEnv,
                        });
                        if (!(apiExperimentIds.size > 0)) return [3 /*break*/, 2];
                        (0, debug_1.logDebug)("[OverridesPlugin] Will fetch ".concat(apiExperimentIds.size, " DRAFT experiments from API"));
                        return [4 /*yield*/, this.fetchFromAPI(Array.from(apiExperimentIds))];
                    case 1:
                        _j.sent();
                        _j.label = 2;
                    case 2:
                        effectiveDevEnv = devEnv || this.fullConfig.environment || null;
                        if (!(devExperiments.length > 0 && effectiveDevEnv)) return [3 /*break*/, 4];
                        (0, debug_1.logDebug)("[OverridesPlugin] Will fetch ".concat(devExperiments.length, " DEV experiments for environment: ").concat(effectiveDevEnv));
                        return [4 /*yield*/, this.fetchFromDevSDK(devExperiments, effectiveDevEnv)];
                    case 3:
                        _j.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        if (devExperiments.length > 0) {
                            (0, debug_1.logDebug)("[OverridesPlugin] Have ".concat(devExperiments.length, " DEV experiments but NO devEnv specified - NOT fetching"));
                        }
                        _j.label = 5;
                    case 5:
                        try {
                            // Apply all overrides to context
                            for (_d = __values(Object.entries(overrides)), _e = _d.next(); !_e.done; _e = _d.next()) {
                                _f = __read(_e.value, 2), experimentName = _f[0], value = _f[1];
                                variant = typeof value === 'number' ? value : value.variant;
                                this.fullConfig.context.override(experimentName, variant);
                                if (this.fullConfig.debug) {
                                    (0, debug_1.logDebug)("[OverridesPlugin] Override: ".concat(experimentName, " -> variant ").concat(variant));
                                }
                            }
                        }
                        catch (e_6_1) { e_6 = { error: e_6_1 }; }
                        finally {
                            try {
                                if (_e && !_e.done && (_h = _d.return)) _h.call(_d);
                            }
                            finally { if (e_6) throw e_6.error; }
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    OverridesPlugin.prototype.fetchFromAPI = function (experimentIds) {
        return __awaiter(this, void 0, void 0, function () {
            var apiEndpoint, apiUrl, headers, response, data, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (experimentIds.length === 0) {
                            if (this.fullConfig.debug) {
                                (0, debug_1.logDebug)('[OverridesPlugin] No experiment IDs to fetch from API');
                            }
                            return [2 /*return*/];
                        }
                        apiEndpoint = this.fullConfig.absmartlyEndpoint;
                        if (!apiEndpoint) {
                            // Default: convert SDK endpoint to API endpoint
                            apiEndpoint = this.fullConfig.sdkEndpoint.replace('.absmartly.io', '.absmartly.com');
                        }
                        // Remove trailing /v1 if it exists to avoid double /v1/v1
                        if (apiEndpoint.endsWith('/v1')) {
                            apiEndpoint = apiEndpoint.slice(0, -3);
                        }
                        // Ensure https protocol
                        if (!apiEndpoint.startsWith('http')) {
                            apiEndpoint = "https://".concat(apiEndpoint);
                        }
                        apiUrl = "".concat(apiEndpoint, "/v1/experiments?ids=").concat(experimentIds.join(','));
                        if (this.fullConfig.debug) {
                            (0, debug_1.logDebug)('[OverridesPlugin] Fetching non-running experiments from API:', apiUrl);
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        headers = {
                            'Content-Type': 'application/json',
                        };
                        if (this.fullConfig.sdkApiKey) {
                            headers['Authorization'] = "ApiKey ".concat(this.fullConfig.sdkApiKey);
                        }
                        return [4 /*yield*/, fetch(apiUrl, {
                                method: 'GET',
                                credentials: 'include',
                                headers: headers,
                                mode: 'cors',
                            })];
                    case 2:
                        response = _a.sent();
                        (0, debug_1.logDebug)('[OverridesPlugin] API Response status:', response.status, response.statusText);
                        if (!response.ok) {
                            (0, debug_1.logDebug)("[OverridesPlugin] API request failed with status ".concat(response.status));
                            if (response.status === 401) {
                                (0, debug_1.logDebug)('[OverridesPlugin] Check if you need to log in to the ABsmartly console first');
                            }
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _a.sent();
                        if (data.experiments) {
                            // Inject experiments into context data
                            this.injectExperimentsIntoContext(data.experiments);
                            // Notify listeners
                            this.notifyExperimentsAdded();
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        (0, debug_1.logDebug)('[OverridesPlugin] Failed to fetch experiments from API:', error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    OverridesPlugin.prototype.fetchFromDevSDK = function (_experiments, devEnv) {
        return __awaiter(this, void 0, void 0, function () {
            var sdkEndpoint, devSdkUrl, headers, response, data, experimentsArray, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sdkEndpoint = this.fullConfig.sdkEndpoint;
                        // Ensure https protocol
                        if (!sdkEndpoint.startsWith('http')) {
                            sdkEndpoint = "https://".concat(sdkEndpoint);
                        }
                        // Normalize: strip trailing /v1 if present to avoid /v1/v1
                        if (sdkEndpoint.endsWith('/v1')) {
                            sdkEndpoint = sdkEndpoint.slice(0, -3);
                        }
                        devSdkUrl = "".concat(sdkEndpoint, "/v1/context?environment=").concat(encodeURIComponent(devEnv));
                        if (this.fullConfig.application) {
                            devSdkUrl += "&application=".concat(encodeURIComponent(this.fullConfig.application));
                        }
                        if (this.fullConfig.debug) {
                            (0, debug_1.logDebug)('[OverridesPlugin] Fetching development experiments from SDK:', devSdkUrl);
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        headers = {};
                        if (this.fullConfig.sdkApiKey) {
                            headers['Authorization'] = "ApiKey ".concat(this.fullConfig.sdkApiKey);
                        }
                        return [4 /*yield*/, fetch(devSdkUrl, {
                                method: 'GET',
                                headers: headers,
                            })];
                    case 2:
                        response = _a.sent();
                        (0, debug_1.logDebug)('[OverridesPlugin] DEV Response status:', response.status, response.statusText);
                        if (!response.ok) {
                            (0, debug_1.logDebug)("[OverridesPlugin] DEV SDK request failed with status ".concat(response.status));
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _a.sent();
                        if (data.experiments) {
                            experimentsArray = Object.entries(data.experiments).map(function (_a) {
                                var _b = __read(_a, 2), name = _b[0], exp = _b[1];
                                return (__assign(__assign({}, exp), { name: name }));
                            });
                            this.injectExperimentsIntoContext(experimentsArray);
                            // Notify listeners
                            this.notifyExperimentsAdded();
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        (0, debug_1.logDebug)('[OverridesPlugin] Failed to fetch experiments from dev SDK:', error_2);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    OverridesPlugin.prototype.injectExperimentsIntoContext = function (experiments) {
        var e_7, _a, _b;
        var _c, _d;
        // Get original context data
        var originalData = this.fullConfig.context.data.bind(this.fullConfig.context);
        // Create a map of experiment names to new experiment data
        var newExperimentsMap = new Map();
        try {
            for (var experiments_2 = __values(experiments), experiments_2_1 = experiments_2.next(); !experiments_2_1.done; experiments_2_1 = experiments_2.next()) {
                var experiment = experiments_2_1.value;
                // Transform API experiment format to context format
                var contextExperiment = {
                    id: experiment.id,
                    name: experiment.name,
                    unitType: ((_c = experiment.unit_type) === null || _c === void 0 ? void 0 : _c.name) || 'user_id',
                    iteration: experiment.iteration || 1,
                    seedHi: 0,
                    seedLo: 0,
                    split: experiment.split || [],
                    trafficSeedHi: 0,
                    trafficSeedLo: 0,
                    trafficSplit: [0, 1],
                    fullOnVariant: 0,
                    applications: ((_d = experiment.applications) === null || _d === void 0 ? void 0 : _d.map(function (app) {
                        var _a;
                        return ({
                            name: ((_a = app.application) === null || _a === void 0 ? void 0 : _a.name) || app.name,
                        });
                    })) || [],
                    variants: [],
                    audience: experiment.audience || '',
                    audienceStrict: experiment.audience_strict || false,
                };
                // Process variants
                if (experiment.variants && Array.isArray(experiment.variants)) {
                    for (var i = 0; i < experiment.variants.length; i++) {
                        var variant = experiment.variants[i];
                        var variantData = {
                            name: variant.name || "Variant ".concat(i),
                            config: typeof variant.config === 'string'
                                ? variant.config
                                : JSON.stringify(variant.config || {}),
                        };
                        // Check if variant already has variables (from dev SDK)
                        if (variant.variables) {
                            variantData.variables = variant.variables;
                        }
                        // Otherwise try to parse from config (from API)
                        else if (variant.config) {
                            try {
                                var config = typeof variant.config === 'string' ? JSON.parse(variant.config) : variant.config;
                                var domChangesField = this.fullConfig.domChangesFieldName;
                                if (config[domChangesField]) {
                                    // Store in variables format that VariantExtractor expects
                                    variantData.variables = (_b = {},
                                        _b[domChangesField] = config[domChangesField],
                                        _b);
                                    (0, debug_1.logDebug)("[OverridesPlugin] Variant ".concat(i, " has DOM changes field '").concat(domChangesField, "'"));
                                }
                            }
                            catch (e) {
                                (0, debug_1.logDebug)("[OverridesPlugin] Failed to parse variant config:", e);
                            }
                        }
                        contextExperiment.variants[i] = variantData;
                    }
                }
                newExperimentsMap.set(experiment.name, contextExperiment);
            }
        }
        catch (e_7_1) { e_7 = { error: e_7_1 }; }
        finally {
            try {
                if (experiments_2_1 && !experiments_2_1.done && (_a = experiments_2.return)) _a.call(experiments_2);
            }
            finally { if (e_7) throw e_7.error; }
        }
        // Override the context.data() method to include our experiments
        this.fullConfig.context.data = function () {
            var e_8, _a;
            var data = originalData();
            if (!data)
                return data;
            // Merge experiments
            var existingExperiments = data.experiments || [];
            var existingNames = new Set(existingExperiments.map(function (exp) { return exp.name; }));
            var _loop_1 = function (name_4, experiment) {
                if (!existingNames.has(name_4)) {
                    existingExperiments.push(experiment);
                }
                else {
                    // Replace existing experiment with fetched one
                    var index = existingExperiments.findIndex(function (exp) { return exp.name === name_4; });
                    if (index >= 0) {
                        existingExperiments[index] = experiment;
                    }
                }
            };
            try {
                // Add new experiments that don't exist
                for (var newExperimentsMap_1 = __values(newExperimentsMap), newExperimentsMap_1_1 = newExperimentsMap_1.next(); !newExperimentsMap_1_1.done; newExperimentsMap_1_1 = newExperimentsMap_1.next()) {
                    var _b = __read(newExperimentsMap_1_1.value, 2), name_4 = _b[0], experiment = _b[1];
                    _loop_1(name_4, experiment);
                }
            }
            catch (e_8_1) { e_8 = { error: e_8_1 }; }
            finally {
                try {
                    if (newExperimentsMap_1_1 && !newExperimentsMap_1_1.done && (_a = newExperimentsMap_1.return)) _a.call(newExperimentsMap_1);
                }
                finally { if (e_8) throw e_8.error; }
            }
            return __assign(__assign({}, data), { experiments: existingExperiments });
        };
        if (this.fullConfig.debug) {
            (0, debug_1.logDebug)("[OverridesPlugin] Injected ".concat(experiments.length, " experiments into context"));
        }
    };
    // Register a callback to be called when experiments are added
    OverridesPlugin.prototype.onExperimentsAdded = function (callback) {
        this.onExperimentsAddedCallbacks.push(callback);
    };
    OverridesPlugin.prototype.notifyExperimentsAdded = function () {
        var e_9, _a;
        if (this.fullConfig.debug) {
            (0, debug_1.logDebug)("[OverridesPlugin] Notifying ".concat(this.onExperimentsAddedCallbacks.length, " listeners about new experiments"));
        }
        try {
            for (var _b = __values(this.onExperimentsAddedCallbacks), _c = _b.next(); !_c.done; _c = _b.next()) {
                var callback = _c.value;
                try {
                    callback();
                }
                catch (error) {
                    (0, debug_1.logDebug)('[OverridesPlugin] Error in experiments added callback:', error);
                }
            }
        }
        catch (e_9_1) { e_9 = { error: e_9_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_9) throw e_9.error; }
        }
    };
    OverridesPlugin.prototype.registerWithContext = function () {
        if (this.fullConfig.context) {
            // Ensure __plugins object exists
            if (!this.fullConfig.context.__plugins) {
                this.fullConfig.context.__plugins = {};
            }
            // Register under standardized __plugins structure
            this.fullConfig.context.__plugins.overridesPlugin = {
                name: 'OverridesPlugin',
                version: '1.0.0',
                initialized: true,
                capabilities: ['cookie-overrides', 'query-overrides', 'api-fetch', 'dev-environments'],
                instance: this,
                timestamp: Date.now(),
            };
            if (this.fullConfig.debug) {
                (0, debug_1.logDebug)('[OverridesPlugin] Registered with context at __plugins.overridesPlugin');
            }
        }
    };
    OverridesPlugin.prototype.unregisterFromContext = function () {
        var _a, _b;
        if ((_b = (_a = this.fullConfig.context) === null || _a === void 0 ? void 0 : _a.__plugins) === null || _b === void 0 ? void 0 : _b.overridesPlugin) {
            delete this.fullConfig.context.__plugins.overridesPlugin;
            if (this.fullConfig.debug) {
                (0, debug_1.logDebug)('[OverridesPlugin] Unregistered from context');
            }
        }
    };
    OverridesPlugin.prototype.destroy = function () {
        _super.prototype.destroy.call(this);
        this.unregisterFromContext();
        this.onExperimentsAddedCallbacks = [];
    };
    return OverridesPlugin;
}(OverridesPluginLite_1.OverridesPluginLite));
exports.OverridesPlugin = OverridesPlugin;


/***/ }),

/***/ "./src/overrides/OverridesPluginFull.ts":
/*!**********************************************!*\
  !*** ./src/overrides/OverridesPluginFull.ts ***!
  \**********************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

/**
 * Full-featured version of OverridesPlugin
 * This is now just an alias for OverridesPlugin to maintain backward compatibility.
 *
 * @deprecated Use OverridesPlugin directly instead
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OverridesPluginFull = void 0;
var OverridesPlugin_1 = __webpack_require__(/*! ./OverridesPlugin */ "./src/overrides/OverridesPlugin.ts");
// Export as OverridesPluginFull for backward compatibility
var OverridesPluginFull = /** @class */ (function (_super) {
    __extends(OverridesPluginFull, _super);
    function OverridesPluginFull() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return OverridesPluginFull;
}(OverridesPlugin_1.OverridesPlugin));
exports.OverridesPluginFull = OverridesPluginFull;


/***/ }),

/***/ "./src/overrides/OverridesPluginLite.ts":
/*!**********************************************!*\
  !*** ./src/overrides/OverridesPluginLite.ts ***!
  \**********************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OverridesPluginLite = void 0;
var debug_1 = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
var plugin_registry_1 = __webpack_require__(/*! ../utils/plugin-registry */ "./src/utils/plugin-registry.ts");
var OverridesPluginLite = /** @class */ (function () {
    function OverridesPluginLite(config) {
        var _a, _b, _c, _d, _e;
        this.initialized = false;
        if (!config.context) {
            throw new Error('[OverridesPluginLite] Context is required');
        }
        this.config = {
            context: config.context,
            cookieName: (_a = config.cookieName) !== null && _a !== void 0 ? _a : 'absmartly_overrides',
            useQueryString: (_b = config.useQueryString) !== null && _b !== void 0 ? _b : true,
            queryPrefix: (_c = config.queryPrefix) !== null && _c !== void 0 ? _c : 'exp_',
            persistQueryToCookie: (_d = config.persistQueryToCookie) !== null && _d !== void 0 ? _d : false,
            debug: (_e = config.debug) !== null && _e !== void 0 ? _e : false,
        };
        if (this.config.debug) {
            (0, debug_1.logDebug)('[OverridesPluginLite] Initialized with config:', {
                cookieName: this.config.cookieName,
                useQueryString: this.config.useQueryString,
                queryPrefix: this.config.queryPrefix,
            });
        }
    }
    OverridesPluginLite.prototype.ready = function () {
        return __awaiter(this, void 0, void 0, function () {
            var overrides, _a, _b, _c, experimentName, value, variant;
            var e_1, _d;
            var _e, _f;
            return __generator(this, function (_g) {
                if (this.initialized) {
                    if (this.config.debug) {
                        (0, debug_1.logDebug)('[OverridesPluginLite] Already initialized');
                    }
                    return [2 /*return*/];
                }
                this.initialized = true;
                // Register with context
                this.registerWithContext();
                this.registerGlobally();
                overrides = {};
                // Try query string first if enabled
                if (this.config.useQueryString && typeof window !== 'undefined') {
                    overrides = this.getQueryStringOverrides();
                    // Persist to cookie if requested and we have overrides
                    if (this.config.persistQueryToCookie &&
                        this.config.cookieName &&
                        Object.keys(overrides).length > 0) {
                        this.persistOverridesToCookie(overrides);
                    }
                }
                // Fall back to cookie if no query string overrides
                if (Object.keys(overrides).length === 0 && this.config.cookieName) {
                    overrides = this.getCookieOverrides();
                }
                if (Object.keys(overrides).length === 0) {
                    if (this.config.debug) {
                        (0, debug_1.logDebug)('[OverridesPluginLite] No overrides found');
                    }
                    return [2 /*return*/];
                }
                try {
                    // Apply overrides to context
                    for (_a = __values(Object.entries(overrides)), _b = _a.next(); !_b.done; _b = _a.next()) {
                        _c = __read(_b.value, 2), experimentName = _c[0], value = _c[1];
                        variant = typeof value === 'number' ? value : value.variant;
                        // Skip if variant is not a valid number
                        if (isNaN(variant)) {
                            if (this.config.debug) {
                                (0, debug_1.logDebug)("[OverridesPluginLite] Skipping invalid variant for ".concat(experimentName, ": ").concat(variant));
                            }
                            continue;
                        }
                        (_f = (_e = this.config.context).override) === null || _f === void 0 ? void 0 : _f.call(_e, experimentName, variant);
                        if (this.config.debug) {
                            (0, debug_1.logDebug)("[OverridesPluginLite] Override: ".concat(experimentName, " -> variant ").concat(variant));
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_b && !_b.done && (_d = _a.return)) _d.call(_a);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                return [2 /*return*/];
            });
        });
    };
    // Alias for backwards compatibility
    OverridesPluginLite.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.ready()];
            });
        });
    };
    OverridesPluginLite.prototype.getQueryStringOverrides = function () {
        var e_2, _a;
        if (typeof window === 'undefined' || !window.location)
            return {};
        var urlParams = new URLSearchParams(window.location.search);
        var overrides = {};
        var prefix = this.config.queryPrefix;
        try {
            // Check for experiment parameters with prefix
            for (var _b = __values(urlParams.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), key = _d[0], value = _d[1];
                if (key.startsWith(prefix)) {
                    var experimentName = key.substring(prefix.length);
                    if (experimentName) {
                        // Parse value as variant[,env][,id]
                        var parts = value.split(',');
                        var variant = parseInt(parts[0], 10);
                        if (!isNaN(variant)) {
                            if (parts.length === 1) {
                                overrides[experimentName] = variant;
                            }
                            else {
                                overrides[experimentName] = {
                                    variant: variant,
                                    env: parts[1] ? parseInt(parts[1], 10) : undefined,
                                    id: parts[2] ? parseInt(parts[2], 10) : undefined,
                                };
                            }
                        }
                    }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        if (this.config.debug && Object.keys(overrides).length > 0) {
            (0, debug_1.logDebug)('[OverridesPluginLite] Query string overrides:', overrides);
        }
        return overrides;
    };
    OverridesPluginLite.prototype.getCookieOverrides = function () {
        var e_3, _a;
        if (typeof document === 'undefined')
            return {};
        var nameEQ = this.config.cookieName + '=';
        var cookies = document.cookie.split(';');
        try {
            for (var cookies_1 = __values(cookies), cookies_1_1 = cookies_1.next(); !cookies_1_1.done; cookies_1_1 = cookies_1.next()) {
                var cookie = cookies_1_1.value;
                cookie = cookie.trim();
                if (cookie.indexOf(nameEQ) === 0) {
                    var value = decodeURIComponent(cookie.substring(nameEQ.length));
                    return this.parseCookieValue(value);
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (cookies_1_1 && !cookies_1_1.done && (_a = cookies_1.return)) _a.call(cookies_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return {};
    };
    OverridesPluginLite.prototype.parseCookieValue = function (value) {
        var e_4, _a;
        if (!value)
            return {};
        var overrides = {};
        // Skip dev environment if present (Lite doesn't handle it)
        var experimentsStr = value;
        if (value.includes('|')) {
            var parts = value.split('|');
            // Take the last part which has the experiments
            experimentsStr = parts[parts.length - 1];
        }
        if (!experimentsStr)
            return {};
        // Parse comma-separated experiments
        var experiments = experimentsStr.split(',');
        try {
            for (var experiments_1 = __values(experiments), experiments_1_1 = experiments_1.next(); !experiments_1_1.done; experiments_1_1 = experiments_1.next()) {
                var exp = experiments_1_1.value;
                var _b = __read(exp.split(':'), 2), name_1 = _b[0], values = _b[1];
                if (!name_1 || !values)
                    continue;
                var decodedName = decodeURIComponent(name_1);
                // Parse dot-separated values (variant.env.id)
                var parts = values.split('.');
                var variant = parseInt(parts[0], 10);
                if (!isNaN(variant)) {
                    if (parts.length === 1) {
                        overrides[decodedName] = variant;
                    }
                    else {
                        overrides[decodedName] = {
                            variant: variant,
                            env: parts[1] ? parseInt(parts[1], 10) : undefined,
                            id: parts[2] ? parseInt(parts[2], 10) : undefined,
                        };
                    }
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (experiments_1_1 && !experiments_1_1.done && (_a = experiments_1.return)) _a.call(experiments_1);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return overrides;
    };
    OverridesPluginLite.prototype.persistOverridesToCookie = function (overrides) {
        var e_5, _a;
        if (!this.config.cookieName || typeof document === 'undefined')
            return;
        var parts = [];
        try {
            for (var _b = __values(Object.entries(overrides)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), name_2 = _d[0], value = _d[1];
                var encodedName = encodeURIComponent(name_2);
                if (typeof value === 'number') {
                    parts.push("".concat(encodedName, ":").concat(value));
                }
                else {
                    var str = "".concat(encodedName, ":").concat(value.variant);
                    if (value.env !== undefined)
                        str += ".".concat(value.env);
                    if (value.id !== undefined)
                        str += ".".concat(value.id);
                    parts.push(str);
                }
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_5) throw e_5.error; }
        }
        var cookieValue = parts.join(',');
        var maxAge = 86400; // 1 day
        document.cookie = "".concat(this.config.cookieName, "=").concat(encodeURIComponent(cookieValue), ";path=/;max-age=").concat(maxAge);
        if (this.config.debug) {
            (0, debug_1.logDebug)('[OverridesPluginLite] Persisted to cookie:', cookieValue);
        }
    };
    OverridesPluginLite.prototype.registerWithContext = function () {
        if (this.config.context) {
            // Ensure __plugins object exists
            if (!this.config.context.__plugins) {
                this.config.context.__plugins = {};
            }
            // Register under standardized __plugins structure
            this.config.context.__plugins.overridesPlugin = {
                name: 'OverridesPluginLite',
                version: '1.0.0',
                initialized: true,
                capabilities: ['cookie-overrides', 'query-overrides'],
                instance: this,
                timestamp: Date.now(),
            };
            if (this.config.debug) {
                (0, debug_1.logDebug)('[OverridesPluginLite] Registered with context at __plugins.overridesPlugin');
            }
        }
    };
    OverridesPluginLite.prototype.unregisterFromContext = function () {
        var _a, _b;
        if ((_b = (_a = this.config.context) === null || _a === void 0 ? void 0 : _a.__plugins) === null || _b === void 0 ? void 0 : _b.overridesPlugin) {
            delete this.config.context.__plugins.overridesPlugin;
            if (this.config.debug) {
                (0, debug_1.logDebug)('[OverridesPluginLite] Unregistered from context');
            }
        }
    };
    OverridesPluginLite.prototype.destroy = function () {
        this.initialized = false;
        this.unregisterFromContext();
        this.unregisterGlobally();
    };
    /**
     * Register plugin in global registry for detection
     */
    OverridesPluginLite.prototype.registerGlobally = function () {
        (0, plugin_registry_1.registerPlugin)('overrides', {
            name: 'OverridesPluginLite',
            version: '1.0.0',
            initialized: true,
            timestamp: Date.now(),
            capabilities: ['cookie-overrides', 'query-overrides'],
            instance: this,
        });
        if (this.config.debug) {
            (0, debug_1.logDebug)('[OverridesPluginLite] Registered in global window.__ABSMARTLY_PLUGINS__');
        }
    };
    /**
     * Unregister plugin from global registry
     */
    OverridesPluginLite.prototype.unregisterGlobally = function () {
        (0, plugin_registry_1.unregisterPlugin)('overrides');
        if (this.config.debug) {
            (0, debug_1.logDebug)('[OverridesPluginLite] Unregistered from global registry');
        }
    };
    return OverridesPluginLite;
}());
exports.OverridesPluginLite = OverridesPluginLite;


/***/ }),

/***/ "./src/overrides/types.ts":
/*!********************************!*\
  !*** ./src/overrides/types.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ }),

/***/ "./src/parsers/VariantExtractor.ts":
/*!*****************************************!*\
  !*** ./src/parsers/VariantExtractor.ts ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VariantExtractor = void 0;
var debug_1 = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
var URLMatcher_1 = __webpack_require__(/*! ../utils/URLMatcher */ "./src/utils/URLMatcher.ts");
var VariantExtractor = /** @class */ (function () {
    function VariantExtractor(context, variableName, debug) {
        if (variableName === void 0) { variableName = '__dom_changes'; }
        if (debug === void 0) { debug = false; }
        this.cachedAllChanges = null;
        this.context = context;
        this.variableName = variableName;
        this.debug = debug;
    }
    // Clear cache when context changes
    VariantExtractor.prototype.clearCache = function () {
        this.cachedAllChanges = null;
    };
    // Extract ALL variants for ALL experiments (efficient single pass)
    VariantExtractor.prototype.extractAllChanges = function () {
        var e_1, _a;
        var _b, _c, _d, _e, _f;
        // Return cached version if available
        if (this.cachedAllChanges) {
            if (this.debug) {
                (0, debug_1.logDebug)('[ABsmartly VariantExtractor] Returning cached changes');
            }
            return this.cachedAllChanges;
        }
        var allChanges = new Map();
        try {
            var contextData = this.context.data();
            // Always log the raw context data structure for debugging
            (0, debug_1.logDebug)('[VariantExtractor DEBUG] Raw context data structure:', {
                hasData: !!contextData,
                contextKeys: contextData ? Object.keys(contextData) : [],
                experimentCount: ((_b = contextData === null || contextData === void 0 ? void 0 : contextData.experiments) === null || _b === void 0 ? void 0 : _b.length) || 0,
                firstExperiment: ((_c = contextData === null || contextData === void 0 ? void 0 : contextData.experiments) === null || _c === void 0 ? void 0 : _c[0])
                    ? {
                        name: contextData.experiments[0].name,
                        // id: contextData.experiments[0].id, // id field might not exist
                        variantCount: ((_d = contextData.experiments[0].variants) === null || _d === void 0 ? void 0 : _d.length) || 0,
                        firstVariantStructure: ((_e = contextData.experiments[0].variants) === null || _e === void 0 ? void 0 : _e[0])
                            ? Object.keys(contextData.experiments[0].variants[0])
                            : [],
                    }
                    : null,
                rawContextData: JSON.stringify(contextData).substring(0, 500) + '...',
            });
            if (this.debug) {
                (0, debug_1.logDebug)('[ABsmartly VariantExtractor] Extracting changes from context:', {
                    hasData: !!contextData,
                    experimentCount: ((_f = contextData === null || contextData === void 0 ? void 0 : contextData.experiments) === null || _f === void 0 ? void 0 : _f.length) || 0,
                });
            }
            // Extract from SDK context data
            if (contextData === null || contextData === void 0 ? void 0 : contextData.experiments) {
                if (this.debug) {
                    (0, debug_1.logDebug)('[ABsmartly VariantExtractor] Available experiments:', contextData.experiments.map(function (exp) {
                        var _a;
                        return ({
                            name: exp.name,
                            // id: exp.id, // id field might not exist
                            hasVariants: !!exp.variants,
                            variantCount: ((_a = exp.variants) === null || _a === void 0 ? void 0 : _a.length) || 0,
                        });
                    }));
                }
                try {
                    for (var _g = __values(contextData.experiments), _h = _g.next(); !_h.done; _h = _g.next()) {
                        var experiment = _h.value;
                        var variantChanges = this.extractAllVariantsForExperiment(experiment);
                        if (variantChanges.size > 0) {
                            allChanges.set(experiment.name, variantChanges);
                            if (this.debug) {
                                (0, debug_1.logDebug)("[ABsmartly VariantExtractor] Experiment '".concat(experiment.name, "' has DOM changes:"), {
                                    variantsWithChanges: Array.from(variantChanges.keys()),
                                    changesByVariant: Array.from(variantChanges.entries()).map(function (_a) {
                                        var _b = __read(_a, 2), v = _b[0], changes = _b[1];
                                        return ({
                                            variant: v,
                                            changeCount: changes.length,
                                            changeTypes: __spreadArray([], __read(new Set(changes.map(function (c) { return c.type; }))), false),
                                        });
                                    }),
                                });
                            }
                        }
                        else if (this.debug) {
                            (0, debug_1.logDebug)("[ABsmartly VariantExtractor] Experiment '".concat(experiment.name, "' has no DOM changes"));
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_h && !_h.done && (_a = _g.return)) _a.call(_g);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            // No need to check window storage - experiments are now injected into context data
        }
        catch (error) {
            (0, debug_1.logDebug)('[ABsmartly] Error extracting DOM changes:', error);
        }
        // Cache the result
        this.cachedAllChanges = allChanges;
        return allChanges;
    };
    // Extract all variants for a single experiment
    VariantExtractor.prototype.extractAllVariantsForExperiment = function (experiment) {
        var _a;
        var variantChanges = new Map();
        (0, debug_1.logDebug)('[DEBUG] Processing experiment:', experiment.name, 'with', ((_a = experiment.variants) === null || _a === void 0 ? void 0 : _a.length) || 0, 'variants');
        if (!experiment.variants) {
            (0, debug_1.logDebug)('[DEBUG] No variants found for experiment:', experiment.name);
            return variantChanges;
        }
        for (var i = 0; i < experiment.variants.length; i++) {
            var variant = experiment.variants[i];
            if (!variant)
                continue;
            var changesData = null;
            // Check variant.config (ABSmartly SDK provides data here as a JSON string)
            if (variant.config) {
                try {
                    // Parse config as JSON if it's a string
                    var parsedConfig = typeof variant.config === 'string' ? JSON.parse(variant.config) : variant.config;
                    (0, debug_1.logDebug)("[VariantExtractor DEBUG] Parsed config for variant ".concat(i, ":"), parsedConfig);
                    // Look for __dom_changes inside the parsed config
                    if (parsedConfig && parsedConfig[this.variableName]) {
                        changesData = parsedConfig[this.variableName];
                        (0, debug_1.logDebug)("[VariantExtractor DEBUG] \u2713 Found DOM changes in config[".concat(this.variableName, "]:"), changesData);
                    }
                    else {
                        (0, debug_1.logDebug)("[VariantExtractor DEBUG] \u2717 No ".concat(this.variableName, " field found in parsed config for variant ").concat(i));
                    }
                }
                catch (e) {
                    (0, debug_1.logDebug)("[VariantExtractor DEBUG] \u2717 Failed to parse variant.config for variant ".concat(i, ":"), e, 'Raw config:', typeof variant.config === 'string' ? variant.config.substring(0, 100) : '');
                }
            }
            else {
                (0, debug_1.logDebug)("[VariantExtractor DEBUG] \u2717 No config field found for variant ".concat(i));
            }
            if (changesData) {
                // Extract changes - handles both legacy array and new wrapped format
                var changes = this.extractChangesFromData(changesData);
                if (changes && changes.length > 0) {
                    variantChanges.set(i, changes);
                }
            }
        }
        return variantChanges;
    };
    /**
     * Extract changes from DOMChangesData (handles both legacy array and new wrapped format)
     */
    VariantExtractor.prototype.extractChangesFromData = function (data) {
        if (!data) {
            return null;
        }
        // If it's a string, try to parse it as JSON first
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            }
            catch (error) {
                (0, debug_1.logDebug)('[ABsmartly] Failed to parse DOM changes JSON:', error);
                return null;
            }
        }
        // Check if it's the new wrapped format (DOMChangesConfig)
        if (data && typeof data === 'object' && !Array.isArray(data) && 'changes' in data) {
            var config = data;
            return this.parseChanges(config.changes);
        }
        // Legacy array format
        return this.parseChanges(data);
    };
    VariantExtractor.prototype.getExperimentChanges = function (experimentName) {
        var allChanges = this.extractAllChanges();
        var experimentVariants = allChanges.get(experimentName);
        if (!experimentVariants || experimentVariants.size === 0) {
            return null;
        }
        var currentVariant = this.context.peek(experimentName);
        if (currentVariant === undefined || currentVariant === null) {
            if (this.debug) {
                (0, debug_1.logDebug)("[ABsmartly] No variant selected for ".concat(experimentName));
            }
            return null;
        }
        return experimentVariants.get(currentVariant) || null;
    };
    VariantExtractor.prototype.parseChanges = function (changesData) {
        var e_2, _a;
        if (!changesData) {
            return null;
        }
        // If it's a string, try to parse it as JSON
        if (typeof changesData === 'string') {
            try {
                changesData = JSON.parse(changesData);
            }
            catch (error) {
                (0, debug_1.logDebug)('[ABsmartly] Failed to parse DOM changes JSON:', error);
                return null;
            }
        }
        // Ensure it's an array
        if (!Array.isArray(changesData)) {
            if (this.debug) {
                (0, debug_1.logDebug)('[ABsmartly] DOM changes data is not an array');
            }
            return null;
        }
        // Validate and filter changes
        var validChanges = [];
        try {
            for (var changesData_1 = __values(changesData), changesData_1_1 = changesData_1.next(); !changesData_1_1.done; changesData_1_1 = changesData_1.next()) {
                var change = changesData_1_1.value;
                if (this.isValidChange(change)) {
                    validChanges.push(change);
                }
                else if (this.debug) {
                    (0, debug_1.logDebug)('[ABsmartly] Invalid DOM change:', change);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (changesData_1_1 && !changesData_1_1.done && (_a = changesData_1.return)) _a.call(changesData_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return validChanges.length > 0 ? validChanges : null;
    };
    VariantExtractor.prototype.isValidChange = function (change) {
        if (!change || typeof change !== 'object') {
            return false;
        }
        var obj = change;
        // Check required fields
        // Note: selector can be empty string for 'create' and 'styleRules' types
        if (obj.selector === undefined || obj.selector === null || !obj.type) {
            return false;
        }
        // Check type is valid
        var validTypes = [
            'text',
            'html',
            'style',
            'class',
            'attribute',
            'javascript',
            'move',
            'create',
            'delete',
            'styleRules',
        ];
        if (!validTypes.includes(obj.type)) {
            return false;
        }
        // Type-specific validation
        switch (obj.type) {
            case 'class':
                if (!obj.add && !obj.remove) {
                    return false;
                }
                if (obj.add && !Array.isArray(obj.add)) {
                    return false;
                }
                if (obj.remove && !Array.isArray(obj.remove)) {
                    return false;
                }
                break;
            case 'move':
                if (!obj.targetSelector) {
                    return false;
                }
                break;
            case 'create':
                if (!obj.element || !obj.targetSelector) {
                    return false;
                }
                break;
            case 'style':
            case 'attribute':
                if (!obj.value || typeof obj.value !== 'object') {
                    return false;
                }
                break;
        }
        return true;
    };
    /**
     * Get all variant changes for an experiment (not just the current variant)
     * This is needed for proper exposure tracking across variants
     */
    VariantExtractor.prototype.getAllVariantChanges = function (experimentName) {
        var allChanges = this.extractAllChanges();
        var experimentVariants = allChanges.get(experimentName);
        if (!experimentVariants) {
            return [];
        }
        // Convert Map to array indexed by variant number
        var maxVariant = Math.max.apply(Math, __spreadArray([], __read(experimentVariants.keys()), false));
        var variantArray = [];
        for (var i = 0; i <= maxVariant; i++) {
            variantArray.push(experimentVariants.get(i) || []);
        }
        return variantArray;
    };
    /**
     * Get the experiment data by name
     * Note: This requires the context to be ready, otherwise it will throw
     */
    VariantExtractor.prototype.getExperiment = function (experimentName) {
        try {
            var contextData = this.context.data();
            if (!contextData || !contextData.experiments) {
                return null;
            }
            return contextData.experiments.find(function (exp) { return exp.name === experimentName; }) || null;
        }
        catch (error) {
            if (this.debug) {
                (0, debug_1.logDebug)("[ABsmartly VariantExtractor] Failed to get experiment '".concat(experimentName, "' - context may not be ready:"), error);
            }
            return null;
        }
    };
    /**
     * Get the raw DOMChangesData for all variants of an experiment (includes URL filters and metadata)
     * This is needed for URL filtering logic
     */
    VariantExtractor.prototype.getAllVariantsData = function (experimentName) {
        var variantsData = new Map();
        try {
            var contextData = this.context.data();
            if (!(contextData === null || contextData === void 0 ? void 0 : contextData.experiments)) {
                return variantsData;
            }
            var experiment = contextData.experiments.find(function (exp) { return exp.name === experimentName; });
            if (!(experiment === null || experiment === void 0 ? void 0 : experiment.variants)) {
                return variantsData;
            }
            for (var i = 0; i < experiment.variants.length; i++) {
                var variant = experiment.variants[i];
                if (!variant)
                    continue;
                var changesData = null;
                // First check variant.variables
                if (variant.variables && variant.variables[this.variableName]) {
                    changesData = variant.variables[this.variableName];
                }
                // Then check variant.config
                else if (variant.config) {
                    try {
                        var config = typeof variant.config === 'string' ? JSON.parse(variant.config) : variant.config;
                        if (config && config[this.variableName]) {
                            changesData = config[this.variableName];
                        }
                    }
                    catch (e) {
                        (0, debug_1.logDebug)('[VariantExtractor] Failed to parse variant.config:', e);
                    }
                }
                if (changesData) {
                    // Parse JSON string if needed
                    if (typeof changesData === 'string') {
                        try {
                            changesData = JSON.parse(changesData);
                        }
                        catch (error) {
                            (0, debug_1.logDebug)('[ABsmartly] Failed to parse DOM changes JSON:', error);
                            continue;
                        }
                    }
                    // Store the raw data (could be array or wrapped format)
                    variantsData.set(i, changesData);
                }
            }
        }
        catch (error) {
            (0, debug_1.logDebug)('[ABsmartly] Error getting all variants data:', error);
        }
        return variantsData;
    };
    /**
     * Check if any variant of an experiment has changes that match the current URL
     * This is critical for SRM prevention - if ANY variant matches URL, ALL variants must be tracked
     */
    VariantExtractor.prototype.anyVariantMatchesURL = function (experimentName, url) {
        var e_3, _a;
        if (url === void 0) { url = window.location.href; }
        var variantsData = this.getAllVariantsData(experimentName);
        var hasAnyURLFilter = false;
        try {
            for (var variantsData_1 = __values(variantsData), variantsData_1_1 = variantsData_1.next(); !variantsData_1_1.done; variantsData_1_1 = variantsData_1.next()) {
                var _b = __read(variantsData_1_1.value, 2), data = _b[1];
                // Check if this variant has URL filter in wrapped format
                if (data && typeof data === 'object' && !Array.isArray(data) && 'urlFilter' in data) {
                    var config = data;
                    if (config.urlFilter) {
                        hasAnyURLFilter = true;
                        if (URLMatcher_1.URLMatcher.matches(config.urlFilter, url)) {
                            return true; // At least one variant matches this URL
                        }
                    }
                }
                // Note: Legacy array format or wrapped format without urlFilter doesn't affect matching
                // We only check URL filters that exist
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (variantsData_1_1 && !variantsData_1_1.done && (_a = variantsData_1.return)) _a.call(variantsData_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        // If NO variant has a URL filter, match all URLs (legacy behavior)
        // If at least one variant has a URL filter, we checked them all above
        return !hasAnyURLFilter;
    };
    /**
     * Extract __inject_html from all variants for all experiments
     * Checks both variant.variables and variant.config
     */
    VariantExtractor.prototype.extractAllInjectHTML = function () {
        var e_4, _a;
        var allInjectHTML = new Map();
        try {
            var contextData = this.context.data();
            if (this.debug) {
                (0, debug_1.logDebug)('[ABsmartly VariantExtractor] Extracting __inject_html from context');
            }
            if (contextData === null || contextData === void 0 ? void 0 : contextData.experiments) {
                try {
                    for (var _b = __values(contextData.experiments), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var experiment = _c.value;
                        var variantInjections = this.extractInjectHTMLForExperiment(experiment);
                        if (variantInjections.size > 0) {
                            allInjectHTML.set(experiment.name, variantInjections);
                            if (this.debug) {
                                (0, debug_1.logDebug)("[ABsmartly VariantExtractor] Experiment '".concat(experiment.name, "' has HTML injections:"), {
                                    variantsWithInjections: Array.from(variantInjections.keys()),
                                });
                            }
                        }
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            }
        }
        catch (error) {
            (0, debug_1.logDebug)('[ABsmartly] Error extracting __inject_html:', error);
        }
        return allInjectHTML;
    };
    /**
     * Extract __inject_html for a single experiment
     * Checks both variant.variables and variant.config
     */
    VariantExtractor.prototype.extractInjectHTMLForExperiment = function (experiment) {
        var variantInjections = new Map();
        if (!experiment.variants) {
            return variantInjections;
        }
        for (var i = 0; i < experiment.variants.length; i++) {
            var variant = experiment.variants[i];
            if (!variant)
                continue;
            var injectionData = null;
            // First check variant.variables (common in tests and some setups)
            if (variant.variables && variant.variables.__inject_html) {
                injectionData = variant.variables.__inject_html;
                if (this.debug) {
                    (0, debug_1.logDebug)("[VariantExtractor] Found __inject_html in variables for ".concat(experiment.name, " variant ").concat(i));
                }
            }
            // Then check variant.config (ABSmartly SDK provides data here as a JSON string)
            else if (variant.config) {
                try {
                    var config = typeof variant.config === 'string' ? JSON.parse(variant.config) : variant.config;
                    if (config && config.__inject_html) {
                        injectionData = config.__inject_html;
                        if (this.debug) {
                            (0, debug_1.logDebug)("[VariantExtractor] Found __inject_html in config for ".concat(experiment.name, " variant ").concat(i));
                        }
                    }
                }
                catch (e) {
                    (0, debug_1.logDebug)("[VariantExtractor] Failed to parse variant.config for ".concat(experiment.name, " variant ").concat(i, ":"), e);
                }
            }
            if (injectionData && typeof injectionData === 'object' && !Array.isArray(injectionData)) {
                // Extract urlFilter if present
                var _a = injectionData, urlFilter = _a.urlFilter, rawData = __rest(_a, ["urlFilter"]);
                // Create InjectionDataWithFilter
                var dataWithFilter = {
                    data: rawData,
                    urlFilter: urlFilter || undefined,
                };
                variantInjections.set(i, dataWithFilter);
                if (this.debug) {
                    (0, debug_1.logDebug)("[VariantExtractor] Extracted __inject_html for ".concat(experiment.name, " variant ").concat(i, ":"), {
                        keys: Object.keys(rawData),
                        hasUrlFilter: !!urlFilter,
                    });
                }
            }
            else if (injectionData && this.debug) {
                (0, debug_1.logDebug)("[VariantExtractor] Invalid __inject_html format in ".concat(experiment.name, " variant ").concat(i), injectionData);
            }
        }
        return variantInjections;
    };
    return VariantExtractor;
}());
exports.VariantExtractor = VariantExtractor;


/***/ }),

/***/ "./src/types/index.ts":
/*!****************************!*\
  !*** ./src/types/index.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ }),

/***/ "./src/utils/URLMatcher.ts":
/*!*********************************!*\
  !*** ./src/utils/URLMatcher.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.URLMatcher = void 0;
var URLMatcher = /** @class */ (function () {
    function URLMatcher() {
    }
    /**
     * Check if current URL matches the filter
     */
    URLMatcher.matches = function (filter, url) {
        if (url === void 0) { url = window.location.href; }
        // Normalize filter to URLFilterConfig
        var config = this.normalizeFilter(filter);
        // Extract the part of URL to match based on matchType
        var urlPart = this.extractURLPart(url, config.matchType);
        // Check exclusions first
        if (config.exclude && this.matchesPatterns(config.exclude, urlPart, config.mode)) {
            return false;
        }
        // Check inclusions
        if (!config.include) {
            return true; // No include property = match all
        }
        if (config.include.length === 0) {
            return false; // Empty include array = match nothing (explicit "include nothing")
        }
        return this.matchesPatterns(config.include, urlPart, config.mode);
    };
    /**
     * Extract the relevant part of the URL based on matchType
     */
    URLMatcher.extractURLPart = function (url, matchType) {
        if (matchType === void 0) { matchType = 'path'; }
        try {
            var urlObj = new URL(url);
            switch (matchType) {
                case 'full-url':
                    // Complete URL including protocol, domain, path, query, and hash
                    return urlObj.href;
                case 'path':
                    // Path + hash (default behavior - most common use case)
                    return urlObj.pathname + urlObj.hash;
                case 'domain':
                    // Just the hostname (e.g., 'example.com' or 'www.example.com')
                    return urlObj.hostname;
                case 'query':
                    // Just query parameters (e.g., '?id=123&ref=home')
                    return urlObj.search;
                case 'hash':
                    // Just hash fragment (e.g., '#section')
                    return urlObj.hash;
                default:
                    return urlObj.pathname + urlObj.hash;
            }
        }
        catch (error) {
            // If URL parsing fails, return original string
            console.error("[ABsmartly] Failed to parse URL: ".concat(url), error);
            return url;
        }
    };
    URLMatcher.matchesPatterns = function (patterns, url, mode) {
        var _this = this;
        if (mode === void 0) { mode = 'simple'; }
        return patterns.some(function (pattern) {
            if (mode === 'regex') {
                try {
                    return new RegExp(pattern).test(url);
                }
                catch (error) {
                    console.error("[ABsmartly] Invalid regex pattern: ".concat(pattern), error);
                    return false;
                }
            }
            return _this.matchSimplePattern(pattern, url);
        });
    };
    URLMatcher.matchSimplePattern = function (pattern, url) {
        // Convert simple pattern to regex
        // * becomes .*
        // ? becomes .
        // Escape other regex special chars
        var regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex chars except * and ?
            .replace(/\*/g, '.*') // * to .*
            .replace(/\?/g, '.'); // ? to .
        try {
            return new RegExp("^".concat(regexPattern, "$")).test(url);
        }
        catch (error) {
            console.error("[ABsmartly] Invalid pattern: ".concat(pattern), error);
            return false;
        }
    };
    URLMatcher.normalizeFilter = function (filter) {
        if (typeof filter === 'string') {
            return { include: [filter], exclude: [], mode: 'simple', matchType: 'path' };
        }
        if (Array.isArray(filter)) {
            return {
                include: filter.length > 0 ? filter : undefined,
                exclude: [],
                mode: 'simple',
                matchType: 'path',
            };
        }
        return {
            include: filter.include,
            exclude: filter.exclude || [],
            mode: filter.mode || 'simple',
            matchType: filter.matchType || 'path',
        };
    };
    return URLMatcher;
}());
exports.URLMatcher = URLMatcher;


/***/ }),

/***/ "./src/utils/debug.ts":
/*!****************************!*\
  !*** ./src/utils/debug.ts ***!
  \****************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DEBUG = void 0;
exports.logDebug = logDebug;
exports.logChangeApplication = logChangeApplication;
exports.logChangeRemoval = logChangeRemoval;
exports.logExperimentSummary = logExperimentSummary;
exports.logStateOperation = logStateOperation;
exports.logVisibilityEvent = logVisibilityEvent;
exports.logMessage = logMessage;
exports.logPerformance = logPerformance;
// Build-time debug flag - true in development, false in production
// TEMPORARILY HARDCODED TO TRUE FOR DEBUGGING
exports.DEBUG =  true ? true : 0;
/**
 * Logs debug messages only when DEBUG flag is true
 * This function will be completely removed in production builds
 */
function logDebug() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    if (exports.DEBUG) {
        // Handle old format with message and context
        if (args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'object') {
            var _a = __read(args, 2), message = _a[0], context = _a[1];
            // Skip repetitive messages
            if (message.includes('Original state already stored'))
                return;
            if (message.includes('State store operation'))
                return;
            if (message.includes('Performance:') && (context === null || context === void 0 ? void 0 : context.duration) && context.duration < 5)
                return;
            if (message.includes('Message sent:') || message.includes('Message received:'))
                return;
            var timestamp = new Date().toISOString();
            var prefix = '[ABsmartly Debug]';
            console.log("".concat(prefix, " [").concat(timestamp, "] ").concat(message), context);
        }
        else if (args.length === 1 && typeof args[0] === 'string') {
            // Single string message
            var message = args[0];
            // Skip repetitive messages
            if (message.includes('Original state already stored'))
                return;
            if (message.includes('State store operation'))
                return;
            if (message.includes('Message sent:') || message.includes('Message received:'))
                return;
            var timestamp = new Date().toISOString();
            var prefix = '[ABsmartly Debug]';
            console.log("".concat(prefix, " [").concat(timestamp, "] ").concat(message));
        }
        else {
            // Direct console.log replacement - just pass through all arguments
            console.log.apply(console, __spreadArray([], __read(args), false));
        }
    }
}
/**
 * Logs detailed change application
 */
function logChangeApplication(experimentName, selector, changeType, elementsAffected, success) {
    if (exports.DEBUG) {
        var status_1 = success ? '✓' : '✗';
        var message = "".concat(status_1, " Applied ").concat(changeType, " change to ").concat(elementsAffected, " element(s)");
        logDebug(message, {
            experimentName: experimentName,
            selector: selector,
            changeType: changeType,
            elementsCount: elementsAffected,
            success: success,
        });
    }
}
/**
 * Logs change removal/restoration
 */
function logChangeRemoval(experimentName, selector, changeType, elementsRestored) {
    if (exports.DEBUG) {
        var message = "Restored ".concat(elementsRestored, " element(s) to original state");
        logDebug(message, {
            experimentName: experimentName,
            selector: selector,
            changeType: changeType,
            elementsCount: elementsRestored,
            action: 'restore',
        });
    }
}
/**
 * Logs experiment summary
 */
function logExperimentSummary(experimentName, totalChanges, successfulChanges, pendingChanges) {
    if (exports.DEBUG) {
        var message = "Experiment \"".concat(experimentName, "\" summary");
        logDebug(message, {
            experimentName: experimentName,
            totalChanges: totalChanges,
            successfulChanges: successfulChanges,
            pendingChanges: pendingChanges,
            successRate: totalChanges > 0 ? "".concat(Math.round((successfulChanges / totalChanges) * 100), "%") : 'N/A',
        });
    }
}
/**
 * Logs state management operations
 */
function logStateOperation(operation, selector, changeType, experimentName) {
    if (exports.DEBUG) {
        var message = "State ".concat(operation, " operation");
        logDebug(message, {
            operation: operation,
            selector: selector,
            changeType: changeType,
            experimentName: experimentName,
        });
    }
}
/**
 * Logs visibility tracking events
 */
function logVisibilityEvent(experimentName, element, triggered) {
    if (exports.DEBUG) {
        var message = triggered
            ? 'Element became visible - experiment triggered'
            : 'Element visibility changed';
        logDebug(message, {
            experimentName: experimentName,
            selector: element.className || element.id || element.tagName,
            triggered: triggered,
            action: 'visibility',
        });
    }
}
/**
 * Logs message bridge communication
 */
function logMessage(direction, messageType, payload) {
    if (exports.DEBUG) {
        var message = "Message ".concat(direction, ": ").concat(messageType);
        logDebug(message, {
            direction: direction,
            messageType: messageType,
            payload: payload,
            bridge: 'extension',
        });
    }
}
/**
 * Logs performance metrics
 */
function logPerformance(operation, duration, details) {
    if (exports.DEBUG) {
        var message = "Performance: ".concat(operation, " took ").concat(duration, "ms");
        logDebug(message, __assign({ operation: operation, duration: duration, performance: true }, details));
    }
}


/***/ }),

/***/ "./src/utils/persistence.ts":
/*!**********************************!*\
  !*** ./src/utils/persistence.ts ***!
  \**********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DOMPersistenceManager = void 0;
var debug_1 = __webpack_require__(/*! ./debug */ "./src/utils/debug.ts");
var DOMPersistenceManager = /** @class */ (function () {
    function DOMPersistenceManager(config) {
        this.watchedElements = new WeakMap();
        this.persistenceObserver = null;
        this.reapplyingElements = new Set();
        this.reapplyLogThrottle = new Map();
        this.appliedChanges = new Map();
        this.config = config;
    }
    DOMPersistenceManager.prototype.watchElement = function (element, experimentName, change) {
        var experiments = this.watchedElements.get(element);
        if (!experiments) {
            experiments = new Set();
            this.watchedElements.set(element, experiments);
        }
        experiments.add(experimentName);
        if (!this.appliedChanges.has(experimentName)) {
            this.appliedChanges.set(experimentName, []);
        }
        var changes = this.appliedChanges.get(experimentName);
        var isNewWatch = !changes.includes(change);
        if (isNewWatch) {
            changes.push(change);
            if (this.config.debug) {
                var currentStyles_1 = {};
                if (change.value && typeof change.value === 'object') {
                    Object.keys(change.value).forEach(function (prop) {
                        var cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                        currentStyles_1[cssProp] = element.style.getPropertyValue(cssProp);
                    });
                }
                (0, debug_1.logDebug)('[WATCH-ELEMENT] Started watching element for persistence', {
                    experimentName: experimentName,
                    selector: change.selector,
                    element: element.tagName,
                    changeType: change.type,
                    value: change.value,
                    currentStyles: change.type === 'style' ? currentStyles_1 : undefined,
                    timestamp: Date.now(),
                });
            }
        }
        if (!this.persistenceObserver) {
            this.setupPersistenceObserver();
        }
    };
    DOMPersistenceManager.prototype.unwatchElement = function (element, experimentName) {
        var experiments = this.watchedElements.get(element);
        if (experiments) {
            experiments.delete(experimentName);
            if (experiments.size === 0) {
                this.watchedElements.delete(element);
            }
        }
    };
    DOMPersistenceManager.prototype.unwatchExperiment = function (experimentName) {
        this.appliedChanges.delete(experimentName);
    };
    DOMPersistenceManager.prototype.getAppliedChanges = function () {
        return this.appliedChanges;
    };
    DOMPersistenceManager.prototype.clearAll = function () {
        this.appliedChanges.clear();
    };
    DOMPersistenceManager.prototype.destroy = function () {
        if (this.persistenceObserver) {
            this.persistenceObserver.disconnect();
            this.persistenceObserver = null;
        }
        this.appliedChanges.clear();
        this.reapplyingElements.clear();
        this.reapplyLogThrottle.clear();
    };
    DOMPersistenceManager.prototype.setupPersistenceObserver = function () {
        var _this = this;
        if (this.persistenceObserver)
            return;
        if (this.config.debug) {
            (0, debug_1.logDebug)('[PERSISTENCE-OBSERVER] Setting up persistence observer', {
                timestamp: Date.now(),
            });
        }
        this.persistenceObserver = new MutationObserver(function (mutations) {
            if (_this.config.debug) {
                (0, debug_1.logDebug)('[MUTATION-DETECTED] Persistence observer detected mutations', {
                    mutationCount: mutations.length,
                    timestamp: Date.now(),
                });
            }
            mutations.forEach(function (mutation) {
                var element = mutation.target;
                if (_this.reapplyingElements.has(element)) {
                    if (_this.config.debug) {
                        (0, debug_1.logDebug)('[MUTATION-SKIP] Skipping mutation - currently reapplying', {
                            element: element.tagName,
                        });
                    }
                    return;
                }
                var experiments = _this.watchedElements.get(element);
                if (experiments) {
                    if (_this.config.debug) {
                        var elementKey = "mutation:".concat(element.tagName, ":").concat(element.getAttribute('name') || element.className);
                        var now = Date.now();
                        var lastLogged = _this.reapplyLogThrottle.get(elementKey) || 0;
                        if (now - lastLogged > 5000) {
                            (0, debug_1.logDebug)('[MUTATION-ON-WATCHED] Mutation detected on watched element', {
                                element: element.tagName,
                                attributeName: mutation.attributeName,
                                oldValue: mutation.oldValue,
                                experiments: Array.from(experiments),
                            });
                            _this.reapplyLogThrottle.set(elementKey, now);
                        }
                    }
                    experiments.forEach(function (experimentName) {
                        var appliedChanges = _this.appliedChanges.get(experimentName);
                        if (appliedChanges) {
                            appliedChanges.forEach(function (change) {
                                var e_1, _a, e_2, _b;
                                var needsReapply = false;
                                if (change.type === 'style' &&
                                    mutation.attributeName === 'style' &&
                                    change.persistStyle !== false) {
                                    needsReapply = _this.checkStyleOverwritten(element, change.value);
                                }
                                else if (change.type === 'attribute' && change.persistAttribute !== false) {
                                    if (change.value && typeof change.value === 'object') {
                                        try {
                                            for (var _c = __values(Object.keys(change.value)), _d = _c.next(); !_d.done; _d = _c.next()) {
                                                var attrName = _d.value;
                                                if (mutation.attributeName === attrName) {
                                                    needsReapply = _this.checkAttributeOverwritten(element, change.value);
                                                    break;
                                                }
                                            }
                                        }
                                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                                        finally {
                                            try {
                                                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                                            }
                                            finally { if (e_1) throw e_1.error; }
                                        }
                                    }
                                }
                                if (needsReapply) {
                                    _this.reapplyingElements.add(element);
                                    var logKey = "".concat(experimentName, "-").concat(change.selector);
                                    var now = Date.now();
                                    var lastLogged = _this.reapplyLogThrottle.get(logKey) || 0;
                                    if (_this.config.debug && now - lastLogged > 5000) {
                                        (0, debug_1.logDebug)('[REAPPLY-TRIGGERED] Reapplying after mutation (React/framework conflict detected)', {
                                            experimentName: experimentName,
                                            selector: change.selector,
                                            element: element.tagName,
                                            changeType: change.type,
                                            timestamp: now,
                                        });
                                        _this.reapplyLogThrottle.set(logKey, now);
                                        if (_this.reapplyLogThrottle.size > 100) {
                                            var oldestAllowed = now - 60000;
                                            try {
                                                for (var _e = __values(_this.reapplyLogThrottle.entries()), _f = _e.next(); !_f.done; _f = _e.next()) {
                                                    var _g = __read(_f.value, 2), key = _g[0], time = _g[1];
                                                    if (time < oldestAllowed) {
                                                        _this.reapplyLogThrottle.delete(key);
                                                    }
                                                }
                                            }
                                            catch (e_2_1) { e_2 = { error: e_2_1 }; }
                                            finally {
                                                try {
                                                    if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                                                }
                                                finally { if (e_2) throw e_2.error; }
                                            }
                                        }
                                    }
                                    _this.config.onReapply(change, experimentName);
                                    setTimeout(function () {
                                        _this.reapplyingElements.delete(element);
                                    }, 0);
                                }
                            });
                        }
                    });
                }
            });
        });
        this.persistenceObserver.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeOldValue: true,
        });
        if (this.config.debug) {
            (0, debug_1.logDebug)('[PERSISTENCE-OBSERVER] Setup complete - now observing mutations', {
                target: 'document.body',
                attributeFilter: ['style', 'class'],
                subtree: true,
                timestamp: Date.now(),
            });
        }
    };
    DOMPersistenceManager.prototype.checkStyleOverwritten = function (element, expectedStyles) {
        var e_3, _a;
        try {
            for (var _b = __values(Object.entries(expectedStyles)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), prop = _d[0], value = _d[1];
                var cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                var currentValue = element.style.getPropertyValue(cssProp);
                var currentPriority = element.style.getPropertyPriority(cssProp);
                if (currentValue !== value || (value.includes('!important') && !currentPriority)) {
                    return true;
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return false;
    };
    DOMPersistenceManager.prototype.checkAttributeOverwritten = function (element, expectedAttributes) {
        var e_4, _a;
        try {
            for (var _b = __values(Object.entries(expectedAttributes)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), attr = _d[0], value = _d[1];
                var currentValue = element.getAttribute(attr);
                if (currentValue !== value) {
                    return true;
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return false;
    };
    return DOMPersistenceManager;
}());
exports.DOMPersistenceManager = DOMPersistenceManager;


/***/ }),

/***/ "./src/utils/plugin-registry.ts":
/*!**************************************!*\
  !*** ./src/utils/plugin-registry.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/**
 * Global plugin registry for ABsmartly plugins
 * Allows detection and inspection of loaded plugins
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerPlugin = registerPlugin;
exports.unregisterPlugin = unregisterPlugin;
exports.isPluginRegistered = isPluginRegistered;
exports.getRegisteredPlugins = getRegisteredPlugins;
/**
 * Register a plugin in the global registry
 */
function registerPlugin(pluginType, entry) {
    if (typeof window === 'undefined') {
        return; // Not in browser environment
    }
    if (!window.__ABSMARTLY_PLUGINS__) {
        window.__ABSMARTLY_PLUGINS__ = {};
    }
    window.__ABSMARTLY_PLUGINS__[pluginType] = entry;
}
/**
 * Unregister a plugin from the global registry
 */
function unregisterPlugin(pluginType) {
    if (typeof window === 'undefined') {
        return;
    }
    if (window.__ABSMARTLY_PLUGINS__) {
        delete window.__ABSMARTLY_PLUGINS__[pluginType];
    }
}
/**
 * Check if a plugin is registered
 */
function isPluginRegistered(pluginType) {
    var _a;
    if (typeof window === 'undefined') {
        return false;
    }
    return !!(window.__ABSMARTLY_PLUGINS__ &&
        ((_a = window.__ABSMARTLY_PLUGINS__[pluginType]) === null || _a === void 0 ? void 0 : _a.initialized));
}
/**
 * Get all registered plugins
 */
function getRegisteredPlugins() {
    if (typeof window === 'undefined') {
        return {};
    }
    return window.__ABSMARTLY_PLUGINS__ || {};
}


/***/ }),

/***/ "./src/vitals/WebVitalsPlugin.ts":
/*!***************************************!*\
  !*** ./src/vitals/WebVitalsPlugin.ts ***!
  \***************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WebVitalsPlugin = void 0;
var debug_1 = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
var WebVitalsPlugin = /** @class */ (function () {
    function WebVitalsPlugin(options) {
        if (options === void 0) { options = {}; }
        this.webVitalsLoaded = false;
        this.metricsTracked = false;
        this.context = options.context;
        this.debug = options.debug || false;
        this.trackWebVitals = options.trackWebVitals !== false;
        this.trackPageMetrics = options.trackPageMetrics !== false;
        this.autoTrack = options.autoTrack !== false;
        // ✨ OPTIMIZATION: Start loading web-vitals library immediately in constructor
        // This allows the HTTP request to happen in parallel with other initialization
        if (typeof window !== 'undefined' && this.trackWebVitals) {
            this.webVitalsPromise = this.loadWebVitalsLibrary();
            this.debugLog('Started pre-loading web-vitals library');
        }
    }
    WebVitalsPlugin.prototype.debugLog = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (this.debug) {
            debug_1.logDebug.apply(void 0, __spreadArray(['[WebVitalsPlugin]'], __read(args), false));
        }
    };
    WebVitalsPlugin.prototype.setContext = function (context) {
        this.context = context;
        this.debugLog('Context set for WebVitalsPlugin');
    };
    WebVitalsPlugin.prototype.loadWebVitalsLibrary = function () {
        return __awaiter(this, void 0, void 0, function () {
            var webVitals, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.webVitalsLoaded || typeof window === 'undefined') {
                            return [2 /*return*/, null];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(__webpack_require__(/*! web-vitals */ "./node_modules/web-vitals/dist/web-vitals.umd.cjs")); })];
                    case 2:
                        webVitals = _a.sent();
                        this.webVitalsLoaded = true;
                        this.debugLog('Web Vitals library loaded from bundle');
                        return [2 /*return*/, webVitals];
                    case 3:
                        error_1 = _a.sent();
                        (0, debug_1.logDebug)('[WebVitalsPlugin] Failed to load Web Vitals library:', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    WebVitalsPlugin.prototype.trackWebVitalsMetrics = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var ctx, webVitals, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx = context || this.context;
                        if (!ctx) {
                            (0, debug_1.logDebug)('[WebVitalsPlugin] No context available for tracking web vitals');
                            return [2 /*return*/];
                        }
                        if (!this.trackWebVitals) {
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        webVitals = void 0;
                        if (!this.webVitalsPromise) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.webVitalsPromise];
                    case 2:
                        webVitals = _a.sent();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, this.loadWebVitalsLibrary()];
                    case 4:
                        // Fallback: Load now if not started in constructor
                        webVitals = _a.sent();
                        _a.label = 5;
                    case 5:
                        if (!webVitals) {
                            (0, debug_1.logDebug)('[WebVitalsPlugin] Web Vitals library not available');
                            return [2 /*return*/];
                        }
                        // Track Core Web Vitals
                        webVitals.onCLS(function (metric) {
                            _this.debugLog('CLS:', metric);
                            ctx.track('cls_score', __assign({}, metric));
                        });
                        webVitals.onLCP(function (metric) {
                            _this.debugLog('LCP:', metric);
                            ctx.track('lcp_score', __assign({}, metric));
                        });
                        webVitals.onFCP(function (metric) {
                            _this.debugLog('FCP:', metric);
                            ctx.track('fcp_score', __assign({}, metric));
                        });
                        webVitals.onINP(function (metric) {
                            _this.debugLog('INP:', metric);
                            ctx.track('inp_score', __assign({}, metric));
                        });
                        webVitals.onTTFB(function (metric) {
                            _this.debugLog('TTFB:', metric);
                            ctx.track('ttfb_score', __assign({}, metric));
                        });
                        this.debugLog('Web Vitals tracking initialized');
                        return [3 /*break*/, 7];
                    case 6:
                        error_2 = _a.sent();
                        (0, debug_1.logDebug)('[WebVitalsPlugin] Error tracking web vitals:', error_2);
                        ctx.track('vitals_tracking_error', {
                            error: error_2.message,
                            type: error_2.name,
                        });
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    WebVitalsPlugin.prototype.trackPageMetricsData = function (context) {
        var _this = this;
        var ctx = context || this.context;
        if (!ctx) {
            (0, debug_1.logDebug)('[WebVitalsPlugin] No context available for tracking page metrics');
            return;
        }
        if (!this.trackPageMetrics || this.metricsTracked) {
            return;
        }
        try {
            // Track immediate metrics
            this.trackImmediateMetrics(ctx);
            // Track load-dependent metrics
            if (document.readyState === 'complete') {
                this.trackLoadMetrics(ctx);
            }
            else {
                window.addEventListener('load', function () { return _this.trackLoadMetrics(ctx); });
            }
            this.metricsTracked = true;
        }
        catch (error) {
            (0, debug_1.logDebug)('[WebVitalsPlugin] Error tracking page metrics:', error);
            ctx.track('metrics_tracking_error', {
                error: error.message,
                type: error.name,
            });
        }
    };
    WebVitalsPlugin.prototype.trackImmediateMetrics = function (context) {
        var e_1, _a, e_2, _b;
        var navigation = performance.getEntriesByType('navigation')[0];
        if (!navigation) {
            this.debugLog('Navigation timing not available');
            return;
        }
        // Network timing metrics
        var timingMetrics = {
            dns: navigation.domainLookupEnd - navigation.domainLookupStart,
            tcp: navigation.connectEnd - navigation.connectStart,
            ttfb: navigation.responseStart - navigation.requestStart,
            download: navigation.responseEnd - navigation.responseStart,
            total_fetch: navigation.responseEnd - navigation.requestStart,
        };
        try {
            for (var _c = __values(Object.entries(timingMetrics)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = __read(_d.value, 2), metric = _e[0], value = _e[1];
                context.track("page_timing_".concat(metric), {
                    value: value,
                    unit: 'ms',
                });
                this.debugLog("Page timing ".concat(metric, ":"), value);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // Size metrics
        var sizeMetrics = {
            total_size: navigation.transferSize,
            header_size: navigation.transferSize - navigation.encodedBodySize,
            html_size: navigation.decodedBodySize,
            compressed_html_size: navigation.encodedBodySize,
        };
        try {
            for (var _f = __values(Object.entries(sizeMetrics)), _g = _f.next(); !_g.done; _g = _f.next()) {
                var _h = __read(_g.value, 2), metric = _h[0], value = _h[1];
                context.track("page_".concat(metric), {
                    value: value,
                    unit: 'bytes',
                });
                this.debugLog("Page ".concat(metric, ":"), value);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
            }
            finally { if (e_2) throw e_2.error; }
        }
        // Compression ratio
        if (navigation.encodedBodySize > 0) {
            var compressionRatio = navigation.decodedBodySize / navigation.encodedBodySize;
            context.track('page_compression_ratio', {
                value: compressionRatio,
            });
            this.debugLog('Compression ratio:', compressionRatio);
        }
    };
    WebVitalsPlugin.prototype.trackLoadMetrics = function (context) {
        var e_3, _a;
        var navigation = performance.getEntriesByType('navigation')[0];
        if (!navigation) {
            return;
        }
        // DOM processing and total load time
        var domProcessing = navigation.domComplete - navigation.responseEnd;
        context.track('page_timing_dom_processing', {
            value: domProcessing,
            metric: 'DOM Processing',
            unit: 'ms',
            rating: domProcessing <= 500 ? 'good' : domProcessing <= 1000 ? 'needs-improvement' : 'poor',
        });
        this.debugLog('DOM processing:', domProcessing);
        var totalLoad = navigation.loadEventEnd - navigation.fetchStart;
        context.track('page_timing_total_load', {
            value: totalLoad,
            metric: 'Total Load',
            unit: 'ms',
            rating: totalLoad <= 2000 ? 'good' : totalLoad <= 4000 ? 'needs-improvement' : 'poor',
        });
        this.debugLog('Total load:', totalLoad);
        // DOM element counts
        var domMetrics = {
            elements: document.getElementsByTagName('*').length,
            imageCount: document.getElementsByTagName('img').length,
            scriptCount: document.getElementsByTagName('script').length,
            styleCount: document.getElementsByTagName('style').length,
            linkCount: document.getElementsByTagName('link').length,
        };
        try {
            for (var _b = __values(Object.entries(domMetrics)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), metric = _d[0], value = _d[1];
                context.track("dom_".concat(metric), {
                    value: value,
                    metric: metric,
                    unit: 'count',
                    rating: value <= 1000 ? 'good' : value <= 2000 ? 'needs-improvement' : 'poor',
                });
                this.debugLog("DOM ".concat(metric, ":"), value);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    WebVitalsPlugin.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.debugLog('Starting WebVitalsPlugin');
                if (!this.context) {
                    this.debugLog('No context available during start');
                    return [2 /*return*/];
                }
                if (this.autoTrack) {
                    // ✨ OPTIMIZATION: Don't await - let tracking start in background
                    // context.track() can be called before context.ready()
                    if (this.trackWebVitals) {
                        // Start tracking (don't await - runs in parallel)
                        this.trackWebVitalsMetrics();
                    }
                    // Start tracking page metrics (also doesn't need to wait)
                    if (this.trackPageMetrics) {
                        this.trackPageMetricsData();
                    }
                }
                this.debugLog('WebVitalsPlugin started successfully');
                return [2 /*return*/];
            });
        });
    };
    // Aliases for backwards compatibility
    WebVitalsPlugin.prototype.ready = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.start()];
            });
        });
    };
    WebVitalsPlugin.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.start()];
            });
        });
    };
    WebVitalsPlugin.prototype.reset = function () {
        this.metricsTracked = false;
        this.debugLog('WebVitalsPlugin reset');
    };
    return WebVitalsPlugin;
}());
exports.WebVitalsPlugin = WebVitalsPlugin;


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/entries/dom-with-overrides-full.ts");
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=absmartly-sdk-plugins.dev.js.map