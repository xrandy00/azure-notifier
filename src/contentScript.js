'use strict';

const BUG = 'Bug';
const US = 'User Story';
const COLUMN = 'Column';
const SWIMLANE = 'Swimlane';
const ADDED = 'ADDED';
const REMOVED = 'REMOVED';

function initaiteObserver() {
  let observer = new MutationObserver(mutations => {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
        var addedNode = mutation.addedNodes?.length != 0 ? mutation.addedNodes[0] : null;
        var removedNode = mutation.removedNodes?.length != 0 ? mutation.removedNodes[0] : null;

        if (addedNode != null) {
          if (addedNode?.id?.startsWith('vss') && addedNode?.role == 'group') {
            processNode(addedNode, ADDED);
          }
        }

        if (removedNode != null) {
          if (removedNode?.id?.startsWith('vss') && removedNode?.role == 'group') {

            processNode(removedNode, REMOVED);
          }
        }
      }
    }
  }
  );

  observer.observe(document, { childList: true, subtree: true });

}


function processNode(node, type) {
  var fullTitle = node.getAttribute('aria-label');

  var itemType;
  if (fullTitle.startsWith(BUG)) {
    itemType = BUG;
    fullTitle = fullTitle.substring(4);

  } else if (fullTitle.startsWith(US)) {
    itemType = US;
    fullTitle = fullTitle.substring(11);
  } else {
    return;
  }

  var columnIndex = fullTitle.lastIndexOf(COLUMN);
  var title = fullTitle.substring(0, columnIndex - 2);
  fullTitle = fullTitle.substring(title.length + 2);

  var swimlaneIndex = fullTitle.lastIndexOf(SWIMLANE);
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


  var workItem = {
    id: id,
    type: itemType,
    title: title,
    swimlane: swimlane,
    column: column,
    assignedPerson: assignedPerson
  }

  chrome.runtime.sendMessage(
    {
      type: type,
      payload: workItem,
    },
    (_) => { }
  );
}

function initateDatabase() {
  var nodes = document.querySelectorAll(`div[id^="vss"][role="group"].board-tile`);
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    processNode(node, ADDED);
  }
}


setTimeout(() => {

  initateDatabase();
  initaiteObserver();

}, 2000);

