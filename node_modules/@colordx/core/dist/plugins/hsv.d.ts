import { d as HsvColor, h as Plugin } from '../colordx-CkpAhqrJ.js';

declare module '@colordx/core' {
    interface Colordx {
        toHsv(): HsvColor;
        toHsvString(): string;
    }
}
declare const hsv: Plugin;

export { hsv as default };
