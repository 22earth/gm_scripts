// ==UserScript==
// @name        migrate douban collection to bangumi
// @name:zh-CN  迁移豆瓣收藏到 Bangumi
// @namespace   https://github.com/22earth
// @description migrate douban collection to bangumi and export douban collection
// @description:zh-cn 迁移豆瓣动画收藏到 Bangumi.
// @include     /^https?:\/\/(bangumi|bgm|chii)\.(tv|in)\/?$/
// @include     https://www.douban.com/people/*/
// @author      22earth
// @homepage    https://github.com/22earth/gm_scripts
// @version     0.0.1
// @run-at      document-end
// @grant       GM_registerMenuCommand
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_getResourceText
// @require     https://cdn.staticfile.org/fuse.js/6.4.0/fuse.min.js
// @resource    bangumiDataURL https://cdn.jsdelivr.net/npm/bangumi-data@0.3/dist/data.json
// ==/UserScript==


/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function sleep(num) {
    return new Promise(resolve => {
        setTimeout(resolve, num);
    });
}

// support GM_XMLHttpRequest
function fetchInfo(url, type, opts = {}, TIMEOUT = 10 * 1000) {
    // @ts-ignore
    {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            GM_xmlhttpRequest(Object.assign({ method: 'GET', timeout: TIMEOUT, url, responseType: type, onload: function (res) {
                    resolve(res.response);
                }, onerror: reject }, opts));
        });
    }
}
function fetchText(url, TIMEOUT = 10 * 1000) {
    return fetchInfo(url, 'text', {}, TIMEOUT);
}
function fetchJson(url, opts = {}) {
    return fetchInfo(url, 'json', opts);
}

var SubjectTypeId;
(function (SubjectTypeId) {
    SubjectTypeId[SubjectTypeId["book"] = 1] = "book";
    SubjectTypeId[SubjectTypeId["anime"] = 2] = "anime";
    SubjectTypeId[SubjectTypeId["music"] = 3] = "music";
    SubjectTypeId[SubjectTypeId["game"] = 4] = "game";
    SubjectTypeId[SubjectTypeId["real"] = 6] = "real";
    SubjectTypeId["all"] = "all";
})(SubjectTypeId || (SubjectTypeId = {}));

function formatDate(time, fmt = 'yyyy-MM-dd') {
    const date = new Date(time);
    var o = {
        'M+': date.getMonth() + 1,
        'd+': date.getDate(),
        'h+': date.getHours(),
        'm+': date.getMinutes(),
        's+': date.getSeconds(),
        'q+': Math.floor((date.getMonth() + 3) / 3),
        S: date.getMilliseconds(),
    };
    if (/(y+)/i.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (var k in o) {
        if (new RegExp('(' + k + ')', 'i').test(fmt)) {
            fmt = fmt.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length));
        }
    }
    return fmt;
}
function dealDate(dataStr) {
    // 2019年12月19
    let l = [];
    if (/\d{4}年\d{1,2}月(\d{1,2}日?)?/.test(dataStr)) {
        l = dataStr
            .replace('日', '')
            .split(/年|月/)
            .filter((i) => i);
    }
    else if (/\d{4}\/\d{1,2}(\/\d{1,2})?/.test(dataStr)) {
        l = dataStr.split('/');
    }
    else if (/\d{4}-\d{1,2}(-\d{1,2})?/.test(dataStr)) {
        return dataStr;
    }
    else {
        return dataStr;
    }
    return l
        .map((i) => {
        if (i.length === 1) {
            return `0${i}`;
        }
        return i;
    })
        .join('-');
}
function isEqualDate(d1, d2) {
    const resultDate = new Date(d1);
    const originDate = new Date(d2);
    if (resultDate.getFullYear() === originDate.getFullYear() &&
        resultDate.getMonth() === originDate.getMonth() &&
        resultDate.getDate() === originDate.getDate()) {
        return true;
    }
    return false;
}

/**
 * 过滤搜索结果： 通过名称以及日期
 * @param items
 * @param subjectInfo
 * @param opts
 */
function filterResults(items, subjectInfo, opts = {}, isSearch = true) {
    var _a;
    if (!items)
        return;
    // 只有一个结果时直接返回, 不再比较日期
    if (items.length === 1 && isSearch) {
        const result = items[0];
        return result;
        // if (isEqualDate(result.releaseDate, subjectInfo.releaseDate)) {
        // }
    }
    let results = new Fuse(items, Object.assign({}, opts)).search(subjectInfo.name);
    if (!results.length)
        return;
    // 有参考的发布时间
    if (subjectInfo.releaseDate) {
        for (const item of results) {
            const result = item.item;
            if (result.releaseDate) {
                if (isEqualDate(result.releaseDate, subjectInfo.releaseDate)) {
                    return result;
                }
            }
        }
    }
    // 比较名称
    const nameRe = new RegExp(subjectInfo.name.trim());
    for (const item of results) {
        const result = item.item;
        if (nameRe.test(result.name) || nameRe.test(result.greyName)) {
            return result;
        }
    }
    return (_a = results[0]) === null || _a === void 0 ? void 0 : _a.item;
}
const typeIdDict = {
    dropped: {
        name: '抛弃',
        id: '5',
    },
    on_hold: {
        name: '搁置',
        id: '4',
    },
    do: {
        name: '在看',
        id: '3',
    },
    collect: {
        name: '看过',
        id: '2',
    },
    wish: {
        name: '想看',
        id: '1',
    },
};
function findInterestStatusById(id) {
    for (let key in typeIdDict) {
        const obj = typeIdDict[key];
        if (obj.id === id) {
            return Object.assign({ key: key }, obj);
        }
    }
}

function getBgmHost() {
    return `${location.protocol}//${location.host}`;
}
function getSubjectId(url) {
    const m = url.match(/(?:subject|character)\/(\d+)/);
    if (!m)
        return '';
    return m[1];
}
function getUserId(url) {
    // https://bgm.tv/user/a_little
    const m = url.match(/user\/(.*)/);
    if (!m)
        return '';
    return m[1];
}
function insertLogInfo($sibling, txt) {
    const $log = document.createElement('div');
    $log.classList.add('e-wiki-log-info');
    // $log.setAttribute('style', 'color: tomato;');
    $log.innerHTML = txt;
    $sibling.parentElement.insertBefore($log, $sibling);
    $sibling.insertAdjacentElement('afterend', $log);
    return $log;
}
function convertItemInfo($item) {
    let $subjectTitle = $item.querySelector('h3>a.l');
    let itemSubject = {
        name: $subjectTitle.textContent.trim(),
        rawInfos: $item.querySelector('.info').textContent.trim(),
        // url 没有协议和域名
        url: $subjectTitle.getAttribute('href'),
        greyName: $item.querySelector('h3>.grey')
            ? $item.querySelector('h3>.grey').textContent.trim()
            : '',
    };
    let matchDate = $item
        .querySelector('.info')
        .textContent.match(/\d{4}[\-\/\年]\d{1,2}[\-\/\月]\d{1,2}/);
    if (matchDate) {
        itemSubject.releaseDate = dealDate(matchDate[0]);
    }
    const $rateInfo = $item.querySelector('.rateInfo');
    if ($rateInfo) {
        const rateInfo = {};
        if ($rateInfo.querySelector('.fade')) {
            rateInfo.score = $rateInfo.querySelector('.fade').textContent;
            rateInfo.count = $rateInfo
                .querySelector('.tip_j')
                .textContent.replace(/[^0-9]/g, '');
        }
        else {
            rateInfo.score = '0';
            rateInfo.count = '少于10';
        }
        itemSubject.rateInfo = rateInfo;
    }
    const $rank = $item.querySelector('.rank');
    if ($rank) {
        itemSubject.rank = $rank.textContent.replace('Rank', '').trim();
    }
    const $collectInfo = $item.querySelector('.collectInfo');
    if ($collectInfo) {
        const collectInfo = {};
        const textArr = $collectInfo.textContent.split('/');
        collectInfo.date = textArr[0].trim();
        textArr.forEach((str) => {
            if (str.match('标签')) {
                collectInfo.tags = str.replace(/标签:/, '').trim();
            }
        });
        const $comment = $item.querySelector('#comment_box');
        if ($comment) {
            collectInfo.comment = $comment.textContent.trim();
        }
        const $starlight = $collectInfo.querySelector('.starlight');
        if ($starlight) {
            $starlight.classList.forEach((s) => {
                if (/stars\d/.test(s)) {
                    collectInfo.score = s.replace('stars', '');
                }
            });
        }
        itemSubject.collectInfo = collectInfo;
    }
    const $cover = $item.querySelector('.subjectCover img');
    if ($cover && $cover.tagName.toLowerCase() === 'img') {
        // 替换 cover/s --->  cover/l 是大图
        const src = $cover.getAttribute('src') || $cover.getAttribute('data-cfsrc');
        if (src) {
            itemSubject.cover = src.replace('pic/cover/s', 'pic/cover/l');
        }
    }
    return itemSubject;
}
function getItemInfos($doc = document) {
    const items = $doc.querySelectorAll('#browserItemList>li');
    const res = [];
    for (const item of Array.from(items)) {
        res.push(convertItemInfo(item));
    }
    return res;
}
function getTotalPageNum($doc = document) {
    const $multipage = $doc.querySelector('#multipage');
    let totalPageNum = 1;
    const pList = $multipage.querySelectorAll('.page_inner>.p');
    if (pList && pList.length) {
        let tempNum = parseInt(pList[pList.length - 2].getAttribute('href').match(/page=(\d*)/)[1]);
        totalPageNum = parseInt(pList[pList.length - 1].getAttribute('href').match(/page=(\d*)/)[1]);
        totalPageNum = totalPageNum > tempNum ? totalPageNum : tempNum;
    }
    return totalPageNum;
}
function genCollectionURL(userId, subjectType, interestType) {
    const dict = {
        movie: 'anime',
        music: 'music',
        book: 'book',
    };
    return `https://bgm.tv/${dict[subjectType]}/list/${userId}/${interestType}`;
}
function getAllPageInfo(userId, subjectType, interestType) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = genCollectionURL(userId, subjectType, interestType);
        console.info('bgm collection page: ', url);
        const rawText = yield fetchText(url);
        const $doc = new DOMParser().parseFromString(rawText, 'text/html');
        const totalPageNum = getTotalPageNum($doc);
        const res = [...getItemInfos($doc)];
        let page = 2;
        while (page <= totalPageNum) {
            let reqUrl = url;
            const m = url.match(/page=(\d*)/);
            if (m) {
                reqUrl = reqUrl.replace(m[0], `page=${page}`);
            }
            else {
                reqUrl = `${reqUrl}?page=${page}`;
            }
            yield sleep(500);
            console.info('fetch info: ', reqUrl);
            const rawText = yield fetchText(reqUrl);
            const $doc = new DOMParser().parseFromString(rawText, 'text/html');
            res.push(...getItemInfos($doc));
            page += 1;
        }
        return res;
    });
}
function loadIframe($iframe, subjectId) {
    return new Promise((resolve, reject) => {
        $iframe.src = `/update/${subjectId}`;
        let timer = setTimeout(() => {
            timer = null;
            reject('iframe timeout');
        }, 5000);
        $iframe.onload = () => {
            clearTimeout(timer);
            $iframe.onload = null;
            resolve();
        };
    });
}
function getUpdateForm(subjectId) {
    return __awaiter(this, void 0, void 0, function* () {
        const iframeId = 'e-userjs-update-interest';
        let $iframe = document.querySelector(`#${iframeId}`);
        if (!$iframe) {
            $iframe = document.createElement('iframe');
            $iframe.style.display = 'none';
            $iframe.id = iframeId;
            document.body.appendChild($iframe);
        }
        yield loadIframe($iframe, subjectId);
        const $form = $iframe.contentDocument.querySelector('#collectBoxForm');
        return $form;
        // return $form.action;
    });
}
/**
 * 更新用户收藏
 * @param subjectId 条目 id
 * @param data 更新数据
 */
function updateInterest(subjectId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        // gh 暂时不知道如何获取，直接拿 action 了
        const $form = yield getUpdateForm(subjectId);
        const formData = new FormData($form);
        const obj = Object.assign({ referer: 'ajax', tags: '', comment: '', update: '保存' }, data);
        for (let [key, val] of Object.entries(obj)) {
            if (!formData.has(key)) {
                formData.append(key, val);
            }
        }
        yield fetch($form.action, {
            method: 'POST',
            body: formData,
        });
    });
}

var BangumiDomain;
(function (BangumiDomain) {
    BangumiDomain["chii"] = "chii.in";
    BangumiDomain["bgm"] = "bgm.tv";
    BangumiDomain["bangumi"] = "bangumi.tv";
})(BangumiDomain || (BangumiDomain = {}));
var Protocol;
(function (Protocol) {
    Protocol["http"] = "http";
    Protocol["https"] = "https";
})(Protocol || (Protocol = {}));
/**
 * 处理搜索页面的 html
 * @param info 字符串 html
 */
function dealSearchResults(info) {
    const results = [];
    let $doc = new DOMParser().parseFromString(info, 'text/html');
    let items = $doc.querySelectorAll('#browserItemList>li>div.inner');
    // get number of page
    let numOfPage = 1;
    let pList = $doc.querySelectorAll('.page_inner>.p');
    if (pList && pList.length) {
        let tempNum = parseInt(pList[pList.length - 2].getAttribute('href').match(/page=(\d*)/)[1]);
        numOfPage = parseInt(pList[pList.length - 1].getAttribute('href').match(/page=(\d*)/)[1]);
        numOfPage = numOfPage > tempNum ? numOfPage : tempNum;
    }
    if (items && items.length) {
        for (const item of Array.prototype.slice.call(items)) {
            let $subjectTitle = item.querySelector('h3>a.l');
            let itemSubject = {
                name: $subjectTitle.textContent.trim(),
                // url 没有协议和域名
                url: $subjectTitle.getAttribute('href'),
                greyName: item.querySelector('h3>.grey')
                    ? item.querySelector('h3>.grey').textContent.trim()
                    : '',
            };
            let matchDate = item
                .querySelector('.info')
                .textContent.match(/\d{4}[\-\/\年]\d{1,2}[\-\/\月]\d{1,2}/);
            if (matchDate) {
                itemSubject.releaseDate = dealDate(matchDate[0]);
            }
            let $rateInfo = item.querySelector('.rateInfo');
            if ($rateInfo) {
                if ($rateInfo.querySelector('.fade')) {
                    itemSubject.score = $rateInfo.querySelector('.fade').textContent;
                    itemSubject.count = $rateInfo
                        .querySelector('.tip_j')
                        .textContent.replace(/[^0-9]/g, '');
                }
                else {
                    itemSubject.score = '0';
                    itemSubject.count = '少于10';
                }
            }
            else {
                itemSubject.score = '0';
                itemSubject.count = '0';
            }
            results.push(itemSubject);
        }
    }
    else {
        return [];
    }
    return [results, numOfPage];
}
/**
 * 搜索条目
 * @param subjectInfo
 * @param type
 * @param uniqueQueryStr
 */
function searchSubject(subjectInfo, bgmHost = 'https://bgm.tv', type = SubjectTypeId.all, uniqueQueryStr = '') {
    return __awaiter(this, void 0, void 0, function* () {
        let releaseDate;
        if (subjectInfo && subjectInfo.releaseDate) {
            releaseDate = subjectInfo.releaseDate;
        }
        let query = (subjectInfo.name || '').trim();
        if (type === SubjectTypeId.book) {
            // 去掉末尾的括号并加上引号
            query = query.replace(/（[^0-9]+?）|\([^0-9]+?\)$/, '');
            query = `"${query}"`;
        }
        if (uniqueQueryStr) {
            query = `"${uniqueQueryStr || ''}"`;
        }
        if (!query || query === '""') {
            console.info('Query string is empty');
            return;
        }
        const url = `${bgmHost}/subject_search/${encodeURIComponent(query)}?cat=${type}`;
        console.info('search bangumi subject URL: ', url);
        const rawText = yield fetchText(url);
        const rawInfoList = dealSearchResults(rawText)[0] || [];
        // 使用指定搜索字符串如 ISBN 搜索时, 并且结果只有一条时，不再使用名称过滤
        if (uniqueQueryStr && rawInfoList && rawInfoList.length === 1) {
            return rawInfoList[0];
        }
        const options = {
            keys: ['name', 'greyName'],
        };
        return filterResults(rawInfoList, subjectInfo, options);
    });
}
/**
 * 通过时间查找条目
 * @param subjectInfo 条目信息
 * @param pageNumber 页码
 * @param type 条目类型
 */
function findSubjectByDate(subjectInfo, bgmHost = 'https://bgm.tv', pageNumber = 1, type) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!subjectInfo || !subjectInfo.releaseDate || !subjectInfo.name) {
            throw new Error('invalid subject info');
        }
        const releaseDate = new Date(subjectInfo.releaseDate);
        if (isNaN(releaseDate.getTime())) {
            throw `invalid releasedate: ${subjectInfo.releaseDate}`;
        }
        const sort = releaseDate.getDate() > 15 ? 'sort=date' : '';
        const page = pageNumber ? `page=${pageNumber}` : '';
        let query = '';
        if (sort && page) {
            query = '?' + sort + '&' + page;
        }
        else if (sort) {
            query = '?' + sort;
        }
        else if (page) {
            query = '?' + page;
        }
        const url = `${bgmHost}/${type}/browser/airtime/${releaseDate.getFullYear()}-${releaseDate.getMonth() + 1}${query}`;
        console.info('find subject by date: ', url);
        const rawText = yield fetchText(url);
        let [rawInfoList, numOfPage] = dealSearchResults(rawText);
        const options = {
            threshold: 0.3,
            keys: ['name', 'greyName'],
        };
        let result = filterResults(rawInfoList, subjectInfo, options, false);
        if (!result) {
            if (pageNumber < numOfPage) {
                yield sleep(300);
                return yield findSubjectByDate(subjectInfo, bgmHost, pageNumber + 1, type);
            }
            else {
                throw 'notmatched';
            }
        }
        return result;
    });
}
/**
 * 查找条目是否存在： 通过名称搜索或者日期加上名称的过滤查询
 * @param subjectInfo 条目基本信息
 * @param bgmHost bangumi 域名
 * @param type 条目类型
 */
function checkExist(subjectInfo, bgmHost = 'https://bgm.tv', type, disabelDate) {
    return __awaiter(this, void 0, void 0, function* () {
        const subjectTypeDict = {
            [SubjectTypeId.game]: 'game',
            [SubjectTypeId.anime]: 'anime',
            [SubjectTypeId.music]: 'music',
            [SubjectTypeId.book]: 'book',
            [SubjectTypeId.real]: 'real',
            [SubjectTypeId.all]: 'all',
        };
        let searchResult = yield searchSubject(subjectInfo, bgmHost, type);
        console.info(`First: search result of bangumi: `, searchResult);
        if (searchResult && searchResult.url) {
            return searchResult;
        }
        if (disabelDate) {
            return;
        }
        searchResult = yield findSubjectByDate(subjectInfo, bgmHost, 1, subjectTypeDict[type]);
        console.info(`Second: search result by date: `, searchResult);
        return searchResult;
    });
}
function checkAnimeSubjectExist(subjectInfo) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield checkExist(subjectInfo, getBgmHost(), SubjectTypeId.anime, true);
        return result;
    });
}
const siteUtils = {
    name: 'Bangumi',
    contanerSelector: '#columnHomeB',
    getUserId: getUserId,
    getSubjectId: getSubjectId,
    updateInterest: updateInterest,
    checkSubjectExist: checkAnimeSubjectExist,
    getAllPageInfo: getAllPageInfo,
};

function genCollectionURL$1(userId, interestType, subjectType = 'movie', start = 1) {
    const baseURL = `https://${subjectType}.douban.com/people/${userId}/${interestType}`;
    if (start === 1) {
        return baseURL;
    }
    else {
        return `${baseURL}?start=${start}&sort=time&rating=all&filter=all&mode=grid`;
    }
}
function getSubjectId$1(url) {
    const m = url.match(/movie\.douban\.com\/subject\/(\d+)/);
    if (m) {
        return m[1];
    }
    return '';
}
function getUserId$1(homeURL) {
    let m = homeURL.match(/douban.com\/people\/([^\/]*)\//);
    if (m) {
        return m[1];
    }
    return '';
}
function convertItemInfo$1($item) {
    var _a, _b, _c;
    let $subjectTitle = $item.querySelector('.info .title a');
    // 默认第二项为日文名
    const titleArr = $subjectTitle.textContent
        .trim()
        .split('/')
        .map((str) => str.trim());
    const rawInfos = $item.querySelector('.info .intro').textContent.trim();
    let itemSubject = {
        name: titleArr[1],
        rawInfos,
        url: $subjectTitle.getAttribute('href'),
        greyName: titleArr[0],
    };
    const $cover = $item.querySelector('.pic img');
    if ($cover && $cover.tagName.toLowerCase() === 'img') {
        const src = $cover.getAttribute('src');
        if (src) {
            itemSubject.cover = src;
        }
    }
    const jpDateReg = /(\d+-\d\d\-\d\d)(?:\(日本\))/;
    const dateReg = /\d+-\d\d\-\d\d/;
    let m;
    if ((m = rawInfos.match(jpDateReg))) {
        itemSubject.releaseDate = m[1];
    }
    else if ((m = rawInfos.match(dateReg))) {
        itemSubject.releaseDate = m[0];
    }
    const $collectInfo = $item.querySelector('.info');
    if ($collectInfo) {
        const collectInfo = {};
        collectInfo.date = (_a = $collectInfo
            .querySelector('li .date')) === null || _a === void 0 ? void 0 : _a.textContent.trim();
        collectInfo.tags = (_b = $collectInfo
            .querySelector('li .tags')) === null || _b === void 0 ? void 0 : _b.textContent.replace('标签: ', '').trim();
        collectInfo.comment = (_c = $collectInfo
            .querySelector('li .comment')) === null || _c === void 0 ? void 0 : _c.textContent.trim();
        const $rating = $collectInfo.querySelector('[class^=rating]');
        if ($rating) {
            const m = $rating.getAttribute('class').match(/\d/);
            if (m) {
                // 十分制
                collectInfo.score = +m[0] * 2;
            }
        }
        itemSubject.collectInfo = collectInfo;
    }
    return itemSubject;
}
function getTotalPageNum$1($doc = document) {
    const numStr = $doc.querySelector('.mode > .subject-num').textContent.trim();
    return Number(numStr.split('/')[1].trim());
}
function getItemInfos$1($doc = document) {
    const items = $doc.querySelectorAll('#content .grid-view > .item');
    const res = [];
    for (const item of Array.from(items)) {
        res.push(convertItemInfo$1(item));
    }
    return res;
}
/**
 * 获取所有分页的条目数据
 * @param userId 用户id
 * @param subjectType 条目类型
 * @param interestType 条目状态
 */
function getAllPageInfo$1(userId, subjectType = 'movie', interestType) {
    return __awaiter(this, void 0, void 0, function* () {
        let res = [];
        const url = genCollectionURL$1(userId, interestType, subjectType);
        const rawText = yield fetchText(url);
        const $doc = new DOMParser().parseFromString(rawText, 'text/html');
        const totalPageNum = getTotalPageNum$1($doc);
        res = [...getItemInfos$1($doc)];
        // 16 分割
        let page = 16;
        while (page <= totalPageNum) {
            let reqUrl = genCollectionURL$1(userId, interestType, subjectType, page);
            yield sleep(500);
            console.info('fetch info: ', reqUrl);
            const rawText = yield fetchText(reqUrl);
            const $doc = new DOMParser().parseFromString(rawText, 'text/html');
            res.push(...getItemInfos$1($doc));
            page += 15;
        }
        return res;
    });
}
function convertHomeSearchItem($item) {
    const dealHref = (href) => {
        const urlParam = href.split('?url=')[1];
        if (urlParam) {
            return decodeURIComponent(urlParam.split('&')[0]);
        }
        else {
            throw 'invalid href';
        }
    };
    const $title = $item.querySelector('.title h3 > a');
    const href = dealHref($title.getAttribute('href'));
    const $ratingNums = $item.querySelector('.rating-info > .rating_nums');
    let ratingsCount = '';
    let averageScore = '';
    if ($ratingNums) {
        const $count = $ratingNums.nextElementSibling;
        const m = $count.innerText.match(/\d+/);
        if (m) {
            ratingsCount = m[0];
        }
        averageScore = $ratingNums.innerText;
    }
    const greayName = $item.querySelector('.subject-cast')
        .innerText;
    return {
        name: $title.textContent.trim(),
        greyName: greayName.split('/')[0].replace('原名:', '').trim(),
        releaseDate: (greayName.match(/\d{4}$/) || [])[0],
        url: href,
        score: averageScore,
        count: ratingsCount,
    };
}
/**
 * 通过首页搜索的结果
 * @param query 搜索字符串
 */
function getHomeSearchResults(query, cat = '1002') {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `https://www.douban.com/search?cat=${cat}&q=${encodeURIComponent(query)}`;
        const rawText = yield fetchText(url);
        const $doc = new DOMParser().parseFromString(rawText, 'text/html');
        const items = $doc.querySelectorAll('.search-result > .result-list > .result > .content');
        return Array.prototype.slice
            .call(items)
            .map(($item) => convertHomeSearchItem($item));
    });
}
function updateInterest$1(subjectId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        let url = `https://movie.douban.com/j/subject/${subjectId}/interest?`;
        const interestObj = findInterestStatusById(data.interest);
        const collectInfo = yield fetchJson(url);
        const interestStatus = collectInfo.interest_status;
        const tags = collectInfo.tags;
        const $doc = new DOMParser().parseFromString(collectInfo.html, 'text/html');
        const $form = $doc.querySelector('form');
        const formData = new FormData($form);
        const sendData = {
            interest: interestObj.key,
            tags: data.tags,
            comment: data.comment,
            rating: data.rating,
        };
        if (tags && tags.length) {
            sendData.tags = tags.join(' ');
        }
        if (interestStatus) {
            sendData.interest = interestStatus;
        }
        if (data.privacy === '1') {
            // @ts-ignore
            sendData.privacy = 'on';
        }
        for (let [key, val] of Object.entries(sendData)) {
            if (!formData.has(key)) {
                formData.append(key, val);
            }
        }
        yield fetch($form.action, {
            method: 'POST',
            body: formData,
        });
    });
}
function checkAnimeSubjectExist$1(subjectInfo) {
    return __awaiter(this, void 0, void 0, function* () {
        let query = (subjectInfo.name || '').trim();
        if (!query) {
            console.info('Query string is empty');
            return Promise.reject();
        }
        const rawInfoList = yield getHomeSearchResults(query);
        // const rawInfoList = await getSubjectSearchResults(query);
        const options = {
            keys: ['name', 'greyName'],
        };
        let searchResult = filterResults(rawInfoList, subjectInfo, options);
        console.info(`Search result of douban: `, searchResult);
        if (searchResult && searchResult.url) {
            return searchResult;
        }
    });
}
const siteUtils$1 = {
    name: '豆瓣',
    contanerSelector: '#board',
    getUserId: getUserId$1,
    getSubjectId: getSubjectId$1,
    getAllPageInfo: getAllPageInfo$1,
    updateInterest: updateInterest$1,
    checkSubjectExist: checkAnimeSubjectExist$1,
};

/**
 * 为页面添加样式
 * @param style
 */
/**
 * 下载内容
 * https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
 * @example
 * download(csvContent, 'dowload.csv', 'text/csv;encoding:utf-8');
 * BOM: data:text/csv;charset=utf-8,\uFEFF
 * @param content 内容
 * @param fileName 文件名
 * @param mimeType 文件类型
 */
function downloadFile(content, fileName, mimeType = 'application/octet-stream') {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], {
        type: mimeType,
    }));
    a.style.display = 'none';
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
/**
 * @param {String} HTML 字符串
 * @return {Element}
 */
function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim();
    template.innerHTML = html;
    // template.content.childNodes;
    return template.content.firstChild;
}

let bangumiData = null;
const typeIdDict$1 = {
    dropped: {
        name: '抛弃',
        id: '5',
    },
    on_hold: {
        name: '搁置',
        id: '4',
    },
    do: {
        name: '在看',
        id: '3',
    },
    collect: {
        name: '看过',
        id: '2',
    },
    wish: {
        name: '想看',
        id: '1',
    },
};
function getBangumiSubjectId(name = '', greyName = '') {
    var _a;
    if (!bangumiData)
        return;
    const obj = bangumiData.items.find((item) => {
        let cnNames = [];
        if (item.titleTranslate && item.titleTranslate['zh-Hans']) {
            cnNames = item.titleTranslate['zh-Hans'];
        }
        return (item.title === name ||
            item.title === greyName ||
            cnNames.includes(greyName));
    });
    return (_a = obj === null || obj === void 0 ? void 0 : obj.sites) === null || _a === void 0 ? void 0 : _a.find((item) => item.site === 'bangumi').id;
}
function genCSVContent(infos) {
    const header = '\ufeff名称,别名,发行日期,地址,封面地址,收藏日期,我的评分,标签,吐槽,其它信息,类别,同步情况';
    let csvContent = '';
    const keys = Object.keys(infos);
    keys.forEach((key) => {
        infos[key].forEach((item) => {
            csvContent += `\r\n${item.name || ''},${item.greyName || ''},${item.releaseDate || ''}`;
            const subjectUrl = item.url;
            csvContent += `,${subjectUrl}`;
            const cover = item.cover || '';
            csvContent += `,${cover}`;
            const collectInfo = item.collectInfo || {};
            const collectDate = collectInfo.date || '';
            csvContent += `,${collectDate}`;
            const score = collectInfo.score || '';
            csvContent += `,${score}`;
            const tag = collectInfo.tag || '';
            csvContent += `,${tag}`;
            const comment = collectInfo.comment || '';
            csvContent += `,"${comment}"`;
            const rawInfos = item.rawInfos || '';
            csvContent += `,"${rawInfos}"`;
            csvContent += `,"${typeIdDict$1[key].name}"`;
            csvContent += `,"${item.syncStatus || ''}"`;
        });
    });
    return header + csvContent;
}
// 区分是否为动画
function isJpMovie(item) {
    return item.rawInfos.indexOf('日本') !== -1;
}
function clearLogInfo($container) {
    $container
        .querySelectorAll('.e-wiki-log-info')
        .forEach((node) => node.remove());
}
function init(site) {
    GM_addStyle(`
  .e-userjs-export-tool-container input {
    margin-bottom: 12px;
  }
  .e-userjs-export-tool-container .import-btn{
    margin-top: 12px;
  }
  .e-userjs-export-tool-container .export-btn {
    display: none;
  }
`);
    let targetUtils;
    let originUtils;
    if (site === 'bangumi') {
        targetUtils = siteUtils$1;
        originUtils = siteUtils;
    }
    else {
        targetUtils = siteUtils;
        originUtils = siteUtils$1;
    }
    const name = targetUtils.name;
    const $parent = document.querySelector(originUtils.contanerSelector);
    const $container = htmlToElement(`
<div class="e-userjs-export-tool-container">
  <label>${name}主页 URL: </label><br/>
  <input placeholder="输入${name}主页的 URL" class="inputtext" autocomplete="off" type="text" size="30" name="tags" value="">
<label for="movie-type-select">选择同步类型:</label>
<select name="movieType" id="movie-type-select">
    <option value="">所有</option>
    <option value="do">在看</option>
    <option value="wish">想看</option>
    <option value="collect">看过</option>
</select><br/>
  <input class="inputBtn import-btn" value="导入${name}动画收藏" name="importBtn" type="submit"><br/>
  <input class="inputBtn export-btn" value="导出${name}动画的收藏同步信息" name="exportBtn" type="submit">
</div>
  `);
    const $input = $container.querySelector('input');
    const $btn = $container.querySelector('.import-btn');
    const $exportBtn = $container.querySelector('.export-btn');
    const interestInfos = {
        do: [],
        collect: [],
        wish: [],
        dropped: [],
        on_hold: [],
    };
    $exportBtn.addEventListener('click', (e) => __awaiter(this, void 0, void 0, function* () {
        const $text = e.target;
        $text.value = '导出中...';
        let strName = `${name}动画的收藏`;
        const csv = genCSVContent(interestInfos);
        // $text.value = '导出完成';
        $text.style.display = 'none';
        downloadFile(csv, `${strName}-${formatDate(new Date())}.csv`);
    }));
    $btn.addEventListener('click', (e) => __awaiter(this, void 0, void 0, function* () {
        try {
            bangumiData = JSON.parse(GM_getResourceText('bangumiDataURL'));
        }
        catch (e) {
            console.log('parse JSON:', e);
        }
        const val = $input.value;
        if (!val) {
            alert(`请输入${name}主页地址`);
            return;
        }
        const userId = targetUtils.getUserId(val);
        if (!userId) {
            alert(`无效${name}主页地址`);
        }
        const $select = $container.querySelector('#movie-type-select');
        // const arr: InterestType[] = ['wish'];
        let arr = ['do', 'collect', 'wish'];
        if ($select && $select.value) {
            arr = [$select.value];
        }
        for (let type of arr) {
            try {
                const res = yield targetUtils.getAllPageInfo(userId, 'movie', type);
                for (let i = 0; i < res.length; i++) {
                    // for test
                    if (i > 1)
                        return;
                    const item = res[i];
                    // 在 Bangumi 上 非日语的条目跳过
                    if (site === 'bangumi' && !isJpMovie(item)) {
                        interestInfos[type].push(item);
                        continue;
                    }
                    let subjectId = '';
                    // 使用 bangumi data
                    if (site === 'bangumi') {
                        subjectId = getBangumiSubjectId(item.name, item.greyName);
                    }
                    if (!subjectId) {
                        const result = yield originUtils.checkSubjectExist({
                            name: item.name,
                            releaseDate: item.releaseDate,
                        });
                        console.info('search results: ', result);
                        if (result && result.url) {
                            subjectId = originUtils.getSubjectId(result.url);
                        }
                    }
                    if (subjectId) {
                        clearLogInfo($container);
                        const nameStr = `<span style="color:tomato">《${item.name}》</span>`;
                        insertLogInfo($btn, `更新收藏 ${nameStr} 中...`);
                        yield originUtils.updateInterest(subjectId, Object.assign(Object.assign({ interest: typeIdDict$1[type].id }, item.collectInfo), { rating: item.collectInfo.score || '' }));
                        yield sleep(300);
                        insertLogInfo($btn, `更新收藏 ${nameStr} 成功`);
                        item.syncStatus = '成功';
                    }
                }
            }
            catch (error) {
                console.error(error);
            }
        }
        clearLogInfo($container);
        $exportBtn.style.display = 'inline-block';
    }));
    $parent.appendChild($container);
}
if (location.href.match(/bgm.tv|bangumi.tv|chii.in/)) {
    init('bangumi');
}
if (location.href.match(/douban.com/)) {
    init('douban');
}
