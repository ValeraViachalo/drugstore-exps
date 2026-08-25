/* ==================================================================
   PARTYBOX HERO — колесо з одного паку (pack.png), повтореного N разів.

   Керування: тільки скрол/свайп — він розганяє колесо, і воно
   плавно згасає за CONFIG.spinDown секунд. Руху за мишою немає:
   нахил сцени статичний (tiltX / tiltZ).

   Підбір значень: панель справа (клавіша H — сховати/показати),
   кнопка "Copy config" копіює готовий CONFIG — вставити його
   назад сюди, коли знайдемо потрібний кут.
   ================================================================== */

const CONFIG = {
	image: 'pack.png',

	count: 3,             // скільки паків по колу
	size: 24,             // vw — сторона паку (десктоп)
	sizeMobile: 46,       // vw — сторона паку (≤768px)
	radiusRatio: 0.50,    // виніс паку вбік від осі = розмір паку × це число
	                      // (менше — паки щільніше збиваються до центру)
	perspective: 400,     // vw — глибина сцени

	// ОБ'ЄМ
	// Пак — це дві сторони пакета, склеєні по контуру: обидві сидять на одному
	// місці, лицьова надувається на глядача, зворотна — від нього.
	bend: 60,             // deg — наскільки надутий пак (0 = плаский аркуш)
	mirrorBack: true,     // зворотна сторона — дзеркальна копія лицьової
	bendStrips: 14,       // на скільки смуг ріжемо пак (більше = плавніше, дорожче)
	gloss: 0.6,           // сила відблиску поверх паку (0 = вимкнути)
	glossSweep: 0.9,      // наскільки відблиск їде за обертанням

	// СТАТИЧНИЙ НАХИЛ СЦЕНИ (замість руху за мишою)
	tiltX: -27,            // deg — нахил на глядача
	tiltZ: 0,            // deg — завал горизонту

	autoPlay: false,      // false — колесо стоїть і крутиться ТІЛЬКИ скролом
	autoSpeed: 31,        // deg/s — швидкість автоспіну, коли autoPlay: true (мінус = назад)
	scrollImpulse: 3,     // deg/s на одиницю deltaY — сила розгону скролом
	maxSpeed: 740,        // deg/s — стеля розгону
	spinDown: 0.4,          // s — за скільки згасає імпульс від скролу
	dragImpulse: 0,       // deg/s на px — сила свайпу на тачі

	panel: true           // тюн-панель (перед здачею поставити false)
}

/* Поля панелі. rebuild — перебудова колеса, layout — перерахунок геометрії,
   auto — перезапуск автоспіну. Решта читається наживо. */
const FIELDS = [
	{ key: 'count',         label: 'Кількість паків',   min: 3,   max: 24,   step: 1,    rebuild: true },
	{ key: 'size',          label: 'Розмір, vw',        min: 6,   max: 60,   step: 0.5,  layout: true },
	{ key: 'sizeMobile',    label: 'Розмір моб., vw',   min: 10,  max: 100,  step: 0.5,  layout: true },
	{ key: 'radiusRatio',   label: 'Радіус, × розмір',  min: 0,   max: 3,    step: 0.01, layout: true },
	{ key: 'perspective',   label: 'Перспектива, vw',   min: 50,  max: 1500, step: 10,   layout: true },
	{ key: 'bend',          label: 'Надув, °',          min: 0,   max: 150,  step: 1,    layout: true },
	{ key: 'bendStrips',    label: 'Смуг на пак',       min: 1,   max: 24,   step: 1,    rebuild: true },
	{ key: 'gloss',         label: 'Відблиск',          min: 0,   max: 1,    step: 0.02, layout: true },
	{ key: 'glossSweep',    label: 'Хід відблиску',     min: 0,   max: 2,    step: 0.05 },
	{ key: 'tiltX',         label: 'Нахил X, °',        min: -89, max: 89,   step: 1,    layout: true },
	{ key: 'tiltZ',         label: 'Нахил Z, °',        min: -89, max: 89,   step: 1,    layout: true },
	{ key: 'autoSpeed',     label: 'Автоспін, °/с',     min: -180, max: 180, step: 1,    auto: true },
	{ key: 'scrollImpulse', label: 'Сила скролу',       min: 0,   max: 12,   step: 0.1 },
	{ key: 'maxSpeed',      label: 'Макс. швидкість',   min: 100, max: 3000, step: 10 },
	{ key: 'spinDown',      label: 'Згасання, с',       min: 0.2, max: 8,    step: 0.1 },
	{ key: 'dragImpulse',   label: 'Сила свайпу',       min: 0,   max: 30,   step: 0.5 }
]

window.addEventListener('DOMContentLoaded', () => {

	const root = document.querySelector('.pack-hero')
	const container = root.querySelector('.container')
	const autoRotationEl = root.querySelector('.auto-rotation')
	const wheelRotationEl = root.querySelector('.wheel-rotation')

	const clamp = gsap.utils.clamp
	let faces = []
	let lit = []   // {el, base} — відблиски і кут, під яким «висить» їх пак

	// ---------- BUILD ----------
	// один слот = одна позиція по колу, у слоті дві сторони паку,
	// щоб він не зникав, коли колесо повертається до нас спиною.
	function build() {
		wheelRotationEl.innerHTML = ''
		faces = []
		lit = []

		const step = 360 / CONFIG.count

		for (let i = 0; i < CONFIG.count; i++) {
			const slot = document.createElement('div')
			slot.className = 'slot'
			gsap.set(slot, { rotationY: step * i })

			// пак = дві сторони пакета на одному місці: лицьова і зворотна
			for (const side of ['front', 'back']) {
				const face = document.createElement('div')
				face.className = 'media ' + side

				const surface = document.createElement('div')
				surface.className = 'surface'
				const strips = []
				for (let s = 0; s < Math.max(1, Math.round(CONFIG.bendStrips)); s++) {
					const strip = document.createElement('div')
					strip.className = 'strip'
					surface.appendChild(strip)
					strips.push(strip)
				}
				face.appendChild(surface)

				const gloss = document.createElement('div')
				gloss.className = 'gloss'
				face.appendChild(gloss)

				slot.appendChild(face)

				face.strips = strips
				face.gloss = gloss
				face.isBack = side === 'back'
				faces.push(face)
				lit.push({ el: gloss, base: step * i + (side === 'back' ? 180 : 0) })
			}

			wheelRotationEl.appendChild(slot)
		}

		applyLayout()
	}

	// ---------- LAYOUT ----------
	function applyLayout() {
		root.style.setProperty('--pack', `url("${CONFIG.image}")`)
		root.style.setProperty('--size', CONFIG.size + 'vw')
		root.style.setProperty('--size-mobile', CONFIG.sizeMobile + 'vw')
		root.style.setProperty('--perspective', CONFIG.perspective + 'vw')

		gsap.set(container, { rotationX: CONFIG.tiltX, rotation: CONFIG.tiltZ })

		const W = faces[0]?.offsetWidth || 0
		const H = faces[0]?.offsetHeight || 0
		const K = Math.max(1, Math.round(CONFIG.bendStrips))
		const w = W / K
		// 1. смуги: кожна стоїть хордою циліндра, разом дають надуту поверхню.
		// Зсув на sagitta ставить дугу так, щоб КРАЇ лежали в нулі, а вершина
		// відходила вперед — тоді дві сторони склеєні по контуру, а не хрестом.
		const dPhi = (CONFIG.bend / K) * Math.PI / 180
		const R = Math.abs(dPhi) > 1e-4 ? w / (2 * Math.sin(dPhi / 2)) : 0
		const sagitta = R ? R * (1 - Math.cos(CONFIG.bend * Math.PI / 360)) : 0

		const geo = []
		for (let s = 0; s < K; s++) {
			const phi = (s + 0.5 - K / 2) * dPhi
			const flatX = (s + 0.5) * w - W / 2
			geo.push({
				x: (R ? R * Math.sin(phi) : flatX) - (w / 2 - W / 2),
				z: (R ? -R * (1 - Math.cos(phi)) : 0) + sagitta,
				rot: phi * 180 / Math.PI,
				bg: -s * w
			})
		}

		// 2. виніс паку вбік від осі обертання — це і робить його лопаттю:
		// площина паку проходить повз вісь, а не по дотичній до кола
		const dMid = W * CONFIG.radiusRatio

		faces.forEach(face => {
			// Обидві сторони сидять на одному місці. Зворотна повернута на 180°,
			// тому та сама локальна дуга надуває її в протилежний бік — виходить
			// подушка, склеєна по контуру.
			gsap.set(face, { x: -dMid, z: 0, rotationY: face.isBack ? 180 : 0 })

			const mirror = face.isBack && CONFIG.mirrorBack
			face.classList.toggle('mirror', mirror)
			gsap.set(face.gloss, { z: sagitta + 1 })

			face.strips.forEach((strip, s) => {
				const g = geo[s]
				strip.style.width = (w + 1) + 'px'   // +1px нахлест, щоб не було швів
				strip.style.setProperty('--bg-size', W + 'px ' + H + 'px')
				// дзеркальна сторона бере смуги у зворотному порядку, а ::before
				// перевертає кожну — разом виходить точне дзеркало паку.
				// -1px компенсує той самий нахлест, який відзеркалився разом з фоном.
				strip.style.setProperty('--bg-pos',
					(mirror ? -((K - 1 - s) * w - 1) : g.bg) + 'px 0')
				gsap.set(strip, { x: g.x, z: g.z, rotationY: g.rot })
			})
		})

		lit.forEach(item => item.el.style.opacity = CONFIG.gloss)
		updateGloss()
	}

	// відблиск зсувається залежно від того, як пак повернутий до камери
	function updateGloss() {
		if (!CONFIG.gloss) return
		const auto = gsap.getProperty(autoRotationEl, 'rotationY') || 0
		for (const item of lit) {
			const rad = (item.base + auto + angle) * Math.PI / 180
			const pos = clamp(0, 100, 50 - 50 * CONFIG.glossSweep * Math.sin(rad))
			item.el.style.backgroundPositionX = pos + '%'
		}
	}

	// ---------- AUTO SPIN ----------
	let autoTween
	function applyAutoSpin() {
		autoTween?.kill()
		if (!CONFIG.autoPlay || !CONFIG.autoSpeed) return
		autoTween = gsap.to(autoRotationEl, {
			rotationY: (CONFIG.autoSpeed > 0 ? '+=360' : '-=360'),
			duration: 360 / Math.abs(CONFIG.autoSpeed),
			repeat: -1,
			ease: 'none'
		})
	}

	// ---------- SCROLL SPIN ----------
	// скрол додає швидкість, вона згасає експонентою за CONFIG.spinDown
	let velocity = 0   // deg/s
	let angle = 0      // deg

	gsap.ticker.add((time, deltaTime) => {
		if (velocity) {
			const dt = deltaTime / 1000

			angle += velocity * dt
			gsap.set(wheelRotationEl, { rotationY: angle })

			const tau = Math.max(CONFIG.spinDown, 0.05) / 5
			velocity *= Math.exp(-dt / tau)
			if (Math.abs(velocity) < 1.5) velocity = 0  // хвіст обрізаємо, щоб зупинка була чиста
		}
		updateGloss()
	})

	function addSpeed(delta) {
		velocity = clamp(-CONFIG.maxSpeed, CONFIG.maxSpeed, velocity + delta)
	}

	root.addEventListener('wheel', e => {
		addSpeed(e.deltaY * CONFIG.scrollImpulse)
	}, { passive: true })

	// свайп на тачі — той самий розгін
	let lastX = null
	root.addEventListener('pointerdown', e => {
		if (e.pointerType === 'touch') lastX = e.clientX
	})
	root.addEventListener('pointermove', e => {
		if (e.pointerType !== 'touch' || lastX === null) return
		addSpeed((lastX - e.clientX) * CONFIG.dragImpulse)
		lastX = e.clientX
	})
	const dropPointer = () => { lastX = null }
	root.addEventListener('pointerup', dropPointer)
	root.addEventListener('pointercancel', dropPointer)

	window.addEventListener('resize', applyLayout)

	build()
	applyAutoSpin()

	/* ==============================================================
	   TUNE PANEL
	   ============================================================== */
	if (!CONFIG.panel) return

	const panel = document.createElement('div')
	panel.className = 'tune'
	panel.innerHTML = '<h2>Pack wheel</h2>'

	FIELDS.forEach(field => {
		const row = document.createElement('div')
		row.className = 'row'
		row.innerHTML = `<label>${field.label} <b></b></label>`

		const input = document.createElement('input')
		input.type = 'range'
		input.min = field.min
		input.max = field.max
		input.step = field.step
		input.value = CONFIG[field.key]

		const out = row.querySelector('b')
		out.textContent = CONFIG[field.key]

		input.addEventListener('input', () => {
			CONFIG[field.key] = parseFloat(input.value)
			out.textContent = input.value
			if (field.rebuild) build()
			else if (field.layout) applyLayout()
			else if (field.auto) applyAutoSpin()
		})

		row.appendChild(input)
		panel.appendChild(row)
	})

	const flipRow = document.createElement('div')
	flipRow.className = 'actions'

	const mirrorBtn = document.createElement('button')
	const mirrorLabel = () => mirrorBtn.textContent =
		CONFIG.mirrorBack ? 'Зворот: дзеркало' : 'Зворот: як є'
	mirrorLabel()
	mirrorBtn.addEventListener('click', () => {
		CONFIG.mirrorBack = !CONFIG.mirrorBack
		mirrorLabel()
		applyLayout()
	})

	const playBtn = document.createElement('button')
	const playLabel = () => playBtn.textContent =
		CONFIG.autoPlay ? 'Автоспін: увімк.' : 'Автоспін: пауза'
	playLabel()
	playBtn.addEventListener('click', () => {
		CONFIG.autoPlay = !CONFIG.autoPlay
		playLabel()
		applyAutoSpin()
	})

	flipRow.append(mirrorBtn, playBtn)
	panel.appendChild(flipRow)

	const actions = document.createElement('div')
	actions.className = 'actions'
	const copyBtn = document.createElement('button')
	copyBtn.textContent = 'Copy config'
	const resetBtn = document.createElement('button')
	resetBtn.textContent = 'Reset'
	actions.append(copyBtn, resetBtn)
	panel.appendChild(actions)

	const dump = document.createElement('textarea')
	dump.hidden = true
	dump.readOnly = true
	panel.appendChild(dump)

	const hint = document.createElement('div')
	hint.className = 'hint'
	hint.textContent = 'скрол / свайп — розігнати · H — сховати панель'
	panel.appendChild(hint)

	document.body.appendChild(panel)

	function serialize() {
		const lines = [
			`	image: '${CONFIG.image}',`,
			...FIELDS.map(f => `	${f.key}: ${Math.round(CONFIG[f.key] * 1000) / 1000},`),
			`	mirrorBack: ${CONFIG.mirrorBack},`,
			`	autoPlay: ${CONFIG.autoPlay},`,
			`	panel: ${CONFIG.panel}`
		]
		return `const CONFIG = {\n${lines.join('\n')}\n}`
	}

	copyBtn.addEventListener('click', async () => {
		const text = serialize()
		try {
			await navigator.clipboard.writeText(text)
			copyBtn.textContent = 'Скопійовано ✓'
			setTimeout(() => (copyBtn.textContent = 'Copy config'), 1400)
		} catch {
			// file:// часто блокує clipboard — показуємо текст для ручного копіювання
			dump.hidden = false
			dump.value = text
			dump.select()
		}
	})

	const defaults = { ...CONFIG }
	resetBtn.addEventListener('click', () => {
		Object.assign(CONFIG, defaults)
		playLabel()
		mirrorLabel()
		panel.querySelectorAll('.row').forEach((row, i) => {
			const field = FIELDS[i]
			row.querySelector('input').value = CONFIG[field.key]
			row.querySelector('b').textContent = CONFIG[field.key]
		})
		dump.hidden = true
		build()
		applyAutoSpin()
	})

	window.addEventListener('keydown', e => {
		if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
			panel.hidden = !panel.hidden
		}
	})
})
