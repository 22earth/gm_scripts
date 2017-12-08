import browser from 'webextension-polyfill';


/**
 * dollar 选择符
 * @param {string} selector 
 */
function $(selector) {
  return document.querySelector(selector);
}

function injectScript(fn, data) {
  var selfInvokeScript = document.createElement("script");
  selfInvokeScript.innerHTML = `(${fn.toString()})(${data});`;
  document.body.appendChild(selfInvokeScript);
}
/**
 * 生成infobox的字符串
 * @param {string} infoType
 * @param {Object[]} infoArray
 */
function genWikiString(infoType, infoArray) {
  let infobox = ["{{Infobox " + infoType];
  for (const info of infoArray) {
    if (Array.isArray(info.data)) {
      let d = data.map((item) => {
        if (item.name) {
          return `[${item.name}|${item.data}]`;
        } else {
          return `[${item}]`;
        }
      }).join('\n');
      infobox.push(`|${info.name}={${d}\n}`);
    } else {
      infobox.push(`|${info.name}=${info.data}`);
    }
  }
  infobox.push('}}');
  console.log('infobox', infobox);
  return infobox.join('\n');
}

function fillSubjectInfo() {

  var pNode = $('.settings .inputtext');
  
}

function fillInfoBox(infoArray) {
  var $infobox = $('#subject_infobox');
  var arr = $infobox.value.split('\n');
  var newArr = [];
  for (var info of infoArray) {
    let isDefault = false;
    for (var i = 0, len = arr.length; i < len; i++) {
      let n = arr[i].replace(/\||=.*/g, '');
      if (n === info.name) {
        arr[i] = arr[i].replace('*', '') + info.data;
        isDefault = true;
        break;
      }
    }
    if (!isDefault && info.name && !info.category) {
      newArr.push(`|${info.name}=${info.data}`);
    }
  }
  arr.pop();
  $infobox.value = [...arr, ...newArr, '}}'].join('\n');
}
var t = [
  {
    "name": "名称",
    "data": "青春ブタ野郎はバニーガール先輩の夢を見ない 1",
    "category": "subject_title"
  },
  {
    "name": "ISBN",
    "data": "404892480X"
  },
  {
    "name": "发售日",
    "data": "2016/10/8",
    "category": "date"
  },
  {},
  {
    "name": "出版社",
    "data": "KADOKAWA"
  },
  {
    "name": "页数",
    "data": "162ページ"
  },
  {
    "name": "价格",
    "data": "￥ 616"
  },
  {
    "name": "内容简介",
    "data": "海と空に囲まれた湘南の町で始まる、ちょっとフシギな恋の物語。ゴールデンウィークの最終日。高校二年生の少年・梓川咲太は、静謐な空気漂う図書館で、野生のバニーガールと出会った――。電撃文庫の大人気タイトル『青春ブタ野郎』シリーズの、コミカライズ第1巻!",
    "category": "subject_summary"
  }
]
function test(data) {
  console.log('data', data);
}
injectScript(test, '12313');