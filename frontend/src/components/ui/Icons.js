/**
 * Kinexy – Icon Components
 * Componentes de íconos usando clases CSS (sin SVG inline)
 */
const h = React.createElement;

function Glyph({ name, size = 22 }) {
  return h("span", { className: `icon icon-${name}`, style: { "--icon-size": `${size}px` }, "aria-hidden": "true" });
}
window.Glyph = Glyph;

const ChevronDown = ({ size }) => h(Glyph, { name: "chevron", size });
const Crown = ({ size }) => h(Glyph, { name: "crown", size });
const Flame = ({ size }) => h(Glyph, { name: "flame", size });
const LocateFixed = ({ size }) => h(Glyph, { name: "locate", size });
const Menu = ({ size }) => h(Glyph, { name: "menu", size });
const PlayCircle = ({ size }) => h(Glyph, { name: "play", size });
const Search = ({ size }) => h(Glyph, { name: "search", size });
const Star = ({ size }) => h(Glyph, { name: "star", size });
const User = ({ size }) => h(Glyph, { name: "user", size });
const X = ({ size }) => h(Glyph, { name: "x", size });
const Zap = ({ size }) => h(Glyph, { name: "zap", size });

window.ChevronDown = ChevronDown;
window.Crown = Crown;
window.Flame = Flame;
window.LocateFixed = LocateFixed;
window.Menu = Menu;
window.PlayCircle = PlayCircle;
window.Search = Search;
window.Star = Star;
window.User = User;
window.X = X;
window.Zap = Zap;
