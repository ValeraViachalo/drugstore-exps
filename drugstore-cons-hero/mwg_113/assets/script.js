window.addEventListener("DOMContentLoaded", () => {
    
    const root = document.querySelector('.mwg_effect113')
    const mediasUrl = [...root.querySelectorAll('.medias img')].map(el => el.getAttribute('src'))

    let isTouch = false
    let isMobile = false
    gsap.matchMedia().add('(hover: none)', () => { isTouch = true })
    gsap.matchMedia().add('(max-width: 768px)', () => { isMobile = true })

    const { Engine, World, Bodies, Runner, Body } = Matter
    const engine = Engine.create({ gravity: { x: 0, y: 0 } })
    const runner = Runner.create()
    Runner.run(runner, engine)

    const mediaItems = []
    let incr = 0
    const MAX_ITEMS = isMobile ? 4 : 5;
    const OVERFLOW_DELAY = 1
    const wallThickness = 200 // 200 for security
    let walls = []
    let locked = false

    function getSize() {
        const rect = root.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
    }

    function createWalls() {
        if (walls.length) World.remove(engine.world, walls)

        const { width, height } = getSize()
        const t = wallThickness
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

    function getItemUnderMouse(mx, my) {
        for (let i = mediaItems.length - 1; i >= 0; i--) {
            const item = mediaItems[i]
            if (item.dead) continue
            const { body, w, h } = item
            if (
                mx >= body.position.x - w / 2 &&
                mx <= body.position.x + w / 2 &&
                my >= body.position.y - h / 2 &&
                my <= body.position.y + h / 2
            ) {
                return item
            }
        }
        return null
    }

    function spawnImage(x, y, { velocity = null, angle = null, angularVelocity = null } = {}) {
        const media = document.createElement('div')
        media.className = 'media'
        const img = document.createElement('img')
        img.src = mediasUrl[incr % mediasUrl.length]
        media.appendChild(img)
        root.appendChild(media)
        incr++

        const addToWorld = () => {
            if (img.naturalWidth > img.naturalHeight) img.classList.add('landscape')

            const w = media.clientWidth
            const h = media.clientHeight
            const { width, height } = getSize()
            const padX = w / 2 + 4
            const padY = h / 2 + 4
            const px = gsap.utils.clamp(padX, width - padX, x)
            const py = gsap.utils.clamp(padY, height - padY, y)

            const body = Bodies.rectangle(px, py, w, h, {
                frictionAir: 0.06,
                restitution: 0.35,
                friction: 0.2,
                density: 0.002,
                angle: angle ?? (Math.random() - 0.5) * 0.4,
            })
            World.add(engine.world, body)

            if (velocity) {
                Body.setVelocity(body, velocity)
            } else {
                Body.setVelocity(body, {
                    x: (Math.random() - 0.5) * 0.4,
                    y: (Math.random() - 0.5) * 0.4,
                })
            }

            if (angularVelocity != null) {
                Body.setAngularVelocity(body, angularVelocity)
            }

            const item = { el: media, body, w, h, dead: false }
            mediaItems.push(item)
            checkOverflow()

            gsap.from(img, {
                scale: 0.6,
                duration: 0.25,
                ease: 'back.out(2.5)',
            })
        }

        if (img.complete && img.naturalWidth) {
            addToWorld()
        } else {
            img.addEventListener('load', addToWorld, { once: true })
        }
    }

    function checkOverflow() {
        mediaItems.forEach((item, i) => {
            const excess = i < mediaItems.length - MAX_ITEMS

            if (excess && !item.expiryCall) {
                item.expiryCall = gsap.delayedCall(OVERFLOW_DELAY, () => {
                    item.expiryCall = null
                    if (!item.dead) removeItem(item, { delayedExit: true })
                })
            } else if (!excess && item.expiryCall) {
                item.expiryCall.kill()
                item.expiryCall = null
            }
        })
    }

    function splitItem(item) {
        if (item.dead) return
        item.dead = true

        const { x, y } = item.body.position
        const spread = Math.max(item.w, item.h) * 0.35
        const speed = 1

        removeItem(item)

        const opts = {
            angle: (Math.random() - 0.5) * 0.4,
            angularVelocity: (Math.random() - 0.5) * 0.04,
        }

        if (isMobile) {
            spawnImage(x, y - spread * 0.5, {
                ...opts,
                velocity: { x: 0, y: -speed },
            })
            spawnImage(x, y + spread * 0.5, {
                ...opts,
                velocity: { x: 0, y: speed },
            })
        } else {
            spawnImage(x - spread * 0.5, y, {
                ...opts,
                velocity: { x: -speed, y: 0 },
            })
            spawnImage(x + spread * 0.5, y, {
                ...opts,
                velocity: { x: speed, y: 0 },
            })
        }
    }

    function removeItem(item, { delayedExit = false } = {}) {
        const index = mediaItems.indexOf(item)
        if (index === -1) return

        item.dead = true
        mediaItems.splice(index, 1)

        if (item.expiryCall) {
            item.expiryCall.kill()
            item.expiryCall = null
        }

        item.el.style.pointerEvents = 'none'

        if (engine.world.bodies.includes(item.body)) {
            World.remove(engine.world, item.body)
        }

        const img = item.el.querySelector('img')
        gsap.killTweensOf([item.el, img])

        if (delayedExit) {
            gsap.to(img, {
                scale: 0.9,
                duration: 0.2,
                ease: 'back.in(2)',
                onComplete: () => {
                    item.el.remove()
                },
            })
        } else {
            item.el.remove()
        }

        checkOverflow()
    }

    function getPointerPos(e) {
        const rect = root.getBoundingClientRect()
        const clientX = e.touches?.[0]?.clientX ?? e.clientX
        const clientY = e.touches?.[0]?.clientY ?? e.clientY
        return {
            mx: clientX - rect.left,
            my: clientY - rect.top,
        }
    }

    function handleMouseMove(e) {
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
        const { mx, my } = getPointerPos(e)
        const hit = getItemUnderMouse(mx, my)
        if (hit) splitItem(hit)
    }

    function spawnInitial() {
        const { width, height } = getSize()
        const count = MAX_ITEMS;

        for (let i = 0; i < count; i++) {
            const x = width * (0.15 + Math.random() * 0.7)
            const y = height * (0.15 + Math.random() * 0.7)
            const angle = Math.random() * Math.PI * 2
            const speed = 1.5 + Math.random() * 1.2

            spawnImage(x, y, {
                velocity: {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed,
                },
                angle: (Math.random() - 0.5) * 0.4,
                angularVelocity: (Math.random() - 0.5) * 0.04,
            })
        }
    }

    spawnInitial()

    if (isTouch) {
        root.addEventListener('click', handleTap)
    } else {
        root.addEventListener('mousemove', handleMouseMove)
    }

    function tick() {
        mediaItems.forEach(({ el, body, w, h }) => {
            el.style.transform = `translate(${body.position.x - w / 2}px, ${body.position.y - h / 2}px) rotate(${body.angle}rad)`
        })
    }

    gsap.ticker.add(tick)

    // KILL
    const observer = new MutationObserver(mutations => {
        const isRootRemoved = mutations.some(mutation =>
            mutation.type === 'childList' &&
            Array.from(mutation.removedNodes).includes(root)
        )

        if (isRootRemoved) {
            mediaItems.forEach(item => {
                if (item.expiryCall) item.expiryCall.kill()
            })
            if (isTouch) {
                root.removeEventListener('click', handleTap)
            } else {
                root.removeEventListener('mousemove', handleMouseMove)
            }
            
            gsap.ticker.remove(tick)
            Runner.stop(runner)
            mediaItems.slice().forEach(removeItem)
            observer.disconnect()
        }
    })
    observer.observe(document.body, { childList: true, subtree: true })
})