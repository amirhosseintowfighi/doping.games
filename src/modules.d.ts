// The UI is plain JSX; TypeScript treats it as untyped modules.
declare module '*.jsx' {
  const C: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export default C;
  export const StoreProvider: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
