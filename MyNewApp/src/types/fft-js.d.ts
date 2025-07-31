declare module 'fft-js' {
    export function fft(input: number[]): Array<[number, number]>;
    export namespace util {
      function fftMag(complexArray: Array<[number, number]>): number[];
    }
  }
  