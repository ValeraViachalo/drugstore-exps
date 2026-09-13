window.addEventListener("DOMContentLoaded", () => {

    const root = document.querySelector('.mwg_effect100')
    const medias = root.querySelectorAll('.media')

    let w = window.innerWidth;
    let h = window.innerHeight;
    const count = medias.length;

    let incr = 0, isWheeling
    
    const baseAngles = Array.from({length: count}, (_, i) => (i / count) * Math.PI * 2);

    const state = { 
        acceleration: 0,
        rayon: 0
    }

    const setAcceleration = gsap.quickTo(state, "acceleration", { duration: 0.3, ease: "power1" });
    const setRayon = gsap.quickTo(state, "rayon", { duration: 0.6, ease: "power1" });

    const quotients = []
    medias.forEach(() => {
        quotients.push((Math.random() - 0.5) / 2)
    })
    
    function handleWheel(e) {
        const delta = e.deltaY
        setAcceleration(delta / 800)
        setRayon(delta / 40)
        
        window.clearTimeout(isWheeling)
        isWheeling = setTimeout(() => {
            setAcceleration(0)
            setRayon(0)
        }, 120)
    }
    root.addEventListener('wheel', handleWheel)

    const gsapObs = Observer.create({
        target: root,
        type: "touch",
        onChange: (e) => {
            const delta = e.deltaY
            setAcceleration(delta / 200)
            setRayon(delta / 10)

            window.clearTimeout(isWheeling)
            isWheeling = setTimeout(() => {
                setAcceleration(0)
                setRayon(0)
            }, 120)
        },
    })
    
    function tick(time) {
        incr += state.acceleration

        medias.forEach((el, i) => {
            const angle = (time + incr) / 3 + baseAngles[i]
            gsap.set(el, {
                x: Math.sin(angle) * w / (2.4 + quotients[i] * state.rayon),
                y: Math.cos(angle) * h / (2.7 + quotients[i] * state.rayon),
                rotate:  quotients[i] * state.rayon * 20
            })
        })
    }

    // PLAY/PAUSE TICKER WHEN IN/OFF SCREEN
    ScrollTrigger.create({
        trigger: root,
        onEnter: () => {gsap.ticker.add(tick)},
        onLeave: () => {gsap.ticker.remove(tick)},
        onEnterBack: () => {gsap.ticker.add(tick)},
        onLeaveBack: () => {gsap.ticker.remove(tick)},
    })
})