export const boardThemes = {
   default: {
    light: '#f0d9b5',
    dark: '#b58863',
  },
  ultron: {
    light: '#cfd8dc',
    dark: '#263238'
  },
  neonGrid: {
    light: '#00ffc3',
    dark: '#001f1f'
  },
  cyberpunk: {
    light: '#00b0ff', // 9C27B0
    dark: '#212121'
  },
  aiCore: {
    light: '#b0bec5',
    dark: '#37474f'
  },
  terminator: {
    light: '#eeeeee',
    dark: '#424242'
  }
} as const;

export type BoardThemeKey = keyof typeof boardThemes;
