/* =============================================================================
   Sphere effect (ported from mwg_099) + live config panel
   ========================================================================== */

const IMAGES = [
    'assets/v-1.png', 'assets/v-2.png', 'assets/v-3.png',
    'assets/v-4.png', 'assets/v-5.png', 'assets/v-6.png',
    'assets/v-7.png', 'assets/v-8.png', 'assets/v-9.png'
]

// Mirrors DEFAULTS in drugstore-frontend (src/components/AboutPage/AboutFooter), so a tweak
// made here means the same thing once it is carried over. shuffle, objectFit, logoInSphere
// and autoRotate exist only for the panel — the component has them fixed.
const DEFAULT_CONFIG = {
    // sphere
    radiusFactor: 0.18,
    radiusOffset: 100,
    perspective: 130,
    stretchX: 1.65,          // > 1 widens the sphere into an ellipsoid
    stretchY: 0.9,
    shuffle: false,
    // medias
    mediaSize: 15,
    objectFit: 'contain',
    depthOpacity: 0.35,
    depthBlur: 4.5,          // px of blur at the very back, easing to 0 at the front
    backdropBlur: 35,        // blur behind each photo, masked to the photo's own shape
    // acceleration — input steers along ONE axis, the drift's own: with the tumble it adds
    // speed, against it the sphere slows and, past the base rate, turns over. It always
    // coasts back to the drift.
    scrollBoost: 0.02,       // page scroll near the section
    wheelBoost: 0.03,        // horizontal wheel / trackpad
    dragBoost: 0.1,          // mouse / trackpad drag
    touchDragBoost: 0.4,     // finger drag — a touch delta covers more ground per frame
    boostMax: 1.6,           // ceiling in deg/frame, so a fast flick can't fling the sphere
    boostDecay: 0.94,        // per-frame fade once the input stops
    // logo
    logoInSphere: true,      // front medias cross over the logo instead of always passing behind
    // auto rotation. A constant pair of rates always composes into ONE fixed axis,
    // which leaves the medias nearest that axis stuck at the rim, never facing front.
    // Breathing the horizontal rate keeps tilting the axis so every media comes round.
    autoRotate: true,
    xPeriod: 30,             // seconds for one full turn about the X axis
    autoRotateRight: 0.06,   // base horizontal rate; + drifts right, - drifts left
    driftSweep: 0.04,        // how far that rate swings over the cycle (keep < |base| to stay one-way)
    // mobile (<= 768px) overrides. Stretch has its own slot, so tuning the portrait sphere
    // no longer drags the desktop one with it — narrower than tall, the mirror of desktop.
    mobileRadiusFactor: 0.15,
    mobilePerspective: 170,
    mobileMediaSize: 22.5,
    mobileStretchX: 0.85,
    mobileStretchY: 1
}

const SCHEMA = [
    {
        title: 'Sphere',
        fields: [
            { key: 'radiusFactor', label: 'Radius × width', type: 'range', min: 0.05, max: 0.6, step: 0.01 },
            { key: 'radiusOffset', label: 'Radius offset (px)', type: 'range', min: -200, max: 400, step: 5 },
            { key: 'perspective', label: 'Perspective (vw)', type: 'range', min: 20, max: 160, step: 1 },
            { key: 'stretchX', label: 'Stretch \u2194 width', type: 'range', min: 0.5, max: 3, step: 0.05 },
            { key: 'stretchY', label: 'Stretch \u2195 height', type: 'range', min: 0.5, max: 3, step: 0.05 },
            { key: 'shuffle', label: 'Shuffle order', type: 'checkbox', rebuild: true }
        ]
    },
    {
        title: 'Medias',
        fields: [
            { key: 'mediaSize', label: 'Media size (vw)', type: 'range', min: 3, max: 30, step: 0.5 },
            { key: 'objectFit', label: 'Object fit', type: 'select', options: ['contain', 'cover', 'fill', 'scale-down'] },
            { key: 'depthOpacity', label: 'Depth fade', type: 'range', min: 0, max: 1, step: 0.01 },
            { key: 'depthBlur', label: 'Depth blur (px)', type: 'range', min: 0, max: 12, step: 0.5 },
            { key: 'backdropBlur', label: 'Backdrop blur (px)', type: 'range', min: 0, max: 40, step: 0.5 }
        ]
    },
    {
        title: 'Acceleration',
        fields: [
            { key: 'scrollBoost', label: 'Page scroll', type: 'range', min: 0, max: 0.2, step: 0.005 },
            { key: 'wheelBoost', label: 'Horizontal wheel', type: 'range', min: 0, max: 0.3, step: 0.005 },
            { key: 'dragBoost', label: 'Drag (mouse)', type: 'range', min: 0, max: 0.4, step: 0.005 },
            { key: 'touchDragBoost', label: 'Drag (touch)', type: 'range', min: 0, max: 1, step: 0.01 },
            { key: 'boostMax', label: 'Ceiling (\u00b0/frame)', type: 'range', min: 0.1, max: 6, step: 0.1 },
            { key: 'boostDecay', label: 'Decay', type: 'range', min: 0.8, max: 0.995, step: 0.005 }
        ]
    },
    {
        title: 'Auto rotation',
        fields: [
            { key: 'autoRotate', label: 'Enabled', type: 'checkbox' },
            { key: 'xPeriod', label: 'X turn (s)', type: 'range', min: 5, max: 120, step: 1 },
            { key: 'autoRotateRight', label: 'Drift → right', type: 'range', min: -0.5, max: 0.5, step: 0.01 },
            { key: 'driftSweep', label: 'Drift sweep', type: 'range', min: 0, max: 0.3, step: 0.005 }
        ]
    },
    {
        title: 'Logo',
        fields: [
            { key: 'logoInSphere', label: 'Items pass over logo', type: 'checkbox' }
        ]
    },
    {
        title: 'Mobile (\u2264 768px)',
        fields: [
            { key: 'mobileMediaSize', label: 'Media size (vw)', type: 'range', min: 4, max: 40, step: 0.5 },
            { key: 'mobileRadiusFactor', label: 'Radius \u00d7 width', type: 'range', min: 0.05, max: 0.9, step: 0.01 },
            { key: 'mobilePerspective', label: 'Perspective (vw)', type: 'range', min: 20, max: 250, step: 1 },
            { key: 'mobileStretchX', label: 'Stretch ↔ width', type: 'range', min: 0.5, max: 3, step: 0.05 },
            { key: 'mobileStretchY', label: 'Stretch ↕ height', type: 'range', min: 0.5, max: 3, step: 0.05 }
        ]
    }
]

// mask-size has to track object-fit so the blur lands exactly under the artwork
const MASK_SIZE = { contain: 'contain', cover: 'cover', fill: '100% 100%', 'scale-down': 'contain' }

// bumped when the defaults were synced from the frontend, so an older session's tweaks
// can't come back up over them
const STORAGE_KEY = 'sphere-effect-config-v2'

window.addEventListener('DOMContentLoaded', () => {

    const root = document.querySelector('.sphere-effect')
    const container = root.querySelector('.sphere-container')
    const sphereBack = root.querySelector('.sphere--back')
    const sphereFront = root.querySelector('.sphere--front')
    const logo = root.querySelector('.sphere-logo')

    const config = loadConfig()

    let medias = []
    let arts = []       // the image inside each media — where the depth cues are written
    let zOrder = []     // paint order each media was last given within its plane
    let positions = []
    let radius = 0, radiusX = 0, radiusY = 0

    /* ------------------------------ sphere build ------------------------------ */

    const goldenAngle = Math.PI * (3 - Math.sqrt(5))

    function buildSphere() {
        medias.forEach((m) => m.remove())
        const order = IMAGES.map((src, i) => i)
        if (config.shuffle) {
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[order[i], order[j]] = [order[j], order[i]]
            }
        }

        const frag = document.createDocumentFragment()
        order.forEach((index) => {
            const src = IMAGES[index]

            const wrap = document.createElement('div')
            wrap.className = 'media'
            // resolve against the document: a url() in a custom property is otherwise
            // resolved relative to the stylesheet, which sits one folder deeper
            wrap.style.setProperty('--mask', `url("${new URL(src, location.href).href}")`)

            const backdrop = document.createElement('div')
            backdrop.className = 'media__backdrop'

            const img = document.createElement('img')
            img.className = 'media__img'
            img.src = src
            img.alt = ''
            img.draggable = false

            wrap.append(backdrop, img)
            frag.appendChild(wrap)
        })
        sphereBack.appendChild(frag)
        medias = Array.from(sphereBack.querySelectorAll('.media'))
        arts = medias.map((media) => media.querySelector('.media__img'))
        zOrder = medias.map(() => -1)

        // Initial positions on the sphere (Fibonacci spiral)
        positions = medias.map((media, index) => {
            const y = 1 - (2 * index) / (medias.length - 1 || 1)
            const phi = Math.acos(y) - Math.PI / 2
            const theta = (index * goldenAngle) % (2 * Math.PI)
            return {
                x: Math.cos(phi) * Math.cos(theta),
                y: Math.sin(phi),
                z: Math.cos(phi) * Math.sin(theta)
            }
        })
    }

    const isMobile = () => window.innerWidth <= 768

    function applyStyles() {
        const mobile = isMobile()
        const size = mobile ? config.mobileMediaSize : config.mediaSize
        const factor = mobile ? config.mobileRadiusFactor : config.radiusFactor
        const persp = mobile ? config.mobilePerspective : config.perspective
        const spreadX = mobile ? config.mobileStretchX : config.stretchX
        const spreadY = mobile ? config.mobileStretchY : config.stretchY

        root.style.setProperty('--media-size', size + 'vw')
        root.style.setProperty('--media-fit', config.objectFit)
        root.style.setProperty('--mask-size', MASK_SIZE[config.objectFit] || 'contain')
        root.style.setProperty('--backdrop-blur', config.backdropBlur + 'px')
        radius = factor * window.innerWidth + config.radiusOffset
        radiusX = radius * spreadX
        radiusY = radius * spreadY
        gsap.set([sphereBack, sphereFront], { perspective: persp + 'vw' })
    }

    /* -------------------------------- rotation -------------------------------- */

    // Current 3×3 matrix (identity), row-major: indices 0–2, 3–5, 6–8
    const m = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    const mTmp = [0, 0, 0, 0, 0, 0, 0, 0, 0]
    const R = [0, 0, 0, 0, 0, 0, 0, 0, 0]

    /** Replace m with left × m (row-major matrices). */
    function premultiply3x3(left) {
        for (let i = 0; i < 3; i++) {
            const a = left[i * 3], b = left[i * 3 + 1], c = left[i * 3 + 2]
            for (let j = 0; j < 3; j++) {
                mTmp[i * 3 + j] = a * m[j] + b * m[3 + j] + c * m[6 + j]
            }
        }
        for (let k = 0; k < 9; k++) m[k] = mTmp[k]
    }

    const auto = { x: 0, y: 0 }     // the only thing that turns the sphere

    let boost = 0                   // deg/frame along the drift's direction, ± the base rate

    /**
     * The drift at time `t`: a steady turn about the X axis, plus a horizontal rate
     * that breathes over the same cycle. The breathing is what keeps the rotation
     * axis moving, so no media stays parked at the rim.
     */
    function spinAt(t) {
        const period = Math.max(config.xPeriod, 0.1)
        return {
            right: config.autoRotateRight + config.driftSweep * Math.sin(Math.PI * 2 * t / period),
            up: 360 / (period * 60)      // one full revolution per period, at 60fps
        }
    }

    /**
     * Where the sphere is heading ON SCREEN right now, as a unit vector, screen y growing
     * downward. Refreshed every frame by the ticker; seeded here so a drag before the
     * first tick still reads the right way.
     */
    const travel = { x: 0, y: 0 }
    function aimTravel(spin) {
        const len = Math.hypot(spin.right, spin.up) || 1
        travel.x = spin.right / len
        travel.y = -spin.up / len
    }
    aimTravel(spinAt(0))

    /**
     * Signed, and that sign is the whole point: going WITH the sphere adds speed, going
     * against it slows the drift and — past the base rate — flips the tumble from
     * bottom-up to top-down. It coasts back to the drift on its own, so the reversal
     * lasts only as long as the gesture.
     */
    function accelerate(amount, gain) {
        boost = Math.max(-config.boostMax, Math.min(boost + amount * gain, config.boostMax))
    }

    let prevX = 0, prevY = 0

    function updateMedias() {
        const totalX = auto.x
        const totalY = auto.y

        const dY = (totalY - prevY) * Math.PI / 180
        const dX = (totalX - prevX) * Math.PI / 180
        prevY = totalY
        prevX = totalX

        if (dX !== 0 || dY !== 0) {
            // Incremental rotation about screen axes (not world axes)
            const cy = Math.cos(dY), sy = Math.sin(dY)
            const cx = Math.cos(dX), sx = Math.sin(dX)
            R[0] = cy; R[1] = 0; R[2] = sy
            R[3] = sx * sy; R[4] = cx; R[5] = -sx * cy
            R[6] = -cx * sy; R[7] = sx; R[8] = cx * cy
            premultiply3x3(R)
        }

        for (let i = 0; i < medias.length; i++) {
            const p = positions[i]
            const x = m[0] * p.x + m[1] * p.y + m[2] * p.z
            const y = m[3] * p.x + m[4] * p.y + m[5] * p.z
            const z = m[6] * p.x + m[7] * p.y + m[8] * p.z
            const media = medias[i]
            media.style.transform = `translate3d(${x * radiusX}px, ${-y * radiusY}px, ${z * radius}px)`

            // hop between the two planes only when the sign of z actually flips
            const plane = (config.logoInSphere && z > 0) ? sphereFront : sphereBack
            if (media.parentElement !== plane) plane.appendChild(media)

            // A plane is flat, so within it paint order is the only depth cue left, and it
            // has to track z: a media that has just come round is the FARTHEST of its plane,
            // not the topmost it would be as the last child appended — and that happens at
            // the rim, where they overlap most, so it read as a jump. Quantised, and written
            // only on a change, so layers are not re-sorted every frame.
            const order = Math.round((z + 1) * 250)
            if (zOrder[i] !== order) {
                zOrder[i] = order
                media.style.zIndex = order
            }

            // depth cues: z is -1 (back) → 1 (front). Written to the image, never the media:
            // opacity or filter on the media makes it the backdrop root, and the masked blur
            // behind the photo would sample nothing.
            const depth = (z + 1) / 2
            const art = arts[i]
            art.style.opacity = 1 - config.depthOpacity * (1 - depth)
            art.style.filter = config.depthBlur
                ? `blur(${(config.depthBlur * (1 - depth)).toFixed(2)}px)`
                : ''
        }
    }

    /* ------------------------------- interaction ------------------------------ */

    let isTouch = false
    gsap.matchMedia().add('(hover: none)', () => { isTouch = true })

    Observer.create({
        target: root,
        type: 'wheel,touch,pointer',
        onWheel: (e) => {
            // vertical wheel belongs to the page; the scroll listener picks that up
            if (!e.deltaX) return
            accelerate(e.deltaX, config.wheelBoost)
        },
        onDrag: (e) => {
            // a drag pushes the sphere, so it is the gesture projected onto the direction of
            // travel: with the tumble it speeds up, against it the medias turn round and
            // follow the finger back
            accelerate(
                e.deltaX * travel.x + e.deltaY * travel.y,
                isTouch ? config.touchDragBoost : config.dragBoost
            )
        }
    })

    /* ------------------------------- scroll boost ----------------------------- */

    let lastScrollY = window.scrollY

    /** 1 while the section is on screen, tapering to 0 a viewport height away. */
    function proximity() {
        const r = root.getBoundingClientRect()
        const vh = window.innerHeight
        const gap = Math.max(r.top - vh, -r.bottom, 0)   // 0 whenever it overlaps
        return Math.max(0, 1 - gap / vh)
    }

    // passive: the page scrolls as it always would, we only read how fast
    window.addEventListener('scroll', () => {
        const y = window.scrollY
        const dy = y - lastScrollY
        lastScrollY = y
        // scrolling DOWN carries content up, the way the sphere already tumbles, so it adds
        // speed — and scrolling back up turns it over
        accelerate(dy, config.scrollBoost * proximity())
    }, { passive: true })

    /* ---------------------------------- ticker -------------------------------- */

    gsap.ticker.add((time, deltaTime) => {
        const f = deltaTime / (1000 / 60)   // frames elapsed at 60fps

        boost *= Math.pow(config.boostDecay, f)
        if (Math.abs(boost) < 1e-4) boost = 0

        // the boost rides whatever direction the drift points in right now
        const spin = spinAt(time)
        const len = Math.hypot(spin.right, spin.up) || 1
        const baseRight = config.autoRotate ? spin.right : 0
        const baseUp = config.autoRotate ? spin.up : 0
        auto.y += (baseRight + (spin.right / len) * boost) * f
        auto.x -= (baseUp + (spin.up / len) * boost) * f
        aimTravel(spin)

        updateMedias()
    })

    window.addEventListener('resize', applyStyles)

    // to prevent safari perspective bug
    gsap.set([sphereBack, sphereFront], { transformStyle: 'flat' })

    /* ------------------------------- config panel ----------------------------- */

    const panel = document.querySelector('.cfg-panel')
    const body = panel.querySelector('.cfg-body')
    const output = panel.querySelector('.cfg-out textarea')
    const outBlock = panel.querySelector('.cfg-out')
    const inputs = new Map()

    SCHEMA.forEach((group) => {
        const wrap = document.createElement('div')
        wrap.className = 'cfg-group'
        wrap.innerHTML = `<h3>${group.title}</h3>`

        group.fields.forEach((field) => {
            const row = document.createElement('div')
            row.className = 'cfg-row'
            const id = `cfg-${field.key}`

            let control
            if (field.type === 'range') {
                row.innerHTML =
                    `<label for="${id}">${field.label}</label><output id="${id}-out"></output>`
                control = document.createElement('input')
                control.type = 'range'
                control.min = field.min
                control.max = field.max
                control.step = field.step
                row.appendChild(control)
            } else if (field.type === 'select') {
                row.innerHTML = `<label for="${id}">${field.label}</label>`
                control = document.createElement('select')
                field.options.forEach((opt) => {
                    const o = document.createElement('option')
                    o.value = o.textContent = opt
                    control.appendChild(o)
                })
                row.appendChild(control)
            } else if (field.type === 'checkbox') {
                row.innerHTML = `<label for="${id}">${field.label}</label>`
                control = document.createElement('input')
                control.type = 'checkbox'
                row.appendChild(control)
            } else if (field.type === 'color') {
                row.innerHTML = `<label for="${id}">${field.label}</label>`
                control = document.createElement('input')
                control.type = 'color'
                row.appendChild(control)
            }

            control.id = id
            control.addEventListener('input', () => {
                config[field.key] = readControl(control, field)
                if (field.type === 'range') {
                    row.querySelector('output').textContent = formatValue(config[field.key], field)
                }
                if (field.rebuild) buildSphere()
                applyStyles()
                syncOutput()
                saveConfig()
            })

            inputs.set(field.key, { control, field, row })
            wrap.appendChild(row)
        })

        body.insertBefore(wrap, outBlock)
    })

    function readControl(control, field) {
        if (field.type === 'checkbox') return control.checked
        if (field.type === 'range') return parseFloat(control.value)
        return control.value
    }

    function formatValue(value, field) {
        const step = String(field.step)
        const decimals = step.includes('.') ? step.split('.')[1].length : 0
        return value.toFixed(decimals)
    }

    function syncInputs() {
        inputs.forEach(({ control, field, row }, key) => {
            const value = config[key]
            if (field.type === 'checkbox') control.checked = value
            else control.value = value
            if (field.type === 'range') {
                row.querySelector('output').textContent = formatValue(value, field)
            }
        })
    }

    function syncOutput() {
        output.value = JSON.stringify(config, null, 2)
    }

    function saveConfig() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
        } catch (e) { /* storage unavailable — tweaks just won't persist */ }
    }

    // copy
    const copyBtn = panel.querySelector('[data-action="copy"]')
    copyBtn.addEventListener('click', async () => {
        const text = JSON.stringify(config, null, 2)
        try {
            await navigator.clipboard.writeText(text)
        } catch (e) {
            output.select()
            document.execCommand('copy')
        }
        copyBtn.textContent = 'Copied ✓'
        copyBtn.classList.add('is-copied')
        setTimeout(() => {
            copyBtn.textContent = 'Copy config'
            copyBtn.classList.remove('is-copied')
        }, 1400)
    })

    // reset
    panel.querySelector('[data-action="reset"]').addEventListener('click', () => {
        Object.assign(config, DEFAULT_CONFIG)
        try { localStorage.removeItem(STORAGE_KEY) } catch (e) {}
        syncInputs()
        buildSphere()
        boost = 0
        applyStyles()
        syncOutput()
    })

    // toggle
    const toggle = document.querySelector('.cfg-toggle')
    toggle.addEventListener('click', () => { panel.hidden = !panel.hidden })
    window.addEventListener('keydown', (e) => {
        const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)
        if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey && !typing) {
            panel.hidden = !panel.hidden
        }
    })

    /* ----------------------------------- boot --------------------------------- */

    panel.hidden = isMobile()   // start collapsed on small screens
    buildSphere()
    applyStyles()
    syncInputs()
    syncOutput()
    updateMedias()
})

function loadConfig() {
    const config = { ...DEFAULT_CONFIG }
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
        if (saved) {
            Object.keys(DEFAULT_CONFIG).forEach((key) => {
                if (key in saved) config[key] = saved[key]
            })
        }
    } catch (e) { /* ignore malformed / unavailable storage */ }
    return config
}
