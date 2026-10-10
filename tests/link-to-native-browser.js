/* SPDX-License-Identifier: GPL-2.0-or-later. Native browser input regression: four drops, two links from one source. */
const fs = require("fs"), http = require("http"), cp = require("child_process");

const root = require("node:path").resolve(__dirname, ".."), assert = require("node:assert/strict");

const server = http.createServer((req, res) => {
    const p = root + new URL(req.url, "http://localhost").pathname;
    try {
        res.setHeader("Content-Type", p.endsWith(".html") ? "text/html" : p.endsWith(".js") ? "application/javascript" : "text/plain");
        res.end(fs.readFileSync(p));
    } catch {
        res.writeHead(404);
        res.end();
    }
});

let chrome;
const timeout = setTimeout(() => {
    chrome?.kill();
    server.closeAllConnections();
    server.close();
    console.error("Native Link-to test timed out");
    process.exit(1);
}, 12e4);

(async () => {
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    chrome = cp.spawn(require(root + "/tests/browser").findBrowser(), [ "--no-sandbox", "--headless", "--remote-debugging-port=0", "--window-size=1500,950", "about:blank" ]);
    let buf = "";
    const endpoint = await new Promise(r => chrome.stderr.on("data", b => {
        buf += b;
        const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) r(m[1]);
    }));
    const pages = await (await fetch("http://" + new URL(endpoint).host + "/json")).json();
    const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    let seq = 0;
    const pending = new Map;
    ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.id) {
            const p = pending.get(m.id);
            pending.delete(m.id);
            m.error ? p.reject(m.error) : p.resolve(m.result);
        }
    };
    const call = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, {
            resolve: resolve,
            reject: reject
        });
        ws.send(JSON.stringify({
            id: id,
            method: method,
            params: params
        }));
    });
    const ev = async expression => {
        const r = await call("Runtime.evaluate", {
            expression: expression,
            awaitPromise: true,
            returnByValue: true
        });
        if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
        return r.result.value;
    };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const wait = async expr => {
        for (let i = 0; i < 100; i++) {
            if (await ev(expr)) return;
            await sleep(100);
        }
        throw Error("Timeout " + expr);
    };
    const click = async (expr, button = "left") => {
        const pos = await ev(`(()=>{const e=${expr};if(!e)throw Error('missing target');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
        await call("Input.dispatchMouseEvent", {
            type: "mouseMoved",
            ...pos
        });
        await call("Input.dispatchMouseEvent", {
            type: "mousePressed",
            ...pos,
            button: button,
            clickCount: 1
        });
        await call("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            ...pos,
            button: button,
            clickCount: 1
        });
        await sleep(250);
    };
    try {
        for (const worker of [ "off", "on" ]) for (const pin of [ false, true ]) {
            await call("Page.navigate", {
                url: `http://127.0.0.1:${server.address().port}/notation/tool/ddn-tool.html?mode=design&worker=${worker}`
            });
            await wait(`document.getElementById('ddn-diagram')?.hasAttribute('data-ddn-rendered')`);
            await ev(`window.s=()=>document.getElementById('ddn-diagram').firstElementChild.shadowRoot`);
            await click(`document.getElementById('ddn-icon-source')`);
            await click(`document.getElementById('ddn-icon-document')`);
            await click(`document.getElementById('ddn-icon-creator')`);
            await click(`document.getElementById('ddn-palette-all')`);
            await click(`document.getElementById('ddn-palette-search')`);
            await call("Input.insertText", {
                text: "entity"
            });
            await sleep(200);
            for (let i = 0; i < 4; i++) {
                const pos = await ev(`(()=>{const e=document.querySelector('.ddn-creator-icon[data-kind="entity"]');e.scrollIntoView();const r=e.getBoundingClientRect();const t=s().querySelector('.stage').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,tx:t.x+150+${i}*300,ty:t.y+180}})()`);
                await call("Input.dispatchMouseEvent", {
                    type: "mouseMoved",
                    x: pos.x,
                    y: pos.y
                });
                await call("Input.dispatchMouseEvent", {
                    type: "mousePressed",
                    x: pos.x,
                    y: pos.y,
                    button: "left",
                    clickCount: 1
                });
                await call("Input.dispatchMouseEvent", {
                    type: "mouseMoved",
                    x: pos.tx,
                    y: pos.ty,
                    buttons: 1
                });
                await call("Input.dispatchMouseEvent", {
                    type: "mouseReleased",
                    x: pos.tx,
                    y: pos.ty,
                    button: "left",
                    clickCount: 1
                });
                await sleep(500);
            }
            await click(`document.getElementById('ddn-pointer-toggle')`);
            await click(`document.getElementById('${pin ? "ddn-pin-arrow" : "ddn-select-arrow"}')`);
            const geometry = await ev(`DDNTool.state.diagram.result.scene.nodes.map(n=>[n.id,n.x,n.y])`);
            const ids = await ev(`Array.from(s().querySelectorAll('.ddn-node')).map(n=>n.dataset.id)`);
            assert.equal(ids.length, 4);
            for (let i = 1; i < 3; i++) {
                const source = `[...s().querySelectorAll('.ddn-node')].find(n=>n.dataset.id===${JSON.stringify(ids[0])}).querySelector('text')`;
                await click(source);
                await click(source, "right");
                await click(`[...s().querySelectorAll('.ddn-ctx button')].find(b=>b.textContent==='Link to…')`);
                await click(`s().querySelectorAll('.ddn-ctx button')[${i - 1}]`);
                await click(`[...s().querySelectorAll('.ddn-ctx button')].find(b=>b.textContent.endsWith('(assoc)'))`);
                await sleep(1e3);
                assert.equal(await ev(`document.getElementById('ddn-action-error')?.open||false`), false, "Link " + i + " must not open an error dialog");
                assert.equal(await ev(`DDNTool.state.diagram.result.scene.routes.length`), i, "Both completed links must remain");
                assert.deepEqual(await ev(`DDNTool.state.diagram.result.scene.nodes.map(n=>[n.id,n.x,n.y])`), geometry, "Linking preserves the dropped positions");
                assert.deepEqual(await ev(`DDNTool.state.diagram.result.scene.quality.errors`), [], "Routes pass geometry checks");
                console.log("PASS", worker, pin ? "Pin" : "Select", "four palette drops, link", i);
            }
            await ev("localStorage.clear()");
        }
    } finally {
        clearTimeout(timeout);
        ws.close();
        chrome.kill();
        server.closeAllConnections();
        server.close();
    }
})().catch(e => {
    console.error(e);
    process.exit(1);
});
