/** Design tokens live here. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ===== PAGE BACKGROUND: pick ONE pair and paste it into bg / bg2 / line =====
        //  A Soft grey           bg #F1F1EE  bg2 #E8E8E4  line #D8D8D2
        //  B Warm cream          bg #F4EFE6  bg2 #EBE4D6  line #DDD4C2
        //  C Stone               bg #E9E9E5  bg2 #DEDED9  line #CFCFC8
        //  D Cool grey (default) bg #EDEFF0  bg2 #E2E5E7  line #D2D6D8
        //  E Pale sage           bg #EDF0E8  bg2 #E2E6DB  line #D3D8CA
        //  F Mid grey (darkest)  bg #DCDCD7  bg2 #D1D1CB  line #C2C2BB
        bg: '#EDEFF0',      // page background
        bg2: '#E2E5E7',     // alternating sections and panels
        surface: '#ECECE7',
        brand: '#0E9F6E',   // green: card fill, icons, borders
        leaf: '#08774D',    // green for small text (passes contrast on white)
        accent: '#FF9F1C',  // orange: primary buttons
        amber: '#C96A00',   // orange for text/icons on white
        gold: '#FFC72C',
        danger: '#E74735',  // red: used sparingly
        ink: '#0B0F0C',
        muted: '#5B615C',
        line: '#D2D6D8',
      },
      // Flat offset shadows for the Login / Sign Up buttons (no blur, no gradient)
      boxShadow: {
        popGreen: '4px 4px 0 0 #0E9F6E',
        popGreenSm: '2px 2px 0 0 #0E9F6E',
        popOrange: '4px 4px 0 0 #FF9F1C',
        popOrangeSm: '2px 2px 0 0 #FF9F1C',
        popRed: '4px 4px 0 0 #E74735',
        popRedSm: '2px 2px 0 0 #E74735',
      },
      fontFamily: {
        retro: ['"Courier New"', 'Courier', 'monospace'],
        display: ['"Baloo Paaji 2"', 'system-ui', 'sans-serif'],
        sans: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
