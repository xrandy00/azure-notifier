'use strict';

const consts = require('./consts.js');


function initaiteObserver() {
  const board = document.querySelector('div#boardContainer');

  const observer = new MutationObserver(mutations => {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        var addedNode = mutation.addedNodes?.length != 0 ? mutation.addedNodes[0] : null;
        var removedNode = mutation.removedNodes?.length != 0 ? mutation.removedNodes[0] : null;

        if (addedNode != null) {
          if (addedNode?.id?.startsWith('vss') && addedNode?.role == 'group') {
            processNode(addedNode, consts.ADDED);
          }
        }

        if (removedNode != null) {
          if (removedNode?.id?.startsWith('vss') && removedNode?.role == 'group') {
            processNode(removedNode, consts.REMOVED);
          }
        }
      }
    }
  }
  );


  function callback(mutationList) {
    mutationList.forEach((mutation) => {
      switch (mutation.type) {
        case "attributes":
          switch (mutation.attributeName) {
            case "aria-label":
              processNode(mutation.target, consts.CHANGED);
          }
      }
    });
  }

  observer.observe(board, { childList: true, subtree: true });

  const observer2 = new MutationObserver(callback);
  observer2.observe(board, {
    attributeFilter: ["aria-label"],
    attributeOldValue: true,
    subtree: true
  });

}


function processNode(node, type) {
  var fullTitle = node.getAttribute('aria-label');

  var itemType;
  if (fullTitle?.startsWith(consts.BUG)) {
    itemType = consts.BUG;
    fullTitle = fullTitle.substring(4);

  } else if (fullTitle?.startsWith(consts.US)) {
    itemType = consts.US;
    fullTitle = fullTitle.substring(11);
  } else {
    itemType = fullTitle.split(' ')[0];
    fullTitle = fullTitle.substring(itemType.length + 1);
  }

  var columnIndex = fullTitle.lastIndexOf(consts.COLUMN);
  var title = fullTitle.substring(0, columnIndex - 2);
  fullTitle = fullTitle.substring(title.length + 2);

  var swimlaneIndex = fullTitle.lastIndexOf(consts.SWIMLANE);
  var column;
  var swimlane;
  if (swimlaneIndex != -1) {
    column = fullTitle.substring(7, swimlaneIndex - 3).trim();
    swimlane = fullTitle.substring(swimlaneIndex + 9).trim();
  } else {
    column = fullTitle.substring(6).trim();
  }

  var assignedPerson = node.querySelector('span.identity-picker-resolved-name')?.textContent;
  var id = node.querySelector(`div[class="id"]`)?.textContent;

  if (!id || !type || !column || !title) return; // required fields

  var workItem = {
    id: id,
    type: itemType,
    title: title,
    swimlane: swimlane,
    column: column,
    assignedPerson: assignedPerson
  }

  console.log('sending message', type, workItem);
  chrome.runtime.sendMessage(
    {
      type: type,
      payload: workItem,
    },
    (r) => {
      if (r.response) {
        var payload = r.response.payload;

        if (r.response.type == consts.CHANGED_TITLE) {
          notifyChange(payload.id, payload.type, 'Title', payload.old, payload.new, true);
        } else if (r.response.type == consts.CHANGED_ASSIGNED) {
          notifyChange(payload.id, payload.type, 'Assignee', payload.old, payload.new, true);
        } else if (r.response.type == consts.CHANGED_COLUMN) {
          var column = payload.new.toLowerCase().trim();

          if ((column.includes(consts.CLOSED) || column == consts.READY.toLowerCase() || column.includes(consts.DONE))) {
            notifyChange(payload.id, payload.type, 'Column', payload.old, payload.new, false);
            notifyGenericItemClosed();
          } else {
            notifyChange(payload.id, payload.type, 'Column', payload.old, payload.new, true);
          }
        } else if (r.type == consts.CHANGED_SWIMLANE) {
          notifyChange(payload.id, payload.type, 'Swimlane', payload.old, payload.new, true);
        }

      }
    }
  );
}

function initateDatabase() {
  chrome.storage.local.set({ "data": [] }, function () { });

  var nodes = document.querySelectorAll(`div[id^="vss"][role="group"].board-tile`);
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    processNode(node, consts.ADDED);
  }
}

async function playCheer() {
  var song = pickCheerSong();
  var audio = new Audio(chrome.runtime.getURL(song));
  audio.volume = await fetchVolume() / 100;
  audio.play();
}

async function playAlert() {
  var song = pickAlert();
  var audio = new Audio(chrome.runtime.getURL(song));
  var volume = (await fetchVolume());
  if (volume > 0) {
    volume = volume / 2; // alerts are louder then cheer, keep it at half
  }
  audio.volume = volume / 100;
  console.log(volume);
  audio.play();
}

function fetchVolume() {
  try {
    return readLocalStorage("volume") ?? 30;
  } catch {
    return 30;
  }
}

const readLocalStorage = async (key) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], function (result) {
      if (result[key] === undefined) {
        reject(null);
      } else {
        resolve(result[key]);
      }
    });
  });
};



function notifyGenericItemClosed(id, title, person) {
  playCheer();
  createBalloons(45);
  setTimeout(() => { removeBalloons() }, 5000);

  // if (person) {
  //   alert(`${person} closed item! ${id}: ${title}`);
  // } else {
  //   alert(`Item closed! ${id}: ${title}`);
  // }
}

function notifyChange(id, type, property, from, to, song) {
  console.log('notify change');
  if (song) {
    playAlert();
  }


  var text = `${type} ${id}, ${property} changed from "${from}" to "${to}"`;
  chrome.storage.local.get("data", function (rootObject) {
    console.log(rootObject);

    if (!rootObject?.data) {
      rootObject.data = [];
    }

    rootObject.data.push(text);
    console.log(rootObject.data);

    chrome.storage.local.set({ "data": rootObject.data }, function () { });
  });
}

function htmlToElement(html) {
  var template = document.createElement('template');
  html = html.trim(); // Never return a text node of whitespace as the result
  template.innerHTML = html;
  return template.content.firstChild;
}

function onIconClick(id, index) {
  var icon = document.getElementById(id).querySelector("i");
  icon.classList.toggle('bowtie-chevron-left');
  icon.classList.toggle('bowtie-chevron-right');

  var header = document.querySelectorAll(`div.cell.inprogress`)[index];

  if (icon.classList.contains('bowtie-chevron-left')) {
    // expand
    header.style.width = null;
    header.children[0].children[0].style.display = null;


    var tables = document.querySelectorAll(`div.horizontal-table`);

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      var tableWidth = table.clientWidth;

      var sizeDifference = parseInt(table.getAttribute('widthDifferenceForOneItem'), 10);
      var newWidth = tableWidth + sizeDifference;

      table.style['width'] = `${newWidth}px`;
    }

    var swimlanes = document.querySelector(`div.cell.member-content.member.content.swimlanes`);
    if (swimlanes) {
      var children = swimlanes?.children ?? [];
      for (var i = 0; i < children.length; i++) {
        var swimlane = children[i];
        var child = swimlane.querySelectorAll(`div.cell.member-content.member.content.inprogress`)[index];
        child.style.width = null;
        child.style.opacity = '1';
      }
    } else {
      var swimlane = document.querySelector(`div.content-container.row.content`);
      var child = swimlane.querySelectorAll(`div.cell.member-content.member.content.inprogress`)[index];
      child.style.width = null;
      child.style.opacity = '1';
    }

  } else {
    // collapse
    header.style.width = '80px';
    header.children[0].children[0].style.display = "none";

    var swimlanes = document.querySelector(`div.cell.member-content.member.content.swimlanes`);
    var maxWidthBefore = 0;

    if (swimlanes) {
      var children = swimlanes?.children ?? [];
      for (var i = 0; i < children.length; i++) {
        var swimlane = children[i];
        var child = swimlane.querySelectorAll(`div.cell.member-content.member.content.inprogress`)[index];
        var currentWidth = child.clientWidth;
        maxWidthBefore = Math.max(currentWidth, maxWidthBefore);

        child.style.width = '80px';
        child.style.overflow = 'hidden';
        child.style.opacity = '0.25';
      }
    } else {
      var swimlane = document.querySelector(`div.content-container.row.content`);
      var child = swimlane.querySelectorAll(`div.cell.member-content.member.content.inprogress`)[index];
      var currentWidth = child.clientWidth;
      maxWidthBefore = Math.max(currentWidth, maxWidthBefore);

      child.style.width = '80px';
      child.style.overflow = 'hidden';
      child.style.opacity = '0.25';
    }


    if (!swimlanes) {
      swimlanes = document.querySelector(`div.content-container.row.content`);
    }

    var sizeDifference = maxWidthBefore - 80;
    var tables = document.querySelectorAll(`div.horizontal-table`);

    tables.forEach((table) => {
      var tableWidth = table.clientWidth;

      table.setAttribute('widthDifferenceForOneItem', sizeDifference);

      table.style.width = `${tableWidth - sizeDifference}px`;
      table.style.display = null;

    });
  }
}

function addCollapseButtons() {
  var nodes = document.querySelector(`div.header-container.header`).querySelectorAll(`div.cell.inprogress`);
  if (nodes && nodes.length > 0) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      const collapseNode = htmlToElement(`
      <a id="azure-notifier-column-collapse-icon-${i}">
        <i class="bowtie-icon bowtie-chevron-left" style="font-size: 20px"></i>
      </a>
      `);

      var targetNode = node.children[1]?.children[0]?.children[0];
      if (!targetNode) return;

      targetNode.insertAdjacentElement('beforebegin', collapseNode);
      var element = document.getElementById(`azure-notifier-column-collapse-icon-${i}`);
      element.addEventListener("click", () => {
        onIconClick(`azure-notifier-column-collapse-icon-${i}`, i);
      });

    }
  }
}

function pickCheerSong() {
  const cheers = [
    "cheer_1.mp3",
    "cheer_2.wav",
    "cheer_3.wav",
    "cheer_4.wav",
    "cheer_5.wav",
    "cheer_6.wav",
    "cheer_7.wav",
    "cheer_8.wav",
    "cheer_9.wav"
  ];

  return cheers[getRandomInt(cheers.length)];
}

function pickAlert() {
  const alerts = [
    "alert_1.wav",
    "alert_2.wav",
    "alert_3.wav",
    "alert_4.wav",
    "alert_5.wav",
  ];

  return alerts[getRandomInt(alerts.length)];
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

setTimeout(() => {
  initateDatabase();
  initaiteObserver();
  addCollapseButtons();

}, 2000);




// balloons
function random(num) {
  return Math.floor(Math.random() * num);
}

function getRandomStyles() {
  var r = random(255);
  var g = random(255);
  var b = random(255);
  var mt = random(200);
  var ml = random(50);
  var dur = random(5) + 5;
  return `
  background-color: rgba(${r},${g},${b},0.7);
  color: rgba(${r},${g},${b},0.7); 
  box-shadow: inset -7px -3px 10px rgba(${r - 10},${g - 10},${b - 10},0.7);
  margin: ${mt}px 0 0 ${ml}px;
  animation: float ${dur}s ease-in infinite
  `;
}

function createBalloons(num) {
  var div = document.createElement('div');
  div.id = "balloon-container";
  document.body.insertBefore(div, document.body.children[0]);
  const balloonContainer = document.getElementById("balloon-container");


  for (var i = num; i > 0; i--) {
    var balloon = document.createElement("div");
    balloon.className = "balloon";
    balloon.style.cssText = getRandomStyles();
    balloonContainer.append(balloon);
  }
}

function removeBalloons() {
  const balloonContainer = document.getElementById("balloon-container");
  balloonContainer.style.opacity = 0;
  setTimeout(() => {
    balloonContainer.remove()
  }, 500)
}

window.addEventListener("click", () => {
  removeBalloons();
});
