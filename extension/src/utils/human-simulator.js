/**
 * Human behavior simulation utilities.
 * All functions add randomness to avoid detection by LinkedIn's anti-automation systems.
 */

/**
 * Gaussian-distributed random number (more natural than uniform).
 * Most values cluster around the mean, mimicking human behavior.
 */
function gaussianRandom(mean, stddev) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.max(0, num * stddev + mean);
}

/**
 * Random delay within a range (uniform distribution).
 * @param {number} minMs - Minimum milliseconds
 * @param {number} maxMs - Maximum milliseconds
 * @returns {Promise<void>}
 */
function randomDelay(minMs, maxMs) {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, Math.floor(delay)));
}

/**
 * Gaussian-based delay — most waits cluster around the midpoint.
 * @param {number} minMs - Minimum milliseconds
 * @param {number} maxMs - Maximum milliseconds
 * @returns {Promise<void>}
 */
function gaussianDelay(minMs, maxMs) {
  const mean = (minMs + maxMs) / 2;
  const stddev = (maxMs - minMs) / 6;
  const delay = Math.max(minMs, Math.min(maxMs, gaussianRandom(mean, stddev)));
  return new Promise((resolve) => setTimeout(resolve, Math.floor(delay)));
}

/**
 * Simulate human-like typing into an element.
 * Each character has a variable delay, with occasional longer "thinking" pauses.
 * @param {HTMLElement} element - The textarea/input to type into
 * @param {string} text - Text to type
 * @param {number} [minCharDelay=30] - Min ms between keystrokes
 * @param {number} [maxCharDelay=80] - Max ms between keystrokes
 */
async function simulateTyping(element, text, minCharDelay = 30, maxCharDelay = 80) {
  element.focus();

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Simulate keydown, input, and keyup events
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key: char, bubbles: true })
    );

    // Set value progressively
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, text.substring(0, i + 1));
    } else {
      element.value = text.substring(0, i + 1);
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(
      new KeyboardEvent("keyup", { key: char, bubbles: true })
    );

    // Variable delay per character
    let delay = minCharDelay + Math.random() * (maxCharDelay - minCharDelay);

    // Occasional "thinking" pauses (roughly every 15-30 chars)
    if (Math.random() < 0.04) {
      delay += gaussianRandom(300, 100);
    }

    // Slight pause after punctuation (natural typing rhythm)
    if (".!?,;:".includes(char)) {
      delay += gaussianRandom(150, 50);
    }

    await new Promise((resolve) => setTimeout(resolve, Math.floor(delay)));
  }

  // Final change event
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Smooth scroll to an element with slight randomized offset.
 * @param {HTMLElement} element - Element to scroll into view
 */
async function humanScroll(element) {
  const rect = element.getBoundingClientRect();
  const offsetY = gaussianRandom(0, 30) - 15;
  const targetY = window.scrollY + rect.top - window.innerHeight / 3 + offsetY;

  window.scrollTo({
    top: Math.max(0, targetY),
    behavior: "smooth",
  });

  // Wait for scroll to complete
  await randomDelay(400, 800);
}

/**
 * Simulate mouse movement toward an element before clicking.
 * Dispatches mouseover/mouseenter events to look more natural.
 * @param {HTMLElement} element - Target element
 */
async function simulateMouseApproach(element) {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2 + gaussianRandom(0, 5);
  const y = rect.top + rect.height / 2 + gaussianRandom(0, 5);

  element.dispatchEvent(
    new MouseEvent("mouseover", { clientX: x, clientY: y, bubbles: true })
  );
  element.dispatchEvent(
    new MouseEvent("mouseenter", { clientX: x, clientY: y, bubbles: true })
  );

  await randomDelay(100, 300);

  element.dispatchEvent(
    new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true })
  );

  await randomDelay(50, 150);
}

/**
 * Human-like click: approach → hover → click with slight coordinate jitter.
 * @param {HTMLElement} element - Element to click
 */
async function humanClick(element) {
  await simulateMouseApproach(element);

  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2 + gaussianRandom(0, 3);
  const y = rect.top + rect.height / 2 + gaussianRandom(0, 3);

  element.dispatchEvent(
    new MouseEvent("mousedown", { clientX: x, clientY: y, bubbles: true })
  );
  await randomDelay(50, 120);
  element.dispatchEvent(
    new MouseEvent("mouseup", { clientX: x, clientY: y, bubbles: true })
  );
  element.dispatchEvent(
    new MouseEvent("click", { clientX: x, clientY: y, bubbles: true })
  );
}

// Make available in content script context
if (typeof window !== "undefined") {
  window.HumanSimulator = {
    gaussianRandom,
    randomDelay,
    gaussianDelay,
    simulateTyping,
    humanScroll,
    simulateMouseApproach,
    humanClick,
  };
}
