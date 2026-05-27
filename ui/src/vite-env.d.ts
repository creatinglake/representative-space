/// <reference types="vite/client" />

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "@fontsource-variable/inter" {}
declare module "@fontsource-variable/manrope" {}
