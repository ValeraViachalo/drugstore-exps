window.addEventListener("DOMContentLoaded", () => {

    const root = document.querySelector('.drugstore_about')
    // The 500vh track is the root, the sticky screen inside it is the scene : the camera,
    // the scene unit and the perspective all live on that one, so it is what gets measured.
    const scene = root.querySelector('.sticky')
    const mediasContainer = root.querySelector('.medias')
    const medias = root.querySelectorAll('.media')
    // The headline block, logo and copy together. It fades in once and stays for the
    // whole section, so it is the only thing on the page that is not scroll driven.
    const content = root.querySelectorAll('.about-content')
    // The disclaimer at the foot of the screen, the one thing here that is only on for the
    // arrival. Its opacity is written by hand every frame, so nothing tweens it but us.
    const note = root.querySelector('.about-note')

    const baseAngles = Array.from({ length: medias.length }, (_, i) => (i / medias.length) * Math.PI * 2)

    // Layout switches on this width, in px. Keep it in step with the media query in scroll.css.
    const MOBILE_BREAKPOINT = 768

    // Two layouts, picked by viewport width and re-picked whenever it crosses the breakpoint.
    //
    // view        the fixed camera, never animated : inputs only change the rotation speed,
    //             never the angles. Distances are in scene units (--u in the stylesheet).
    // ringWidth   stretches the ring into an ellipse. 1 is a circle, above 1 lays it down wide,
    //             below 1 stands it up tall. The medias are never scaled by it, so the bubbles
    //             never come out oval. A ring reads as vertical when ringWidth < cos(rotateX).
    // gapUnits    space left between two neighbouring medias. The radius follows from it, so a
    //             wider gap spreads them out instead of packing more in. Negative overlaps them.
    // gapWarp     how much of the ring the far medias get to themselves, to undo the way
    //             perspective packs the back together. 0 seats them evenly, near 1 they cross over.
    // mediaSize   the diameter of one media, in scene units.
    // perspective how far the camera sits from the plane, in scene units. Lower exaggerates the
    //             depth, higher flattens the ring out.
    //
    // The last two also live in the stylesheet, which is the no-JS fallback : once this script
    // runs, renderView writes them onto the scene and these values are the ones in force.
    const DESKTOP = {
        view: { translateX: -5, translateY: -3, translateZ: -18, rotateX: 55, rotateY: 10, rotateZ: 33 },
        ringWidth: 1.35,
        gapUnits: 1.6,
        gapWarp: 0.15,
        mediaSize: 16,
        perspective: 100
    }

    // A phone is tall and narrow, so the ring stands up into a vertical arc : ringWidth well
    // under cos(rotateX) squeezes it sideways, and the camera is pushed further back to keep
    // the near media from blowing up. A standing ring hides more of itself behind the front,
    // so the far medias need a bigger share of it than on desktop.
    const MOBILE = {
        view: { translateX: 6, translateY:-25, translateZ: -40, rotateX: 40, rotateY: 8, rotateZ: 8 },
        ringWidth: 0.45,
        gapUnits: 1.5,
        gapWarp: 0.35,
        mediaSize: 34,
        perspective: 100
    }

    // Everything that is not per layout, in one object rather than as loose constants : the
    // config panel writes straight into it, and every reader below picks the value up fresh,
    // so an edit lands on the very next frame without anything having to be rebuilt.
    const TUNE = {
        // The medias at the back of the ring, the ones that read as the top row, shrink and fade.
        depthScale: 0.3, // scales down to 1 - depthScale
        depthFade: 0.6, // fades down to 1 - depthFade
        depthBlur: 1.9, // vw of blur at the very back, before depthFade scales it down

        revolutionSeconds: 33, // how long the idle drift takes to carry the ring round once

        // How hard the scroll pushes the ring. scrollSensitivity is rad/s gained per pixel
        // scrolled, so one mouse notch (100px) buys roughly one extra turn's worth of speed.
        // maxBoostFactor caps how fast it can ever get, in multiples of the idle speed.
        scrollSensitivity: 0.004,
        maxBoostFactor: 12,

        // Short and sharp : the ring answers a scroll at once and drops back quickly, rather
        // than gliding to a stop. Lengthen it to let the ring coast again.
        boostDecay: 0.4,

        // Which way the ring drifts when nothing is pushing it. It follows the scroll instead
        // of being pinned forward : scrolling back up turns the whole ring around, and it keeps
        // running that way once the scroll stops. driftTurn is how long that swing takes;
        // turnThreshold is the scroll the other way it takes to count, so trackpad jitter
        // cannot flip the ring mid-glide.
        driftTurn: 0.7,
        turnThreshold: 2, // px

        // THE SCROLL REVEAL. The ring is empty when the section arrives and fills up in groups,
        // one every so often across the whole 500vh. Each group is spread evenly around the ring
        // — i % revealGroups puts medias 0,4,8,12 in the first, 1,5,9,13 in the second, and so
        // on — so a group never lights up as a run of neighbours, it lights up all round at once.
        // With 14 medias and 4 groups that is 4,4,3,3 medias a step.
        revealGroups: 4,
        revealFrom: 0.08, // scroll progress at which the first group starts to arrive
        revealTo: 0.92, // progress by which the last group has fully arrived
        revealSpan: 0.14, // how much progress a single group takes to fade in

        // THE DISCLAIMER. It rides in on the same clock as the headline, holds at noteOpacity,
        // and is gone again over the first noteFade of the scroll — it belongs to the very top
        // of the section, so it clears out before the ring has anything to show.
        noteOpacity: 0.4,
        noteFade: 0.06
    }

    // Shapes of the two decays above. Only their durations are worth tuning live.
    const BOOST_EASE = "power3.out"
    const DRIFT_EASE = "power2.inOut"

    // THE HEADLINE FADE IN. The logo and copy are the only things that arrive on their own
    // clock : everything else waits for the scroll.
    const REVEAL = { duration: 1, delay: 0.5, ease: "power2.out" }

    const DEG = Math.PI / 180

    const baseSpeed = () => (Math.PI * 2) / TUNE.revolutionSeconds
    const maxBoost = () => baseSpeed() * TUNE.maxBoostFactor

    // Where each media's own fade begins, in scroll progress. The last group has to finish by
    // revealTo, so it is the group *starts* that are spread over the shortened run.
    const groupStep = () => (TUNE.revealTo - TUNE.revealFrom - TUNE.revealSpan) / Math.max(1, TUNE.revealGroups - 1)

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
    // recomputed when the viewport only changes size. The scene unit is read back off the
    // perspective, which is layout.perspective of them, so one scene unit in vw is
    // perspective / innerWidth however the perspective was written.
    function getSceneUnit() {
        return parseFloat(getComputedStyle(scene).perspective) / (window.innerWidth * layout.perspective) * 100
    }

    function toVw(px) {
        return px * 100 / window.innerWidth
    }

    const clamp01 = gsap.utils.clamp(0, 1)

    // Smoothstep, so a group eases into place instead of popping on at full opacity.
    function smoothstep(t) {
        return t * t * (3 - 2 * t)
    }

    const offset = { value: 0 }
    const boost = { value: 0 }
    // +1 forward, -1 backward, and everything between while it is turning over.
    const drift = { value: 1 }
    let driftTarget = 1
    // The disclaimer's load fade, 0 -> 1. The scroll fade is multiplied on top of it, which is
    // why it cannot simply be a tween on the element's own opacity.
    const noteReveal = { value: 0 }

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

    // The scroll track, measured once and re-measured on resize so the tick never has to ask
    // the layout anything. The scene is sticky for exactly this much of the page.
    let trackTop = 0
    let trackLength = 1

    function measureTrack() {
        trackTop = root.getBoundingClientRect().top + window.scrollY
        trackLength = Math.max(1, root.offsetHeight - window.innerHeight)
    }

    // 0 when the section's top hits the viewport top, 1 when its bottom does : the whole
    // stretch the sticky scene is held for, which is what the reveal is spread across.
    function scrollProgress() {
        return clamp01((window.scrollY - trackTop) / trackLength)
    }

    let progress = 0

    // The medias plane is tilted once, the medias are counter rotated once :
    // they keep facing the camera while travelling along the ring.
    function renderView() {
        const { translateX, translateY, translateZ, rotateX, rotateY, rotateZ } = layout.view
        const move = distance => `calc(${distance} * var(--u))`
        // The two scene values the stylesheet cannot pick per layout. Written every time, so a
        // config edit to either one lands here and the radius below is measured against it.
        scene.style.perspective = `calc(${layout.perspective} * var(--u))`
        scene.style.setProperty('--media-size', `calc(${layout.mediaSize} * var(--u))`)
        mediasContainer.style.transform =
            `translate3d(${move(translateX)}, ${move(translateY)}, ${move(translateZ)}) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`
        gsap.set(medias, { rotationX: -rotateX, rotationY: -rotateY, rotation: -rotateZ })
        measureDepth()
    }

    function updateScene() {
        if (note) {
            note.style.opacity = TUNE.noteOpacity * noteReveal.value * (1 - clamp01(progress / TUNE.noteFade))
        }
        const groups = Math.max(1, Math.round(TUNE.revealGroups))
        const step = groupStep()
        medias.forEach((el, i) => {
            const seat = offset.value + baseAngles[i]
            // Slide each media off its evenly spaced seat, towards the front of the ring : the
            // far ones end up sharing more of the ring, so their gaps stay open under perspective.
            const angle = seat - layout.gapWarp * Math.sin(seat - front.phase)
            const depth = Math.cos(angle - front.phase) // +1 at the front, -1 at the back
            const back = (1 - depth) / 2 // 0 at the front of the ring, 1 at the back
            const start = TUNE.revealFrom + (i % groups) * step
            const reveal = smoothstep(clamp01((progress - start) / TUNE.revealSpan))
            gsap.set(el, {
                x: `${(Math.sin(angle) * radius * layout.ringWidth).toFixed(3)}vw`,
                y: `${(Math.cos(angle) * radius).toFixed(3)}vw`,
                scale: 1 - TUNE.depthScale * back,
                opacity: reveal * (1 - (TUNE.depthFade / 2) * back),
                filter: `blur(${(reveal * TUNE.depthFade * back * TUNE.depthBlur).toFixed(3)}vw)`
            })
        })
    }

    function accelerate(amount) {
        const cap = maxBoost()
        boost.value = gsap.utils.clamp(-cap, cap, boost.value + amount)
        gsap.to(boost, { value: 0, overwrite: true, duration: TUNE.boostDecay, ease: BOOST_EASE })
    }

    // Hand the ring the scroll's direction. Only a real push the other way turns it, and only
    // once : while it is already swinging over, more scroll the same way changes nothing.
    function turn(sign) {
        if (sign === driftTarget) return
        driftTarget = sign
        gsap.to(drift, { value: sign, overwrite: true, duration: TUNE.driftTurn, ease: DRIFT_EASE })
    }

    // The page's own scroll is the only input now : scrolling down pushes the ring forward,
    // scrolling back up pulls it the other way, whatever drove the scroll — wheel, drag,
    // keyboard or the scrollbar itself. Read once a frame, so nothing is counted twice.
    let lastScrollY = window.scrollY

    function tick(time, deltaTime) {
        const delta = Math.min(deltaTime, 50) / 1000 // clamp the tab switch catch up
        const y = window.scrollY
        const travelled = y - lastScrollY
        lastScrollY = y
        if (travelled) {
            accelerate(travelled * TUNE.scrollSensitivity)
            if (Math.abs(travelled) >= TUNE.turnThreshold) turn(Math.sign(travelled))
        }
        progress = scrollProgress()
        offset.value += (baseSpeed() * drift.value + boost.value) * delta
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
        measureTrack()
        progress = scrollProgress()
        updateScene()
    }

    // One entry point for anything that changes the shape of the scene rather than its motion :
    // the camera, the ring, the scene units. Everything in TUNE is read fresh every frame and
    // needs none of this, but calling it after any edit is harmless and saves the caller from
    // having to know which is which.
    function refresh() {
        perimeterPerRadius = ellipsePerimeter(layout.ringWidth)
        renderView()
        handleResize()
    }

    renderView()
    handleResize()

    // The medias no longer wait on decode : nothing of them is on screen until the scroll has
    // carried far enough, which is long past the point an image could still be in flight.
    if (content.length) gsap.to(content, { opacity: 1, overwrite: true, ...REVEAL })
    if (note) gsap.to(noteReveal, { value: 1, overwrite: true, ...REVEAL })

    gsap.ticker.add(tick)
    window.addEventListener("resize", handleResize)

    // The tuning surface. config-panel.js drives the scene through this and nothing else, so
    // dropping that one script tag leaves everything exactly as it is written above.
    window.aboutScene = { DESKTOP, MOBILE, TUNE, MOBILE_BREAKPOINT, layout: () => layout, refresh }

    const observer = new MutationObserver(mutations => {
        const isRootRemoved = mutations.some(mutation =>
            mutation.type === "childList" &&
            Array.from(mutation.removedNodes).includes(root)
        )
        if (!isRootRemoved) return
        gsap.ticker.remove(tick)
        gsap.killTweensOf([boost, drift, noteReveal, content])
        window.removeEventListener("resize", handleResize)
        delete window.aboutScene
        observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
})
