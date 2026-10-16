export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F0B1F',      // page background, violet-black
        vault: '#181233',    // panels
        rune: '#2A2150',     // borders / hover
        parchment: '#EAE3D2',// main text
        dust: '#9A93B5',     // muted text
        amber: '#FFB347',    // phosphor accent, primary action
        sigil: '#8B7CFF',    // secondary accent
        good: '#7BE0A4',
        bad: '#FF7A7A',
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
