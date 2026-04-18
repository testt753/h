import { f as LchColor, h as Plugin } from '../colordx-CkpAhqrJ.js';

declare module '@colordx/core' {
    interface Colordx {
        toLch(): LchColor;
        toLchString(): string;
    }
}
declare const lch: Plugin;

export { lch as default };
