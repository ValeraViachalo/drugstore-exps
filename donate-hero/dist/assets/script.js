/* =============================================================================
   Donate hero — a half ring of spheres closing in on the main one (static)
   + live config panel
   ========================================================================== */

const MAIN_SRC = 'assets/v-main.png'
const ASSET_IDS = Array.from({ length: 13 }, (_, i) => i + 1)
const assetSrc = (id) => `assets/v-${id}.png`

// Easings for the lap — every standard GSAP ease. Each family only needs its "out" curve:
// "in" mirrors it end to end, "inOut" splices both mirrored halves (see `family`) — the trick
// this file already used for expo, now shared by every curve. `peak` is the fastest each one
// runs against its average speed — the lap sizes its tip jumps by it.
const EASES = (() => {
    const family = (out) => ({
        in: (t) => 1 - out(1 - t),
        out,
        inOut: (t) => (t < 0.5 ? (1 - out(1 - 2 * t)) / 2 : (1 + out(2 * t - 1)) / 2)
    })
    const expand = (name, { in: fin, out, inOut }) => ({
        [`${name}.in`]: fin, [`${name}.out`]: out, [`${name}.inOut`]: inOut
    })
    const power = (p) => family((t) => 1 - Math.pow(1 - t, p))   // power1..4 = quad..quint

    const c1 = 1.70158, c3 = c1 + 1               // back's default overshoot
    const c4 = (2 * Math.PI) / 3                  // elastic's default period
    const bounceOut = (t) => {
        const n1 = 7.5625, d1 = 2.75
        if (t < 1 / d1) return n1 * t * t
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
        return n1 * (t -= 2.625 / d1) * t + 0.984375
    }
    // the exponential decay never quite reaches 0 or 1 on its own — pinned here, same idea as expo
    const elasticOut = (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1)

    const fns = {
        linear: (t) => t,
        ...expand('power1', power(2)),
        ...expand('power2', power(3)),
        ...expand('power3', power(4)),
        ...expand('power4', power(5)),
        ...expand('sine', family((t) => Math.sin(t * Math.PI / 2))),
        ...expand('circ', family((t) => Math.sqrt(1 - Math.pow(t - 1, 2)))),
        ...expand('expo', family((t) => (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10)))),
        ...expand('back', family((t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2))),
        ...expand('elastic', family(elasticOut)),
        ...expand('bounce', family(bounceOut))
    }
    const eases = {}
    Object.entries(fns).forEach(([name, fn]) => {
        let peak = 0
        for (let i = 0; i < 1000; i++) peak = Math.max(peak, (fn((i + 1) / 1000) - fn(i / 1000)) * 1000)
        eases[name] = { fn, peak }
    })
    return eases
})()

const DEFAULT_CONFIG = {
    // section — the stage is laid out at this size, then scaled as a whole
    width: 1190,
    height: 620,
    fitToViewport: true,
    // the section as seen: 0 shows the whole stage (scaled down to fit if fitToViewport), any
    // width makes it a window that wide instead — the stage centred in it, the rest cropped off,
    // never scaled. That's the mobile way round: the main sphere centred, the arms running off
    // the sides. On a narrower screen the window is only ever the screen's own width.
    frameWidth: 0,
    showBounds: false,
    showGuides: true,
    // entrance — spheres fade in out of a blur, from the arms' tips inward, the main sphere last.
    // It plays when the section first comes into view
    intro: true,
    // 'fade' — spheres simply arrive where they are, tips inward, the main sphere last of the
    // queue. 'slide' — the two sides ride in to the centre from beyond their own edges, the blur
    // hanging on a little longer, and the main sphere appears only once both have arrived
    introStyle: 'fade',
    introDelay: 0.25,         // s of stillness before the first sphere arrives
    introBlur: 5,            // px each sphere blurs out of
    introFade: 0.45,         // s for one sphere to arrive
    introStagger: 15,        // ms between one sphere and the next
    introSlide: 140,         // px a side starts out from its place (slide only)
    introBlurHold: 1.8,      // the blur and the ride last this much longer than the fade (slide only)
    // title
    showTitle: true,
    titleText: 'Донати',
    titleSize: 170,
    titleTop: 92,
    // main sphere, centred horizontally
    mainSize: 332,
    mainBottom: 5,           // px from the section's bottom edge to the sphere's
    // arc — the lower half of an ellipse whose lowest point is the main sphere's centre
    radiusX: 520,
    radiusY: 310,
    arcEnd: 115,             // degrees from the bottom: 90 = level with the ellipse centre, > 90 curls back in
    // spheres. Each side's first sphere is the "near" one, right next to the main sphere
    leftCount: 11,
    rightCount: 10,
    leftPool: '1-9',
    rightPool: '9-13, 5, 7, 1',
    leftNear: 'auto',        // pin the near sphere's image, or let the shuffle pick it
    rightNear: 'auto',
    nearSize: 108,
    maxSize: 120,            // right after the near sphere…
    minSize: 78,             // …shrinking to this at the end of the arc
    sizeCurve: 1.4,          // > 1 shrinks sooner, < 1 stays big for longer
    sizeJitter: 0.05,        // ± share of the size, still clamped to min…max
    fitFalloff: true,        // falloff ends at the arm's last sphere, not at the arc end
    gap: 10,
    // band — how thick the ring is, counted in spheres of the local size
    thicknessNear: 1.85,
    thicknessFar: 2,
    laneSpread: 1,           // 0 = every sphere on the centreline, 1 = out to the band edge
    laneJitter: 0.15,        // how far a sphere may drift from its lane's middle toward the centreline
    laneSwitch: 0.78,        // chance the next sphere takes the other lane (1 = strict zigzag)
    nearDrift: 62,           // px the near spheres may slide off the centreline
    // gap fill — the chain sizes each sphere by its distance, so where that size can't fit a
    // hole stays open. These plug the biggest ones with whatever fits, even below minSize
    fillGaps: true,
    fillMinSize: 37,         // a hole that can't take a sphere this big stays empty
    fillMax: 4,              // per side
    // dodge — every sphere but the main one steps aside from the cursor and springs back
    dodge: true,
    dodgeReach: 102,         // px between cursor and a sphere's edge at which it starts to move
    dodgeDistance: 69,       // px it steps aside at most — only as far as the cursor chases it; enough to clear the biggest
    dodgeSpeed: 1.4,         // spring frequency, Hz — higher is snappier
    dodgeDamping: 1.31,      // 1 = settles without overshoot, lower = a little bounce, higher = slower and softer
    dodgeNeighbours: true,   // a sphere that steps aside nudges the ones it runs into
    // spin — a click on the main sphere sends the ring one lap round and back
    spin: true,
    spinDuration: 2,       // s for the lap
    spinEase: 'power3.out',    // the lap's easing (see EASES) — expo.out bursts off and glides in
    spinShrink: 0.9,         // the main sphere's press: it dips to this scale and springs back
    spinBounce: 0.3,         // damping of that spring — lower bounces more
    spinSwitch: 60,          // px out from the main sphere's edge where a sphere starts shrinking into it (gone on the edge)
    spinTipSwitch: 80,       // the same at the arms' tips — kept short, as past a tip is past the half ring
    spinSwap: false,         // off: inner layer clockwise (right → left past the main sphere), outer anticlockwise
    spinHalf: true,         // half turn: every sphere runs on to the other side, into the layout's mirror image (next click runs them home)
    spinAxisRx: 0,           // the spin axis is the layout's own arc; these move its radii (± px)
    spinAxisRy: 0,
    // random
    seed: 73429
}

// Mobile takes the desktop numbers and changes only what a phone needs: a phone-wide window,
// a shorter section, a tighter arc and smaller spheres. Everything else — counts, pools, band
// shape, dodge, spin — is shared, so a change there carries to both.
const DEFAULT_MOBILE_CONFIG = {
    ...DEFAULT_CONFIG,
    height: 540,
    // a phone-width window onto the same stage: on a real phone it narrows to the screen, on a
    // desktop it's this wide, which is what the Mobile tab previews
    frameWidth: 390,
    // only a few spheres are ever on screen at once, so the ring is shorter — and the photos are
    // swapped on every click instead (see planPhotos)
    leftCount: 5,
    rightCount: 5,
    titleSize: 104,
    titleTop: 201,
    mainSize: 188,
    radiusX: 335,
    radiusY: 250,
    nearSize: 91,
    maxSize: 82,
    minSize: 51,
    gap: 6,
    thicknessNear: 1.8,
    thicknessFar: 1.65
}

const NEAR_OPTIONS = ['auto', ...ASSET_IDS.map(String)]

const SCHEMA = [
    {
        title: 'Section',
        fields: [
            { key: 'width', label: 'Width (px)', type: 'range', min: 600, max: 1600, step: 10 },
            { key: 'height', label: 'Height (px)', type: 'range', min: 300, max: 1000, step: 10 },
            { key: 'fitToViewport', label: 'Scale down to fit', type: 'checkbox' },
            { key: 'frameWidth', label: 'Window (px, 0 = whole)', type: 'range', min: 0, max: 800, step: 5 },
            { key: 'showBounds', label: 'Show bounds', type: 'checkbox' },
            { key: 'showGuides', label: 'Show arc guides', type: 'checkbox' }
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
            { key: 'introStagger', label: 'Between spheres (ms)', type: 'range', min: 0, max: 200, step: 5 },
            { key: 'introSlide', label: 'Slide in from (px)', type: 'range', min: 0, max: 400, step: 5 },
            { key: 'introBlurHold', label: 'Blur / ride hold (×)', type: 'range', min: 1, max: 3, step: 0.05 }
        ]
    },
    {
        title: 'Title',
        fields: [
            { key: 'showTitle', label: 'Visible', type: 'checkbox' },
            { key: 'titleText', label: 'Text', type: 'text' },
            { key: 'titleSize', label: 'Font size (px)', type: 'range', min: 40, max: 260, step: 1 },
            { key: 'titleTop', label: 'Top (px)', type: 'range', min: -60, max: 400, step: 1 }
        ]
    },
    {
        title: 'Main sphere',
        fields: [
            { key: 'mainSize', label: 'Size (px)', type: 'range', min: 120, max: 460, step: 1 },
            { key: 'mainBottom', label: 'Bottom offset (px)', type: 'range', min: -150, max: 300, step: 1 }
        ]
    },
    {
        title: 'Arc',
        fields: [
            { key: 'radiusX', label: 'Radius ↔ (px)', type: 'range', min: 150, max: 800, step: 5 },
            { key: 'radiusY', label: 'Radius ↕ (px)', type: 'range', min: 80, max: 700, step: 5 },
            { key: 'arcEnd', label: 'Arc end (°)', type: 'range', min: 45, max: 170, step: 1 }
        ]
    },
    {
        title: 'Spheres',
        fields: [
            { key: 'leftCount', label: 'Left count', type: 'range', min: 0, max: 30, step: 1 },
            { key: 'rightCount', label: 'Right count', type: 'range', min: 0, max: 30, step: 1 },
            { key: 'leftPool', label: 'Left images (e.g. 1-9)', type: 'text' },
            { key: 'rightPool', label: 'Right images', type: 'text' },
            { key: 'leftNear', label: 'Left near image', type: 'select', options: NEAR_OPTIONS },
            { key: 'rightNear', label: 'Right near image', type: 'select', options: NEAR_OPTIONS },
            { key: 'nearSize', label: 'Near size (px)', type: 'range', min: 40, max: 220, step: 1 },
            { key: 'maxSize', label: 'Max size (px)', type: 'range', min: 20, max: 160, step: 1 },
            { key: 'minSize', label: 'Min size (px)', type: 'range', min: 20, max: 160, step: 1 },
            { key: 'sizeCurve', label: 'Size falloff curve', type: 'range', min: 0.3, max: 3, step: 0.05 },
            { key: 'sizeJitter', label: 'Size jitter', type: 'range', min: 0, max: 0.4, step: 0.01 },
            { key: 'fitFalloff', label: 'Min size at last sphere', type: 'checkbox' },
            { key: 'gap', label: 'Gap (px)', type: 'range', min: 0, max: 40, step: 1 }
        ]
    },
    {
        title: 'Band',
        fields: [
            { key: 'thicknessNear', label: 'Thickness near (spheres)', type: 'range', min: 1, max: 4, step: 0.05 },
            { key: 'thicknessFar', label: 'Thickness far (spheres)', type: 'range', min: 1, max: 4, step: 0.05 },
            { key: 'laneSpread', label: 'Lane spread', type: 'range', min: 0, max: 1, step: 0.01 },
            { key: 'laneJitter', label: 'Lane jitter', type: 'range', min: 0, max: 1, step: 0.01 },
            { key: 'laneSwitch', label: 'Lane switch chance', type: 'range', min: 0, max: 1, step: 0.01 },
            { key: 'nearDrift', label: 'Near drift (px)', type: 'range', min: 0, max: 100, step: 1 }
        ]
    },
    {
        title: 'Gap fill',
        fields: [
            { key: 'fillGaps', label: 'Fill gaps with small spheres', type: 'checkbox' },
            { key: 'fillMinSize', label: 'Smallest filler (px)', type: 'range', min: 20, max: 120, step: 1 },
            { key: 'fillMax', label: 'Max fillers per side', type: 'range', min: 0, max: 10, step: 1 }
        ]
    },
    {
        title: 'Dodge (hover)',
        fields: [
            { key: 'dodge', label: 'Enabled', type: 'checkbox' },
            { key: 'dodgeReach', label: 'Cursor clearance (px)', type: 'range', min: 0, max: 120, step: 1 },
            { key: 'dodgeDistance', label: 'Max step aside (px)', type: 'range', min: 0, max: 120, step: 1 },
            { key: 'dodgeSpeed', label: 'Spring speed (Hz)', type: 'range', min: 0.5, max: 6, step: 0.1 },
            { key: 'dodgeDamping', label: 'Damping (1 = no bounce)', type: 'range', min: 0.2, max: 1.5, step: 0.01 },
            { key: 'dodgeNeighbours', label: 'Push neighbours', type: 'checkbox' }
        ]
    },
    {
        title: 'Spin (click)',
        fields: [
            { key: 'spin', label: 'Enabled', type: 'checkbox' },
            { key: 'spinDuration', label: 'Lap duration (s)', type: 'range', min: 0.6, max: 6, step: 0.1 },
            { key: 'spinEase', label: 'Easing', type: 'select', options: Object.keys(EASES) },
            { key: 'spinShrink', label: 'Press scale', type: 'range', min: 0.6, max: 1, step: 0.01 },
            { key: 'spinBounce', label: 'Press bounce (lower = more)', type: 'range', min: 0.1, max: 1, step: 0.01 },
            { key: 'spinSwitch', label: 'Switch zone (px)', type: 'range', min: 10, max: 240, step: 1 },
            { key: 'spinTipSwitch', label: 'Tip switch zone (px)', type: 'range', min: 10, max: 240, step: 1 },
            { key: 'spinSwap', label: 'Swap layer directions', type: 'checkbox' },
            { key: 'spinHalf', label: 'Half turn — swap sides', type: 'checkbox' },
            { key: 'spinAxisRx', label: 'Axis radius ↔ (± px)', type: 'range', min: -300, max: 300, step: 1 },
            { key: 'spinAxisRy', label: 'Axis radius ↕ (± px)', type: 'range', min: -300, max: 300, step: 1 }
        ]
    },
    {
        title: 'Random',
        fields: [
            { key: 'seed', label: 'Seed', type: 'number' }
        ]
    }
]

// bumped whenever the defaults change, so an older session's tweaks can't come back up over them
const STORAGE_KEY = 'donate-hero-config-v7'
const STORAGE_KEY_MOBILE = 'donate-hero-config-mobile-v2'

// px edge to edge; closer than this, two spheres showing the same image read as a repeat
const TWIN_MIN_DISTANCE = 80

// the saved-configs list. Deliberately NOT versioned with STORAGE_KEY: saves have to outlive
// a defaults bump — each one is laid over the current defaults when loaded instead
const SAVED_KEY = 'donate-hero-saved-configs'
const SAVED_KEY_MOBILE = 'donate-hero-saved-configs-mobile'

// Saves built into the page, so they show up in the list without anyone pressing Save.
// Each is planted once per browser — deleting one keeps it gone. Written out in full rather
// than as DEFAULT_CONFIG + overrides, so a later defaults change can't quietly alter them.
const PRESET_SAVES = [
    {
        id: 'preset-final-v2-73429',
        name: 'Final v2 — seed 73429',
        config: {
            width: 1190,
            height: 620,
            fitToViewport: true,
            showBounds: false,
            showGuides: false,
            showTitle: true,
            titleText: 'Донати',
            titleSize: 170,
            titleTop: 92,
            mainSize: 332,
            mainBottom: 5,
            radiusX: 520,
            radiusY: 310,
            arcEnd: 115,
            leftCount: 11,
            rightCount: 10,
            leftPool: '1-9',
            rightPool: '9-13, 5, 7, 1',
            leftNear: 'auto',
            rightNear: 'auto',
            nearSize: 108,
            maxSize: 120,
            minSize: 78,
            sizeCurve: 1.4,
            sizeJitter: 0.05,
            fitFalloff: true,
            gap: 10,
            thicknessNear: 1.85,
            thicknessFar: 2,
            laneSpread: 1,
            laneJitter: 0.15,
            laneSwitch: 0.78,
            nearDrift: 62,
            fillGaps: true,
            fillMinSize: 37,
            fillMax: 4,
            dodge: true,
            dodgeReach: 102,
            dodgeDistance: 69,
            dodgeSpeed: 1.4,
            dodgeDamping: 1.31,
            dodgeNeighbours: true,
            seed: 73429
        }
    },
    {
        id: 'preset-final-73429',
        name: 'Final — seed 73429',
        config: {
            width: 1190,
            height: 620,
            fitToViewport: true,
            showBounds: false,
            showGuides: false,
            showTitle: true,
            titleText: 'Донати',
            titleSize: 170,
            titleTop: 92,
            mainSize: 332,
            mainBottom: 5,
            radiusX: 520,
            radiusY: 285,
            arcEnd: 115,
            leftCount: 11,
            rightCount: 10,
            leftPool: '1-9',
            rightPool: '9-13, 5, 7, 1',
            leftNear: 'auto',
            rightNear: 'auto',
            nearSize: 108,
            maxSize: 120,
            minSize: 78,
            sizeCurve: 1.4,
            sizeJitter: 0.05,
            fitFalloff: false,
            gap: 10,
            thicknessNear: 1.85,
            thicknessFar: 2,
            laneSpread: 1,
            laneJitter: 0.15,
            laneSwitch: 0.78,
            nearDrift: 62,
            fillGaps: true,
            fillMinSize: 37,
            fillMax: 4,
            seed: 73429
        }
    },
    {
        id: 'preset-base-73429',
        name: 'Base — seed 73429',
        config: {
            width: 1190,
            height: 620,
            fitToViewport: true,
            showBounds: false,
            showGuides: false,
            showTitle: true,
            titleText: 'Донати',
            titleSize: 170,
            titleTop: 92,
            mainSize: 332,
            mainBottom: 10,
            radiusX: 520,
            radiusY: 285,
            arcEnd: 115,
            leftCount: 13,
            rightCount: 10,
            leftPool: '1-9',
            rightPool: '9-13, 5, 7, 1',
            leftNear: 'auto',
            rightNear: 'auto',
            nearSize: 108,
            maxSize: 120,
            minSize: 78,
            sizeCurve: 1.4,
            sizeJitter: 0.05,
            fitFalloff: false,
            gap: 10,
            thicknessNear: 1.85,
            thicknessFar: 2.1,
            laneSpread: 1,
            laneJitter: 0.15,
            laneSwitch: 0.86,
            nearDrift: 88,
            fillGaps: true,
            fillMinSize: 48,
            fillMax: 4,
            seed: 73429
        }
    }
]

const PRESET_SAVES_MOBILE = [
    {
        id: 'preset-mobile-390-73429',
        name: 'Mobile 390 — seed 73429',
        config: {
            width: 1190,
            height: 540,
            fitToViewport: true,
            frameWidth: 390,
            showBounds: false,
            showGuides: true,
            showTitle: true,
            titleText: 'Донати',
            titleSize: 104,
            titleTop: 201,
            mainSize: 188,
            mainBottom: 5,
            radiusX: 335,
            radiusY: 250,
            arcEnd: 115,
            leftCount: 5,
            rightCount: 5,
            leftPool: '1-9',
            rightPool: '9-13, 5, 7, 1',
            leftNear: 'auto',
            rightNear: 'auto',
            nearSize: 91,
            maxSize: 82,
            minSize: 51,
            sizeCurve: 1.4,
            sizeJitter: 0.05,
            fitFalloff: true,
            gap: 6,
            thicknessNear: 1.8,
            thicknessFar: 1.65,
            laneSpread: 1,
            laneJitter: 0.15,
            laneSwitch: 0.78,
            nearDrift: 62,
            fillGaps: true,
            fillMinSize: 37,
            fillMax: 4,
            dodge: true,
            dodgeReach: 102,
            dodgeDistance: 69,
            dodgeSpeed: 1.4,
            dodgeDamping: 1.31,
            dodgeNeighbours: true,
            spin: true,
            spinDuration: 2,
            spinEase: 'power3.out',
            spinShrink: 0.9,
            spinBounce: 0.3,
            spinSwitch: 60,
            spinTipSwitch: 80,
            spinSwap: false,
            spinHalf: true,
            spinAxisRx: 0,
            spinAxisRy: 0,
            seed: 73429
        }
    }
]

// the config panel's two tabs. Each is its own config, storage key, saved-list key and preset
// set — switching tabs swaps which of these the shared panel reads and writes
const DEVICES = {
    desktop: { label: 'Desktop', defaults: DEFAULT_CONFIG, storageKey: STORAGE_KEY, savedKey: SAVED_KEY, presets: PRESET_SAVES },
    mobile: { label: 'Mobile', defaults: DEFAULT_MOBILE_CONFIG, storageKey: STORAGE_KEY_MOBILE, savedKey: SAVED_KEY_MOBILE, presets: PRESET_SAVES_MOBILE }
}

window.addEventListener('DOMContentLoaded', () => {

    const page = document.querySelector('.page')
    const root = document.querySelector('.donate-hero')
    const stage = root.querySelector('.dh-stage')
    const title = root.querySelector('.dh-title')
    const guides = root.querySelector('.dh-guides')
    const bubbles = root.querySelector('.dh-bubbles')

    Object.values(DEVICES).forEach((d) => {
        d.config = loadConfig(d.storageKey, d.defaults)
        d.store = loadSaved(d.savedKey, d.presets)
    })

    // which device is live: follows the real viewport until a tab click pins it — that's how
    // the Mobile tab can be tuned visually without shrinking the window
    const mobileQuery = window.matchMedia('(max-width: 768px)')
    let deviceKey = mobileQuery.matches ? 'mobile' : 'desktop'
    let devicePinned = false
    let config = DEVICES[deviceKey].config
    let store = DEVICES[deviceKey].store
    let lastLayout = null

    /* --------------------------------- render --------------------------------- */

    function render() {
        const result = layout(config)
        lastLayout = result

        stage.style.width = config.width + 'px'
        stage.style.height = config.height + 'px'
        stage.classList.toggle('is-bounds', config.showBounds)

        title.hidden = !config.showTitle
        title.textContent = config.titleText
        stage.style.setProperty('--title-size', config.titleSize + 'px')
        stage.style.setProperty('--title-top', config.titleTop + 'px')

        const frag = document.createDocumentFragment()
        const entries = []
        const mainEl = bubble(result.main, MAIN_SRC, 'main')
        if (config.spin) {
            // the main sphere is a button — it sends the ring round (see spin)
            mainEl.tabIndex = 0
            mainEl.setAttribute('role', 'button')
            mainEl.setAttribute('aria-label', config.titleText)
        }
        frag.appendChild(mainEl)
        entries.push({ item: result.main, el: mainEl, fixed: true })
        result.sides.forEach((side) => {
            side.items.forEach((item, rank) => {
                const el = bubble(item, assetSrc(item.id), side.name)
                el.dataset.rank = rank
                if (item.fill) el.dataset.fill = ''
                frag.appendChild(el)
                entries.push({ item, el, fixed: false, dir: side.dir, id: item.id })
            })
        })
        bubbles.replaceChildren(frag)
        bindDodge(entries)

        drawGuides(result)
        fit()
        syncInfo(result)

        stage.style.setProperty('--intro-blur', config.introBlur + 'px')
        stage.style.setProperty('--intro-fade', config.introFade + 's')
        // sliding in, the blur and the ride outlast the fade
        const hold = config.introStyle === 'slide' ? Math.max(config.introBlurHold, 1) : 1
        stage.style.setProperty('--intro-blur-fade', (config.introFade * hold).toFixed(2) + 's')
        stage.style.setProperty('--intro-move', (config.introFade * hold).toFixed(2) + 's')
        // the entrance waits for the section to come into view; a re-render mid-tuning doesn't
        // replay it, it only re-veils while one is still pending
        if (config.intro && introPending) veil(entries)
    }

    /* ---------------------------------- intro --------------------------------- */
    // Spheres arrive out of a blur, from the arms' tips inward — a plain CSS transition per sphere
    // with a staggered delay, so it costs nothing. Two ways round:
    //  · fade  — everyone simply arrives where they belong, the main sphere last in the queue.
    //  · slide — each side starts out beyond its own edge and rides in to the centre, the blur
    //            hanging on past the fade; the main sphere appears once both sides are home.
    // Only the slide moves anything, and only then does the entrance touch `transform` (the class
    // is-arriving) — dodge and spin own it otherwise, and both sit still while this plays.

    const MAIN_AFTER_ARMS = 150   // ms the main sphere waits once the sides have landed (slide)

    let introPending = config.intro
    let introOrder = []
    let introRunning = false
    let introTimer = 0

    function veil(entries) {
        // farthest from the main sphere first, the main sphere itself last
        const main = entries.find((e) => e.fixed)
        const arms = entries
            .filter((e) => !e.fixed)
            .sort((a, b) => Math.hypot(b.item.x - main.item.x, b.item.y - main.item.y) -
                Math.hypot(a.item.x - main.item.x, a.item.y - main.item.y))
        introOrder = arms.concat(main).map((e) => e.el)
        const slide = config.introStyle === 'slide'
        arms.concat(main).forEach((e) => {
            e.el.style.transitionDelay = ''
            // the sides start out past their own edge; the main sphere only fades
            e.el.style.transform = slide && e !== main
                ? `translate3d(${(e.item.x < main.item.x ? -1 : 1) * config.introSlide}px, 0, 0)`
                : ''
            // is-arriving (the transitions) is added only when they set off — while hidden they
            // carry no transition at all, so this takes hold at once
            e.el.classList.add('is-veiled')
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
        // sliding, the main sphere waits for both sides to land; fading, it's just last in the queue
        const mainDelay = slide ? lastArm + Math.round(fade * hold) + MAIN_AFTER_ARMS : wait + arms * stagger

        // dodge keeps its hands off transform until everyone is home
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
        }, mainDelay + Math.round(fade * hold) + 80)
        return true
    }

    function replayIntro() {
        if (!lastLayout) return
        introPending = true
        render()      // veils everything again…
        playIntro()   // …and lets it in
    }

    // in a page, the section is usually further down: it arrives when it's scrolled to
    // keep watching until the entrance has actually started — on a fast load the section can be
    // in view before the first render veiled anything, and letting go here would lose it for good
    new IntersectionObserver((entries, observer) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (!introPending || playIntro()) observer.disconnect()
    }, { threshold: 0.15 }).observe(root)

    function bubble(item, src, side) {
        const el = document.createElement('div')
        el.className = 'dh-bubble'
        el.dataset.side = side
        el.style.left = (item.x - item.d / 2).toFixed(2) + 'px'
        el.style.top = (item.y - item.d / 2).toFixed(2) + 'px'
        el.style.width = el.style.height = item.d.toFixed(2) + 'px'

        const img = document.createElement('img')
        img.src = src
        img.alt = ''
        img.draggable = false
        img.decoding = 'async'
        el.appendChild(img)
        return el
    }

    function drawGuides(result) {
        // an <svg> has no `hidden` property — toggle it through style instead
        guides.style.display = config.showGuides ? '' : 'none'
        if (!config.showGuides) {
            guides.replaceChildren()
            return
        }
        const ns = 'http://www.w3.org/2000/svg'
        const path = (d, stroke, dash) => {
            const p = document.createElementNS(ns, 'path')
            p.setAttribute('d', d)
            p.setAttribute('fill', 'none')
            p.setAttribute('stroke', stroke)
            p.setAttribute('stroke-width', '1')
            if (dash) p.setAttribute('stroke-dasharray', dash)
            return p
        }
        const toD = (points) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')

        const nodes = []
        result.sides.forEach((side) => {
            const { arc } = side
            const centre = [], inner = [], outer = []
            for (let s = 0; s <= arc.length; s += 4) centre.push(arc.at(s, 0))
            for (let s = side.start; s <= arc.length; s += 4) {
                const half = side.bandAt(s) / 2
                inner.push(arc.at(s, -half))
                outer.push(arc.at(s, half))
            }
            nodes.push(path(toD(centre), 'rgba(0, 200, 83, 0.9)', '4 4'))
            if (inner.length > 1) {
                nodes.push(path(toD(inner), 'rgba(255, 255, 255, 0.35)'))
                nodes.push(path(toD(outer), 'rgba(255, 255, 255, 0.35)'))
            }
            // gap fillers get a dashed ring, so it's clear which spheres the second pass added
            side.items.filter((it) => it.fill).forEach((it) => {
                const ring = document.createElementNS(ns, 'circle')
                ring.setAttribute('cx', it.x.toFixed(1))
                ring.setAttribute('cy', it.y.toFixed(1))
                ring.setAttribute('r', (it.d / 2 + 3).toFixed(1))
                ring.setAttribute('fill', 'none')
                ring.setAttribute('stroke', 'rgba(0, 200, 83, 0.9)')
                ring.setAttribute('stroke-dasharray', '3 3')
                nodes.push(ring)
            })
        })
        // the axis the ring runs along on a click, as far as the lap reaches, dotted
        const spinners = result.sides.flatMap((side) => side.items.map((it) => ({ ...it, dir: side.dir })))
        const lap = planSpin(config, spinners, result.main)
        const axis = []
        for (let v = -lap.S; v <= lap.S; v += 6) axis.push(lap.point(v, 0))
        nodes.push(path(toD(axis), 'rgba(255, 255, 255, 0.35)', '2 6'))

        guides.replaceChildren(...nodes)
    }

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

    /* ---------------------------------- dodge --------------------------------- */
    // Every sphere but the main one hangs on a spring at its resting place. The cursor carries
    // a little personal space: as it closes in on a sphere's edge the sphere is pushed off,
    // along the line from the cursor through its (current) centre, and eases back once the
    // cursor has gone. Where a sphere stepping aside would run into a neighbour, that one gets
    // nudged along — so the ring parts around the cursor rather than piling up; the main sphere
    // never moves and acts as a wall. Offsets live in `transform`, left free by the layout.

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = { clientX: 0, clientY: 0, active: false }
    let bodies = []          // { el, x, y, r, ox, oy, vx, vy, fixed } — x/y rest centre, o offset, v velocity
    let dodgeFrame = 0
    let lastTime = 0

    // substeps per frame: the push gets stiff near the edge, and short steps keep it from jittering
    const DODGE_STEPS = 4

    function bindDodge(entries) {
        cancelSpin()   // a re-render mid-lap starts over from the fresh layout
        // s / lateral / dir place each sphere along its arm — the spin reads them; id is the photo
        // it's showing, which the spin swaps as it goes (see planPhotos)
        bodies = entries.map(({ item, el, fixed, dir, id }) => ({
            el, fixed, dir, id, x: item.x, y: item.y, d: item.d, r: item.d / 2, s: item.s, lateral: item.lateral,
            ox: 0, oy: 0, vx: 0, vy: 0
        }))
        wake()
    }

    function wake() {
        if (dodgeFrame || spin.running || introRunning) return   // dodge sits out the lap and the entrance
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
        if (spin.running || introRunning) return
        const dt = Math.min((now - lastTime) / 1000, 1 / 30)   // a stalled tab mustn't fling anything
        lastTime = now

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
            for (const b of bodies) {
                if (b.fixed) continue
                let ax = -k * b.ox - c * b.vx
                let ay = -k * b.oy - c * b.vy
                b.pushed = false
                if (pushing) {
                    const dx = b.x + b.ox - px
                    const dy = b.y + b.oy - py
                    const d = Math.hypot(dx, dy) || 1e-3
                    // 0 while the cursor is `reach` or more from the edge, 1 once it touches it —
                    // scaled so that at rest the spring balances it `dodgeDistance · s` away
                    const s = smoothstep((b.r + reach - d) / reach)
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
                for (const b of bodies) {
                    if (b.fixed) continue
                    b.vx = (b.ox - b.px) / h
                    b.vy = (b.oy - b.py) / h
                }
            }
        }

        // px/s and px: below these nothing visibly moves any more
        const REST_SPEED = 1
        const REST_OFFSET = 0.1
        let moving = false
        for (const b of bodies) {
            if (b.fixed) continue
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
        // the next pointermove wakes it
        if (moving) dodgeFrame = requestAnimationFrame(stepDodge)
    }

    /** Push apart any two spheres that got closer than half the layout gap; the main one stays put. */
    function separate() {
        const minGap = config.gap * 0.5
        for (let i = 0; i < bodies.length; i++) {
            const a = bodies[i]
            for (let j = i + 1; j < bodies.length; j++) {
                const b = bodies[j]
                if (a.fixed && b.fixed) continue
                const min = a.r + b.r + minGap
                const dx = (b.x + b.ox) - (a.x + a.ox)
                const dy = (b.y + b.oy) - (a.y + a.oy)
                if (Math.abs(dx) > min || Math.abs(dy) > min) continue
                const d = Math.hypot(dx, dy)
                if (d >= min || d === 0) continue
                const push = min - d
                const nx = dx / d
                const ny = dy / d
                a.pushed = b.pushed = true      // in contact — held, not "on its way home"
                const wa = a.fixed ? 0 : (b.fixed ? 1 : 0.5)
                const wb = b.fixed ? 0 : (a.fixed ? 1 : 0.5)
                a.ox -= nx * push * wa
                a.oy -= ny * push * wa
                b.ox += nx * push * wb
                b.oy += ny * push * wb
            }
        }
    }

    /* ---------------------------------- spin ---------------------------------- */
    // A click on the main sphere runs the ring along its own arc (see planSpin): a full turn sends
    // each layer once round — the inner clockwise, the outer anticlockwise — and back to where it
    // started; a half turn (spinHalf) runs every sphere on to the other side, into the layout's
    // mirror image, and leaves it there. Spheres never cross the top or pass through the main sphere: at either they
    // shrink away and pop out at the far end. Dodge sits the lap out.
    // The main sphere itself only answers the press, like a button's :active.

    const spin = { running: false, frame: 0, start: 0, plan: null, movers: [], main: null, points: null, raw: null, photos: null, laps: 0 }
    const press = { el: null, down: false, until: 0, scale: 1, v: 0, frame: 0, last: 0 }

    // the press spring: this fast, damped by config.spinBounce (< 1 overshoots) — and held at
    // least this long, so even a quick tap shows
    const PRESS_HZ = 5
    const PRESS_MIN_MS = 140

    // share of the way a sphere pushed off its path is pulled back onto it each frame
    const SPIN_PULL = 0.3

    function startSpin() {
        if (spin.running || introRunning || !config.spin || reducedMotion.matches) return
        const main = spin.main = bodies.find((b) => b.fixed)
        spin.movers = bodies.filter((b) => !b.fixed)
        // dodge hands over: its offsets dropped, its loop stopped
        if (dodgeFrame) cancelAnimationFrame(dodgeFrame)
        dodgeFrame = 0
        spin.movers.forEach((b) => { b.ox = b.oy = b.vx = b.vy = 0 })
        spin.plan = planSpin(config, spin.movers, main)
        // a half turn also brings fresh photos: each sphere takes a new one the moment it's out of
        // sight inside the main sphere
        spin.photos = spin.plan.half
            ? planPhotos(config, spin.plan, spin.movers, mulberry32(hashSeed(config.seed, 900 + ++spin.laps)))
            : null
        spin.movers.forEach((b) => { b.swapped = false })
        spin.points = spin.raw = null
        spin.running = true
        spin.start = performance.now()
        spin.frame = requestAnimationFrame(stepSpin)
    }

    function stepSpin(now) {
        spin.frame = 0
        const t = Math.min((now - spin.start) / (Math.max(config.spinDuration, 0.1) * 1000), 1)
        const raw = spinPositions(spin.plan, t)
        // Kept up frame to frame rather than worked out afresh: where spheres jostle — the layers
        // setting off past each other — pushing them apart from scratch every frame lets one pop
        // straight past another. Carried over, a push builds up and lets go gently. The pull back
        // onto the path goes to 1 over the last stretch, so the lap still ends exactly.
        const pull = Math.max(SPIN_PULL, smoothstep((t - 0.85) / 0.15))
        const points = spinCarry(spin.points, spin.raw, raw, pull)
        spin.raw = raw
        // keep everyone a clean half-gap apart, and off the main sphere — bar those shrinking
        // into it on purpose
        points.forEach((p) => { p.ghost = p.fade < 0.999 })
        points.push({ x: spin.main.x, y: spin.main.y, r: spin.main.d / 2, fixed: true })
        relax(points, config.gap * 0.5, 6)
        points.pop()
        spin.points = points
        spin.movers.forEach((b, i) => {
            const p = points[i]
            // the photo changes while the sphere is inside the main one, where nobody can see it
            if (spin.photos && !b.swapped && p.fade <= 0.001) {
                b.swapped = true
                b.el.querySelector('img').src = assetSrc(spin.photos[i])
            }
            b.el.style.transform = t < 1
                ? `translate3d(${(p.x - b.x).toFixed(2)}px, ${(p.y - b.y).toFixed(2)}px, 0) scale(${p.scale.toFixed(3)})`
                : ''
        })
        if (t < 1) {
            spin.frame = requestAnimationFrame(stepSpin)
            return
        }
        if (spin.plan.half) settleSwapped()
        spin.running = false
        wake()   // back to dodge
    }

    // After a half turn each sphere keeps the place it ran into — the layout's mirror image, sizes
    // and all — and dodge and the next click carry on from there
    function settleSwapped() {
        spin.movers.forEach((b, i) => {
            const slot = spin.plan.spheres[i].slot
            if (spin.photos) {
                b.id = spin.photos[i]
                // a sphere that somehow never went out of sight still ends on its new photo
                if (!b.swapped) b.el.querySelector('img').src = assetSrc(b.id)
            }
            b.x = slot.x
            b.y = slot.y
            b.d = slot.d
            b.r = slot.d / 2
            b.lateral = slot.lateral
            b.dir = slot.dir
            b.el.style.left = (b.x - b.d / 2).toFixed(2) + 'px'
            b.el.style.top = (b.y - b.d / 2).toFixed(2) + 'px'
            b.el.style.width = b.el.style.height = b.d.toFixed(2) + 'px'
            b.el.dataset.side = b.dir > 0 ? 'right' : 'left'
        })
    }

    function pressMain(el) {
        press.el = el
        press.down = true
        press.until = performance.now() + PRESS_MIN_MS
        runPress()
    }

    function releaseMain() {
        if (!press.down) return
        press.down = false
        runPress()
    }

    function runPress() {
        if (press.frame) return
        press.last = performance.now()
        press.frame = requestAnimationFrame(stepPress)
    }

    function stepPress(now) {
        press.frame = 0
        const dt = Math.min((now - press.last) / 1000, 1 / 30)
        press.last = now
        const held = press.down || now < press.until
        const target = held ? config.spinShrink : 1
        const w = 2 * Math.PI * PRESS_HZ
        const h = dt / 2
        for (let n = 0; n < 2; n++) {
            press.v += (-w * w * (press.scale - target) - 2 * config.spinBounce * w * press.v) * h
            press.scale += press.v * h
        }
        if (!held && Math.abs(press.scale - 1) < 0.001 && Math.abs(press.v) < 0.01) {
            press.scale = 1
            press.v = 0
            press.el.style.transform = ''
            return
        }
        press.el.style.transform = `scale(${press.scale.toFixed(4)})`
        press.frame = requestAnimationFrame(stepPress)
    }

    function cancelSpin() {
        if (spin.frame) cancelAnimationFrame(spin.frame)
        if (press.frame) cancelAnimationFrame(press.frame)
        spin.frame = press.frame = 0
        spin.running = press.down = false
        press.scale = 1
        press.v = 0
    }

    // the main sphere is a button: pressed with the pointer, or Enter / Space
    bubbles.addEventListener('pointerdown', (e) => {
        const el = e.target.closest('.dh-bubble[role="button"]')
        if (el) pressMain(el)
    })
    window.addEventListener('pointerup', releaseMain)
    window.addEventListener('pointercancel', releaseMain)
    bubbles.addEventListener('click', (e) => {
        if (e.target.closest('.dh-bubble[role="button"]')) startSpin()
    })
    bubbles.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.dh-bubble[role="button"]')) {
            e.preventDefault()
            if (e.repeat) return
            pressMain(e.target)
            releaseMain()   // a tap — PRESS_MIN_MS still lets it show
            startSpin()
        }
    })

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
            } else if (field.type === 'text' || field.type === 'number') {
                row.innerHTML = `<label for="${id}">${field.label}</label>`
                control = document.createElement('input')
                control.type = field.type
                control.spellcheck = false
            }
            row.appendChild(control)

            control.id = id
            control.addEventListener('input', () => {
                const value = readControl(control, field)
                if (value === null) return      // half-typed number — keep the last good one
                config[field.key] = value
                if (field.type === 'range') {
                    row.querySelector('output').textContent = formatValue(value, field)
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
        if (field.type === 'number') {
            const n = parseInt(control.value, 10)
            return Number.isFinite(n) ? n : null
        }
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

    function syncInfo(result) {
        const line = (side) => {
            const chain = side.items.filter((it) => !it.fill)
            const fills = side.items.filter((it) => it.fill)
            const sizes = chain.filter((it) => !it.near).map((it) => it.d)
            const range = sizes.length
                ? `${Math.round(Math.min(...sizes))}–${Math.round(Math.max(...sizes))}px`
                : '—'
            const fillNote = fills.length
                ? ` · +${fills.length} fill (${fills.map((it) => Math.round(it.d)).join(', ')}px)`
                : ''
            const missing = side.count - chain.length
            const over = side.items.filter((it) => it.y - it.d / 2 < 0).length
            const farthest = Math.max(0, ...chain.map((it) => it.s))
            const reach = Math.round(farthest / side.arc.length * 100)
            const warn = []
            if (missing) warn.push(`${missing} didn't fit`)
            if (over) warn.push(`${over} over top edge`)
            return `<b>${side.name}</b> ${chain.length}/${side.count} · ${range}${fillNote} · arm ${reach}% of arc` +
                (warn.length ? ` · <span class="is-warn">${warn.join(', ')}</span>` : '')
        }
        info.innerHTML = result.sides.map(line).join('<br>')
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
        renderSaved()    // the loaded save may just have turned "edited"
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

    // shuffle — a new seed re-rolls placement and images; the seed lands in the JSON,
    // so a layout worth keeping can be carried over exactly
    panel.querySelector('[data-action="shuffle"]').addEventListener('click', () => {
        config.seed = Math.floor(Math.random() * 100000)
        syncInputs()
        commit()
    })

    panel.querySelector('[data-action="intro"]').addEventListener('click', replayIntro)

    // reset — back to the defaults; the saved list is left alone
    panel.querySelector('[data-action="reset"]').addEventListener('click', () => {
        Object.assign(config, DEVICES[deviceKey].defaults)
        try { localStorage.removeItem(DEVICES[deviceKey].storageKey) } catch (e) {}
        store.active = null
        persistSaved()
        syncInputs()
        render()
        syncOutput()
        renderSaved()
    })

    /* ------------------------------ saved configs ----------------------------- */

    const saveForm = panel.querySelector('.cfg-save')
    const saveName = saveForm.querySelector('input')
    const saveBtn = saveForm.querySelector('button')
    const savedList = panel.querySelector('.cfg-saved-list')
    const savedEmpty = panel.querySelector('.cfg-saved-empty')
    const savedCount = panel.querySelector('.cfg-saved-count')

    // store: { active: id | null, items: [{ id, name, savedAt, config }] }, newest first —
    // config/store were already pointed at the active device above

    function persistSaved() {
        try {
            localStorage.setItem(DEVICES[deviceKey].savedKey, JSON.stringify(store))
            return true
        } catch (e) {
            return false
        }
    }

    const sameConfig = (a, b) => Object.keys(DEVICES[deviceKey].defaults).every((key) => a[key] === b[key])

    const stamp = (time) => new Date(time).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    })

    function iconButton(label, title, onClick) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'cfg-icon'
        btn.textContent = label
        btn.title = title
        btn.setAttribute('aria-label', title)
        btn.addEventListener('click', onClick)
        return btn
    }

    function renderSaved() {
        savedCount.textContent = store.items.length || ''
        savedEmpty.hidden = store.items.length > 0

        savedList.replaceChildren(...store.items.map((entry) => {
            const active = entry.id === store.active
            const edited = active && !sameConfig(withDefaults(entry.config, DEVICES[deviceKey].defaults), config)

            const li = document.createElement('li')
            li.className = 'cfg-saved-item' + (active ? ' is-active' : '')

            // names are user text — always textContent, never innerHTML
            const load = document.createElement('button')
            load.type = 'button'
            load.className = 'cfg-saved-load'
            load.title = 'Load this config'
            const name = document.createElement('span')
            name.className = 'cfg-saved-name'
            name.textContent = entry.name
            const meta = document.createElement('span')
            meta.className = 'cfg-saved-meta'
            meta.textContent = `${stamp(entry.savedAt)} · seed ${entry.config.seed}`
            if (edited) {
                const mark = document.createElement('span')
                mark.className = 'is-edited'
                mark.textContent = ' · edited'
                meta.appendChild(mark)
            }
            load.append(name, meta)
            load.addEventListener('click', () => loadEntry(entry))

            const update = iconButton('↻', 'Overwrite with the current config', () => updateEntry(entry))
            update.disabled = active && !edited   // nothing new to write into it
            const remove = iconButton('×', 'Delete', () => removeEntry(entry))
            remove.dataset.danger = ''

            li.append(load, update, remove)
            return li
        }))
    }

    function loadEntry(entry) {
        Object.assign(config, withDefaults(entry.config, DEVICES[deviceKey].defaults))
        store.active = entry.id
        persistSaved()
        syncInputs()
        commit()
    }

    function updateEntry(entry) {
        entry.config = { ...config }
        entry.savedAt = Date.now()
        store.active = entry.id
        persistSaved()
        renderSaved()
    }

    function removeEntry(entry) {
        if (!window.confirm(`Delete “${entry.name}”?`)) return
        store.items = store.items.filter((item) => item !== entry)
        if (store.active === entry.id) store.active = null
        persistSaved()
        renderSaved()
    }

    // save — always a new entry at the top; ↻ on an entry is how one gets overwritten
    let saveFlash
    saveForm.addEventListener('submit', (e) => {
        e.preventDefault()
        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: saveName.value.trim() || `Config ${store.items.length + 1}`,
            savedAt: Date.now(),
            config: { ...config }
        }
        store.items.unshift(entry)
        store.active = entry.id
        const ok = persistSaved()
        saveName.value = ''
        renderSaved()

        clearTimeout(saveFlash)
        saveBtn.textContent = ok ? 'Saved ✓' : 'No storage'
        saveBtn.classList.add('is-done')
        saveFlash = setTimeout(() => {
            saveBtn.textContent = 'Save'
            saveBtn.classList.remove('is-done')
        }, 1400)
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
        store = DEVICES[deviceKey].store
        syncTabs()
        syncInputs()
        render()
        syncOutput()
        renderSaved()
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
    syncTabs()
    syncInputs()
    render()
    syncOutput()
    renderSaved()

    // the viewport can still settle after the first render — fonts, a phone's own metrics, an
    // orientation change — so measure it again on the next frame and once everything has loaded
    requestAnimationFrame(fit)
    window.addEventListener('load', fit)

    // the layout is plain data — exposed for the interaction step and for debugging
    window.donateHero = {
        get config() { return config },
        get device() { return deviceKey },
        get layout() { return lastLayout },
        get dodging() { return dodgeFrame !== 0 },   // is the dodge loop awake
        intro: replayIntro,
        get spinning() { return spin.running },
        spin: startSpin,
        render
    }
})

/* =============================================================================
   Layout — pure: config in, sphere centres/sizes/images out
   ========================================================================== */

function layout(cfg) {
    const W = cfg.width
    const H = cfg.height
    const main = { x: W / 2, y: H - cfg.mainBottom - cfg.mainSize / 2, d: cfg.mainSize, main: true }
    const placed = [main]

    const sides = [
        { name: 'left', dir: -1, count: cfg.leftCount, pool: cfg.leftPool, near: cfg.leftNear },
        { name: 'right', dir: 1, count: cfg.rightCount, pool: cfg.rightPool, near: cfg.rightNear }
    ].map((side, k) => {
        // each side draws from its own streams, so retuning one side never reshuffles the other
        const packSeed = hashSeed(cfg.seed, k + 1)
        const imageSeed = hashSeed(cfg.seed, k + 11)
        const arc = makeArc(cfg, main, side.dir)

        // Sizes fall off with distance, and the distance the arm ends up covering depends on
        // those sizes — so with fitFalloff the pack is rerun with the falloff stretched to the
        // arm's actual far end until the two agree. Same seed every pass, same lanes.
        let reach = arc.length
        let packed
        for (let pass = 0; pass < (cfg.fitFalloff ? 4 : 1); pass++) {
            packed = packSide(cfg, arc, side.count, mulberry32(packSeed), placed, reach)
            const graded = packed.items.filter((it) => !it.near)
            if (!graded.length) break
            reach = Math.max(...graded.map((it) => it.s))
        }

        placed.push(...packed.items)
        // the chain leaves holes wherever its sphere of the moment was too big — plug them
        packed.items.push(...fillGaps(cfg, arc, packed, placed))
        return { ...side, arc, ...packed, imageSeed }
    })

    // Images go on once every sphere has its place — and its place after a half turn (the spin's
    // mirrored layout), where the same image mustn't end up side by side either
    const everyone = sides.flatMap((side) =>
        side.items.map((it) => ({ x: it.x, y: it.y, d: it.d, lateral: it.lateral, dir: side.dir })))
    const swapped = planSpin({ ...cfg, spinHalf: true }, everyone, main).spheres
    sides.flatMap((side) => side.items).forEach((it, i) => { it.alt = swapped[i].slot })

    // image counts for the whole ring, both sides together; the side that goes first can only
    // expect the other's, spread evenly over its pool
    const ring = {
        used: new Map(), expected: new Map(), placed: [], cap: Infinity,
        window: cfg.frameWidth, centre: cfg.width / 2
    }
    // …and no image more than its fair share of the ring, rounded up, while others are left
    const union = new Set(sides.flatMap((side) => {
        const ids = parsePool(side.pool)
        return ids.length ? ids : ASSET_IDS
    }))
    ring.cap = Math.ceil(sides.reduce((n, side) => n + side.items.length, 0) / Math.max(union.size, 1))
    sides.forEach((side, k) => {
        ring.expected = new Map()
        if (k === 0) {
            const other = sides[1]
            const otherPool = parsePool(other.pool)
            const otherIds = [...new Set(otherPool.length ? otherPool : ASSET_IDS)]
            otherIds.forEach((id) => ring.expected.set(id, other.items.length / otherIds.length))
        }
        assignImages(side.items, parsePool(side.pool), side.near, mulberry32(side.imageSeed), ring)
    })

    return { main, sides }
}

/**
 * One arm of the ring. θ runs from 0 (the main sphere's centre, the ellipse's lowest point)
 * upward; everything else is addressed by arc length s, so a step along the arc means the
 * same number of px wherever it is taken. `lateral` pushes off the centreline along the
 * normal: + outward (away from the ellipse centre), − inward.
 */
function makeArc(cfg, main, dir) {
    const rx = Math.max(cfg.radiusX, 1)
    const ry = Math.max(cfg.radiusY, 1)
    const ey = main.y - ry
    const end = cfg.arcEnd * Math.PI / 180

    const point = (th) => ({ x: main.x + dir * rx * Math.sin(th), y: ey + ry * Math.cos(th) })
    const normal = (th) => {
        const nx = dir * Math.sin(th) / rx
        const ny = Math.cos(th) / ry
        const len = Math.hypot(nx, ny)
        return { x: nx / len, y: ny / len }
    }

    // arc-length table, carried a little past the end so a crowded side can spill over
    // instead of losing spheres, but not so far that one lands back at the top centre
    const maxTh = Math.min(Math.PI, end + Math.PI / 4)
    const STEPS = 900
    const ths = [0]
    const lens = [0]
    let prev = point(0)
    for (let i = 1; i <= STEPS; i++) {
        const th = maxTh * i / STEPS
        const p = point(th)
        ths.push(th)
        lens.push(lens[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y))
        prev = p
    }

    const thetaAt = (s) => {
        if (s <= 0) return 0
        if (s >= lens[STEPS]) return ths[STEPS]
        let lo = 0, hi = STEPS
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1
            if (lens[mid] < s) lo = mid
            else hi = mid
        }
        const f = (s - lens[lo]) / (lens[hi] - lens[lo] || 1)
        return ths[lo] + (ths[hi] - ths[lo]) * f
    }

    const lengthAt = (th) => {
        const i = Math.min(STEPS, Math.round(th / maxTh * STEPS))
        return lens[i]
    }

    return {
        dir,
        length: lengthAt(Math.min(end, maxTh)),   // where the size falloff reaches minSize
        total: lens[STEPS],                       // how far a sphere may still be pushed
        at(s, lateral) {
            const th = thetaAt(s)
            const p = point(th)
            const n = normal(th)
            return { x: p.x + n.x * lateral, y: p.y + n.y * lateral }
        }
    }
}

/**
 * Greedy packing along the arc: each sphere takes a lane (a random offset inside the band,
 * mostly flipping sides of the centreline so the ring reads two spheres thick) and then slides
 * in from the main sphere until it sits a clean `gap` away from everything placed so far.
 * That is what keeps them "one next to another" rather than scattered.
 */
function packSide(cfg, arc, count, rng, base, reach) {
    const placed = base.slice()   // a trial run — the caller keeps only the pass it settles on
    const items = []
    const gap = cfg.gap
    const lo = Math.min(cfg.minSize, cfg.maxSize)
    const hi = Math.max(cfg.minSize, cfg.maxSize)

    let start = 0            // arc length where the graded spheres begin — just past the near one
    const progress = (s) => clamp((s - start) / Math.max(reach - start, 1), 0, 1)
    const baseAt = (t) => lo + (hi - lo) * Math.pow(1 - t, cfg.sizeCurve)
    const bandAt = (s) => {
        const t = progress(s)
        const T = cfg.thicknessNear + (cfg.thicknessFar - cfg.thicknessNear) * t
        return T * baseAt(t) + Math.max(T - 1, 0) * gap
    }

    let sign = rng() < 0.5 ? -1 : 1
    for (let i = 0; i < count; i++) {
        // always three draws per sphere, whatever the search does, so tuning a slider only
        // moves spheres — it never re-rolls which lane or image each one gets
        const rSize = rng() * 2 - 1
        const rLane = rng()
        const rFlip = rng()

        const near = i === 0
        let d, lateral, s, t

        if (near) {
            d = cfg.nearSize
            lateral = rSize * cfg.nearDrift
            s = findSpot(cfg, arc, d, lateral, placed, 0)
            t = 0
        } else {
            if (rFlip < cfg.laneSwitch) sign = -sign
            // the size depends on where it lands and where it lands on its size: settle in passes
            s = items.length ? items[items.length - 1].s : start
            for (let pass = 0; pass < 3 && s !== null; pass++) {
                t = progress(s)
                const base = baseAt(t)
                d = clamp(base * (1 + rSize * cfg.sizeJitter), lo, hi)
                // `room` puts the sphere's edge on the band edge, i.e. the middle of its lane.
                // Jitter only pulls it in toward the centreline, and by little: two spheres just
                // across the centreline from each other stack in single file, the arm grows
                // long, and the ring stops reading as two thick
                const room = Math.max(0, (bandAt(s) - d) / 2)
                lateral = sign * (1 - cfg.laneJitter * rLane) * cfg.laneSpread * room
                s = findSpot(cfg, arc, d, lateral, placed, start)
            }
            if (s !== null) t = progress(s)
        }

        if (s === null) continue    // no room left on this arm — reported in the panel

        const p = arc.at(s, lateral)
        const item = { x: p.x, y: p.y, d, s, t, near, lateral }
        placed.push(item)
        items.push(item)
        if (near) start = s + d / 2
    }

    return { items, count, start, reach, bandAt, baseAt, progress }
}

/** Smallest arc length (from `from` on) where a sphere of size d at `lateral` clears everything. */
function findSpot(cfg, arc, d, lateral, placed, from) {
    const r = d / 2
    const gap = cfg.gap
    const fits = (s) => {
        const p = arc.at(s, lateral)
        // bottom and sides are hard edges; the top is left open so the arms can run off it
        if (p.x - r < 0 || p.x + r > cfg.width || p.y + r > cfg.height) return false
        for (let k = 0; k < placed.length; k++) {
            const q = placed[k]
            if (Math.hypot(p.x - q.x, p.y - q.y) < r + q.d / 2 + gap - 1e-6) return false
        }
        return true
    }

    const STEP = 2
    const begin = Math.max(0, from - r)
    if (fits(begin)) return begin
    for (let s = begin + STEP; s <= arc.total; s += STEP) {
        if (!fits(s)) continue
        // walk back to the exact contact point, so the gap is the gap and not gap + a step
        let a = s - STEP, b = s
        for (let k = 0; k < 10; k++) {
            const m = (a + b) / 2
            if (fits(m)) b = m
            else a = m
        }
        return b
    }
    return null
}

/**
 * Second pass. The chain gives every sphere the size its distance asks for, so wherever that
 * size didn't fit, a hole stayed open — worst near the centre, where the spheres are biggest.
 * Here the size rule is relaxed: the biggest empty circle inside the band takes a sphere as
 * large as it holds (never above the local size), down to fillMinSize; repeat.
 * Pushes each filler onto `placed` as it goes and returns them.
 */
function fillGaps(cfg, arc, packed, placed) {
    const fillers = []
    const chain = packed.items
    if (!cfg.fillGaps || !chain.length) return fillers

    const far = Math.max(...chain.map((it) => it.s))   // fillers plug the arm, never extend it
    const gap = cfg.gap

    // radius a sphere centred at (s, lateral) could have: out to the band edge, the section
    // edges (the top included — a filler never runs off it) and a clean gap from every sphere.
    // Stops early once it can't beat `floor`, which keeps the grid scan cheap
    const roomAt = (s, lateral, floor) => {
        const p = arc.at(s, lateral)
        let r = Math.min(packed.bandAt(s) / 2 - Math.abs(lateral), p.x, cfg.width - p.x, cfg.height - p.y, p.y)
        for (let k = 0; k < placed.length && r > floor; k++) {
            const q = placed[k]
            r = Math.min(r, Math.hypot(p.x - q.x, p.y - q.y) - q.d / 2 - gap)
        }
        return { r, p, s, lateral }
    }

    const STEP = 6
    for (let n = 0; n < cfg.fillMax; n++) {
        // coarse grid over the band…
        let best = { r: -Infinity }
        for (let s = 0; s <= far; s += STEP) {
            const half = packed.bandAt(s) / 2
            for (let lat = -half; lat <= half; lat += STEP) {
                const room = roomAt(s, lat, best.r)
                if (room.r > best.r) best = room
            }
        }
        if (!best.p) break
        // …then climb to the hole's actual centre with shrinking steps
        for (let step = STEP / 2; step >= 0.5; step /= 2) {
            let moved = true
            while (moved) {
                moved = false
                for (const [ds, dl] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
                    const s = best.s + ds
                    if (s < 0 || s > far) continue
                    const room = roomAt(s, best.lateral + dl, best.r)
                    if (room.r > best.r) {
                        best = room
                        moved = true
                    }
                }
            }
        }

        const t = packed.progress(best.s)
        const d = Math.min(best.r * 2, packed.baseAt(t))
        if (!(d >= cfg.fillMinSize)) break    // the biggest hole left is too small — done

        const item = { x: best.p.x, y: best.p.y, d, s: best.s, t, near: false, fill: true, lateral: best.lateral }
        placed.push(item)
        fillers.push(item)
    }
    return fillers
}

/**
 * Every image in a side's pool is used once before any comes round again on that side. Repeats
 * are unavoidable, so among the least-used there the pick goes first to the images least used on
 * the whole ring — two pools sharing an image would otherwise show it twice as often as the rest
 * — and then to the one whose nearest twin is farthest away, both where the spheres rest and
 * where a half turn takes them (`alt`). `ring` is shared by the two sides: what's been placed so
 * far (`used`, `placed`) and what the side still to come is expected to use (`expected`).
 */
function assignImages(items, pool, nearChoice, rng, ring) {
    // shuffled once, so ties (e.g. the whole first round, where nothing has a twin) go randomly
    const ids = shuffle([...new Set(pool.length ? pool : ASSET_IDS)], rng)
    const used = new Map(ids.map((id) => [id, 0]))   // on this side
    const onRing = (id) => (ring.used.get(id) || 0) + (ring.expected.get(id) || 0)

    const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) - (a.d + b.d) / 2
    // on a windowed section (mobile) only a slice of the stage is ever on screen — two of the same
    // photo inside it at once is the one thing that must never happen
    const onScreen = (p) => ring.window > 0 && Math.abs(p.x - ring.centre) < ring.window / 2 + p.d / 2
    const twinDistance = (item, id) => {
        let best = Infinity
        for (const q of ring.placed) {
            if (q.id !== id) continue
            if (onScreen(item) && onScreen(q)) return -Infinity
            if (item.alt && q.alt && onScreen(item.alt) && onScreen(q.alt)) return -Infinity
            best = Math.min(best, gap(item, q))
            if (item.alt && q.alt) best = Math.min(best, gap(item.alt, q.alt))
        }
        return best
    }
    const take = (item, id) => {
        item.id = id
        used.set(id, (used.get(id) || 0) + 1)
        ring.used.set(id, (ring.used.get(id) || 0) + 1)
        ring.placed.push(item)
    }

    items.forEach((item) => {
        if (item.near && nearChoice !== 'auto') return take(item, Number(nearChoice))
        const farthest = (candidates) => {
            let pick = null, pickDistance = -1
            candidates.forEach((id) => {
                const distance = twinDistance(item, id)
                if (distance > pickDistance) {
                    pick = id
                    pickDistance = distance
                }
            })
            return { pick, pickDistance }
        }
        // images already at the ring's cap sit out — unless nothing else is left
        const open = (list) => {
            const under = list.filter((id) => (ring.used.get(id) || 0) < ring.cap)
            return under.length ? under : list
        }
        const leastHere = Math.min(...ids.map((id) => used.get(id)))
        const fresh = open(ids.filter((id) => used.get(id) === leastHere))
        const leastOnRing = Math.min(...fresh.map(onRing))
        let { pick, pickDistance } = farthest(fresh.filter((id) => onRing(id) === leastOnRing))
        // the rules give way one at a time when every image they allow already sits right next
        // door — late spheres (gap fillers above all) land among the crowd, and a twin at arm's
        // length reads worse than one image coming up once more than another
        if (pickDistance < TWIN_MIN_DISTANCE) ({ pick, pickDistance } = farthest(fresh))
        if (pickDistance < TWIN_MIN_DISTANCE) pick = farthest(open(ids)).pick
        take(item, pick)
    })
}

/**
 * Fresh photos for a half turn: every sphere takes the photo of the place it's heading for, and
 * those are dealt out again from scratch — the ones on screen now counted as used, so what comes
 * out of the main sphere is what hasn't been seen. Sizes and places are the lap's business; this
 * only picks pictures. Each destination draws from the pool of the arm it lands on.
 * Returns the new photo id per mover, in the movers' own order.
 */
function planPhotos(cfg, plan, movers, rng) {
    const slots = plan.spheres.map((p, i) => ({ x: p.slot.x, y: p.slot.y, d: p.slot.d, dir: p.slot.dir, i }))
    const ring = {
        used: new Map(), expected: new Map(), placed: [], cap: Infinity,
        window: cfg.frameWidth, centre: cfg.width / 2
    }
    // what's on screen now goes to the back of the queue
    movers.forEach((b) => { if (b.id) ring.used.set(b.id, (ring.used.get(b.id) || 0) + 1) })
    const pools = { 1: parsePool(cfg.rightPool), '-1': parsePool(cfg.leftPool) }
    const union = new Set([...pools[1], ...pools[-1]])
    ring.cap = Math.ceil((slots.length + ring.used.size) / Math.max(union.size, 1))

    const ids = new Array(slots.length)
    for (const dir of [1, -1]) {
        const mine = slots.filter((s) => s.dir === dir)
        if (!mine.length) continue
        assignImages(mine, pools[dir], 'auto', rng, ring)
        mine.forEach((s) => { ids[s.i] = s.id })
    }
    return ids
}

/** "9-13, 5, 7, 1" → [9, 10, 11, 12, 13, 5, 7, 1]; unknown ids are dropped. */
function parsePool(text) {
    const ids = []
    String(text).split(/[\s,;]+/).forEach((part) => {
        const range = part.match(/^(\d+)\s*-\s*(\d+)$/)
        if (range) {
            const a = +range[1], b = +range[2]
            const step = a <= b ? 1 : -1
            for (let n = a; n !== b + step; n += step) ids.push(n)
        } else if (/^\d+$/.test(part)) {
            ids.push(+part)
        }
    })
    return ids.filter((n) => ASSET_IDS.includes(n))
}

/* =============================================================================
   Spin — the lap the ring runs when the main sphere is clicked (pure)
   ========================================================================== */

/**
 * The lap, planned. Every sphere runs along its own track: the spin axis — the arc the spheres
 * sit on, unless the config moves it — kept at the sphere's own distance off it, so a click sets
 * everything off from exactly where it is. Along the axis, `v` is signed arc length: + up the
 * right arm, − up the left, 0 at the bottom, in the main sphere. The track is one loop: through
 * the main sphere (unseen — a sphere shrinks away right into its edge and grows back out of the
 * far side) and, past a tip, on from the other tip. The inner layer runs it clockwise — right to
 * left past the main sphere, up the left arm — the outer anticlockwise; cfg.spinSwap flips them.
 * While running, spheres too near the centre line ease just far enough off it to pass the other
 * layer.
 * - Full turn: everyone once round and back to their own place, at their own size.
 * - Half turn (cfg.spinHalf): the places are the layout's mirror image. In each layer the spheres,
 *   in the order they run, take the mirrored places in that same order — shifted so every one
 *   crosses to the other arm. The ring never empties, and since the order holds, nobody overtakes
 *   anybody: each just runs its own distance, growing or shrinking to the size of its new place.
 *   Two half turns bring every sphere home.
 * `spheres` need x, y, d, lateral and dir (-1 left, 1 right); `main` needs x, y, d.
 */
function planSpin(cfg, spheres, main) {
    const M = { x: main.x, y: main.y, r: main.d / 2 }
    const half = Boolean(cfg.spinHalf)
    const axisCfg = { ...cfg, radiusX: cfg.radiusX + cfg.spinAxisRx, radiusY: cfg.radiusY + cfg.spinAxisRy }
    const arcs = { 1: makeArc(axisCfg, main, 1), '-1': makeArc(axisCfg, main, -1) }
    const point = (v, lateral) => (v >= 0 ? arcs[1].at(v, lateral) : arcs[-1].at(-v, lateral))

    // where a point sits against the axis: the nearest spot of its centre line, and how far off
    const locate = (x, y, dir) => {
        const arc = arcs[dir]
        let s = 0
        let best = Infinity
        for (let v = 0; v <= arc.total; v += 2) {
            const q = arc.at(v, 0)
            const d = (q.x - x) ** 2 + (q.y - y) ** 2
            if (d < best) {
                best = d
                s = v
            }
        }
        const q = arc.at(s, 0)
        const n = arc.at(s, 1)   // one px out along the normal
        return { v: dir * s, lateral: (x - q.x) * (n.x - q.x) + (y - q.y) * (n.y - q.y) }
    }

    const zone = Math.max(cfg.spinSwitch, 1)
    const starts = spheres.map((sp) => locate(sp.x, sp.y, sp.dir))
    const farthest = Math.max(0, ...starts.map((a) => Math.abs(a.v)))
    // Past a tip a sphere jumps to the other one, and the jump must never be caught on screen: the
    // last stretch before it is spent at nothing, at least as long as the most a sphere covers in
    // a frame — which the easing sets (expo.out bursts off at ~7× its average speed). The tip zone
    // is that plus room to shrink over, and the loop runs a zone past the farthest sphere, so
    // nobody sets off already shrinking.
    const ease = EASES[cfg.spinEase] || EASES['expo.out']
    const fastest = (2.2 * (farthest + cfg.spinTipSwitch) * ease.peak) / (Math.max(cfg.spinDuration, 0.1) * 60)
    const tipDead = Math.max(40, cfg.spinTipSwitch * 0.3, fastest)
    const tip = Math.max(cfg.spinTipSwitch, tipDead + 30)
    const S = Math.min(arcs[1].total, arcs[-1].total, farthest + tip)
    const span = 2 * S
    // how far along the loop, the way a layer runs it, from the tip it starts at
    const flow = (v, way) => (way < 0 ? S - v : v + S)

    const planned = spheres.map((sp, i) => {
        const a = starts[i]
        return {
            i,
            way: (a.lateral < 0) !== Boolean(cfg.spinSwap) ? -1 : 1,
            v0: a.v,
            lat0: a.lateral,
            x0: sp.x,
            y0: sp.y,
            r0: sp.d / 2,
            // full turn: once round, back into its own place
            slot: { x: sp.x, y: sp.y, d: sp.d, lateral: sp.lateral, dir: sp.dir, v: a.v, lat: a.lateral },
            run: span
        }
    })

    if (half) {
        for (const way of [-1, 1]) {
            const f = (v) => flow(v, way)
            const runners = planned.filter((p) => p.way === way).sort((a, b) => f(a.v0) - f(b.v0))
            // a layer's mirrored places are its own spheres' mirror images
            const places = runners.map((p) => {
                const sp = spheres[p.i]
                const x = cfg.width - sp.x
                const at = locate(x, sp.y, -sp.dir)
                return { x, y: sp.y, d: sp.d, lateral: sp.lateral, dir: -sp.dir, v: at.v, lat: at.lateral }
            }).sort((a, b) => f(a.v) - f(b.v))
            // the runners on the first stretch of the loop take the places on the second, and the
            // other way round: shift by how many places lie on the first
            const shift = places.filter((q) => f(q.v) < S).length
            runners.forEach((p, j) => {
                const k = j + shift
                p.slot = places[k % places.length]
                p.run = f(p.slot.v) + (k >= places.length ? span : 0) - f(p.v0)
                if (p.run <= 0) p.run += span   // can't happen with the shift above; never run backwards
            })
        }
    }

    planned.forEach((p) => {
        const s = p.slot
        const a = point(p.v0, p.lat0)
        const b = point(s.v, s.lat)
        const clearOfMain = (x, y) => Math.hypot(x - M.x, y - M.y) - M.r
        p.f0 = flow(p.v0, p.way)
        p.lat1 = s.lat
        p.r1 = s.d / 2
        // what's left between the track and where it rests, and where it ends up — a px or so
        p.dx = p.x0 - a.x
        p.dy = p.y0 - a.y
        p.ex = s.x - b.x
        p.ey = s.y - b.y
        // it shrinks into the main sphere over `zone` px — fewer if it rests (or ends) nearer,
        // so it never sets off, nor lands, shrunk
        p.zone = Math.max(1, Math.min(zone, clearOfMain(p.x0, p.y0), clearOfMain(s.x, s.y)))
    })

    return { half, main: M, tip, tipDead, S, span, gap: cfg.gap, ease: ease.fn, point, spheres: planned }
}

/**
 * Sphere centres and sizes at time `t` 0…1 of the lap: everyone off at once, eased in and out.
 * `fade` is the shrinking into the main sphere or a tip; `scale` is size against the sphere's
 * resting one, fade included. t 0 is exactly the layout; t 1 is the layout again, or on a half
 * turn its mirror image.
 */
function spinPositions(plan, t) {
    const p = plan.ease(clamp(t, 0, 1))
    const M = plan.main
    // spheres near the centre line ease off it over the first bit of the way and back over the
    // last — by distance run, not time, so however sharp the easing they're clear of the other
    // layer before much of it has gone by
    const apart = smoothstep(p / 0.04) * smoothstep((1 - p) / 0.04)
    // into a tip: nothing over the last `tipDead` px (see planSpin)
    const tipDead = plan.tipDead
    return plan.spheres.map((sp) => {
        const f = (((sp.f0 + sp.run * p) % plan.span) + plan.span) % plan.span
        const v = sp.way < 0 ? plan.S - f : f - plan.S
        const r = sp.r0 + (sp.r1 - sp.r0) * p
        // from its own distance off the axis to its new place's — and while the layers pass each
        // other, never nearer the centre line than it takes to clear the other one
        const base = sp.lat0 + (sp.lat1 - sp.lat0) * p
        const clear = r + plan.gap / 2
        const passing = sp.lat0 < 0 ? Math.min(base, -clear) : Math.max(base, clear)
        const q = plan.point(v, base + (passing - base) * apart)
        const x = q.x + sp.dx * (1 - p) + sp.ex * p
        const y = q.y + sp.dy * (1 - p) + sp.ey * p
        const intoMain = smoothstep((Math.hypot(x - M.x, y - M.y) - M.r) / sp.zone)
        const intoTip = smoothstep((plan.S - Math.abs(v) - tipDead) / (plan.tip - tipDead))
        const fade = Math.min(intoMain, intoTip)
        return { x, y, r: r * fade, scale: (r / sp.r0) * fade, fade }
    })
}

/** Last frame's settled `points` moved along with their targets (`prevRaw` → `raw`), then pulled
 *  `pull` of the way onto them. With no last frame, the targets themselves. */
function spinCarry(points, prevRaw, raw, pull) {
    return raw.map((p, i) => {
        if (!points) return { ...p }
        const x = points[i].x + p.x - prevRaw[i].x
        const y = points[i].y + p.y - prevRaw[i].y
        return { x: x + (p.x - x) * pull, y: y + (p.y - y) * pull, r: p.r, scale: p.scale, fade: p.fade }
    })
}

/** Pushes apart any two circles closer than `minGap` edge to edge — a few passes over all pairs.
 *  A `fixed` circle never moves: whoever it touches takes the whole push — except a `ghost`,
 *  which it lets through. */
function relax(points, minGap, passes) {
    for (let n = 0; n < passes; n++) {
        for (let i = 0; i < points.length; i++) {
            const a = points[i]
            for (let j = i + 1; j < points.length; j++) {
                const b = points[j]
                if (a.fixed && b.fixed) continue
                if ((a.fixed && b.ghost) || (b.fixed && a.ghost)) continue
                const min = a.r + b.r + minGap
                const dx = b.x - a.x
                const dy = b.y - a.y
                if (Math.abs(dx) > min || Math.abs(dy) > min) continue
                const d = Math.hypot(dx, dy)
                if (d >= min || d === 0) continue
                const push = (min - d) / d
                const wa = a.fixed ? 0 : (b.fixed ? 1 : 0.5)
                const wb = b.fixed ? 0 : (a.fixed ? 1 : 0.5)
                a.x -= dx * push * wa
                a.y -= dy * push * wa
                b.x += dx * push * wb
                b.y += dy * push * wb
            }
        }
    }
    return points
}


/* ---------------------------------- helpers --------------------------------- */

function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max)
}

function smoothstep(x) {
    const t = clamp(x, 0, 1)
    return t * t * (3 - 2 * t)
}

function shuffle(list, rng) {
    const out = list.slice()
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

function hashSeed(seed, salt) {
    let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0
    h ^= h >>> 16
    return Math.imul(h, 0x7feb352d) >>> 0
}

function mulberry32(a) {
    return function () {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
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

function loadSaved(savedKey, presets) {
    const store = { active: null, items: [], planted: [] }
    try {
        const raw = JSON.parse(localStorage.getItem(savedKey) || 'null')
        if (raw && Array.isArray(raw.items)) {
            store.active = raw.active ?? null
            store.items = raw.items.filter((item) => item && item.id && item.config)
            store.planted = Array.isArray(raw.planted) ? raw.planted : []
        }
    } catch (e) { /* malformed / unavailable storage — start with an empty list */ }

    // presets this browser hasn't had yet go on top, in the order they're listed
    const fresh = presets.filter((preset) => !store.planted.includes(preset.id))
    if (fresh.length) {
        fresh.slice().reverse().forEach((preset) => {
            store.planted.push(preset.id)
            if (store.items.some((item) => item.id === preset.id)) return
            store.items.unshift({ id: preset.id, name: preset.name, savedAt: Date.now(), config: { ...preset.config } })
        })
        try { localStorage.setItem(savedKey, JSON.stringify(store)) } catch (e) {}
    }
    return store
}
