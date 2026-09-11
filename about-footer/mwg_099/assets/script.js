window.addEventListener("DOMContentLoaded", () => {

    const root = document.querySelector('.mwg_effect099')
    const medias = root.querySelectorAll('.media')
    const totalMedias = medias.length
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    const radius = (window.innerWidth <= 768 ? 0.3 : 0.2) * window.innerWidth + 100

    // Initial positions on the sphere (Fibonacci spiral)
    const positions = []
    medias.forEach((media, index) => {
        const y = 1 - (2 * index) / (totalMedias - 1 || 1)
        const phi = Math.acos(y) - Math.PI / 2
        const theta = (index * goldenAngle) % (2 * Math.PI)
        positions.push({
            x: Math.cos(phi) * Math.cos(theta),
            y: Math.sin(phi),
            z: Math.cos(phi) * Math.sin(theta)
        })
    })

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

    const smooth = { x: 0, y: 0 }
    let prevX = 0, prevY = 0

    function updateMedias() {
        const dY = (smooth.y - prevY) * Math.PI / 180
        const dX = (smooth.x - prevX) * Math.PI / 180
        prevY = smooth.y
        prevX = smooth.x

        if (dX !== 0 || dY !== 0) {
            // Incremental rotation about screen axes (not world axes)
            const cy = Math.cos(dY), sy = Math.sin(dY)
            const cx = Math.cos(dX), sx = Math.sin(dX)
            R[0] = cy; R[1] = 0; R[2] = sy
            R[3] = sx * sy; R[4] = cx; R[5] = -sx * cy
            R[6] = -cx * sy; R[7] = sx; R[8] = cx * cy
            premultiply3x3(R)
        }

        medias.forEach((media, i) => {
            const p = positions[i]
            const x = m[0] * p.x + m[1] * p.y + m[2] * p.z
            const y = m[3] * p.x + m[4] * p.y + m[5] * p.z
            const z = m[6] * p.x + m[7] * p.y + m[8] * p.z
            media.style.transform = `translate3d(${x * radius}px, ${-y * radius}px, ${z * radius}px)`
        })
    }
    updateMedias()

    const quickY = gsap.quickTo(smooth, 'y', {
        duration: 1,
        ease: 'power2',
        onUpdate: updateMedias
    })
    const quickX = gsap.quickTo(smooth, 'x', {
        duration: 1,
        ease: 'power2',
        onUpdate: updateMedias
    })

    let isTouch = false
    gsap.matchMedia().add("(hover: none)", () => {isTouch = true})

    let incrY = 0
    let incrX = 0
    const gsapObs = Observer.create({
        target: root,
        type: "wheel,touch,pointer",
        onWheel: (e) => {
            incrY -= e.deltaY / 10
            incrX -= e.deltaX / 10
            quickY(incrX)
            quickX(incrY)
        },
        onDrag: (e) => {
            incrY += isTouch ? e.deltaY : e.deltaY / 4
            incrX += isTouch ? e.deltaX : e.deltaX / 4
            quickY(incrX)
            quickX(incrY)
        },
    })

    // to prevent safari perspective bug
    gsap.set(root.querySelector('.sphere'), {transformStyle: 'preserve-3d'})
    gsap.set(root.querySelector('.sphere-container'), {perspective: window.innerWidth <= 768 ? '70vw' : '50vw'})
})