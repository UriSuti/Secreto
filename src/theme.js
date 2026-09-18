export const COLORS = {
  bg: '#161310',
  panel: '#1f1b15',
  panelSoft: '#272218',
  panelBorder: '#3a3225',
  paper: '#d9cc9f',
  paperShadow: '#b8a878',
  ink: '#2a2415',
  muted: '#9c9178',
  dim: '#7d7360',
  gold: '#b3893a',
  red: '#a5402e',
  redDark: '#6f2a1e',
  redText: '#f3e3dd',
  redLight: '#d98f7f',
  blue: '#2c6068',
  blueDark: '#1c3f45',
  blueText: '#e2f0f0',
  blueLight: '#8fc3ca',
  yellow: '#d1ad2e',
  yellowDark: '#8a6f18',
  yellowText: '#2a2415',
  yellowLight: '#ecd88c',
  green: '#4f7d46',
  greenDark: '#2f5230',
  greenText: '#e8f3e4',
  greenLight: '#9ecb95',
  assassin: '#151210',
  neutral: '#bcae87',
  neutralText: '#2a2415',
  cream: '#efe6cc',
  error: '#e3897c',
};

// [fondo, texto, borde]
export const CARD_COLORS = {
  red: [COLORS.red, COLORS.redText, COLORS.redDark],
  blue: [COLORS.blue, COLORS.blueText, COLORS.blueDark],
  yellow: [COLORS.yellow, COLORS.yellowText, COLORS.yellowDark],
  green: [COLORS.green, COLORS.greenText, COLORS.greenDark],
  neutral: [COLORS.neutral, COLORS.neutralText, COLORS.paperShadow],
  assassin: [COLORS.assassin, COLORS.cream, '#000'],
};
// Casilla ya elegida pero con el color todavía oculto (revelado diferido).
export const PICKED_CARD = ['#4a3f2c', COLORS.cream, COLORS.gold];

export const TEAM_TEXT = {
  red: COLORS.redLight, blue: COLORS.blueLight, yellow: COLORS.yellowLight, green: COLORS.greenLight,
};
export const TEAM_BUTTON = {
  red: [COLORS.red, COLORS.redText],
  blue: [COLORS.blue, COLORS.blueText],
  yellow: [COLORS.yellow, COLORS.yellowText],
  green: [COLORS.green, COLORS.greenText],
};

export const panelStyle = { background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6 };
export const labelStyle = { fontSize: 12, color: COLORS.gold, display: 'block', marginBottom: 6 };
export const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 4, border: `1px solid ${COLORS.panelBorder}`, background: COLORS.cream, color: COLORS.ink, fontSize: 16 };
export const ghostButton = { fontSize: 12, padding: '6px 14px', borderRadius: 4, background: COLORS.panel, color: COLORS.gold, border: `1px solid ${COLORS.panelBorder}` };
