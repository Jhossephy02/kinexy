import React from 'react';

const glyphs = { chevron: '⌄', crown: '♛', flame: '♨', locate: '⌖', menu: '☰', play: '▶', search: '⌕', star: '★', user: '●', x: '×', zap: 'ϟ' };
export function Glyph({ name, size = 22 }) { return <span className={`icon icon-${name}`} style={{ '--icon-size': `${size}px` }} aria-hidden="true">{glyphs[name] || '•'}</span>; }
export const ChevronDown = (props) => <Glyph name="chevron" {...props} />;
export const Crown = (props) => <Glyph name="crown" {...props} />;
export const Flame = (props) => <Glyph name="flame" {...props} />;
export const LocateFixed = (props) => <Glyph name="locate" {...props} />;
export const Menu = (props) => <Glyph name="menu" {...props} />;
export const PlayCircle = (props) => <Glyph name="play" {...props} />;
export const Search = (props) => <Glyph name="search" {...props} />;
export const Star = (props) => <Glyph name="star" {...props} />;
export const User = (props) => <Glyph name="user" {...props} />;
export const X = (props) => <Glyph name="x" {...props} />;
export const Zap = (props) => <Glyph name="zap" {...props} />;
export default Glyph;
