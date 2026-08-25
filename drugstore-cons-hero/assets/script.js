window.addEventListener('DOMContentLoaded', async () => {

    /* ------------------------------------------------------------------
     * A port of mwg_113 into this section: same mechanic, same numbers.
     * Spheres float in zero gravity; moving the cursor over one replaces it
     * with two smaller ones flying apart; anything past MAX_ITEMS ages out.
     *
     * Two deliberate differences from the original, both because our art is
     * different — see NOTES at the bottom of this file.
     * ---------------------------------------------------------------- */
    const CONFIG = {
        // population
        MAX_ITEMS: 5,               // reference: 5 on desktop, 4 on mobile
        MAX_ITEMS_MOBILE: 4,
        OVERFLOW_DELAY: 1,          // grace period before an over-the-cap sphere leaves, s

        // size — every sphere picks a random diameter in this range
        SIZE: [8, 15],              // reference was a fixed 12vw
        SIZE_MOBILE: [18, 30],

        // interaction — the reference's own trigger: the cursor splits whatever
        // sphere it touches (a tap, on touch devices)
        HOVER_SPLIT: true,

        // auto split — a random sphere bursts on a timer, on top of the
        // reference's cursor interaction
        AUTO_SPLIT: true,
        AUTO_SPLIT_DELAY: 1,        // s

        // physics — straight from the reference body options
        FRICTION_AIR: 0.06,
        RESTITUTION: 0.35,
        FRICTION: 0.2,
        DENSITY: 0.002,

        // motion
        SPAWN_SPEED: [1.5, 2.7],    // reference: 1.5 + Math.random() * 1.2
        SPLIT_SPEED: 1,
        ROTATE: true,               // reference tilts and spins every sphere

        // levitation — a slow wander so spheres never fully settle.
        // Matter multiplies an applied force by delta² (~278) before it
        // reaches velocity, which is why these numbers look so small.
        DRIFT: 0.0001,              // strength
        DRIFT_SPEED: 0.25,          // how fast it cycles, rad/s — lower = wider

        // transitions
        ENTER_DURATION: 0.25,
        EXIT_DURATION: 0.2,
    }

    const DEFAULTS = JSON.parse(JSON.stringify(CONFIG))

    // Versioned: a saved config silently overrides every key it still shares
    // with the current one. Bump when the defaults must win.
    const STORAGE_KEY = 'cons-hero:config:v4'
    const STALE_KEYS = ['cons-hero:config', 'cons-hero:config:v2', 'cons-hero:config:v3']

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
     *   3. the <img> tags already in the markup  ← what the reference does
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
                const list = await strategy()
                console.info(`[cons-hero] ${list.length} icons via ${label}`)
                return list
            } catch {
                /* try the next one */
            }
        }
        const list = iconsFromMarkup()
        console.info(`[cons-hero] ${list.length} icons via markup`)
        return list
    }

    const icons = await loadIcons()

    /* ------------------------------------------------------------------
     * SETUP
     * ---------------------------------------------------------------- */
    let isTouch = false
    let isMobile = false
    gsap.matchMedia().add('(hover: none)', () => { isTouch = true })
    gsap.matchMedia().add('(max-width: 768px)', () => { isMobile = true })

    const { Engine, World, Bodies, Body, Runner, Events } = Matter
    const engine = Engine.create({ gravity: { x: 0, y: 0 } })
    const runner = Runner.create()
    Runner.run(runner, engine)

    const items = []
    let incr = 0
    let locked = false
    let autoSplitCall = null

    const vw = (value) => (window.innerWidth * value) / 100
    const maxItems = () => (isMobile ? CONFIG.MAX_ITEMS_MOBILE : CONFIG.MAX_ITEMS)
    const sizeRange = () => (isMobile ? CONFIG.SIZE_MOBILE : CONFIG.SIZE)
    const randSize = () => gsap.utils.random(sizeRange()[0], sizeRange()[1])

    function getSize() {
        const rect = root.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
    }

    /* ------------------------------------------------------------------
     * WALLS
     * ---------------------------------------------------------------- */
    const WALL_THICKNESS = 200 // 200 for security
    let walls = []

    function createWalls() {
        if (walls.length) World.remove(engine.world, walls)

        const { width, height } = getSize()
        const t = WALL_THICKNESS
        const opts = { isStatic: true, restitution: 0.2, friction: 0.3 }

        walls = [
            Bodies.rectangle(width / 2, -t / 2, width + t * 2, t, opts),
            Bodies.rectangle(width / 2, height + t / 2, width + t * 2, t, opts),
            Bodies.rectangle(-t / 2, height / 2, t, height + t * 2, opts),
            Bodies.rectangle(width + t / 2, height / 2, t, height + t * 2, opts),
        ]
        World.add(engine.world, walls)
    }

    createWalls()

    /* ------------------------------------------------------------------
     * HIT TESTING
     * ---------------------------------------------------------------- */
    function getItemUnderMouse(mx, my) {
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i]
            if (item.dead) continue
            const { body, radius } = item
            if (Math.hypot(mx - body.position.x, my - body.position.y) <= radius) return item
        }
        return null
    }

    /* ------------------------------------------------------------------
     * SPAWN
     * ---------------------------------------------------------------- */
    function spawnImage(x, y, { velocity = null, angle = null, angularVelocity = null, sizeVw = null } = {}) {
        if (!icons.length) return null

        const finalVw = sizeVw ?? randSize()
        const size = vw(finalVw)
        const radius = size / 2

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

        const { width, height } = getSize()
        const pad = radius + 4
        const px = gsap.utils.clamp(pad, Math.max(pad, width - pad), x)
        const py = gsap.utils.clamp(pad, Math.max(pad, height - pad), y)

        const body = Bodies.circle(px, py, radius, {
            frictionAir: CONFIG.FRICTION_AIR,
            restitution: CONFIG.RESTITUTION,
            friction: CONFIG.FRICTION,
            density: CONFIG.DENSITY,
            angle: angle ?? (Math.random() - 0.5) * 0.4,
        })
        if (!CONFIG.ROTATE) Body.setInertia(body, Infinity)

        World.add(engine.world, body)

        if (velocity) {
            Body.setVelocity(body, velocity)
        } else {
            Body.setVelocity(body, {
                x: (Math.random() - 0.5) * 0.4,
                y: (Math.random() - 0.5) * 0.4,
            })
        }

        if (angularVelocity != null && CONFIG.ROTATE) Body.setAngularVelocity(body, angularVelocity)

        const item = {
            el, img, body, radius, size,
            vwSize: finalVw,
            dead: false,
            expiryCall: null,
            // Its own pair of oscillators, so no two spheres wander alike.
            // The rate is a multiplier on DRIFT_SPEED, not an absolute
            // frequency, so the dash can retune the whole field live.
            drift: {
                mx: gsap.utils.random(0.7, 1.3),
                my: gsap.utils.random(0.7, 1.3),
                px: Math.random() * Math.PI * 2,
                py: Math.random() * Math.PI * 2,
            },
        }
        items.push(item)

        renderItem(item) // place it before the first paint so it never flashes at 0,0
        checkOverflow()

        gsap.from(img, {
            scale: 0.6,
            duration: CONFIG.ENTER_DURATION,
            ease: 'back.out(2.5)',
        })

        return item
    }

    /* ------------------------------------------------------------------
     * OVERFLOW — anything older than the last MAX_ITEMS is scheduled out
     * ---------------------------------------------------------------- */
    function checkOverflow() {
        const cap = maxItems()
        items.forEach((item, i) => {
            const excess = i < items.length - cap

            if (excess && !item.expiryCall) {
                item.expiryCall = gsap.delayedCall(CONFIG.OVERFLOW_DELAY, () => {
                    item.expiryCall = null
                    if (!item.dead) removeItem(item, { delayedExit: true })
                })
            } else if (!excess && item.expiryCall) {
                item.expiryCall.kill()
                item.expiryCall = null
            }
        })
    }

    /* ------------------------------------------------------------------
     * SPLIT
     * ---------------------------------------------------------------- */
    function splitItem(item) {
        if (item.dead) return
        item.dead = true

        const { x, y } = item.body.position
        const spread = item.size * 0.35
        const speed = CONFIG.SPLIT_SPEED

        removeItem(item)

        const opts = {
            angle: (Math.random() - 0.5) * 0.4,
            angularVelocity: (Math.random() - 0.5) * 0.04,
        }

        if (isMobile) {
            spawnImage(x, y - spread * 0.5, { ...opts, velocity: { x: 0, y: -speed } })
            spawnImage(x, y + spread * 0.5, { ...opts, velocity: { x: 0, y: speed } })
        } else {
            spawnImage(x - spread * 0.5, y, { ...opts, velocity: { x: -speed, y: 0 } })
            spawnImage(x + spread * 0.5, y, { ...opts, velocity: { x: speed, y: 0 } })
        }
    }

    /* ------------------------------------------------------------------
     * REMOVAL
     * ---------------------------------------------------------------- */
    function removeItem(item, { delayedExit = false } = {}) {
        const index = items.indexOf(item)
        if (index === -1) return

        item.dead = true
        items.splice(index, 1)

        if (item.expiryCall) {
            item.expiryCall.kill()
            item.expiryCall = null
        }

        item.el.style.pointerEvents = 'none'

        if (engine.world.bodies.includes(item.body)) World.remove(engine.world, item.body)

        gsap.killTweensOf([item.el, item.img])

        if (delayedExit) {
            gsap.to(item.img, {
                scale: 0.9,
                duration: CONFIG.EXIT_DURATION,
                ease: 'back.in(2)',
                onComplete: () => item.el.remove(),
            })
        } else {
            item.el.remove()
        }

        checkOverflow()
    }

    /* ------------------------------------------------------------------
     * POINTER
     * ---------------------------------------------------------------- */
    function getPointerPos(e) {
        const rect = root.getBoundingClientRect()
        const clientX = e.touches?.[0]?.clientX ?? e.clientX
        const clientY = e.touches?.[0]?.clientY ?? e.clientY
        return { mx: clientX - rect.left, my: clientY - rect.top }
    }

    function handleMouseMove(e) {
        if (!CONFIG.HOVER_SPLIT) {
            locked = false
            return
        }

        const { mx, my } = getPointerPos(e)
        const hit = getItemUnderMouse(mx, my)

        // After a split, wait until the cursor leaves every image
        if (locked) {
            if (!hit) locked = false
            return
        }

        if (hit) {
            splitItem(hit)
            locked = true
        }
    }

    function handleTap(e) {
        if (!CONFIG.HOVER_SPLIT) return

        const { mx, my } = getPointerPos(e)
        const hit = getItemUnderMouse(mx, my)
        if (hit) splitItem(hit)
    }

    /* ------------------------------------------------------------------
     * LEVITATION — a slow wander applied every physics step, so spheres
     * keep breathing instead of coming to rest against the air friction
     * ---------------------------------------------------------------- */
    function applyDrift() {
        if (CONFIG.DRIFT <= 0) return

        const t = engine.timing.timestamp / 1000

        for (const { body, drift } of items) {
            const fx = Math.cos(t * CONFIG.DRIFT_SPEED * drift.mx + drift.px) * CONFIG.DRIFT
            const fy = Math.sin(t * CONFIG.DRIFT_SPEED * drift.my + drift.py) * CONFIG.DRIFT
            Body.applyForce(body, body.position, { x: fx * body.mass, y: fy * body.mass })
        }
    }

    Events.on(engine, 'beforeUpdate', applyDrift)

    /* ------------------------------------------------------------------
     * AUTO SPLIT — a random sphere bursts on a timer. The reference only
     * ever split on hover; this runs alongside it.
     * ---------------------------------------------------------------- */
    function splitRandom() {
        const alive = items.filter(item => !item.dead)
        if (!alive.length) return
        splitItem(alive[Math.floor(Math.random() * alive.length)])
    }

    function scheduleAutoSplit() {
        if (autoSplitCall) autoSplitCall.kill()
        autoSplitCall = gsap.delayedCall(Math.max(CONFIG.AUTO_SPLIT_DELAY, 0.05), () => {
            if (CONFIG.AUTO_SPLIT) splitRandom()
            scheduleAutoSplit()
        })
    }

    /* ------------------------------------------------------------------
     * RENDER
     * ---------------------------------------------------------------- */
    function renderItem({ el, body, radius }) {
        el.style.transform =
            `translate(${body.position.x - radius}px, ${body.position.y - radius}px) rotate(${body.angle}rad)`
    }

    function tick() {
        for (const item of items) renderItem(item)
    }

    gsap.ticker.add(tick)

    /* ------------------------------------------------------------------
     * PUBLIC API — what the dash drives
     * ---------------------------------------------------------------- */
    function spawnInitial() {
        const { width, height } = getSize()

        for (let i = 0; i < maxItems(); i++) {
            const x = width * (0.15 + Math.random() * 0.7)
            const y = height * (0.15 + Math.random() * 0.7)
            const angle = Math.random() * Math.PI * 2
            const speed = gsap.utils.random(CONFIG.SPAWN_SPEED[0], CONFIG.SPAWN_SPEED[1])

            spawnImage(x, y, {
                velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
                angle: (Math.random() - 0.5) * 0.4,
                angularVelocity: (Math.random() - 0.5) * 0.04,
            })
        }
    }

    function clear() {
        items.slice().forEach(item => removeItem(item))
    }

    function reseed() {
        clear()
        spawnInitial()
    }

    function applyConfig() {
        items.forEach(item => {
            item.body.frictionAir = CONFIG.FRICTION_AIR
            item.body.restitution = CONFIG.RESTITUTION
            item.body.friction = CONFIG.FRICTION

            if (CONFIG.ROTATE) {
                if (item.body.inertia === Infinity) {
                    Body.setInertia(item.body, item.body.mass * item.radius * item.radius * 0.5)
                }
            } else {
                Body.setInertia(item.body, Infinity)
                Body.setAngularVelocity(item.body, 0)
            }
        })
        checkOverflow()
    }

    window.consHero = {
        config: CONFIG,
        defaults: DEFAULTS,
        storageKey: STORAGE_KEY,
        icons,
        applyConfig,
        clear,
        reseed,
        splitRandom,
        get count() { return items.filter(item => !item.dead).length },
        get target() { return maxItems() },
    }

    /* ------------------------------------------------------------------
     * BOOT
     * ---------------------------------------------------------------- */
    spawnInitial()
    scheduleAutoSplit()

    if (isTouch) {
        root.addEventListener('click', handleTap)
    } else {
        root.addEventListener('mousemove', handleMouseMove)
    }

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

        items.forEach(item => { if (item.expiryCall) item.expiryCall.kill() })
        if (autoSplitCall) autoSplitCall.kill()
        if (resizeCall) resizeCall.kill()

        if (isTouch) root.removeEventListener('click', handleTap)
        else root.removeEventListener('mousemove', handleMouseMove)

        window.removeEventListener('resize', handleResize)
        Events.off(engine, 'beforeUpdate', applyDrift)
        gsap.ticker.remove(tick)
        Runner.stop(runner)
        items.slice().forEach(item => removeItem(item))
        observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    document.dispatchEvent(new CustomEvent('cons-hero:ready'))

    /* ------------------------------------------------------------------
     * NOTES — where this departs from mwg_113, and why
     *
     * 1. Circle bodies instead of Bodies.rectangle, and a radius hit test
     *    instead of an AABB one. The reference's medias are rectangular
     *    photos; ours are round spheres on transparent PNGs, so a box body
     *    leaves a visible gap between two touching spheres and makes the
     *    cursor trigger a split before it reaches the artwork.
     *
     * 2. Icons are discovered rather than read only from the markup, and the
     *    dash exposes the reference's constants. Neither changes behaviour.
     * ---------------------------------------------------------------- */
})
