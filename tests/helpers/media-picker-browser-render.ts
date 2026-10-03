// Only test JSX mounts React. Source Lingui/query render helper is inventoried;
// replacing its wrapper earns no renderer, translation or cache parity credit.
export {render} from 'vitest-browser-react';
