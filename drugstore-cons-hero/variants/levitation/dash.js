/* ------------------------------------------------------------------
 * Dev dash for the cons-hero section.
 * Schema-driven: add a row here and it shows up in the panel.
 * ---------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {

    const SCHEMA = [
        { type: 'group', label: 'Population' },
        { type: 'pair', key: 'COUNT', label: 'Count', min: 1, max: 60, step: 1 },
        { type: 'pair', key: 'COUNT_INTERVAL', label: 'Re-target every', min: 1, max: 30, step: 0.5, unit: 's' },
        { type: 'pair', key: 'ADJUST_DELAY', label: 'Add / remove step', min: 0.1, max: 6, step: 0.1, unit: 's' },

        { type: 'group', label: 'Size' },
        { type: 'pair', key: 'SIZE', label: 'Diameter', min: 1, max: 30, step: 0.1, unit: 'vw' },
        { type: 'range', key: 'SIZE_BIAS', label: 'Size bias', min: 0.4, max: 4, step: 0.05 },

        { type: 'group', label: 'Life' },
        { type: 'toggle', key: 'LIFETIME_ENABLED', label: 'Auto-remove' },
        { type: 'pair', key: 'LIFETIME', label: 'Lifetime', min: 1, max: 60, step: 0.5, unit: 's' },

        { type: 'group', label: 'Split' },
        { type: 'toggle', key: 'SPLIT_ENABLED', label: 'Enabled' },
        { type: 'pair', key: 'SPLIT_DELAY', label: 'Split delay', min: 0.2, max: 20, step: 0.1, unit: 's' },
        { type: 'range', key: 'SPLIT_SCALE', label: 'Child scale', min: 0.3, max: 1, step: 0.01 },
        { type: 'range', key: 'SPLIT_SPEED', label: 'Split speed', min: 0, max: 4, step: 0.05 },

        { type: 'group', label: 'Motion' },
        { type: 'range', key: 'DRIFT', label: 'Drift', min: 0, max: 0.0008, step: 0.00001 },
        { type: 'range', key: 'DRIFT_SPEED', label: 'Drift speed', min: 0.02, max: 1, step: 0.01 },
        { type: 'range', key: 'EDGE_PUSH', label: 'Edge push', min: 0, max: 0.002, step: 0.00005 },
        { type: 'range', key: 'EDGE_MARGIN', label: 'Edge margin', min: 0, max: 0.45, step: 0.01 },
        { type: 'range', key: 'SEPARATION', label: 'Separation', min: 0, max: 0.002, step: 0.00005 },
        { type: 'range', key: 'SEPARATION_GAP', label: 'Separation gap', min: 0, max: 20, step: 0.5, unit: 'vw' },
        { type: 'pair', key: 'SPEED', label: 'Spawn speed', min: 0, max: 2, step: 0.05 },
        { type: 'range', key: 'FRICTION_AIR', label: 'Air friction', min: 0.002, max: 0.15, step: 0.001 },
        { type: 'range', key: 'RESTITUTION', label: 'Bounciness', min: 0, max: 1, step: 0.01 },
        { type: 'toggle', key: 'ROTATE', label: 'Rotate' },

        { type: 'group', label: 'Transitions' },
        { type: 'range', key: 'ENTER_DURATION', label: 'Enter', min: 0.05, max: 3, step: 0.05, unit: 's' },
        { type: 'range', key: 'EXIT_DURATION', label: 'Exit', min: 0.05, max: 3, step: 0.05, unit: 's' },
    ]

    const COLLAPSE_KEY = 'cons-hero:dash-collapsed'

    function init() {
        const hero = window.consHero
        const config = hero.config
        const STORAGE_KEY = hero.storageKey

        const dash = document.createElement('aside')
        dash.className = 'dash'
        dash.innerHTML = `
            <header class="dash__head">
                <span class="dash__title">Cons hero</span>
                <span class="dash__count">0</span>
                <span class="dash__toggle">▾</span>
            </header>
            <div class="dash__body"></div>
        `
        const body = dash.querySelector('.dash__body')
        const count = dash.querySelector('.dash__count')

        SCHEMA.forEach(row => body.appendChild(buildRow(row, config, onChange)))
        body.appendChild(buildActions(hero, config, body))

        document.body.appendChild(dash)

        // collapse
        const head = dash.querySelector('.dash__head')
        if (readLocal(COLLAPSE_KEY) === '1') dash.classList.add('is-collapsed')
        head.addEventListener('click', () => {
            dash.classList.toggle('is-collapsed')
            writeLocal(COLLAPSE_KEY, dash.classList.contains('is-collapsed') ? '1' : '0')
        })

        // `h` hides the whole panel for a clean screenshot
        window.addEventListener('keydown', e => {
            if (e.key === 'h' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                dash.style.display = dash.style.display === 'none' ? '' : 'none'
            }
        })

        function onChange() {
            hero.applyConfig()
            persistConfig(config, STORAGE_KEY)
        }

        setInterval(() => { count.textContent = `${hero.count} / ${hero.target}` }, 200)

        hero.applyConfig()
    }

    /* --------------------------------------------------------------
     * ROW BUILDERS
     * ------------------------------------------------------------ */
    function buildRow(row, config, onChange) {
        if (row.type === 'group') {
            const el = document.createElement('div')
            el.className = 'dash__group'
            el.textContent = row.label
            return el
        }
        if (row.type === 'toggle') return buildToggle(row, config, onChange)
        if (row.type === 'pair') return buildPair(row, config, onChange)
        return buildRange(row, config, onChange)
    }

    function buildRange({ key, label, min, max, step, unit }, config, onChange) {
        const wrap = document.createElement('div')
        wrap.className = 'dash__row'
        wrap.dataset.key = key

        const value = document.createElement('span')
        value.className = 'dash__value'

        const head = document.createElement('div')
        head.className = 'dash__label'
        head.innerHTML = `<span>${label}</span>`
        head.appendChild(value)

        const input = document.createElement('input')
        input.type = 'range'
        input.min = min
        input.max = max
        input.step = step
        input.value = config[key]

        const paint = () => { value.innerHTML = `${format(config[key], step)}<span class="dash__unit">${unit ? ' ' + unit : ''}</span>` }
        paint()

        input.addEventListener('input', () => {
            config[key] = parseFloat(input.value)
            paint()
            onChange()
        })

        wrap.append(head, input)
        wrap.__sync = () => { input.value = config[key]; paint() }
        return wrap
    }

    function buildPair({ key, label, min, max, step, unit }, config, onChange) {
        const wrap = document.createElement('div')
        wrap.className = 'dash__row'
        wrap.dataset.key = key

        const value = document.createElement('span')
        value.className = 'dash__value'

        const head = document.createElement('div')
        head.className = 'dash__label'
        head.innerHTML = `<span>${label}</span>`
        head.appendChild(value)

        const pair = document.createElement('div')
        pair.className = 'dash__pair'

        const inputs = [0, 1].map(i => {
            const input = document.createElement('input')
            input.type = 'range'
            input.min = min
            input.max = max
            input.step = step
            input.value = config[key][i]
            pair.appendChild(input)
            return input
        })

        const paint = () => {
            const [a, b] = config[key]
            value.innerHTML = `${format(a, step)}–${format(b, step)}<span class="dash__unit">${unit ? ' ' + unit : ''}</span>`
        }
        paint()

        inputs.forEach((input, i) => {
            input.addEventListener('input', () => {
                config[key][i] = parseFloat(input.value)
                // keep min ≤ max whichever handle moved
                if (config[key][0] > config[key][1]) {
                    const other = i === 0 ? 1 : 0
                    config[key][other] = config[key][i]
                    inputs[other].value = config[key][i]
                }
                paint()
                onChange()
            })
        })

        wrap.append(head, pair)
        wrap.__sync = () => { inputs.forEach((input, i) => input.value = config[key][i]); paint() }
        return wrap
    }

    function buildToggle({ key, label }, config, onChange) {
        const wrap = document.createElement('label')
        wrap.className = 'dash__check'
        wrap.dataset.key = key

        const text = document.createElement('span')
        text.textContent = label

        const input = document.createElement('input')
        input.type = 'checkbox'
        input.checked = !!config[key]

        const switchEl = document.createElement('span')
        switchEl.className = 'dash__switch'

        input.addEventListener('change', () => {
            config[key] = input.checked
            onChange()
        })

        wrap.append(text, input, switchEl)
        wrap.__sync = () => { input.checked = !!config[key] }
        return wrap
    }

    function buildActions(hero, config, body) {
        const wrap = document.createElement('div')
        wrap.className = 'dash__actions'

        const button = (label, onClick, wide = false) => {
            const el = document.createElement('button')
            el.className = `dash__btn${wide ? ' dash__btn--wide' : ''}`
            el.type = 'button'
            el.textContent = label
            el.addEventListener('click', onClick)
            wrap.appendChild(el)
            return el
        }

        button('Reseed', () => hero.reseed())
        button('Split now', () => hero.splitRandom())
        button('Fill', () => hero.fill(false))
        button('Clear', () => hero.clear())

        const copy = button('Copy config', async () => {
            const snapshot = JSON.stringify(config, null, 4)
            try {
                await navigator.clipboard.writeText(snapshot)
                copy.textContent = 'Copied ✓'
            } catch {
                console.log(snapshot)
                copy.textContent = 'Logged to console'
            }
            setTimeout(() => { copy.textContent = 'Copy config' }, 1400)
        }, true)

        button('Reset to defaults', () => {
            Object.entries(hero.defaults).forEach(([key, value]) => {
                config[key] = Array.isArray(value) ? value.slice() : value
            })
            clearLocal(hero.storageKey)
            body.querySelectorAll('[data-key]').forEach(el => el.__sync && el.__sync())
            hero.applyConfig()
            hero.reseed()
        }, true)

        return wrap
    }

    /* --------------------------------------------------------------
     * PERSISTENCE — tweaks survive a reload
     * ------------------------------------------------------------ */
    function persistConfig(config, key) {
        writeLocal(key, JSON.stringify(config))
    }

    const readLocal = (key) => { try { return localStorage.getItem(key) } catch { return null } }
    const writeLocal = (key, value) => { try { localStorage.setItem(key, value) } catch {} }
    const clearLocal = (key) => { try { localStorage.removeItem(key) } catch {} }

    const format = (value, step) => {
        const decimals = (String(step).split('.')[1] || '').length
        return value.toFixed(decimals)
    }

    if (window.consHero) init()
    else document.addEventListener('cons-hero:ready', init, { once: true })
})
