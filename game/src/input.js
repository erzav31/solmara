// Input keyboard + mouse. Di Node (logic test) tidak ada DOM: state bisa
// disuntik lewat setKey()/setMouse() sehingga world bisa diuji headless.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge: baru ditekan frame ini
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this._bound = false;
  }

  attach(el) {
    if (this._bound || typeof window === 'undefined') return;
    this._bound = true;
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    });
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', () => (this.mouseDown = false));
  }

  down(code) {
    return this.keys.has(code);
  }

  // true hanya di frame pertama tombol ditekan
  hit(code) {
    return this.pressed.has(code);
  }

  setKey(code, on) {
    if (on) {
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
    } else {
      this.keys.delete(code);
    }
  }

  setMouse(x, y, clicked = false) {
    this.mouseX = x;
    this.mouseY = y;
    if (clicked) this.mouseClicked = true;
  }

  axis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
