(function () {
    'use strict';

    const {
        stash,
        Stash,
        waitForElementId,
        waitForElementClass,
        waitForElementByXpath,
        getElementByXpath,
        getElementsByXpath,
        getClosestAncestor,
        sortElementChildren,
        createElementFromHTML,
    } = unsafeWindow.stash;

    document.body.appendChild(document.createElement('style')).textContent = `
    .search-item > div.row:first-child > div.col-md-6.my-1 > div:first-child { display: flex; flex-direction: column; }
    .tagger-remove { order: 10; }
    `;

    let running = false;
    let maxCount = 0;
    const SAVE_DELAY_MS = 150; // gap between Save clicks; lower = closer to "all at once"

    const btnId = 'batch-save';
    const startLabel = 'Save All';
    const stopLabel = 'Stop Save';
    const btn = document.createElement("button");
    btn.setAttribute("id", btnId);
    btn.classList.add('btn', 'btn-primary', 'ml-3');
    btn.innerHTML = startLabel;
    btn.onclick = () => {
        if (running) {
            stop();
        }
        else {
            start();
        }
    };

    function eligibleSaveButtons() {
        return [...document.querySelectorAll('.btn.btn-primary')].filter(button => {
            if (button.innerText !== 'Save' || button.disabled) return false;
            const searchItem = getClosestAncestor(button, '.search-item');
            return !(searchItem && searchItem.classList.contains('d-none'));
        });
    }

    function start() {
        if (!confirm("Are you sure you want to batch save?")) return;
        btn.innerHTML = stopLabel;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-danger');
        running = true;
        stash.setProgress(0);
        maxCount = eligibleSaveButtons().length;
        if (!maxCount) {
            stop();
            return;
        }
        // Self-driving loop: re-query each tick and click the next Save button.
        // Intentionally does NOT wait on per-scene stash:response events — that
        // chain stalled forever after the first save when the response id never
        // matched. We just drain every visible Save button until none remain.
        const clicked = new WeakSet();
        let done = 0;
        (function tick() {
            if (!running) return;
            const next = eligibleSaveButtons().find(button => !clicked.has(button));
            if (!next) {
                stop();
                return;
            }
            clicked.add(next);
            try {
                next.click();
            } catch (e) {
                console.error('[batch-save] click failed:', e);
            }
            done += 1;
            stash.setProgress(Math.min(done / maxCount, 1) * 100);
            setTimeout(tick, SAVE_DELAY_MS);
        })();
    }

    function stop() {
        btn.innerHTML = startLabel;
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-primary');
        running = false;
        stash.setProgress(0);
    }

    stash.addEventListener('tagger:mutations:header', evt => {
        const el = getElementByXpath("//button[text()='Scrape All']");
        if (el && !document.getElementById(btnId)) {
            const container = el.parentElement;
            container.appendChild(btn);
            sortElementChildren(container);
            el.classList.add('ml-3');
        }
    });

    function checkSaveButtonDisplay() {
        const taggerContainer = document.querySelector('.tagger-container');
        const saveButton = getElementByXpath("//button[text()='Save']", taggerContainer);
        btn.style.display = saveButton ? 'inline-block' : 'none';
    }

    stash.addEventListener('tagger:mutations:searchitems', checkSaveButtonDisplay);

    async function initRemoveButtons() {
        const nodes = getElementsByXpath("//button[contains(@class, 'btn-primary') and text()='Scrape by fragment']");
        const buttons = [];
        let node = null;
        while (node = nodes.iterateNext()) {
            buttons.push(node);
        }
        for (const button of buttons) {
            const searchItem = getClosestAncestor(button, '.search-item');

            const removeButtonExists = searchItem.querySelector('.tagger-remove');
            if (removeButtonExists) {
                continue;
            }

            const removeEl = createElementFromHTML('<div class="mt-2 text-right tagger-remove"><button class="btn btn-danger">Remove</button></div>');
            const removeButton = removeEl.querySelector('button');
            button.parentElement.parentElement.appendChild(removeEl);
            removeButton.addEventListener('click', async () => {
                searchItem.classList.add('d-none');
            });
        }
    }

    stash.addEventListener('page:studio:scenes', function () {
        waitForElementByXpath("//button[contains(@class, 'btn-primary') and text()='Scrape by fragment']", initRemoveButtons);
    });

    stash.addEventListener('page:performer:scenes', function () {
        waitForElementByXpath("//button[contains(@class, 'btn-primary') and text()='Scrape by fragment']", initRemoveButtons);
    });

    stash.addEventListener('page:scenes', function () {
        waitForElementByXpath("//button[contains(@class, 'btn-primary') and text()='Scrape by fragment']", initRemoveButtons);
    });
})();