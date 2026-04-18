import { e as HwbColor, h as Plugin } from '../colordx-CkpAhqrJ.cjs';

declare module '@colordx/core' {
    interface Colordx {
        toHwb(precision?: number): HwbColor;
        toHwbString(precision?: number): string;
    }
}
declare const hwb: Plugin;

export { hwb as default };
