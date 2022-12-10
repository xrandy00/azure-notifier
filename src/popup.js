function init() {
    document.getElementsByName("volume")[0].addEventListener('change', changeVolume);

    loadVolume();
    loadChangelog();


    chrome.storage.onChanged.addListener(function (changes, namespace) {
        loadChangelog();
    });
}

function loadVolume() {
    chrome.storage.local.get("volume", function (item) {
        var volumeInput = document.getElementsByName("volume")[0];
        if (item && item.volume) {
            volumeInput.value = item.volume ?? 30;
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
                appendTextToChangelog(`${i + 1} - ${text}`);

            }
        }
    });
}

function changeVolume() {
    chrome.storage.local.set({ "volume": this.value }, function () { });
}

function appendTextToChangelog(text) {
    var changelog = document.getElementById('changelog');
    var node = document.createTextNode(text);

    changelog.appendChild(node);

    const br = document.createElement("br");
    changelog.appendChild(br);

}

init();

