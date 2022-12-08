'use strict';

var database = {};
var recentlyRemoved = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const payload = request.payload;
  if (request.type === 'ADDED') {
    if (recentlyRemoved[payload.id]) {
      console.log('modified', payload.id);
      // TODO - what changed? notify user
      delete recentlyRemoved[payload.id];
    } else {
      console.log('added', payload.id);
      // TODO - notify user
    }

    database[payload.id] = payload;

  }

  if (request.type === 'REMOVED') {
    var item = database[payload.id];
    if (item) {
      recentlyRemoved[item.id] = item;
      delete database[payload.id];

      setTimeout(() => {
        if (recentlyRemoved[item.id]) {
          console.log('deleted', item.id);
          // TODO - notify user?

          delete recentlyRemoved[item.id];
        }
      }, 500);
    }
  }
  return true;
});
