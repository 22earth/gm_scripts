declare var Fuse: any;

declare var GM_setValue: any;
declare var GM_getValue: any;
declare var GM_registerMenuCommand: any;
declare var GM_addStyle: any;
declare var GM_openInTab: any;
declare var GM_getResourceText: any;

// declare var bangumiDataURL: string;

// @TODO avoid use global variable
interface Window {
  _parsedEl: Element | Document;
}
