window.addEventListener("DOMContentLoaded", () => {

    const root = document.querySelector('.drugstore_about')
    const mediasContainer = root.querySelector('.medias')
    const medias = root.querySelectorAll('.media')
    // Both headline svgs, desktop and mobile. The stylesheet mounts one and hides the other,
    // fading both is harmless and keeps the reveal indifferent to which one is showing.
    const content = root.querySelectorAll('.about-content, .about-content-mobile')

    const baseAngles = Array.from({ length: medias.length }, (_, i) => (i / medias.length) * Math.PI * 2)

    // Layout switches on this width, in px. Keep it in step with the media query in style.css.
    const MOBILE_BREAKPOINT = 768

    // Two layouts, picked by viewport width and re-picked whenever it crosses the breakpoint.
    //
    // view      the fixed camera, never animated : inputs only change the rotation speed,
    //           never the angles. Distances are in scene units (--u in the stylesheet).
    // ringWidth stretches the ring into an ellipse. 1 is a circle, above 1 lays it down wide,
    //           below 1 stands it up tall. The medias are never scaled by it, so the bubbles
    //           never come out oval. A ring reads as vertical when ringWidth < cos(rotateX).
    // gapUnits  space left between two neighbouring medias. The radius follows from it, so a
    //           wider gap spreads them out instead of packing more in. Negative overlaps them.
    // gapWarp   how much of the ring the far medias get to themselves, to undo the way
    //           perspective packs the back together. 0 seats them evenly, near 1 they cross over.
    const DESKTOP = {
        view: { translateX: -5, translateY: -3, translateZ: -18, rotateX: 55, rotateY: 10, rotateZ: 33 },
        ringWidth: 1.7,
        gapUnits: 1.6,
        gapWarp: 0.15
    }

    // A phone is tall and narrow, so the ring stands up into a vertical arc : ringWidth well
    // under cos(rotateX) squeezes it sideways, and the camera is pushed further back to keep
    // the near media from blowing up. A standing ring hides more of itself behind the front,
    // so the far medias need a bigger share of it than on desktop.
    const MOBILE = {
        view: { translateX: 6, translateY:-25, translateZ: -40, rotateX: 40, rotateY: 8, rotateZ: 8 },
        ringWidth: 0.45,
        gapUnits: 1.5,
        gapWarp: 0.35
    }

    // The medias at the back of the ring, the ones that read as the top row, shrink and fade.
    const DEPTH_SCALE = 0.3 // scales down to 1 - DEPTH_SCALE
    const DEPTH_FADE = 0.6 // fades down to 1 - DEPTH_FADE
    const DEPTH_BLUR = 1.9 // vw of blur at the very back, before DEPTH_FADE scales it down

    const BASE_SPEED = (Math.PI * 2) / 33 // one revolution every 33s

    // How hard an input pushes the ring. SCROLL_SENSITIVITY is rad/s gained per unit of deltaY :
    // one mouse notch is deltaY 100, so 0.002 buys roughly one extra turn's worth of speed.
    // MAX_BOOST caps how fast it can ever get, whatever lands on it.
    const SCROLL_SENSITIVITY = 0.004
    const DRAG_SENSITIVITY = 0.008 // the touch equivalent, rad/s gained per vw dragged
    const MAX_BOOST = BASE_SPEED * 12

    // Short and sharp : the ring answers a scroll at once and drops back quickly, rather than
    // gliding to a stop. Lengthen the duration or soften the ease to make it coast again.
    const BOOST_DECAY = { duration: 0.4, ease: "power3.out" }

    // THE FADE IN. This one object times the opacity 0 -> 1 of everything that appears : the
    // medias and the headline svg both run off it, so changing it here moves them together.
    // The medias cannot be a plain tween, their opacity is this value multiplied by the depth
    // fade down in updateScene, which is why it is driven through reveal.value.
    const REVEAL = { duration: 1, delay: 0.5, ease: "ease.out" }

    // While it fades in the ring is already flying, as if the page had just been scrolled.
    const INTRO_SPIN = MAX_BOOST
    const INTRO_SETTLE = { duration: 1, delay: 0.5, ease: "expo.out" }

    const DEG = Math.PI / 180

    let layout = pickLayout()
    let perimeterPerRadius = ellipsePerimeter(layout.ringWidth)
    let radius

    function pickLayout() {
        return window.innerWidth <= MOBILE_BREAKPOINT ? MOBILE : DESKTOP
    }

    // Ramanujan's approximation, per unit of radius. It keeps the gap honest when ringWidth
    // stretches the ring, since the medias are seated along the perimeter, not around a circle.
    function ellipsePerimeter(width) {
        return Math.PI * (3 * (width + 1) - Math.sqrt((3 * width + 1) * (width + 3)))
    }

    // Everything below is in vw, the same unit the stylesheet works in, so nothing has to be
    // recomputed when the viewport only changes size. The stylesheet owns the scene unit and the
    // perspective is 100 of them, so one scene unit in vw is perspective / innerWidth.
    function getSceneUnit() {
        return parseFloat(getComputedStyle(root).perspective) / window.innerWidth
    }

    function toVw(px) {
        return px * 100 / window.innerWidth
    }

    const offset = { value: 0 }
    const boost = { value: 0 }
    const reveal = { value: 0 }

    // Pushing the ellipse through the plane transform below leaves a plain sinusoid in the ring
    // angle, so the whole depth of the scene collapses to one number : the angle at which a media
    // is closest to the camera. Read off the layout, so it follows any tweak to the camera.
    const front = { phase: 0 }

    function measureDepth() {
        const { rotateX, rotateY, rotateZ } = layout.view
        const x = Math.sin(rotateX * DEG)
        const y = Math.sin(rotateY * DEG) * Math.cos(rotateX * DEG)
        const c = Math.cos(rotateZ * DEG)
        const s = Math.sin(rotateZ * DEG)
        front.phase = Math.atan2(layout.ringWidth * (x * s - y * c), x * c + y * s)
    }

    // The medias plane is tilted once, the medias are counter rotated once :
    // they keep facing the camera while travelling along the ring.
    function renderView() {
        const { translateX, translateY, translateZ, rotateX, rotateY, rotateZ } = layout.view
        const move = distance => `calc(${distance} * var(--u))`
        mediasContainer.style.transform =
            `translate3d(${move(translateX)}, ${move(translateY)}, ${move(translateZ)}) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`
        gsap.set(medias, { rotationX: -rotateX, rotationY: -rotateY, rotation: -rotateZ })
        measureDepth()
    }

    function updateScene() {
        medias.forEach((el, i) => {
            const seat = offset.value + baseAngles[i]
            // Slide each media off its evenly spaced seat, towards the front of the ring : the
            // far ones end up sharing more of the ring, so their gaps stay open under perspective.
            const angle = seat - layout.gapWarp * Math.sin(seat - front.phase)
            const depth = Math.cos(angle - front.phase) // +1 at the front, -1 at the back
            const back = (1 - depth) / 2 // 0 at the front of the ring, 1 at the back
            gsap.set(el, {
                x: `${(Math.sin(angle) * radius * layout.ringWidth).toFixed(3)}vw`,
                y: `${(Math.cos(angle) * radius).toFixed(3)}vw`,
                scale: 1 - DEPTH_SCALE * back,
                opacity: reveal.value * (1 - (DEPTH_FADE / 2) * back),
                filter: `blur(${(reveal.value * DEPTH_FADE * back * DEPTH_BLUR).toFixed(3)}vw)`
            })
        })
    }

    function accelerate(amount) {
        boost.value = gsap.utils.clamp(-MAX_BOOST, MAX_BOOST, boost.value + amount)
        gsap.to(boost, { value: 0, overwrite: true, ...BOOST_DECAY })
    }

    // Both axes drive the ring, on every device. Up and left push it forward, down and right
    // pull it back, and a diagonal gesture simply contributes both of its components.
    function handleWheel(e) {
        accelerate((e.deltaY + e.deltaX) * SCROLL_SENSITIVITY)
    }

    let lastTouch = null

    function handleTouchStart(e) {
        const touch = e.touches?.[0]
        lastTouch = touch ? { x: touch.clientX, y: touch.clientY } : null
    }

    function handleTouchMove(e) {
        const touch = e.touches?.[0]
        if (!touch) return
        if (lastTouch) {
            const travelled = (lastTouch.y - touch.clientY) + (lastTouch.x - touch.clientX)
            accelerate(toVw(travelled) * DRAG_SENSITIVITY)
        }
        lastTouch = { x: touch.clientX, y: touch.clientY }
    }

    function handleTouchEnd() {
        lastTouch = null
    }

    function tick(time, deltaTime) {
        const delta = Math.min(deltaTime, 50) / 1000 // clamp the tab switch catch up
        offset.value += (BASE_SPEED + boost.value) * delta
        updateScene()
    }

    // The ring is exactly long enough to seat every media plus its gap. Crossing the breakpoint
    // swaps the whole layout, so the camera has to be rewritten before the radius is measured.
    function handleResize() {
        const next = pickLayout()
        if (next !== layout) {
            layout = next
            perimeterPerRadius = ellipsePerimeter(layout.ringWidth)
            renderView()
        }
        const mediaSize = toVw(parseFloat(getComputedStyle(medias[0]).width))
        radius = medias.length * (mediaSize + layout.gapUnits * getSceneUnit()) / perimeterPerRadius
        updateScene()
    }

    renderView()
    handleResize()

    // Play the intro once the medias are decoded, never let a stalled image hide the section.
    // The spin borrows the scroll's own boost, so the ring settles exactly the way it does
    // after a flick of the wheel.
    function startIntro() {
        gsap.to(reveal, { value: 1, overwrite: true, ...REVEAL }) // the medias, via updateScene
        if (content.length) gsap.to(content, { opacity: 1, overwrite: true, ...REVEAL }) // the svgs
        boost.value = INTRO_SPIN
        gsap.to(boost, { value: 0, overwrite: true, ...INTRO_SETTLE })
    }

    const introFallback = gsap.delayedCall(3, startIntro)
    Promise.all(Array.from(medias, el => el.decode().catch(() => {})))
        .then(() => { introFallback.kill(); startIntro() })

    gsap.ticker.add(tick)
    window.addEventListener("resize", handleResize)
    root.addEventListener("wheel", handleWheel, { passive: true })
    root.addEventListener("touchstart", handleTouchStart, { passive: true })
    root.addEventListener("touchmove", handleTouchMove, { passive: true })
    root.addEventListener("touchend", handleTouchEnd, { passive: true })

    const observer = new MutationObserver(mutations => {
        const isRootRemoved = mutations.some(mutation =>
            mutation.type === "childList" &&
            Array.from(mutation.removedNodes).includes(root)
        )
        if (!isRootRemoved) return
        gsap.ticker.remove(tick)
        gsap.killTweensOf([boost, reveal, content])
        introFallback.kill()
        window.removeEventListener("resize", handleResize)
        root.removeEventListener("wheel", handleWheel)
        root.removeEventListener("touchstart", handleTouchStart)
        root.removeEventListener("touchmove", handleTouchMove)
        root.removeEventListener("touchend", handleTouchEnd)
        observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
})
