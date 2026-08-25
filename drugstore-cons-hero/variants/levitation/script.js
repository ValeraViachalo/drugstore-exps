window.addEventListener('DOMContentLoaded', async () => {

    /* ------------------------------------------------------------------
     * CONFIG — live-editable from the dash (assets/dash.js)
     * Every size is expressed in vw and resolved to px at spawn time.
     * ---------------------------------------------------------------- */
    const CONFIG = {
        // population — the target drifts inside COUNT, so the section breathes
        // instead of sitting pinned at a hard cap
        COUNT: [6, 16],
        COUNT_INTERVAL: [5, 11],    // how often a new target is picked, s
        ADJUST_DELAY: [0.7, 1.8],   // pause between adding or removing one sphere, s

        // size
        SIZE: [5, 12],              // diameter range, vw
        SIZE_BIAS: 1.2,             // >1 → many small + few large, 1 → flat random

        // life
        LIFETIME: [14, 26],         // how long a sphere lives, s
        LIFETIME_ENABLED: true,

        // motion
        SPEED: [0.02, 0.09],        // initial velocity magnitude
        // Matter multiplies an applied force by delta² (~278) before it reaches
        // velocity, so these coefficients are far smaller than they look.
        // Calibrated by measurement against the live config: ~20 px/s drift,
        // roughly a 140px wander around wherever a sphere faded in.
        DRIFT: 0.00006,             // strength of the endless wander
        DRIFT_SPEED: 0.25,          // how fast that wander cycles, rad/s
                                    // lower = wider, slower floating
        EDGE_PUSH: 0.0003,           // inward nudge that stops spheres parking on the walls
        EDGE_MARGIN: 0.16,          // how far in from each edge that nudge starts, 0–0.5
        SEPARATION: 0.0003,          // spheres keep their distance instead of clumping
        SEPARATION_GAP: 5,          // how far past touching that repulsion reaches, vw
        FRICTION_AIR: 0.025,
        RESTITUTION: 0.35,
        ROTATE: false,              // some spheres carry readable text

        // split — the mwg_113 mechanic, fired on a timer instead of on hover
        SPLIT_ENABLED: true,
        SPLIT_DELAY: [2.5, 6],      // random pause between two splits, s
        SPLIT_SCALE: 0.82,          // child diameter = parent diameter × this
        SPLIT_SPEED: 0.25,          // how hard the two children drift apart

        // transitions
        ENTER_DURATION: 0.9,
        EXIT_DURATION: 0.7,
    }

    const DEFAULTS = JSON.parse(JSON.stringify(CONFIG))

    // Versioned: a saved config silently overrides every key it still shares
    // with the current one, so retuning the defaults does nothing on a browser
    // that has an older config in storage. Bump this whenever defaults change
    // in a way that must win.
    const STORAGE_KEY = 'cons-hero:config:v2'
    const STALE_KEYS = ['cons-hero:config']

    restoreConfig(CONFIG)

    const root = document.querySelector('.cons-hero')

    function restoreConfig(config) {
        try {
            STALE_KEYS.forEach(key => localStorage.removeItem(key))

            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return
            Object.entries(JSON.parse(raw)).forEach(([key, value]) => {
                if (!(key in config)) return
                config[key] = Array.isArray(value) ? value.slice() : value
            })
        } catch {
            /* nothing saved, or storage is blocked — defaults are fine */
        }
    }

    /* ------------------------------------------------------------------
     * ICONS — three discovery strategies, first one that works wins:
     *   1. assets/icons.json      (built by scripts/build-icons.mjs)
     *   2. the assets/ directory listing, if the host serves an autoindex
     *   3. the <img> tags already in the markup
     * ---------------------------------------------------------------- */
    const ASSETS_HREF = 'assets/'
    const IMAGE_RE = /\.(png|jpe?g|webp|avif|gif|svg)$/i

    const iconsFromMarkup = () =>
        [...root.querySelectorAll('.cons-hero__sources img')].map(el => el.getAttribute('src'))

    async function iconsFromManifest() {
        const res = await fetch(`${ASSETS_HREF}icons.json`, { cache: 'no-cache' })
        if (!res.ok) throw new Error(res.status)
        const data = await res.json()
        if (!Array.isArray(data.icons) || !data.icons.length) throw new Error('empty manifest')
        return data.icons
    }

    async function iconsFromDirectoryListing() {
        const res = await fetch(ASSETS_HREF, { cache: 'no-cache' })
        if (!res.ok) throw new Error(res.status)

        const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
        const found = [...doc.querySelectorAll('a[href]')]
            .map(a => a.getAttribute('href').split(/[?#]/)[0])
            .filter(href => IMAGE_RE.test(href))
            .map(href => (href.includes('/') ? href.replace(/^.*\//, '') : href))

        const unique = [...new Set(found)]
        if (!unique.length) throw new Error('no images in listing')

        return unique
            .sort(new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare)
            .map(name => ASSETS_HREF + name)
    }

    async function loadIcons() {
        for (const [label, strategy] of [
            ['manifest', iconsFromManifest],
            ['directory listing', iconsFromDirectoryListing],
        ]) {
            try {
                const icons = await strategy()
                console.info(`[cons-hero] ${icons.length} icons via ${label}`)
                return icons
            } catch {
                /* try the next one */
            }
        }
        const icons = iconsFromMarkup()
        console.info(`[cons-hero] ${icons.length} icons via markup`)
        return icons
    }

    const icons = await loadIcons()

    /* ------------------------------------------------------------------
     * ENGINE
     * ---------------------------------------------------------------- */
    const { Engine, World, Bodies, Body, Runner, Events } = Matter
    const engine = Engine.create({ gravity: { x: 0, y: 0 } })
    const runner = Runner.create()
    Runner.run(runner, engine)

    const items = []
    let incr = 0
    let targetCount = 0
    let adjustCall = null
    let targetCall = null
    let splitCall = null

    /* ------------------------------------------------------------------
     * HELPERS
     * ---------------------------------------------------------------- */
    const vw = (value) => (window.innerWidth * value) / 100
    const rand = ([min, max]) => gsap.utils.random(min, max)
    const living = () => items.filter(item => !item.dead)

    // Power curve: bias > 1 pushes the result toward the low end, so the
    // section gets a couple of big spheres and a few small ones.
    function randSize() {
        const [min, max] = CONFIG.SIZE
        return min + (max - min) * Math.pow(Math.random(), CONFIG.SIZE_BIAS)
    }

    function getSize() {
        const rect = root.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
    }

    /* ------------------------------------------------------------------
     * WALLS
     * ---------------------------------------------------------------- */
    const WALL_THICKNESS = 200
    let walls = []

    function createWalls() {
        if (walls.length) World.remove(engine.world, walls)

        const { width, height } = getSize()
        const t = WALL_THICKNESS
        const opts = { isStatic: true, restitution: 0.4, friction: 0 }

        walls = [
            Bodies.rectangle(width / 2, -t / 2, width + t * 2, t, opts),           // top
            Bodies.rectangle(width / 2, height + t / 2, width + t * 2, t, opts),   // bottom
            Bodies.rectangle(-t / 2, height / 2, t, height + t * 2, opts),         // left
            Bodies.rectangle(width + t / 2, height / 2, t, height + t * 2, opts),  // right
        ]
        World.add(engine.world, walls)
    }

    createWalls()

    /* ------------------------------------------------------------------
     * PLACEMENT — farthest-point sampling, so a new sphere fades in where
     * there is room rather than on top of what is already floating
     * ---------------------------------------------------------------- */
    function findSpawnPosition(radius) {
        const { width, height } = getSize()
        const padX = Math.min(radius + 4, width / 2)
        const padY = Math.min(radius + 4, height / 2)
        const others = living()

        let best = { x: width / 2, y: height / 2 }
        let bestScore = -Infinity

        for (let i = 0; i < 24; i++) {
            const x = gsap.utils.random(padX, width - padX)
            const y = gsap.utils.random(padY, height - padY)

            let score = Infinity
            for (const item of others) {
                const d = Math.hypot(item.body.position.x - x, item.body.position.y - y)
                score = Math.min(score, d - item.radius - radius)
            }

            if (score > bestScore) {
                bestScore = score
                best = { x, y }
            }
        }

        return best
    }

    /* ------------------------------------------------------------------
     * SPAWN
     * ---------------------------------------------------------------- */
    function spawnItem({ x = null, y = null, sizeVw = null, velocity = null, skipEnter = false } = {}) {
        if (!icons.length) return null

        const finalVw = sizeVw ?? randSize()
        const size = vw(finalVw)
        const radius = size / 2

        let px = x
        let py = y
        if (px == null || py == null) {
            const pos = findSpawnPosition(radius)
            px = pos.x
            py = pos.y
        } else {
            const { width, height } = getSize()
            px = gsap.utils.clamp(radius, Math.max(radius, width - radius), px)
            py = gsap.utils.clamp(radius, Math.max(radius, height - radius), py)
        }

        const el = document.createElement('div')
        el.className = 'cons-hero__item'
        el.style.width = `${size}px`
        el.style.height = `${size}px`

        const img = document.createElement('img')
        img.src = icons[incr % icons.length]
        img.alt = ''
        el.appendChild(img)
        root.appendChild(el)
        incr++

        const body = Bodies.circle(px, py, radius, {
            frictionAir: CONFIG.FRICTION_AIR,
            restitution: CONFIG.RESTITUTION,
            friction: 0,
            density: 0.001,
        })
        if (!CONFIG.ROTATE) Body.setInertia(body, Infinity)

        if (velocity) {
            Body.setVelocity(body, velocity)
        } else {
            const angle = Math.random() * Math.PI * 2
            const speed = rand(CONFIG.SPEED)
            Body.setVelocity(body, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed })
        }

        World.add(engine.world, body)

        const item = {
            el, img, body, radius, size,
            vwSize: finalVw,
            dead: false,
            lifeCall: null,
            // Every sphere wanders on its own pair of oscillators. The rate is
            // a multiplier on DRIFT_SPEED rather than an absolute frequency, so
            // the dash can retune the whole field live.
            drift: {
                mx: gsap.utils.random(0.7, 1.3),
                my: gsap.utils.random(0.7, 1.3),
                px: Math.random() * Math.PI * 2,
                py: Math.random() * Math.PI * 2,
            },
        }
        items.push(item)

        renderItem(item) // place it before the first paint so it never flashes at 0,0

        if (skipEnter) {
            gsap.set(img, { scale: 1, opacity: 1 })
        } else {
            gsap.fromTo(img,
                { scale: 0.72, opacity: 0 },
                { scale: 1, opacity: 1, duration: CONFIG.ENTER_DURATION, ease: 'power2.out' }
            )
        }

        scheduleLifetime(item)
        return item
    }

    function scheduleLifetime(item) {
        if (item.lifeCall) {
            item.lifeCall.kill()
            item.lifeCall = null
        }
        if (!CONFIG.LIFETIME_ENABLED) return

        item.lifeCall = gsap.delayedCall(rand(CONFIG.LIFETIME), () => {
            item.lifeCall = null
            retireItem(item)
        })
    }

    /* ------------------------------------------------------------------
     * SPLIT — lifted from mwg_113: one sphere is replaced by two smaller
     * ones drifting apart. Here it fires on a slow random timer, not on hover.
     * ---------------------------------------------------------------- */
    function splitItem(item) {
        if (item.dead) return

        const { x, y } = item.body.position
        const childVw = Math.max(CONFIG.SIZE[0], item.vwSize * CONFIG.SPLIT_SCALE)
        const spread = item.size * 0.4
        const speed = CONFIG.SPLIT_SPEED

        // Fade the parent out where it stands instead of cutting it — at this
        // pace a hard swap is the one thing that still reads as a jump cut
        retireItem(item)

        // Random axis, otherwise the section slowly organises itself into stripes
        const angle = Math.random() * Math.PI * 2
        const ax = Math.cos(angle)
        const ay = Math.sin(angle)

        spawnItem({
            x: x - ax * spread * 0.5,
            y: y - ay * spread * 0.5,
            sizeVw: childVw,
            velocity: { x: -ax * speed, y: -ay * speed },
        })
        spawnItem({
            x: x + ax * spread * 0.5,
            y: y + ay * spread * 0.5,
            sizeVw: childVw,
            velocity: { x: ax * speed, y: ay * speed },
        })
    }

    function pickSplitCandidate() {
        // Only spheres that still have room to shrink are worth splitting
        const candidates = living().filter(item => item.vwSize > CONFIG.SIZE[0] * 1.05)
        if (!candidates.length) return null
        return candidates[Math.floor(Math.random() * candidates.length)]
    }

    /* ------------------------------------------------------------------
     * REMOVAL
     * ---------------------------------------------------------------- */
    function retireItem(item) {
        if (item.dead) return
        item.dead = true

        if (item.lifeCall) { item.lifeCall.kill(); item.lifeCall = null }

        gsap.killTweensOf(item.img)
        gsap.to(item.img, {
            scale: 0.72,
            opacity: 0,
            duration: CONFIG.EXIT_DURATION,
            ease: 'power2.in',
            onComplete: () => destroyItem(item),
        })
    }

    function destroyItem(item) {
        item.dead = true

        const index = items.indexOf(item)
        if (index !== -1) items.splice(index, 1)

        if (item.lifeCall) { item.lifeCall.kill(); item.lifeCall = null }

        gsap.killTweensOf(item.img)
        if (engine.world.bodies.includes(item.body)) World.remove(engine.world, item.body)
        item.el.remove()
    }

    /* ------------------------------------------------------------------
     * POPULATION — a target that re-rolls on its own timer, walked toward
     * one sphere at a time so the count always changes gradually
     * ---------------------------------------------------------------- */
    function rollTarget() {
        const [min, max] = CONFIG.COUNT
        let next = Math.round(gsap.utils.random(min, max))
        // Re-roll once if we landed on the current target — a change should change something
        if (next === targetCount) next = Math.round(gsap.utils.random(min, max))
        targetCount = next
    }

    function scheduleTarget() {
        if (targetCall) targetCall.kill()
        targetCall = gsap.delayedCall(rand(CONFIG.COUNT_INTERVAL), () => {
            rollTarget()
            scheduleTarget()
        })
    }

    function scheduleAdjust() {
        if (adjustCall) adjustCall.kill()
        adjustCall = gsap.delayedCall(rand(CONFIG.ADJUST_DELAY), () => {
            const alive = living()
            if (alive.length < targetCount) spawnItem()
            else if (alive.length > targetCount) retireItem(alive[0]) // oldest first
            scheduleAdjust()
        })
    }

    function scheduleSplit() {
        if (splitCall) splitCall.kill()
        splitCall = gsap.delayedCall(rand(CONFIG.SPLIT_DELAY), () => {
            if (CONFIG.SPLIT_ENABLED) {
                const candidate = pickSplitCandidate()
                if (candidate) splitItem(candidate)
            }
            scheduleSplit()
        })
    }

    /* ------------------------------------------------------------------
     * FORCES — slow wander, plus an inward nudge that only wakes up near
     * the edges. A global pull to the centre would work too, but it slowly
     * drags the whole composition into one clump in the middle; this leaves
     * the centre alone and only argues with spheres about to park on a wall.
     * ---------------------------------------------------------------- */
    function applyForces() {
        const t = engine.timing.timestamp / 1000
        const { width, height } = getSize()
        const margin = Math.min(width, height) * CONFIG.EDGE_MARGIN

        for (const item of items) {
            const { body, drift, radius } = item

            let fx = Math.cos(t * CONFIG.DRIFT_SPEED * drift.mx + drift.px) * CONFIG.DRIFT
            let fy = Math.sin(t * CONFIG.DRIFT_SPEED * drift.my + drift.py) * CONFIG.DRIFT

            if (margin > 0) {
                const left = body.position.x - radius
                const right = width - (body.position.x + radius)
                const top = body.position.y - radius
                const bottom = height - (body.position.y + radius)

                if (left < margin) fx += (1 - Math.max(left, 0) / margin) * CONFIG.EDGE_PUSH
                if (right < margin) fx -= (1 - Math.max(right, 0) / margin) * CONFIG.EDGE_PUSH
                if (top < margin) fy += (1 - Math.max(top, 0) / margin) * CONFIG.EDGE_PUSH
                if (bottom < margin) fy -= (1 - Math.max(bottom, 0) / margin) * CONFIG.EDGE_PUSH
            }

            Body.applyForce(body, body.position, { x: fx * body.mass, y: fy * body.mass })
        }

        applySeparation()
    }

    // Matter only stops spheres overlapping — it never pushes them apart again.
    // Without this they drift into each other once and stay stuck as a clump.
    function applySeparation() {
        if (CONFIG.SEPARATION <= 0) return

        const gap = vw(CONFIG.SEPARATION_GAP)

        for (let i = 0; i < items.length; i++) {
            const a = items[i]
            for (let j = i + 1; j < items.length; j++) {
                const b = items[j]

                const dx = b.body.position.x - a.body.position.x
                const dy = b.body.position.y - a.body.position.y
                const dist = Math.hypot(dx, dy) || 1
                const reach = a.radius + b.radius + gap
                if (dist >= reach) continue

                const push = (1 - dist / reach) * CONFIG.SEPARATION
                const nx = (dx / dist) * push
                const ny = (dy / dist) * push

                Body.applyForce(a.body, a.body.position, { x: -nx * a.body.mass, y: -ny * a.body.mass })
                Body.applyForce(b.body, b.body.position, { x: nx * b.body.mass, y: ny * b.body.mass })
            }
        }
    }

    Events.on(engine, 'beforeUpdate', applyForces)

    /* ------------------------------------------------------------------
     * RENDER
     * ---------------------------------------------------------------- */
    function renderItem({ el, body, radius }) {
        const rotation = CONFIG.ROTATE ? ` rotate(${body.angle}rad)` : ''
        el.style.transform = `translate(${body.position.x - radius}px, ${body.position.y - radius}px)${rotation}`
    }

    function tick() {
        for (const item of items) renderItem(item)
    }

    gsap.ticker.add(tick)

    /* ------------------------------------------------------------------
     * PUBLIC API — what the dash drives
     * ---------------------------------------------------------------- */
    function fill(instant = false) {
        let guard = 0
        while (living().length < targetCount && guard++ < 200) {
            // The boot fill drops everything in at rest — a random kick on
            // every sphere at once reads as an explosion on frame 1
            spawnItem(instant ? { skipEnter: true, velocity: { x: 0, y: 0 } } : {})
        }
    }

    function clear() {
        items.slice().forEach(destroyItem)
    }

    function reseed() {
        clear()
        rollTarget()
        fill(false)
    }

    function applyConfig() {
        items.forEach(item => {
            if (CONFIG.ROTATE) {
                if (item.body.inertia === Infinity) {
                    Body.setInertia(item.body, item.body.mass * item.radius * item.radius * 0.5)
                }
            } else {
                Body.setInertia(item.body, Infinity)
                Body.setAngularVelocity(item.body, 0)
            }
            item.body.frictionAir = CONFIG.FRICTION_AIR
            item.body.restitution = CONFIG.RESTITUTION
        })

        living().forEach(item => {
            if (CONFIG.LIFETIME_ENABLED && !item.lifeCall) scheduleLifetime(item)
            if (!CONFIG.LIFETIME_ENABLED && item.lifeCall) { item.lifeCall.kill(); item.lifeCall = null }
        })

        targetCount = gsap.utils.clamp(Math.round(CONFIG.COUNT[0]), Math.round(CONFIG.COUNT[1]), targetCount)
    }

    window.consHero = {
        config: CONFIG,
        defaults: DEFAULTS,
        storageKey: STORAGE_KEY,
        icons,
        applyConfig,
        fill,
        clear,
        reseed,
        splitRandom: () => { const c = pickSplitCandidate(); if (c) splitItem(c) },
        get count() { return living().length },
        get target() { return targetCount },
    }

    /* ------------------------------------------------------------------
     * BOOT
     * ---------------------------------------------------------------- */
    rollTarget()
    fill(true)
    scheduleTarget()
    scheduleAdjust()
    scheduleSplit()

    /* ------------------------------------------------------------------
     * RESIZE
     * ---------------------------------------------------------------- */
    let resizeCall = null
    function handleResize() {
        if (resizeCall) resizeCall.kill()
        resizeCall = gsap.delayedCall(0.15, () => {
            createWalls()
            const { width, height } = getSize()
            items.forEach(({ body, radius }) => {
                Body.setPosition(body, {
                    x: gsap.utils.clamp(radius, Math.max(radius, width - radius), body.position.x),
                    y: gsap.utils.clamp(radius, Math.max(radius, height - radius), body.position.y),
                })
            })
        })
    }
    window.addEventListener('resize', handleResize)

    /* ------------------------------------------------------------------
     * KILL
     * ---------------------------------------------------------------- */
    const observer = new MutationObserver(mutations => {
        const isRootRemoved = mutations.some(mutation =>
            mutation.type === 'childList' &&
            Array.from(mutation.removedNodes).includes(root)
        )
        if (!isRootRemoved) return

        if (adjustCall) adjustCall.kill()
        if (targetCall) targetCall.kill()
        if (splitCall) splitCall.kill()
        if (resizeCall) resizeCall.kill()

        window.removeEventListener('resize', handleResize)
        Events.off(engine, 'beforeUpdate', applyForces)
        gsap.ticker.remove(tick)
        Runner.stop(runner)
        clear()
        observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    document.dispatchEvent(new CustomEvent('cons-hero:ready'))
})
