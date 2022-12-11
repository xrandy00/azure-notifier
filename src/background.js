'use strict';

const consts = require('./consts.js');

var database = {};
var recentlyRemoved = {};
var lastRequest = {};


function processChange(before, after) {
  if (before.title != after.title) {
    return {
      type: consts.CHANGED_TITLE,
      payload: {
        id: before.id,
        type: before.type,
        old: before.title,
        new: after.title,
      },
    };
  }

  if (before.swimlane != after.swimlane) {
    return {
      type: consts.CHANGED_ASSIGNED,
      payload: {
        id: before.id,
        type: before.type,
        old: before.swimlane,
        new: after.swimlane,
      },
    };
  }

  if (before.column != after.column) {
    return {
      type: consts.CHANGED_COLUMN,
      payload: {
        id: before.id,
        type: before.type,
        old: before.column,
        new: after.column,
        person: after.assignedPerson,
      },
    };
  }

  if (before.assignedPerson != after.assignedPerson) {
    return {
      type: consts.CHANGED_SWIMLANE,
      payload: {
        id: before.id,
        type: before.type,
        old: before.assignedPerson,
        new: after.assignedPerson,
      },
    };
  }
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // process each change just once 
  var requestString = JSON.stringify(request);
  if (lastRequest[request.type] == requestString) return true;
  lastRequest[request.type] = requestString;

  const payload = request.payload;
  var response;

  if (request.type === consts.ADDED) {
    if (database[payload.id]) {
      return true;
      // already added, so change message will follow, ignore
    }

    if (recentlyRemoved[payload.id]) {
      delete recentlyRemoved[payload.id];
    } else {
      console.log('added', payload.id);
    }

    database[payload.id] = payload;

  } else if (request.type === consts.REMOVED) {
    var item = database[payload.id];
    if (item) {
      recentlyRemoved[item.id] = payload; // this works - stores old state of item
      delete database[payload.id];

      setTimeout(() => {
        if (recentlyRemoved[item.id]) {
          console.log('deleted', item.id);

          delete recentlyRemoved[item.id];
        }
      }, 1000);
    }
  } else if (request.type === consts.CHANGED) {
    var currentData = database[payload.id];
    if (!currentData) return true;

    response = processChange(currentData, payload);
  }

  sendResponse({
    response,
  });
});


// reload content script when URL changes
chrome.tabs.onUpdated.addListener(
  function (tabId, changeInfo, tab) {
    console.log(tabId, changeInfo);
    // read changeInfo data and do something with it
    // like send the new url to contentscripts.js
    if (changeInfo.url) {
      chrome.tabs.sendMessage(tabId, {
        type: 'urlChanged',
        url: changeInfo.url
      })
    }
  }
);

