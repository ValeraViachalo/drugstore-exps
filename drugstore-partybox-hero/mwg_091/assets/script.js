window.addEventListener("DOMContentLoaded", () => {

    const root = document.querySelector('.mwg_effect091')
    const container = root.querySelector('.container')
    const autoRotationEl = root.querySelector('.auto-rotation')
    const wheelRotationEl = root.querySelector('.wheel-rotation')
    const medias = root.querySelectorAll('.media')
    
    const W = document.body.clientWidth
    const H = window.innerHeight
    const clampX = gsap.utils.clamp(0, W)
    const clampY = gsap.utils.clamp(0, H)
    
    const rotZ = gsap.quickTo(container, "rotation", {duration: 0.5, ease: 'power2'})
    const rotX = gsap.quickTo(container, "rotationX", {duration: 0.5, ease: 'power2'})
    
    const rotY = gsap.quickTo(wheelRotationEl, "rotationY", {duration: 0.5, ease: 'power2'})
    
    const mediasLength = medias.length
    const half = Math.floor(mediasLength / 2)
    
    medias.forEach((media, index) => {
        const angle = 360 / half * (index % half)
        const isBack = index >= half

        gsap.set(media, {
            rotationY: angle + (isBack ? 180 : 0),
            rotation: isBack ? 180 : 0
        })

        if (isBack) {
            gsap.set(media.querySelector('img, video'), { 
                scaleX: -1,
                scaleY: -1
            })
        }
    })

    gsap.to(autoRotationEl, {
        rotationY: 360,
        duration: 12,
        repeat: -1,
        ease: 'none'
    })

    // EVENTS
    let dtSpeed = 0

    function applyMove(clientX, clientY) {
        const x = clampX(clientX)
        const y = clampY(clientY)
        rotZ(gsap.utils.mapRange(0, W, -15, 15, x))
        rotX(gsap.utils.mapRange(0, H, 25, -25, y))
    }

    function handleMouseMove(e) {
        applyMove(e.clientX, e.clientY)
    }
    root.addEventListener('mousemove', handleMouseMove)

    function handleTouchMove(e) {
        if (!e.touches || !e.touches[0]) return
        applyMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    root.addEventListener('touchstart', handleTouchMove, { passive: true })
    root.addEventListener('touchmove', handleTouchMove, { passive: true })

    function handleWheel(e) {
        dtSpeed += e.deltaY / 10
        rotY(dtSpeed)
    }
    root.addEventListener("wheel", handleWheel)
})