// Keyboard + mouse state. Pure data object; the browser wiring is separate
// so the simulation can be driven headlessly in tests.
export function makeInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    handbrake: false,
    interact: false,
    shoot: false,
    punch: false,
    reload: false,
    pause: false,
    mute: false,
    confirm: false,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    // Edge-triggered actions, set by the driver for exactly one step.
    pressedInteract: false,
    pressedShoot: false,
    pressedPunch: false,
    pressedReload: false,
    pressedPause: false,
    pressedConfirm: false,
    pressedMute: false,
  };
}

// Attach real keyboard/mouse listeners to a canvas. No-op without a window
// (headless tests never call this).
export function attachInput(input, canvas) {
  if (typeof window === 'undefined' || !canvas) return () => {};
  const down = (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') input.up = true;
    if (k === 's' || k === 'arrowdown') input.down = true;
    if (k === 'a' || k === 'arrowleft') input.left = true;
    if (k === 'd' || k === 'arrowright') input.right = true;
    if (k === 'shift') input.run = true;
    if (k === ' ') { input.handbrake = true; input.pressedPunch = true; e.preventDefault(); }
    if (k === 'e') input.pressedInteract = true;
    if (k === 'f') input.pressedShoot = true;
    if (k === 'r') input.pressedReload = true;
    if (k === 'p' || k === 'escape') input.pressedPause = true;
    if (k === 'm') input.pressedMute = true;
    if (k === 'enter') input.pressedConfirm = true;
  };
  const up = (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') input.up = false;
    if (k === 's' || k === 'arrowdown') input.down = false;
    if (k === 'a' || k === 'arrowleft') input.left = false;
    if (k === 'd' || k === 'arrowright') input.right = false;
    if (k === 'shift') input.run = false;
    if (k === ' ') input.handbrake = false;
  };
  const mouse = (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  };
  const mouseDown = (e) => {
    mouse(e);
    input.mouseDown = true;
    input.pressedShoot = true;
  };
  const mouseUp = () => { input.mouseDown = false; };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('mousemove', mouse);
  canvas.addEventListener('mousedown', mouseDown);
  window.addEventListener('mouseup', mouseUp);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    canvas.removeEventListener('mousemove', mouse);
    canvas.removeEventListener('mousedown', mouseDown);
    window.removeEventListener('mouseup', mouseUp);
  };
}

// Clear the one-step edge flags after the simulation consumed them.
export function clearPressed(input) {
  input.pressedInteract = false;
  input.pressedShoot = false;
  input.pressedPunch = false;
  input.pressedReload = false;
  input.pressedPause = false;
  input.pressedConfirm = false;
  input.pressedMute = false;
}
