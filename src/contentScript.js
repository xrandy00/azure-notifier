'use strict';

const consts = require('./consts.js');

var loadInProgress = false;
var shrinkSizeForOneItem = null;


function initaiteObserver() {
  const board = document.querySelector('div#boardContainer');
  if (!board) return;

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
  if (!fullTitle) return;

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
  var volume = await fetchCheerVolume();
  if (volume == 0) return;
  audio.volume = volume / 100;
  audio.play();
}

async function playAlert() {
  var song = pickAlert();
  var audio = new Audio(chrome.runtime.getURL(song));
  var volume = (await fetchAlertVolume());
  if (volume == 0) return;
  audio.volume = volume / 100;
  audio.play();
}

function fetchCheerVolume() {
  try {
    return readLocalStorage("cheerVolume") ?? 30;
  } catch {
    return 30;
  }
}

function fetchAlertVolume() {
  try {
    return readLocalStorage("alertVolume") ?? 30;
  } catch {
    return 30;
  }
}

function fetchBalloonsEnabled() {
  try {
    return readLocalStorage("balloons") ?? true;
  } catch {
    return true;
  }
}

function fetchCollapsiblesEnabled() {
  try {
    return readLocalStorage("collapsibles") ?? true;
  } catch {
    return true;
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

async function notifyGenericItemClosed(id, title, person) {
  playCheer();

  var balloonsEnabled = await fetchBalloonsEnabled();
  if (balloonsEnabled) {
    createBalloons(45);
    setTimeout(() => { removeBalloons() }, 5000);
  }

}

function notifyChange(id, type, property, from, to, song) {
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


  if (icon.classList.contains('bowtie-chevron-left')) {
    enforceExpanded(index);
  } else {
    enforceCollapsed(index);
  }
}

function enforceCollapsed(index) {
  console.log(index);

  var header = document.querySelectorAll(`div.cell.inprogress`)[index];

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

    if (shrinkSizeForOneItem == null) {
      shrinkSizeForOneItem = sizeDifference;
    }

    table.style.width = `${tableWidth - sizeDifference}px`;
    table.style.display = null;

  });
}

function enforceExpanded(index) {
  console.log(index);
  var header = document.querySelectorAll(`div.cell.inprogress`)[index];

  // expand
  header.style.width = null;
  header.children[0].children[0].style.display = null;

  var tables = document.querySelectorAll(`div.horizontal-table`);

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    var tableWidth = table.clientWidth;

    var newWidth = tableWidth + shrinkSizeForOneItem;

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

}

async function addCollapseButtons() {
  var collapsiblesEnabled = await fetchCollapsiblesEnabled();
  if (!collapsiblesEnabled) return;

  var nodes = document.querySelector(`div.header-container.header`)?.querySelectorAll(`div.cell.inprogress`);
  if (nodes && nodes.length > 0) {
    var addedIcons = []; // array of arrays (triplets) [id, index, icon node]

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

      addedIcons.push([`azure-notifier-column-collapse-icon-${i}`, i]);
    }

    hijactClickEventsOnOriginalCollapseIcons();
  }


  function hijactClickEventsOnOriginalCollapseIcons() {
    var icons = document.querySelectorAll(`i.bowtie-icon[role="button"]`);
    if (icons && icons.length > 0) {
      for (let i = 0; i < icons.length; i++) {
        const icon = icons[i];
        icon.addEventListener('click', function (event) {
          console.log('icon click', event);
          for (let i = 0; i < addedIcons.length; i++) {
            const iconData = addedIcons[i];

            var iconElement = document.getElementById(iconData[0]).querySelector("i");

            console.log(iconElement.classList);
            if (iconElement.classList.contains('bowtie-chevron-right')) {
              enforceCollapsed(iconData[1]);
            } else {
              // for some reason it breaks when I uncomment this line
              // enforceExpanded(iconData[1]);
            }
          }
        });

      }
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

function listenToUrlChange() {
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      // listen for messages sent from background.js
      if (request.type == 'urlChanged') {
        if (loadInProgress) return true;
        loadInProgress = true;
        console.log('changing url');
        setTimeout(() => {
          addCollapseButtons();
          loadInProgress = false;
        }, 2000);
      }

      return true;
    });
}

loadInProgress = true;
setTimeout(() => {
  initateDatabase();
  initaiteObserver();
  addCollapseButtons();
  listenToUrlChange();
  loadInProgress = false;
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

  window.addEventListener("click", () => {
    removeBalloons();
  });
}

function removeBalloons() {
  const balloonContainer = document.getElementById("balloon-container");

  if (!balloonContainer) return;

  window.removeEventListener("click", () => {
    removeBalloons();
  });
  balloonContainer.style.opacity = 0;
  setTimeout(() => {
    balloonContainer.remove()
  }, 500)
}


