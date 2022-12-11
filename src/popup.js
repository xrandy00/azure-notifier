import './popup.css';

function init() {
    document.getElementsByName("alertVolume")[0].addEventListener('change', changeAlertVolume);
    document.getElementsByName("cheerVolume")[0].addEventListener('change', changeCheerVolume);
    document.getElementsByName("balloons")[0].addEventListener('change', changeBalloons);
    document.getElementsByName("collapsibles")[0].addEventListener('change', changeCollapsible);

    loadConfig();
    loadChangelog();


    chrome.storage.onChanged.addListener(function (changes, namespace) {
        loadChangelog();
    });
}

function loadConfig() {
    chrome.storage.local.get("alertVolume", function (item) {
        var volumeInput = document.getElementsByName("alertVolume")[0];
        if (item && item.alertVolume) {
            volumeInput.value = item.alertVolume ?? 30;
        }
    });

    chrome.storage.local.get("cheerVolume", function (item) {
        var volumeInput = document.getElementsByName("cheerVolume")[0];
        if (item && item.cheerVolume) {
            volumeInput.value = item.cheerVolume ?? 30;
        }
    });

    chrome.storage.local.get("balloons", function (item) {
        var balloonsBool = document.getElementsByName("balloons")[0];
        if (item && item.balloons) {
            balloonsBool.checked = item.balloons ?? true;
        }
    });

    chrome.storage.local.get("collapsibles", function (item) {
        var collapsiblesBool = document.getElementsByName("collapsibles")[0];
        if (item && item.collapsibles) {
            collapsiblesBool.checked = item.collapsibles ?? true;
        }
    });
}

function loadChangelog() {
    chrome.storage.local.get("data", function (item) {
        var changelog = document.getElementById('changelog');
        changelog.innerHTML = null;

        if (item && item.data) {
            for (let i = 0; i < item.data.length; i++) {
                var text = item.data[i];
                addTextToChangelog(`${i + 1} - ${text}`);

            }
        }
    });
}

function changeAlertVolume() {
    chrome.storage.local.set({ "alertVolume": this.value }, function () { });
}

function changeCheerVolume() {
    chrome.storage.local.set({ "cheerVolume": this.value }, function () { });
}

function changeBalloons() {
    chrome.storage.local.set({ "balloons": this.checked }, function () { });
}

function changeCollapsible() {
    chrome.storage.local.set({ "collapsibles": this.checked }, function () { });
}


function addTextToChangelog(text) {
    var changelog = document.getElementById('changelog');
    var node = document.createTextNode(text);
    const br = document.createElement("br");

    changelog.insertBefore(br, changelog.firstChild);
    changelog.insertBefore(node, changelog.firstChild);
}

init();

