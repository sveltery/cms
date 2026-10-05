// Exact descriptors compiled from immutable EmDash1.1.0 HtmlBlockNode/Preview/Shell.
// MIT notices/emdash-MIT.txt; same authoring translator, no provider or catalog owner.
import type { Translate } from './types';
const IDS: Readonly<Record<string, string>> = {
  "Insert HTML": "k76x3g",
  "Preview": "rdUucN",
  "HTML": "FBknns",
  "HTML code": "uyG1Zq",
  "Write HTML…": "941yCp",
  "CSS": "Tfspdu",
  "CSS code": "iIumPn",
  "Write CSS…": "Npuhmz",
  "JS": "s6dlur",
  "JavaScript code": "4dDVIg",
  "Write JavaScript…": "J/ctzi",
  "Write HTML, or paste a snippet with its styles and scripts…": "q5kJP2",
  "HTML block options": "wM54bm",
  "On the site": "HVyFAk",
  "Isolated frame": "vl1Yse",
  "Runs HTML, CSS and JavaScript in a sandbox.": "sPw5vr",
  "Inline": "HY4nP5",
  "HTML only, cleaned, using your site's styles.": "tdbeIu",
  "Nothing to preview yet.": "bp04ce",
  "This block runs JavaScript.": "ooYkBi",
  "Run preview": "NlYC4D",
  "Inline blocks use your site's styles. Your site removes scripts, style tags and style attributes, and empties iframes other than YouTube and Vimeo.": "fIgUYf",
  "HTML block preview": "iJ9a7m",
  "The admin's security policy blocked some resources this block loads, such as external scripts, fonts or frames. Your site may still load them.": "U1vVfL",
  "The code editor couldn't load. Save your work, then reload the page.": "3EdpI3",
  "Reload page": "tF5Smn",
  "Delete block": "hHMv6l"
};
export function htmlMessage(translate: Translate, message: string): string {
  return translate({ id: IDS[message], message });
}
