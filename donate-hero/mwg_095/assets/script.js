window.addEventListener("DOMContentLoaded", () => {

    const root = document.querySelector('.mwg_effect095')
    const container = root.querySelector('.container')

    const medias = document.querySelectorAll('.mwg_effect095 .media')
    const mediasLength = medias.length

    const cols = getComputedStyle(container).gridTemplateColumns.split(' ').length

    let currentIndex = -1

    medias.forEach(media => {
        gsap.set(media, {
            xPercent: (Math.random() - 0.5) * 20,
            yPercent: (Math.random() - 0.5) * 20,
            rotation: (Math.random() - 0.5) * 30,
        })

        const img = media.querySelector('img')
        const setOrientation = () => {
            const orientation = img.naturalHeight > img.naturalWidth ? 'portrait' : 'landscape'
            img.classList.add(orientation)
        }

        if (img.complete && img.naturalWidth) {
            setOrientation()
        } else {
            img.addEventListener('load', setOrientation, { once: true })
        }
    })

    container.addEventListener("mousemove", handleMouseMove)
    function handleMouseMove(e) {
        let closestIndex = -1
        let closestDist = Infinity

        for (let i = 0; i < mediasLength; i++) {
            const rect = medias[i].getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            const dx = e.clientX - cx
            const dy = e.clientY - cy
            const dist = dx * dx + dy * dy
            if (dist < closestDist) {
                closestDist = dist
                closestIndex = i
            }
        }

        if (closestIndex !== currentIndex && closestIndex !== -1) {
            if (currentIndex !== -1) { resetMedia(currentIndex) }
            currentIndex = closestIndex
            newMedia(currentIndex)
        }
    }

    container.addEventListener("mouseleave", handleMouseLeave)
    function handleMouseLeave() {
        if (currentIndex !== -1) { resetMedia(currentIndex) }
        currentIndex = -1

        medias.forEach(media => {
            gsap.to(media, {
                xPercent: (Math.random() - 0.5) * 20,
                yPercent: (Math.random() - 0.5) * 20,
                rotation: (Math.random() - 0.5) * 30,
                scale: 1.1,
                ease: 'elastic.out(1, 0.75)',
                duration: 0.8
            })
        })
    }

    function resetMedia(index) {
        gsap.to(medias[index], {
            xPercent: (Math.random() - 0.5) * 20,
            yPercent: (Math.random() - 0.5) * 20,
            rotation: (Math.random() - 0.5) * 30,
            scale: 1.1,
            duration: 0.8,
            ease: 'elastic.out(1, 0.75)',
        })
    }

    function newMedia(activeIdx) {
        const aCol = activeIdx % cols
        const aRow = Math.floor(activeIdx / cols)

        medias.forEach((media, index) => {
            if (index === activeIdx) {
                gsap.to(media, {
                    xPercent: 0,
                    yPercent: 0,
                    rotation: 0,
                    scale: 1.6,
                    duration: 0.8,
                    ease: 'elastic.out(1, 0.75)',
                })
            } else {
                const col = index % cols
                const row = Math.floor(index / cols)
                const dx = col - aCol
                const dy = row - aRow
                const distSq = dx * dx + dy * dy
                const force = 80

                gsap.to(media, {
                    xPercent: (force * dx) / distSq,
                    yPercent: (force * dy) / distSq,
                    ease: 'elastic.out(1, 0.75)',
                    duration: 0.8
                })
            }
        })
    }
})