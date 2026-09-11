// Scene config panel — a tuning tool, not part of the effect.
//
// It drives the page only through window.aboutScene, the surface scroll.js hands out, so
// deleting this one script tag from the page removes the panel and changes nothing else.
//
// Camera, Ring and Scene edit the LAYOUT that is currently in force — desktop or mobile,
// whichever the viewport is on — and the badge in the header says which. Everything else is
// shared. Values are kept in localStorage so a reload does not throw the session away, which
// also means the page can come up on your last tweak rather than on what scroll.js says :
// Reset puts the file's own numbers back, and Copy config hands you the blocks to paste in.

window.addEventListener("DOMContentLoaded", () => {

    const api = window.aboutScene
    if (!api) return

    const STORE_KEY = "drugstore-about-config"

    // path            where the value lives. "layout." resolves against whichever layout is in
    //                 force right now, so the same row edits desktop or mobile as you resize.
    // min / max / step the slider. step also decides how many decimals the readout shows.
    const SECTIONS = [
        {
            title: "Scene", scoped: true, fields: [
                { path: "layout.perspective", label: "perspective", min: 30, max: 300, step: 1 },
                { path: "layout.mediaSize", label: "media size", min: 4, max: 60, step: 0.5 }
            ]
        },
        {
            title: "Camera", scoped: true, fields: [
                { path: "layout.view.translateX", label: "translate X", min: -60, max: 60, step: 0.5 },
                { path: "layout.view.translateY", label: "translate Y", min: -60, max: 60, step: 0.5 },
                { path: "layout.view.translateZ", label: "translate Z", min: -120, max: 60, step: 0.5 },
                { path: "layout.view.rotateX", label: "rotate X", min: -180, max: 180, step: 1 },
                { path: "layout.view.rotateY", label: "rotate Y", min: -180, max: 180, step: 1 },
                { path: "layout.view.rotateZ", label: "rotate Z", min: -180, max: 180, step: 1 }
            ]
        },
        {
            title: "Ring", scoped: true, fields: [
                { path: "layout.ringWidth", label: "ring width", min: 0.1, max: 3, step: 0.01 },
                { path: "layout.gapUnits", label: "gap", min: -4, max: 12, step: 0.1 },
                { path: "layout.gapWarp", label: "gap warp", min: 0, max: 0.9, step: 0.01 }
            ]
        },
        {
            title: "Depth", fields: [
                { path: "TUNE.depthScale", label: "scale", min: 0, max: 1, step: 0.01 },
                { path: "TUNE.depthFade", label: "fade", min: 0, max: 1, step: 0.01 },
                { path: "TUNE.depthBlur", label: "blur", min: 0, max: 8, step: 0.1 }
            ]
        },
        {
            title: "Motion", fields: [
                { path: "TUNE.revolutionSeconds", label: "revolution, s", min: 3, max: 120, step: 1 },
                { path: "TUNE.scrollSensitivity", label: "scroll push", min: 0, max: 0.02, step: 0.0005 },
                { path: "TUNE.maxBoostFactor", label: "max boost, ×", min: 0, max: 40, step: 1 },
                { path: "TUNE.boostDecay", label: "boost decay, s", min: 0.05, max: 3, step: 0.05 },
                { path: "TUNE.driftTurn", label: "turn, s", min: 0, max: 3, step: 0.05 },
                { path: "TUNE.turnThreshold", label: "turn threshold, px", min: 0, max: 30, step: 1 }
            ]
        },
        {
            title: "Reveal", fields: [
                { path: "TUNE.revealGroups", label: "groups", min: 1, max: 14, step: 1 },
                { path: "TUNE.revealFrom", label: "from", min: 0, max: 1, step: 0.01 },
                { path: "TUNE.revealTo", label: "to", min: 0, max: 1, step: 0.01 },
                { path: "TUNE.revealSpan", label: "span", min: 0.02, max: 1, step: 0.01 }
            ]
        },
        {
            title: "Disclaimer", fields: [
                { path: "TUNE.noteOpacity", label: "opacity", min: 0, max: 1, step: 0.01 },
                { path: "TUNE.noteFade", label: "fade out by", min: 0.01, max: 1, step: 0.01 }
            ]
        }
    ]

    // px throughout, never rem : the page's root font-size is fluid, and a panel that resized
    // itself with the design would be unusable at the ends of the range.
    const CSS = `
.scene-config {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 9999;
    width: 272px;
    max-width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
    display: flex;
    flex-direction: column;
    border: 1px solid rgb(255 255 255 / 0.14);
    border-radius: 10px;
    background: rgb(16 16 16 / 0.86);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    color: #fff;
    font: 400 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    box-shadow: 0 12px 40px rgb(0 0 0 / 0.5);
}
.scene-config__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 9px 9px 12px;
    border-bottom: 1px solid rgb(255 255 255 / 0.1);
}
.scene-config__title {
    flex: 1;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: 10px;
    color: rgb(255 255 255 / 0.5);
}
.scene-config__layout {
    padding: 2px 6px;
    border-radius: 4px;
    background: rgb(255 255 255 / 0.1);
    font-size: 10px;
    color: rgb(255 255 255 / 0.75);
}
.scene-config__toggle {
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: 4px;
    background: rgb(255 255 255 / 0.1);
    color: #fff;
    font: inherit;
    line-height: 1;
    cursor: pointer;
}
.scene-config__toggle:hover { background: rgb(255 255 255 / 0.2); }
.scene-config__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px 12px 12px;
}
.scene-config[data-collapsed="true"] .scene-config__body,
.scene-config[data-collapsed="true"] .scene-config__foot { display: none; }
.scene-config__section { padding-top: 10px; }
.scene-config__section-title {
    margin-bottom: 6px;
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgb(255 255 255 / 0.35);
}
.scene-config__row { display: block; padding: 3px 0; }
.scene-config__line {
    display: flex;
    align-items: center;
    gap: 6px;
}
.scene-config__label {
    flex: 1;
    color: rgb(255 255 255 / 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
/* a row the file itself does not say : marks what Copy config would carry over */
.scene-config__row[data-dirty="true"] .scene-config__label { color: #fff; }
.scene-config__row[data-dirty="true"] .scene-config__label::before {
    content: "•";
    margin-right: 4px;
    color: #7ec4ff;
}
.scene-config__number {
    width: 62px;
    padding: 2px 4px;
    border: 1px solid rgb(255 255 255 / 0.14);
    border-radius: 4px;
    background: rgb(255 255 255 / 0.06);
    color: #fff;
    font: inherit;
    text-align: right;
}
.scene-config__number:focus {
    outline: none;
    border-color: rgb(126 196 255 / 0.7);
}
.scene-config__range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 14px;
    margin-top: 2px;
    background: transparent;
    cursor: ew-resize;
}
.scene-config__range::-webkit-slider-runnable-track {
    height: 2px;
    border-radius: 2px;
    background: rgb(255 255 255 / 0.18);
}
.scene-config__range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    margin-top: -4px;
    border-radius: 50%;
    background: #fff;
}
.scene-config__range::-moz-range-track {
    height: 2px;
    border-radius: 2px;
    background: rgb(255 255 255 / 0.18);
}
.scene-config__range::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border: 0;
    border-radius: 50%;
    background: #fff;
}
.scene-config__foot {
    display: flex;
    gap: 6px;
    padding: 9px 12px;
    border-top: 1px solid rgb(255 255 255 / 0.1);
}
.scene-config__button {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid rgb(255 255 255 / 0.14);
    border-radius: 5px;
    background: rgb(255 255 255 / 0.06);
    color: #fff;
    font: inherit;
    cursor: pointer;
}
.scene-config__button:hover { background: rgb(255 255 255 / 0.16); }
.scene-config__hint {
    padding: 0 12px 10px;
    font-size: 10px;
    color: rgb(255 255 255 / 0.35);
}
@media (max-width: 768px) {
    .scene-config {
        top: auto;
        right: 8px;
        left: 8px;
        bottom: 8px;
        width: auto;
        max-height: 52vh;
    }
}
`

    // ---------------------------------------------------------------------------------------
    // The numbers scroll.js was written with. Taken before anything stored is merged in, so
    // Reset always goes back to the file and never to an earlier session.
    const clone = value => JSON.parse(JSON.stringify(value))
    const DEFAULTS = { DESKTOP: clone(api.DESKTOP), MOBILE: clone(api.MOBILE), TUNE: clone(api.TUNE) }

    // Only ever writes over keys that already exist and are numbers, so a stale or hand-edited
    // store can never introduce a field the scene does not know what to do with.
    function merge(target, source) {
        if (!source || typeof source !== "object") return
        Object.keys(target).forEach(key => {
            if (typeof target[key] === "number") {
                if (typeof source[key] === "number" && isFinite(source[key])) target[key] = source[key]
            } else if (target[key] && typeof target[key] === "object") {
                merge(target[key], source[key])
            }
        })
    }

    function restore() {
        let saved = null
        try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null") } catch (e) { saved = null }
        if (!saved) return
        merge(api.DESKTOP, saved.DESKTOP)
        merge(api.MOBILE, saved.MOBILE)
        merge(api.TUNE, saved.TUNE)
    }

    function save() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify({
                DESKTOP: api.DESKTOP, MOBILE: api.MOBILE, TUNE: api.TUNE
            }))
        } catch (e) { /* private window, quota : the panel still works, it just forgets */ }
    }

    // "layout.view.rotateX" -> the object holding rotateX, plus the key. The layout is resolved
    // on every call, so the rows follow the breakpoint without being rebuilt.
    function resolve(path) {
        const parts = path.split(".")
        let obj = parts[0] === "layout" ? api.layout() : api[parts[0]]
        for (let i = 1; i < parts.length - 1; i++) obj = obj[parts[i]]
        return { obj, key: parts[parts.length - 1] }
    }

    function defaultOf(path) {
        const parts = path.split(".")
        const which = parts[0] === "layout"
            ? (api.layout() === api.MOBILE ? "MOBILE" : "DESKTOP")
            : parts[0]
        let obj = DEFAULTS[which]
        for (let i = 1; i < parts.length - 1; i++) obj = obj[parts[i]]
        return obj[parts[parts.length - 1]]
    }

    const decimals = step => (String(step).split(".")[1] || "").length
    const format = (value, step) => value.toFixed(decimals(step))

    // ---------------------------------------------------------------------------------------
    restore()
    api.refresh()

    const style = document.createElement("style")
    style.textContent = CSS
    document.head.appendChild(style)

    const panel = document.createElement("aside")
    panel.className = "scene-config"
    panel.innerHTML = `
        <div class="scene-config__head">
            <span class="scene-config__title">Scene config</span>
            <span class="scene-config__layout" data-layout></span>
            <button class="scene-config__toggle" data-toggle type="button">–</button>
        </div>
        <div class="scene-config__body"></div>
        <div class="scene-config__hint">Camera · Ring · Scene edit the layout in the badge. C toggles.</div>
        <div class="scene-config__foot">
            <button class="scene-config__button" data-action="copy" type="button">Copy config</button>
            <button class="scene-config__button" data-action="reset" type="button">Reset</button>
        </div>
    `

    const body = panel.querySelector(".scene-config__body")
    const rows = []

    SECTIONS.forEach(section => {
        const wrap = document.createElement("div")
        wrap.className = "scene-config__section"
        wrap.innerHTML = `<div class="scene-config__section-title">${section.title}</div>`

        section.fields.forEach(field => {
            // A div, not a label : two controls under one label would hand every click on the
            // row to whichever of them came first.
            const row = document.createElement("div")
            row.className = "scene-config__row"
            row.innerHTML = `
                <span class="scene-config__line">
                    <span class="scene-config__label">${field.label}</span>
                    <input class="scene-config__number" type="number"
                           min="${field.min}" max="${field.max}" step="${field.step}">
                </span>
                <input class="scene-config__range" type="range"
                       min="${field.min}" max="${field.max}" step="${field.step}">
            `
            const number = row.querySelector(".scene-config__number")
            const range = row.querySelector(".scene-config__range")
            const entry = { field, row, number, range }

            const write = raw => {
                const value = parseFloat(raw)
                if (!isFinite(value)) return
                const { obj, key } = resolve(field.path)
                obj[key] = value
                api.refresh()
                save()
                syncRow(entry)
            }

            range.addEventListener("input", () => write(range.value))
            number.addEventListener("input", () => write(number.value))

            rows.push(entry)
            wrap.appendChild(row)
        })

        body.appendChild(wrap)
    })

    function syncRow(entry) {
        const { obj, key } = resolve(entry.field.path)
        const value = obj[key]
        const text = format(value, entry.field.step)
        if (document.activeElement !== entry.number) entry.number.value = text
        entry.range.value = value
        entry.row.dataset.dirty = String(value !== defaultOf(entry.field.path))
    }

    const layoutBadge = panel.querySelector("[data-layout]")

    function syncAll() {
        layoutBadge.textContent = api.layout() === api.MOBILE ? "mobile" : "desktop"
        rows.forEach(syncRow)
    }

    // Reads the live objects back out as the three blocks they are declared as in scroll.js.
    function snippet() {
        const js = value => JSON.stringify(value, null, 4).replace(/"([A-Za-z_$][\w$]*)":/g, "$1:")
        return [
            `const DESKTOP = ${js(api.DESKTOP)}`,
            `const MOBILE = ${js(api.MOBILE)}`,
            `const TUNE = ${js(api.TUNE)}`
        ].join("\n\n")
    }

    async function copy(button) {
        const text = snippet()
        const label = button.textContent
        let ok = true
        try {
            await navigator.clipboard.writeText(text)
        } catch (e) {
            // No clipboard permission, or an insecure origin : leave it somewhere reachable.
            ok = false
            console.log(text)
        }
        button.textContent = ok ? "Copied" : "See console"
        setTimeout(() => { button.textContent = label }, 1400)
    }

    panel.querySelector("[data-toggle]").addEventListener("click", () => {
        const collapsed = panel.dataset.collapsed === "true"
        panel.dataset.collapsed = String(!collapsed)
        panel.querySelector("[data-toggle]").textContent = collapsed ? "–" : "+"
        try { localStorage.setItem(STORE_KEY + ":collapsed", String(!collapsed)) } catch (e) { /* ignore */ }
    })

    panel.querySelector('[data-action="copy"]').addEventListener("click", event => copy(event.currentTarget))

    panel.querySelector('[data-action="reset"]').addEventListener("click", () => {
        merge(api.DESKTOP, DEFAULTS.DESKTOP)
        merge(api.MOBILE, DEFAULTS.MOBILE)
        merge(api.TUNE, DEFAULTS.TUNE)
        api.refresh()
        try { localStorage.removeItem(STORE_KEY) } catch (e) { /* ignore */ }
        syncAll()
    })

    // C toggles the panel, but not while a number field has the caret.
    window.addEventListener("keydown", event => {
        if (event.key !== "c" && event.key !== "C") return
        if (event.metaKey || event.ctrlKey || event.altKey) return
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) return
        panel.querySelector("[data-toggle]").click()
    })

    // The layout badge and the layout-scoped rows follow the breakpoint.
    window.addEventListener("resize", syncAll)

    document.body.appendChild(panel)

    let collapsed = "false"
    try { collapsed = localStorage.getItem(STORE_KEY + ":collapsed") || "false" } catch (e) { /* ignore */ }
    panel.dataset.collapsed = collapsed
    panel.querySelector("[data-toggle]").textContent = collapsed === "true" ? "+" : "–"

    syncAll()
})
