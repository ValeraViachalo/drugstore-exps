/* =============================================================================
   Cons hero, version 2 — the reference cluster of large spheres, each with its
   own picture. Every so often two of them trade sizes: one grows as the other
   shrinks, and the rest make room. Nothing ever appears or leaves.
   Same bones as donate-hero: a fixed-size stage scaled as a whole, spheres
   placed with left/top, transform left to the dodge, no libraries.
   ========================================================================== */

// The composition, as measured on the 2000×1139 reference: each sphere's centre, its picture —
// no two alike — and the line it shows while it is one of the two big ones. Two changes from
// the reference: it repeats two pictures, and those slots take photos from the wider set; and
// it has three big spheres where this has exactly two (the left pink one is brought down, the
// small ones up a little, so the cluster keeps its area) — plus five small fillers in its empty
// spots, so the zone reads full. `layout` scales it by config.scale
// and centres the cluster at config.clusterX/Y; Reset brings it back. The lines are
// placeholders except the two the reference shows.
const SPHERES = [
    { src: '../assets/ic-3.png', x: 1075, y: 578, d: 350, label: 'Перші 4 безкоштовно' },   // face — the anchor
    { src: '../assets/ic-2.png', x: 808,  y: 762, d: 200, label: 'Без осуду' },             // pink roots, left (was 265)
    { src: '../assets/ic-5.png', x: 1248, y: 855, d: 280, label: 'Анонімно' },              // hand in water, right
    { src: '../assets/ic-6.png', x: 822,  y: 458, d: 180, label: 'Онлайн-чат' },            // hand hole, top left
    { src: '../assets/lifestyle.png', x: 1338, y: 522, d: 160, label: 'Обрати фахівця' },  // (was a second pink roots)
    { src: '../assets/ic-7.png', x: 1060, y: 922, d: 130, label: 'Конфіденційно' },         // moss, bottom
    { src: '../assets/ic-1.png', x: 942,  y: 380, d: 120, label: 'Типи консультацій' },     // glass, top
    { src: '../assets/mental-health.png', x: 648, y: 543, d: 110, label: 'Додаток Free2Ask' },  // (was a second glass)
    // fillers — not in the reference; small spheres dropped into its empty spots, pictures
    // copied over from donate-hero (v-*). The relax settles them against the rest
    { src: '../assets/v-13.png', x: 690,  y: 680, d: 140, label: 'Підтримка' },
    { src: '../assets/v-1.png',  x: 1390, y: 690, d: 130, label: 'Спільнота' },
    { src: '../assets/v-6.png',  x: 1210, y: 400, d: 120, label: 'Тестування' },
    { src: '../assets/v-12.png', x: 900,  y: 905, d: 125, label: 'Гаряча лінія' },
    { src: '../assets/v-3.png',  x: 1150, y: 320, d: 115, label: 'Групи' }
]

// exactly this many spheres are big at any moment — they carry their line, and every trade
// hands one of their sizes down to a small sphere
const ACTIVE_COUNT = 2

// the cluster's bounding box on the reference — its centre is what clusterX/Y place, and what
// every relaxed layout is re-centred on, so the composition never wanders off
const CLUSTER = bounds(SPHERES)

const DEFAULT_CONFIG = {
    // section — the stage is laid out at this size, then scaled as a whole
    width: 1190,
    height: 760,
    fitToViewport: true,
    // the section as seen: 0 shows the whole stage (scaled down to fit if fitToViewport), any
    // width makes it a window that wide instead — the stage centred in it, the rest cropped off,
    // never scaled. On a narrower screen the window is only ever the screen's own width.
    frameWidth: 0,
    showBounds: false,
    // entrance — spheres fade in out of a blur, from the outside inward, the biggest last.
    // It plays when the section first comes into view
    intro: true,
    // 'fade' — spheres simply arrive where they are, outermost first, the biggest last of the
    // queue. 'slide' — the two sides ride in to the centre from beyond their own edges, the blur
    // hanging on a little longer, and the biggest appears only once both have arrived
    introStyle: 'fade',
    introDelay: 0.25,         // s of stillness before the first sphere arrives
    introBlur: 5,             // px each sphere blurs out of
    introFade: 0.45,          // s for one sphere to arrive
    introStagger: 60,         // ms between one sphere and the next
    introSlide: 140,          // px a side starts out from its place (slide only)
    introBlurHold: 1.8,       // the blur and the ride last this much longer than the fade (slide only)
    // title
    showTitle: true,
    titleText: 'Консультації',
    titleSize: 108,
    titleTop: 90,
    // cluster — the reference composition at this size, its centre here on the stage
    scale: 0.68,
    clusterX: 5,              // px off the stage's centre line (the reference sits 5px right)
    clusterY: 475,            // px from the stage's top to the cluster's centre
    gap: 8,                   // px two spheres are kept apart — by the layout and by the dodge
    // resize — every so often the big sphere that has been big the longest hands its size to a
    // small one: it shrinks as the other grows, and the rest shift to make room. So no sphere
    // stays big for more than two trades. The set of sizes never changes, and the cluster is
    // held to the reference's box, so the zone always reads equally full
    resize: true,
    resizeMin: 2,             // s between one trade and the next, at least…
    resizeMax: 4,             // …and at most
    resizeDuration: 1.1,      // s a trade takes to play out
    resizeMinRatio: 1.3,      // the two must differ at least this much, or nothing visibly happens…
    resizeMaxRatio: 3.5,      // …and at most this much
    // labels — the two big spheres carry their line on a frosted pill; it fades as they shrink
    labels: true,
    labelSize: 16,            // px, on the stage
    // dodge — every sphere steps aside from the cursor and springs back
    dodge: true,
    dodgeReach: 102,          // px between cursor and a sphere's edge at which it starts to move
    dodgeDistance: 69,        // px it steps aside at most — only as far as the cursor chases it
    dodgeSpeed: 1.4,          // spring frequency, Hz — higher is snappier
    dodgeDamping: 1.31,       // 1 = settles without overshoot, lower = a little bounce, higher = slower and softer
    dodgeNeighbours: true     // a sphere that steps aside nudges the ones it runs into
}

// Mobile takes the desktop numbers and changes only what a phone needs: a phone-wide stage, a
// smaller composition and a shorter reach. Everything else — intro, resize, dodge feel — is
// shared, so a change there carries to both.
const DEFAULT_MOBILE_CONFIG = {
    ...DEFAULT_CONFIG,
    width: 390,
    height: 640,
    titleSize: 64,
    titleTop: 150,
    scale: 0.38,
    clusterX: 3,
    clusterY: 410,
    gap: 5,
    dodgeReach: 60,
    dodgeDistance: 40
}

const SCHEMA = [
    {
        title: 'Section',
        fields: [
            { key: 'width', label: 'Width (px)', type: 'range', min: 320, max: 1600, step: 10 },
            { key: 'height', label: 'Height (px)', type: 'range', min: 300, max: 1000, step: 10 },
            { key: 'fitToViewport', label: 'Scale down to fit', type: 'checkbox' },
            { key: 'frameWidth', label: 'Window (px, 0 = whole)', type: 'range', min: 0, max: 800, step: 5 },
            { key: 'showBounds', label: 'Show bounds', type: 'checkbox' }
        ]
    },
    {
        title: 'Intro',
        fields: [
            { key: 'intro', label: 'Play on view', type: 'checkbox' },
            { key: 'introStyle', label: 'Style', type: 'select', options: ['fade', 'slide'] },
            { key: 'introDelay', label: 'Delay before (s)', type: 'range', min: 0, max: 3, step: 0.05 },
            { key: 'introBlur', label: 'Blur (px)', type: 'range', min: 0, max: 40, step: 1 },
            { key: 'introFade', label: 'One sphere (s)', type: 'range', min: 0.1, max: 2, step: 0.05 },
            { key: 'introStagger', label: 'Between spheres (ms)', type: 'range', min: 0, max: 400, step: 5 },
            { key: 'introSlide', label: 'Slide in from (px)', type: 'range', min: 0, max: 400, step: 5 },
            { key: 'introBlurHold', label: 'Blur / ride hold (×)', type: 'range', min: 1, max: 3, step: 0.05 }
        ]
    },
    {
        title: 'Title',
        fields: [
            { key: 'showTitle', label: 'Show', type: 'checkbox' },
            { key: 'titleText', label: 'Text', type: 'text' },
            { key: 'titleSize', label: 'Size (px)', type: 'range', min: 40, max: 240, step: 1 },
            { key: 'titleTop', label: 'Top (px)', type: 'range', min: 0, max: 400, step: 1 }
        ]
    },
    {
        title: 'Cluster',
        fields: [
            { key: 'scale', label: 'Scale (× reference)', type: 'range', min: 0.2, max: 1.2, step: 0.005 },
            { key: 'clusterX', label: 'Centre X (± px)', type: 'range', min: -300, max: 300, step: 1 },
            { key: 'clusterY', label: 'Centre Y (px)', type: 'range', min: 100, max: 800, step: 1 },
            { key: 'gap', label: 'Min gap (px)', type: 'range', min: 0, max: 40, step: 1 }
        ]
    },
    {
        title: 'Resize',
        fields: [
            { key: 'resize', label: 'Enabled', type: 'checkbox' },
            { key: 'resizeMin', label: 'Pause, at least (s)', type: 'range', min: 0.5, max: 15, step: 0.5 },
            { key: 'resizeMax', label: 'Pause, at most (s)', type: 'range', min: 0.5, max: 20, step: 0.5 },
            { key: 'resizeDuration', label: 'One trade (s)', type: 'range', min: 0.3, max: 5, step: 0.05 },
            { key: 'resizeMinRatio', label: 'Sizes differ, at least (×)', type: 'range', min: 1, max: 4, step: 0.1 },
            { key: 'resizeMaxRatio', label: 'Sizes differ, at most (×)', type: 'range', min: 1, max: 4, step: 0.1 }
        ]
    },
    {
        title: 'Labels',
        fields: [
            { key: 'labels', label: 'Show', type: 'checkbox' },
            { key: 'labelSize', label: 'Size (px)', type: 'range', min: 10, max: 32, step: 1 }
        ]
    },
    {
        title: 'Dodge (hover)',
        fields: [
            { key: 'dodge', label: 'Enabled', type: 'checkbox' },
            { key: 'dodgeReach', label: 'Cursor clearance (px)', type: 'range', min: 0, max: 200, step: 1 },
            { key: 'dodgeDistance', label: 'Max step aside (px)', type: 'range', min: 0, max: 200, step: 1 },
            { key: 'dodgeSpeed', label: 'Spring speed (Hz)', type: 'range', min: 0.5, max: 6, step: 0.1 },
            { key: 'dodgeDamping', label: 'Damping (1 = no bounce)', type: 'range', min: 0.2, max: 1.5, step: 0.01 },
            { key: 'dodgeNeighbours', label: 'Push neighbours', type: 'checkbox' }
        ]
    }
]

const STORAGE_KEY = 'cons-hero-v2-config-v1'
const STORAGE_KEY_MOBILE = 'cons-hero-v2-config-mobile-v1'

const DEVICES = {
    desktop: { label: 'Desktop', defaults: DEFAULT_CONFIG, storageKey: STORAGE_KEY },
    mobile: { label: 'Mobile', defaults: DEFAULT_MOBILE_CONFIG, storageKey: STORAGE_KEY_MOBILE }
}

window.addEventListener('DOMContentLoaded', () => {

    const page = document.querySelector('.page')
    const root = document.querySelector('.cons-hero')
    const stage = root.querySelector('.ch-stage')
    const title = root.querySelector('.ch-title')
    const bubbles = root.querySelector('.ch-bubbles')

    Object.values(DEVICES).forEach((d) => {
        d.config = loadConfig(d.storageKey, d.defaults)
    })

    // which device is live: follows the real viewport until a tab click pins it — that's how
    // the Mobile tab can be tuned visually without shrinking the window
    const mobileQuery = window.matchMedia('(max-width: 768px)')
    let deviceKey = mobileQuery.matches ? 'mobile' : 'desktop'
    let devicePinned = false
    let config = DEVICES[deviceKey].config

    /* ---------------------------------- state --------------------------------- */
    // The cluster, in reference px — what a size trade reshapes. Each sphere:
    //   x, y, d      its resting centre and diameter, tweened by a trade
    //   tween        { from, to, t0, dur } while a trade moves it, else null
    //   el           its element (rebuilt by render); sx, sy, sr the same in stage px
    //   ox, oy…      the dodge's offset and velocity (stage px)

    let spheres = []
    let nextId = 1

    function sphere(src, x, y, d, label) {
        return { id: nextId++, src, x, y, d, label, tween: null, el: null, img: null, bigSince: 0,
            sx: 0, sy: 0, sr: 0, ox: 0, oy: 0, vx: 0, vy: 0, px: 0, py: 0, pushed: false }
    }

    function resetSpheres() {
        spheres = SPHERES.map((s) => sphere(s.src, s.x, s.y, s.d, s.label))
        // the measured reference has two spheres a hair inside the gap — settle that once here,
        // or the dodge would hold them apart forever (no pull: the composition stays as drawn)
        const points = spheres.map((s) => ({ s, x: s.x, y: s.y, r: s.d / 2 }))
        relax(points, config.gap / config.scale, 0)
        points.forEach((p) => { p.s.x = p.x; p.s.y = p.y })
    }

    /* --------------------------------- render --------------------------------- */

    function render() {
        stage.style.width = config.width + 'px'
        stage.style.height = config.height + 'px'
        stage.classList.toggle('is-bounds', config.showBounds)

        title.hidden = !config.showTitle
        title.textContent = config.titleText
        stage.style.setProperty('--title-size', config.titleSize + 'px')
        stage.style.setProperty('--title-top', config.titleTop + 'px')

        stage.style.setProperty('--label-size', config.labelSize + 'px')
        const frag = document.createDocumentFragment()
        spheres.forEach((s) => {
            frag.appendChild(bubble(s))
            place(s)
        })
        bubbles.replaceChildren(frag)
        updateActive()
        wake()

        fit()
        syncInfo()

        stage.style.setProperty('--intro-blur', config.introBlur + 'px')
        stage.style.setProperty('--intro-fade', config.introFade + 's')
        // sliding in, the blur and the ride outlast the fade
        const hold = config.introStyle === 'slide' ? Math.max(config.introBlurHold, 1) : 1
        stage.style.setProperty('--intro-blur-fade', (config.introFade * hold).toFixed(2) + 's')
        stage.style.setProperty('--intro-move', (config.introFade * hold).toFixed(2) + 's')
        // the entrance waits for the section to come into view; a re-render mid-tuning doesn't
        // replay it, it only re-veils while one is still pending
        if (config.intro && introPending) veil()
        scheduleResize()
    }

    function bubble(s) {
        const el = document.createElement('div')
        el.className = 'ch-bubble'
        const img = document.createElement('img')
        img.src = s.src
        img.alt = ''
        img.draggable = false
        el.appendChild(img)
        const label = document.createElement('span')
        label.className = 'ch-label'
        label.textContent = s.label
        el.appendChild(label)
        s.el = el
        s.img = img
        // the dodge's offset survives a re-render
        el.style.transform = (s.ox || s.oy) ? `translate3d(${s.ox.toFixed(2)}px, ${s.oy.toFixed(2)}px, 0)` : ''
        return el
    }

    /** Reference px → stage px, written to the element: left/top/size are layout, transform
     *  stays the dodge's. Bigger spheres paint on top, as the face does in the reference. */
    function place(s) {
        s.sx = config.width / 2 + config.clusterX + (s.x - CLUSTER.cx) * config.scale
        s.sy = config.clusterY + (s.y - CLUSTER.cy) * config.scale
        s.sr = s.d * config.scale / 2
        const el = s.el
        el.style.left = (s.sx - s.sr).toFixed(2) + 'px'
        el.style.top = (s.sy - s.sr).toFixed(2) + 'px'
        el.style.width = el.style.height = (s.sr * 2).toFixed(2) + 'px'
        el.style.zIndex = Math.round(s.d)
    }

    /** The two biggest, by the size they are right now. */
    function biggest() {
        return spheres.slice().sort((a, b) => b.d - a.d).slice(0, ACTIVE_COUNT)
    }

    /** The big ones show their line, the rest hide it — and each remembers when it got big. */
    function updateActive() {
        const top = biggest()
        const now = performance.now()
        spheres.forEach((s) => {
            const big = top.includes(s)
            if (big && !s.el.classList.contains('is-active')) s.bigSince = now
            s.el.classList.toggle('is-active', big && config.labels)
            s.el.classList.toggle('is-big', big)
        })
    }

    /* ---------------------------------- intro --------------------------------- */
    // Spheres arrive out of a blur, from the outside inward — a plain CSS transition per sphere
    // with a staggered delay, so it costs nothing. Two ways round:
    //  · fade  — everyone simply arrives where they belong, the biggest last in the queue.
    //  · slide — each side starts out beyond its own edge and rides in to the centre, the blur
    //            hanging on past the fade; the biggest appears once both sides are home.
    // Only the slide moves anything, and only then does the entrance touch `transform` (the class
    // is-arriving) — the dodge owns it otherwise, and sits still while this plays.

    const MAIN_AFTER_ARMS = 150   // ms the biggest sphere waits once the sides have landed (slide)

    let introPending = config.intro
    let introOrder = []
    let introRunning = false
    let introTimer = 0

    function veil() {
        // farthest from the biggest sphere first, the biggest itself last
        const main = spheres.reduce((a, b) => (b.d > a.d ? b : a))
        const others = spheres
            .filter((s) => s !== main)
            .sort((a, b) => Math.hypot(b.x - main.x, b.y - main.y) - Math.hypot(a.x - main.x, a.y - main.y))
        introOrder = others.concat(main).map((s) => s.el)
        const slide = config.introStyle === 'slide'
        others.concat(main).forEach((s) => {
            s.el.style.transitionDelay = ''
            // the sides start out past their own edge; the biggest only fades
            s.el.style.transform = slide && s !== main
                ? `translate3d(${(s.x < main.x ? -1 : 1) * config.introSlide}px, 0, 0)`
                : ''
            // is-arriving (the transitions) is added only when they set off — while hidden they
            // carry no transition at all, so this takes hold at once
            s.el.classList.add('is-veiled')
        })
        // and make the browser take it in now: the unveil lands one frame later, and without a
        // computed hidden state in between there is no change to transition from
        void bubbles.offsetWidth
    }

    function playIntro() {
        // nothing veiled yet (the observer beat the first render) — stay pending, don't burn it
        if (!introOrder.length) return false
        introPending = false
        const order = introOrder
        introOrder = []
        const slide = config.introStyle === 'slide'
        const wait = Math.round(config.introDelay * 1000)
        const stagger = Math.round(config.introStagger)
        const fade = Math.round(config.introFade * 1000)
        const hold = slide ? Math.max(config.introBlurHold, 1) : 1
        const arms = order.length - 1
        const lastArm = wait + Math.max(0, arms - 1) * stagger
        // sliding, the biggest waits for both sides to land; fading, it's just last in the queue
        const mainDelay = slide ? lastArm + Math.round(fade * hold) + MAIN_AFTER_ARMS : wait + arms * stagger

        // the dodge keeps its hands off transform until everyone is home
        introRunning = true
        if (dodgeFrame) cancelAnimationFrame(dodgeFrame)
        dodgeFrame = 0
        requestAnimationFrame(() => {
            order.forEach((el, i) => {
                el.classList.add('is-arriving')   // the transitions come in with the release
                el.style.transitionDelay = (i < arms ? wait + i * stagger : mainDelay) + 'ms'
                el.style.transform = ''
                el.classList.remove('is-veiled')
            })
        })

        clearTimeout(introTimer)
        introTimer = setTimeout(() => {
            introRunning = false
            order.forEach((el) => {
                el.classList.remove('is-arriving')
                el.style.transitionDelay = ''
            })
            wake()
            scheduleResize()   // trades wait for the entrance
        }, mainDelay + Math.round(fade * hold) + 80)
        return true
    }

    function replayIntro() {
        cancelMorph()
        introPending = true
        render()      // veils everything again…
        playIntro()   // …and lets it in
    }

    // in a page, the section is usually further down: it arrives when it's scrolled to.
    // keep watching until the entrance has actually started — on a fast load the section can be
    // in view before the first render veiled anything, and letting go here would lose it for good
    new IntersectionObserver((entries, observer) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (!introPending || playIntro()) observer.disconnect()
    }, { threshold: 0.15 }).observe(root)

    /* ----------------------------------- fit ---------------------------------- */

    function fit() {
        // a window narrower than the screen keeps the page's side padding; one that wouldn't fit
        // inside it (a phone) goes edge to edge instead
        const flush = config.frameWidth > 0 && config.frameWidth >= window.innerWidth - 32
        page.classList.toggle('is-flush', flush)
        const avail = window.innerWidth - (flush ? 0 : 32)

        if (config.frameWidth > 0) {
            // a window onto the stage: no scaling, the stage centred in it, the rest cropped
            const frame = Math.min(config.frameWidth, avail)
            stage.style.transform = ''
            stage.style.left = Math.round((frame - config.width) / 2) + 'px'
            root.classList.add('is-window')
            root.style.width = frame + 'px'
            root.style.height = config.height + 'px'
            return
        }

        const scale = config.fitToViewport ? Math.min(1, avail / config.width) : 1
        stage.style.transform = scale === 1 ? '' : `scale(${scale})`
        stage.style.left = ''
        root.classList.remove('is-window')
        root.style.width = config.width * scale + 'px'
        root.style.height = config.height * scale + 'px'
    }

    window.addEventListener('resize', fit)

    /* ---------------------------------- resize -------------------------------- */
    // Every few seconds the big sphere that has been big the longest trades sizes with a small
    // one: it shrinks to the small one's diameter as that one grows to its, both where they are.
    // Two spheres are big at any moment, and none stays big past its second trade.
    // The resting layout is then relaxed — pairs pushed apart to the gap, the cluster re-centred
    // — and every sphere tweens from where it is to where it now belongs, so the neighbours of
    // the growing one make room. No picture ever changes, nothing arrives or leaves. The dodge
    // rides on top the whole time and parts spheres that meet on the way.

    const RELAX_PASSES = 120
    const BOX_FIT = 0.25          // share of the way the layout is squeezed or stretched toward the
                                  // reference's box each pass — the zone stays equally full
    const FIT_UNTIL = 0.85        // share of the passes that fit; the rest only separate, so no overlap is left

    let resizeTimer = 0
    let morphing = false
    const rand = (a, b) => a + Math.random() * (b - a)
    const pick = (list) => list[Math.floor(Math.random() * list.length)]

    function scheduleResize() {
        clearTimeout(resizeTimer)
        if (!config.resize || reducedMotion.matches) return
        const lo = Math.min(config.resizeMin, config.resizeMax), hi = Math.max(config.resizeMin, config.resizeMax)
        resizeTimer = setTimeout(resizeEvent, Math.round(rand(lo, hi) * 1000))
    }

    function resizeEvent() {
        resizeTimer = 0
        if (!config.resize || introRunning || introPending || document.hidden) return scheduleResize()
        const big = biggest()
        const giver = big.slice().sort((a, b) => a.bigSince - b.bigSince)[0]   // big the longest
        const partners = spheres.filter((s) => !big.includes(s) && tradeable(giver, s))
        if (partners.length) trade([giver, pick(partners)])
        syncInfo()
        scheduleResize()
    }

    // sizes differ by the configured ratio, so a trade is visible but never absurd
    function tradeable(a, b) {
        const lo = Math.min(config.resizeMinRatio, config.resizeMaxRatio)
        const hi = Math.max(config.resizeMinRatio, config.resizeMaxRatio)
        const ratio = Math.max(a.d, b.d) / Math.min(a.d, b.d)
        return ratio >= lo && ratio <= hi
    }

    function trade([a, b]) {
        startMorph(new Map([[a, { x: a.x, y: a.y, d: b.d }], [b, { x: b.x, y: b.y, d: a.d }]]))
    }

    /**
     * Sets every sphere's new resting place and starts the tween there. `targets` holds the
     * changed ones (reference px); everyone else's target is where it is now. The lot is then
     * relaxed — pairs pushed apart to the gap, the whole held to the reference's box — so the
     * growing sphere's neighbours step away and the shrinking one's close in.
     */
    function startMorph(targets) {
        const now = performance.now()
        const dur = config.resizeDuration * 1000
        const points = spheres.map((s) => {
            const t = targets.get(s)
            return { s, x: t ? t.x : s.x, y: t ? t.y : s.y, r: (t ? t.d : s.d) / 2 }
        })
        relax(points, config.gap / config.scale)
        points.forEach((p) => {
            p.s.tween = { from: { x: p.s.x, y: p.s.y, d: p.s.d }, to: { x: p.x, y: p.y, d: p.r * 2 }, t0: now, dur }
        })
        morphing = true
        wake()
    }

    function relax(points, gap, fit = BOX_FIT) {
        for (let pass = 0; pass < RELAX_PASSES; pass++) {
            // the last passes are separation only, so the fit never leaves an overlap
            if (fit > 0 && pass < RELAX_PASSES * FIT_UNTIL) {
                // squeeze or stretch the lot about its centre toward the reference's box — the
                // separation right after then undoes whatever went too far
                const box = bounds(points.map((p) => ({ x: p.x, y: p.y, d: p.r * 2 })))
                const kx = 1 + (CLUSTER.width / box.width - 1) * fit
                const ky = 1 + (CLUSTER.height / box.height - 1) * fit
                for (const p of points) {
                    p.x = box.cx + (p.x - box.cx) * kx
                    p.y = box.cy + (p.y - box.cy) * ky
                }
            }
            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    const a = points[i], b = points[j]
                    const min = a.r + b.r + gap
                    let dx = b.x - a.x, dy = b.y - a.y
                    let d = Math.hypot(dx, dy)
                    if (d >= min) continue
                    if (d < 1e-3) { dx = 1; dy = 0; d = 1 }   // dead on top of each other — part sideways
                    const push = (min - d) / 2
                    a.x -= dx / d * push; a.y -= dy / d * push
                    b.x += dx / d * push; b.y += dy / d * push
                }
            }
        }
        // the composition stays where the reference put it
        const box = bounds(points.map((p) => ({ x: p.x, y: p.y, d: p.r * 2 })))
        points.forEach((p) => { p.x += CLUSTER.cx - box.cx; p.y += CLUSTER.cy - box.cy })
    }

    /** Advances every tween; returns whether any is still running. */
    function stepMorph(now) {
        let active = false
        for (const s of spheres) {
            if (!s.tween) continue
            const { from, to, t0, dur } = s.tween
            const t = clamp((now - t0) / dur, 0, 1)
            const e = easeInOut(t)
            s.x = from.x + (to.x - from.x) * e
            s.y = from.y + (to.y - from.y) * e
            s.d = from.d + (to.d - from.d) * e
            place(s)
            if (t < 1) active = true
            else s.tween = null
        }
        if (active || morphing) updateActive()
        morphing = active
        return active
    }

    function cancelMorph() {
        clearTimeout(resizeTimer)
        resizeTimer = 0
        // everything lands where it was going
        spheres.forEach((s) => {
            if (s.tween) { Object.assign(s, s.tween.to); s.tween = null }
        })
        morphing = false
        if (spheres[0] && spheres[0].el) updateActive()
    }

    /* ---------------------------------- dodge --------------------------------- */
    // Every sphere hangs on a spring at its resting place. The cursor carries a little personal
    // space: as it closes in on a sphere's edge the sphere is pushed off, along the line from
    // the cursor through its (current) centre, and eases back once the cursor has gone. Where
    // a sphere stepping aside would run into a neighbour, that one gets nudged along — so the
    // cluster parts around the cursor rather than piling up. Offsets live in `transform`, left
    // free by the layout. A trade moves resting places under it; where two spheres meet on the
    // way, the nudge parts them just the same.

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = { clientX: 0, clientY: 0, active: false }
    let dodgeFrame = 0
    let lastTime = 0

    // substeps per frame: the push gets stiff near the edge, and short steps keep it from jittering
    const DODGE_STEPS = 4

    function wake() {
        if (dodgeFrame || introRunning) return   // the dodge sits out the entrance
        lastTime = performance.now()
        dodgeFrame = requestAnimationFrame(stepDodge)
    }

    function release() {
        pointer.active = false
        wake()
    }

    window.addEventListener('pointermove', (e) => {
        // over the config panel the cursor isn't "in" the section
        if (e.target.closest && e.target.closest('.cfg-panel, .cfg-toggle')) return release()
        pointer.clientX = e.clientX
        pointer.clientY = e.clientY
        pointer.active = true
        wake()
    }, { passive: true })
    document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) release() })   // left the window
    window.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') release() })
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    // a still mouse over a scrolling page still moves relative to the spheres
    window.addEventListener('scroll', () => { if (pointer.active) wake() }, { passive: true })

    function stepDodge(now) {
        dodgeFrame = 0
        if (introRunning) return
        const dt = Math.min((now - lastTime) / 1000, 1 / 30)   // a stalled tab mustn't fling anything
        lastTime = now

        let moving = stepMorph(now)

        // cursor in stage px, re-read every frame: the stage is scaled and the page may scroll
        const rect = stage.getBoundingClientRect()
        const scale = rect.width / config.width || 1
        const px = (pointer.clientX - rect.left) / scale
        const py = (pointer.clientY - rect.top) / scale
        const pushing = config.dodge && pointer.active && !reducedMotion.matches

        const w = 2 * Math.PI * Math.max(config.dodgeSpeed, 0.1)
        const k = w * w
        const c = 2 * config.dodgeDamping * w
        const reach = Math.max(config.dodgeReach, 8)
        const h = dt / DODGE_STEPS

        for (let n = 0; n < DODGE_STEPS; n++) {
            for (const b of spheres) {
                let ax = -k * b.ox - c * b.vx
                let ay = -k * b.oy - c * b.vy
                b.pushed = false
                if (pushing) {
                    const dx = b.sx + b.ox - px
                    const dy = b.sy + b.oy - py
                    const d = Math.hypot(dx, dy) || 1e-3
                    // 0 while the cursor is `reach` or more from the edge, 1 once it touches it —
                    // scaled so that at rest the spring balances it `dodgeDistance · s` away
                    const s = smoothstep((b.sr + reach - d) / reach)
                    if (s > 0) {
                        const f = k * config.dodgeDistance * s / d
                        ax += dx * f
                        ay += dy * f
                        b.pushed = true
                    }
                }
                // semi-implicit Euler: velocity first, then position
                b.px = b.ox
                b.py = b.oy
                b.vx += ax * h
                b.vy += ay * h
                b.ox += b.vx * h
                b.oy += b.vy * h
            }
            if (config.dodgeNeighbours) {
                separate()
                // velocity is then whatever motion actually happened. Moving spheres apart alone
                // leaves the speed they had in: pinned against a neighbour, the spring keeps
                // feeding a velocity that never turns into motion — the pair never settles and
                // flicks off when let go. Free spheres come out exactly as integrated
                for (const b of spheres) {
                    b.vx = (b.ox - b.px) / h
                    b.vy = (b.oy - b.py) / h
                }
            }
        }

        // px/s and px: below these nothing visibly moves any more
        const REST_SPEED = 1
        const REST_OFFSET = 0.1
        for (const b of spheres) {
            const speed = Math.hypot(b.vx, b.vy)
            const away = Math.hypot(b.ox, b.oy)
            if (speed > REST_SPEED) {
                moving = true
            } else if (!b.pushed && away < REST_OFFSET) {
                b.ox = b.oy = b.vx = b.vy = 0   // home — snap the last hair off so the loop can sleep
            } else if (!b.pushed) {
                moving = true                   // still easing home — even caught at the far end of a swing
            }
            // pushed and slow: held in balance by the cursor or a neighbour — fine to sleep on
            b.el.style.transform = (b.ox || b.oy)
                ? `translate3d(${b.ox.toFixed(2)}px, ${b.oy.toFixed(2)}px, 0)`
                : ''
        }
        // sleeps once everything has settled — at home, or held still under a resting cursor;
        // the next pointermove or trade wakes it
        if (moving) dodgeFrame = requestAnimationFrame(stepDodge)
    }

    /** Push apart any two spheres that got closer than half the layout gap. */
    function separate() {
        const minGap = config.gap * 0.5
        for (let i = 0; i < spheres.length; i++) {
            const a = spheres[i]
            for (let j = i + 1; j < spheres.length; j++) {
                const b = spheres[j]
                const min = a.sr + b.sr + minGap
                const dx = (b.sx + b.ox) - (a.sx + a.ox)
                const dy = (b.sy + b.oy) - (a.sy + a.oy)
                if (Math.abs(dx) > min || Math.abs(dy) > min) continue
                const d = Math.hypot(dx, dy)
                if (d >= min || d === 0) continue
                const push = (min - d) / 2
                const nx = dx / d
                const ny = dy / d
                a.pushed = b.pushed = true      // in contact — held, not "on its way home"
                a.ox -= nx * push
                a.oy -= ny * push
                b.ox += nx * push
                b.oy += ny * push
            }
        }
    }

    /* ------------------------------- config panel ----------------------------- */

    const panel = document.querySelector('.cfg-panel')
    const body = panel.querySelector('.cfg-body')
    const output = panel.querySelector('.cfg-out textarea')
    const info = panel.querySelector('.cfg-info')
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
            } else if (field.type === 'select') {
                row.innerHTML = `<label for="${id}">${field.label}</label>`
                control = document.createElement('select')
                field.options.forEach((opt) => {
                    const o = document.createElement('option')
                    o.value = o.textContent = opt
                    control.appendChild(o)
                })
            } else if (field.type === 'checkbox') {
                row.innerHTML = `<label for="${id}">${field.label}</label>`
                control = document.createElement('input')
                control.type = 'checkbox'
            } else if (field.type === 'text') {
                row.innerHTML = `<label for="${id}">${field.label}</label>`
                control = document.createElement('input')
                control.type = 'text'
                control.spellcheck = false
            }
            row.appendChild(control)

            control.id = id
            control.addEventListener('input', () => {
                config[field.key] = readControl(control, field)
                if (field.type === 'range') {
                    row.querySelector('output').textContent = formatValue(config[field.key], field)
                }
                commit()
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

    function syncInfo() {
        const live = spheres
        const sizes = live.map((s) => (s.tween ? s.tween.to.d : s.d) * config.scale)
        const box = bounds(live.map((s) => (s.tween ? s.tween.to : s)))
        const over = live.filter((s) => {
            const sx = config.width / 2 + config.clusterX + (s.x - CLUSTER.cx) * config.scale
            const sy = config.clusterY + (s.y - CLUSTER.cy) * config.scale
            const r = s.d * config.scale / 2
            return sx - r < 0 || sx + r > config.width || sy - r < 0 || sy + r > config.height
        }).length
        // the ic-* sources are 200px: past that the browser is upscaling
        const soft = live.filter((s, i) => /ic-\d/.test(s.src) && sizes[i] > 200).length
        const warn = []
        if (over) warn.push(`${over} past the stage edge`)
        if (soft) warn.push(`${soft} larger than the 200px source`)
        info.innerHTML =
            `<b>${live.length} spheres</b> · ${Math.round(Math.min(...sizes))}–${Math.round(Math.max(...sizes))}px` +
            ` · cluster ${Math.round(box.width * config.scale)}×${Math.round(box.height * config.scale)}px` +
            (warn.length ? `<br><span class="is-warn">${warn.join(', ')}</span>` : '')
    }

    function saveConfig() {
        try {
            localStorage.setItem(DEVICES[deviceKey].storageKey, JSON.stringify(config))
        } catch (e) { /* storage unavailable — tweaks just won't persist */ }
    }

    function commit() {
        render()
        syncOutput()
        saveConfig()
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
            copyBtn.textContent = 'Copy'
            copyBtn.classList.remove('is-copied')
        }, 1400)
    })

    panel.querySelector('[data-action="intro"]').addEventListener('click', replayIntro)

    // reset — back to the defaults and the reference composition
    panel.querySelector('[data-action="reset"]').addEventListener('click', () => {
        Object.assign(config, DEVICES[deviceKey].defaults)
        try { localStorage.removeItem(DEVICES[deviceKey].storageKey) } catch (e) {}
        cancelMorph()
        resetSpheres()
        syncInputs()
        render()
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

    /* ------------------------------- device tabs ------------------------------ */
    // Desktop and Mobile are separate configs; the active tab is the one rendered live.
    // A click pins it — clicking the already-active tab again lets it follow the viewport again.

    const tabButtons = [...panel.querySelectorAll('.cfg-tab')]
    const tabHint = panel.querySelector('.cfg-tabs-hint')

    function syncTabs() {
        tabButtons.forEach((btn) => {
            const isActive = btn.dataset.device === deviceKey
            btn.classList.toggle('is-active', isActive)
            btn.setAttribute('aria-selected', String(isActive))
        })
        tabHint.textContent = devicePinned
            ? `Previewing ${DEVICES[deviceKey].label} — pinned, ignores window width (click again to unpin)`
            : `Following window width — currently ${DEVICES[deviceKey].label}`
    }

    function switchDevice(next) {
        deviceKey = next
        config = DEVICES[deviceKey].config
        syncTabs()
        syncInputs()
        render()
        syncOutput()
        if (config.intro) replayIntro()   // the other device's layout gets its own entrance
    }

    tabButtons.forEach((btn) => btn.addEventListener('click', () => {
        const device = btn.dataset.device
        if (devicePinned && device === deviceKey) {
            devicePinned = false
            switchDevice(mobileQuery.matches ? 'mobile' : 'desktop')
        } else {
            devicePinned = true
            switchDevice(device)
        }
    }))

    mobileQuery.addEventListener('change', (e) => {
        // the panel is a desktop tool — it gets out of the way as soon as the window is a phone
        panel.hidden = e.matches
        if (!devicePinned) switchDevice(e.matches ? 'mobile' : 'desktop')
    })

    /* ----------------------------------- boot --------------------------------- */

    panel.hidden = mobileQuery.matches   // start collapsed on phones
    resetSpheres()
    syncTabs()
    syncInputs()
    render()
    syncOutput()

    // the viewport can still settle after the first render — fonts, a phone's own metrics, an
    // orientation change — so measure it again on the next frame and once everything has loaded
    requestAnimationFrame(fit)
    window.addEventListener('load', fit)
    // a tab coming back from the background picks the trades up again
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { wake(); scheduleResize() } })

    // the state is plain data — exposed for debugging
    window.consHero = {
        get config() { return config },
        get device() { return deviceKey },
        get spheres() { return spheres },
        get dodging() { return dodgeFrame !== 0 },   // is the frame loop awake
        get morphing() { return morphing },
        intro: replayIntro,
        resize: resizeEvent, // fire the next trade now
        step: stepDodge,     // advance the frame loop by hand (a background tab gets no frames)
        render
    }
})

/* ---------------------------------- helpers --------------------------------- */

/** The bounding box of circles given as { x, y, d }. */
function bounds(list) {
    const left = Math.min(...list.map((s) => s.x - s.d / 2))
    const right = Math.max(...list.map((s) => s.x + s.d / 2))
    const top = Math.min(...list.map((s) => s.y - s.d / 2))
    const bottom = Math.max(...list.map((s) => s.y + s.d / 2))
    return { cx: (left + right) / 2, cy: (top + bottom) / 2, width: right - left, height: bottom - top }
}

function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max)
}

function smoothstep(x) {
    const t = clamp(x, 0, 1)
    return t * t * (3 - 2 * t)
}

function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** A stored config laid over `defaults`: keys added since it was saved get their default,
 *  keys that no longer exist are dropped. */
function withDefaults(saved, defaults) {
    const config = { ...defaults }
    if (saved && typeof saved === 'object') {
        Object.keys(defaults).forEach((key) => {
            if (key in saved) config[key] = saved[key]
        })
    }
    return config
}

function loadConfig(storageKey, defaults) {
    try {
        return withDefaults(JSON.parse(localStorage.getItem(storageKey) || 'null'), defaults)
    } catch (e) {
        return { ...defaults }   // malformed / unavailable storage
    }
}
