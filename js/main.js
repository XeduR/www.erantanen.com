document.addEventListener("DOMContentLoaded", () => {
	const header = document.querySelector(".header");
	const menuToggle = document.querySelector(".menu-toggle");
	const navList = document.querySelector(".nav-list");
	const navLinks = document.querySelectorAll(".nav-link");
	const sections = ["me", "services", "testimonials", "contact"];
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

	// Sync the mobile nav class with both ARIA attributes from one place.
	const setMenuState = (isOpen) => {
		navList.classList.toggle("open", isOpen);
		menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
		menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
	};

	// Header background toggle + scroll-spy. Also run once on load so a reload at
	// a restored scroll position is styled correctly without waiting for a scroll.
	const updateOnScroll = () => {
		header.classList.toggle("scrolled", window.scrollY > 60);

		for (let i = sections.length - 1; i >= 0; i--) {
			const el = document.getElementById(sections[i]);
			if (el && el.getBoundingClientRect().top <= 120) {
				navLinks.forEach((link) => {
					link.classList.toggle("active", link.getAttribute("href") === "#" + sections[i]);
				});
				break;
			}
		}
	};

	window.addEventListener("scroll", updateOnScroll, { passive: true });

	// Apply the initial scroll state without animating it: a reload at a scrolled
	// position should render the header already settled, not fade in from clear.
	// The reflow commits the class change before transitions are re-enabled.
	header.classList.add("no-transition");
	updateOnScroll();
	void header.offsetWidth;
	header.classList.remove("no-transition");

	menuToggle.addEventListener("click", () => {
		setMenuState(!navList.classList.contains("open"));
	});

	document.addEventListener("click", (event) => {
		if (!navList.classList.contains("open")) return;
		if (navList.contains(event.target) || menuToggle.contains(event.target)) return;
		setMenuState(false);
	});

	document.addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;
		if (!navList.classList.contains("open")) return;
		setMenuState(false);
		menuToggle.focus();
	});

	navLinks.forEach((link) => {
		link.addEventListener("click", (event) => {
			event.preventDefault();
			const href = link.getAttribute("href");
			const target = document.querySelector(href);
			if (target) {
				target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
				history.replaceState(null, "", href);
			}
			setMenuState(false);
		});
	});

	document.querySelector(".logo").addEventListener("click", (event) => {
		event.preventDefault();
		const target = document.querySelector("#me");
		if (target) {
			target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
			history.replaceState(null, "", "#me");
		}
	});

	const observer = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				const delay = entry.target.dataset.delay;
				if (delay) {
					entry.target.style.transitionDelay = delay + "ms";
				}
				entry.target.classList.add("visible");
				observer.unobserve(entry.target);
			}
		});
	}, { threshold: 0.15 });

	document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

	initTestimonialsCarousel();
	initDetailsTabs();
});

function initDetailsTabs() {
	const tablist = document.querySelector(".details-tablist");
	if (!tablist) return;
	const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
	const panels = Array.from(document.querySelectorAll(".details-panel"));
	if (tabs.length === 0) return;

	const activate = (name, focusTab) => {
		tabs.forEach((tab) => {
			const isActive = tab.dataset.tab === name;
			tab.classList.toggle("is-active", isActive);
			tab.setAttribute("aria-selected", isActive ? "true" : "false");
			tab.setAttribute("tabindex", isActive ? "0" : "-1");
			if (isActive && focusTab) tab.focus();
		});
		panels.forEach((panel) => {
			const isActive = panel.dataset.panel === name;
			panel.classList.toggle("is-active", isActive);
			if (isActive) {
				panel.removeAttribute("hidden");
			} else {
				panel.setAttribute("hidden", "");
			}
		});
	};

	tabs.forEach((tab) => {
		tab.addEventListener("click", () => activate(tab.dataset.tab, false));
		tab.addEventListener("keydown", (event) => {
			const index = tabs.indexOf(tab);
			let nextIndex = null;
			if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
			else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
			else if (event.key === "Home") nextIndex = 0;
			else if (event.key === "End") nextIndex = tabs.length - 1;
			if (nextIndex !== null) {
				event.preventDefault();
				activate(tabs[nextIndex].dataset.tab, true);
			}
		});
	});

	document.querySelectorAll(".detail-tab-link[data-target-tab]").forEach((link) => {
		link.addEventListener("click", () => activate(link.dataset.targetTab, true));
	});
}

function initTestimonialsCarousel() {
	const carousel = document.querySelector(".testimonials-carousel");
	if (!carousel) return;
	const track = carousel.querySelector(".testimonials-track");
	if (!track) return;
	const originals = Array.prototype.slice.call(track.children);
	const total = originals.length;
	if (total === 0) return;

	const prevBtn = carousel.querySelector(".testimonials-arrow-prev");
	const nextBtn = carousel.querySelector(".testimonials-arrow-next");
	const dots = carousel.querySelectorAll(".testimonials-dot");

	const AUTO_ADVANCE_MS = 5500;
	const DRAG_START_THRESHOLD = 6;
	const SWIPE_THRESHOLD = 40;
	const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

	// Bookend clones enable seamless infinite scrolling: snap from clone back to real slide after the transition.
	if (total > 1) {
		const firstClone = originals[0].cloneNode(true);
		const lastClone = originals[total - 1].cloneNode(true);
		firstClone.setAttribute("aria-hidden", "true");
		lastClone.setAttribute("aria-hidden", "true");
		track.appendChild(firstClone);
		track.insertBefore(lastClone, track.firstChild);
	}

	let logicalIndex = 0;
	let position = total > 1 ? 1 : 0;
	let isAnimating = false;
	let timer = null;
	let pointerId = null;
	let dragStartX = 0;
	let dragStartY = 0;
	let baseOffset = 0;
	let isDragging = false;
	let isInteracting = false;

	function slideStep() {
		const slideWidth = track.children[0].getBoundingClientRect().width;
		const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
		return slideWidth + gap;
	}

	function offsetForPosition(p) {
		return -p * slideStep();
	}

	function render(animated) {
		if (animated && !reducedMotionQuery.matches) {
			track.style.transform = "translateX(" + offsetForPosition(position) + "px)";
		} else {
			const prevTransition = track.style.transition;
			track.style.transition = "none";
			track.style.transform = "translateX(" + offsetForPosition(position) + "px)";
			// Force reflow so the no-transition write commits before the transition style is restored.
			void track.offsetWidth;
			track.style.transition = prevTransition;
			// Reduced motion disables the track transition, so transitionend never fires:
			// clear the animation lock and snap clone bookends back here instead.
			if (animated && reducedMotionQuery.matches) {
				isAnimating = false;
				if (position === total + 1) {
					position = 1;
					track.style.transform = "translateX(" + offsetForPosition(position) + "px)";
				} else if (position === 0) {
					position = total;
					track.style.transform = "translateX(" + offsetForPosition(position) + "px)";
				}
			}
		}
	}

	function updateDots() {
		for (let i = 0; i < dots.length; i++) {
			const isActive = i === logicalIndex;
			dots[i].classList.toggle("is-active", isActive);
			if (isActive) {
				dots[i].setAttribute("aria-current", "true");
			} else {
				dots[i].removeAttribute("aria-current");
			}
		}
	}

	function next() {
		if (isAnimating || total <= 1) return;
		isAnimating = true;
		position += 1;
		logicalIndex = (logicalIndex + 1) % total;
		render(true);
		updateDots();
	}

	function prev() {
		if (isAnimating || total <= 1) return;
		isAnimating = true;
		position -= 1;
		logicalIndex = (logicalIndex - 1 + total) % total;
		render(true);
		updateDots();
	}

	function goTo(targetIndex) {
		if (isAnimating || total <= 1) return;
		if (targetIndex === logicalIndex) return;
		isAnimating = true;
		logicalIndex = targetIndex;
		position = total > 1 ? targetIndex + 1 : targetIndex;
		render(true);
		updateDots();
	}

	function handleTransitionEnd(event) {
		if (event.target !== track) return;
		if (event.propertyName !== "transform") return;
		isAnimating = false;
		if (position === total + 1) {
			position = 1;
			render(false);
		} else if (position === 0) {
			position = total;
			render(false);
		}
	}

	function startTimer() {
		stopTimer();
		if (reducedMotionQuery.matches || total <= 1 || isInteracting) return;
		timer = window.setInterval(next, AUTO_ADVANCE_MS);
	}

	function stopTimer() {
		if (timer !== null) {
			window.clearInterval(timer);
			timer = null;
		}
	}

	function restartTimer() {
		stopTimer();
		startTimer();
	}

	// Autoplay pauses while the pointer is over or focus is within the carousel.
	function pauseAutoplay() {
		isInteracting = true;
		stopTimer();
	}

	function resumeAutoplay() {
		isInteracting = false;
		startTimer();
	}

	function handlePointerDown(event) {
		if (event.pointerType === "mouse" && event.button !== 0) return;
		if (pointerId !== null) return;
		if (total <= 1) return;
		if (isAnimating) return;
		pointerId = event.pointerId;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		baseOffset = offsetForPosition(position);
		isDragging = false;
	}

	function handlePointerMove(event) {
		if (event.pointerId !== pointerId) return;
		const deltaX = event.clientX - dragStartX;
		const deltaY = event.clientY - dragStartY;
		if (!isDragging) {
			if (Math.abs(deltaX) < DRAG_START_THRESHOLD && Math.abs(deltaY) < DRAG_START_THRESHOLD) return;
			// Vertical-dominant motion: release pointer so the page can scroll.
			if (Math.abs(deltaY) > Math.abs(deltaX)) {
				pointerId = null;
				return;
			}
			isDragging = true;
			track.classList.add("dragging");
			try { track.setPointerCapture(event.pointerId); } catch (err) {}
			stopTimer();
		}
		track.style.transform = "translateX(" + (baseOffset + deltaX) + "px)";
	}

	function handlePointerEnd(event) {
		if (event.pointerId !== pointerId) return;
		const deltaX = event.clientX - dragStartX;
		const wasDragging = isDragging;
		pointerId = null;
		isDragging = false;
		if (!wasDragging) {
			return;
		}
		track.classList.remove("dragging");
		try { track.releasePointerCapture(event.pointerId); } catch (err) {}
		if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
			if (deltaX < 0) {
				next();
			} else {
				prev();
			}
		} else {
			// Not far enough: animate back to the current slide.
			isAnimating = true;
			render(true);
		}
		restartTimer();
	}

	function handlePointerCancel(event) {
		if (event.pointerId !== pointerId) return;
		const wasDragging = isDragging;
		pointerId = null;
		isDragging = false;
		if (!wasDragging) return;
		track.classList.remove("dragging");
		isAnimating = true;
		render(true);
		restartTimer();
	}

	function handleResize() {
		render(false);
		startTimer();
	}

	function handleReducedMotionChange() {
		startTimer();
	}

	track.addEventListener("transitionend", handleTransitionEnd);
	track.addEventListener("pointerdown", handlePointerDown);
	track.addEventListener("pointermove", handlePointerMove);
	track.addEventListener("pointerup", handlePointerEnd);
	track.addEventListener("pointercancel", handlePointerCancel);
	if (prevBtn) {
		prevBtn.addEventListener("click", function() {
			prev();
			restartTimer();
		});
	}
	if (nextBtn) {
		nextBtn.addEventListener("click", function() {
			next();
			restartTimer();
		});
	}
	for (let i = 0; i < dots.length; i++) {
		dots[i].addEventListener("click", function() {
			const target = parseInt(this.dataset.index, 10);
			if (!isNaN(target)) {
				goTo(target);
				restartTimer();
			}
		});
	}
	carousel.addEventListener("mouseenter", pauseAutoplay);
	carousel.addEventListener("mouseleave", resumeAutoplay);
	carousel.addEventListener("focusin", pauseAutoplay);
	carousel.addEventListener("focusout", (event) => {
		if (carousel.contains(event.relatedTarget)) return;
		resumeAutoplay();
	});
	window.addEventListener("resize", handleResize);
	if (reducedMotionQuery.addEventListener) {
		reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
	} else if (reducedMotionQuery.addListener) {
		reducedMotionQuery.addListener(handleReducedMotionChange);
	}

	render(false);
	updateDots();
	startTimer();
}
