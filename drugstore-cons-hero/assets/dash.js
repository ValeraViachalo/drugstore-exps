/* ------------------------------------------------------------------
 * Dev dash for the cons-hero section.
 * Schema-driven: add a row here and it shows up in the panel.
 * ---------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {

    const SCHEMA = [
        { type: 'group', label: 'Population' },
        { type: 'range', key: 'MAX_ITEMS', label: 'Max items', min: 1, max: 40, step: 1 },
        { type: 'range', key: 'MAX_ITEMS_MOBILE', label: 'Max items (mobile)', min: 1, max: 20, step: 1, hidden: true },
        { type: 'range', key: 'OVERFLOW_DELAY', label: 'Overflow delay', min: 0, max: 5, step: 0.05, unit: 's' },

        { type: 'group', label: 'Size' },
        { type: 'pair', key: 'SIZE', label: 'Diameter', min: 2, max: 30, step: 0.5, unit: 'vw' },
        { type: 'pair', key: 'SIZE_MOBILE', label: 'Diameter (mobile)', min: 4, max: 50, step: 0.5, unit: 'vw', hidden: true },

        { type: 'group', label: 'Interaction' },
        { type: 'toggle', key: 'HOVER_SPLIT', label: 'Split on hover' },

        { type: 'group', label: 'Auto split' },
        { type: 'toggle', key: 'AUTO_SPLIT', label: 'Enabled' },
        { type: 'range', key: 'AUTO_SPLIT_DELAY', label: 'Every', min: 0.1, max: 10, step: 0.1, unit: 's' },

        { type: 'group', label: 'Physics' },
        { type: 'range', key: 'FRICTION_AIR', label: 'Air friction', min: 0.005, max: 0.2, step: 0.005 },
        { type: 'range', key: 'RESTITUTION', label: 'Bounciness', min: 0, max: 1, step: 0.01 },
        { type: 'range', key: 'FRICTION', label: 'Friction', min: 0, max: 1, step: 0.01 },
        { type: 'range', key: 'DENSITY', label: 'Density', min: 0.0005, max: 0.01, step: 0.0005 },

        { type: 'group', label: 'Motion' },
        { type: 'pair', key: 'SPAWN_SPEED', label: 'Spawn speed', min: 0, max: 6, step: 0.1 },
        { type: 'range', key: 'SPLIT_SPEED', label: 'Split speed', min: 0, max: 5, step: 0.05 },
        { type: 'range', key: 'DRIFT', label: 'Levitation', min: 0, max: 0.001, step: 0.00001 },
        { type: 'range', key: 'DRIFT_SPEED', label: 'Levitation speed', min: 0.02, max: 1, step: 0.01 },
        { type: 'toggle', key: 'ROTATE', label: 'Rotate' },

        { type: 'group', label: 'Transitions' },
        { type: 'range', key: 'ENTER_DURATION', label: 'Enter', min: 0.05, max: 2, step: 0.05, unit: 's' },
        { type: 'range', key: 'EXIT_DURATION', label: 'Exit', min: 0.05, max: 2, step: 0.05, unit: 's' },
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

        SCHEMA.filter(row => !row.hidden)
            .forEach(row => body.appendChild(buildRow(row, config, onChange)))
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
        button('Clear', () => hero.clear(), true)

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
