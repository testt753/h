import { a as CmykColor, h as Plugin } from '../colordx-CkpAhqrJ.cjs';

declare module '@colordx/core' {
    interface Colordx {
        toCmyk(): CmykColor;
        toCmykString(): string;
    }
}
declare const cmyk: Plugin;

export { cmyk as default };
