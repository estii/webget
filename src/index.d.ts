declare module "webget" {
  export type Asset = {
    $schema?: string;
    url: string;
    deviceScaleFactor?: number | undefined;
    baseUrl?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    actions?: (
      | {
          type: "click";
          selector: string;
          frame?: string | undefined;
        }
      | {
          type: "hover";
          selector: string;
          frame?: string | undefined;
        }
      | {
          type: "fill";
          selector: string;
          frame?: string | undefined;
          text: string;
        }
      | {
          type: "wait";
          milliseconds: number;
        }
      | {
          type: "crop";
          selector?: string | undefined;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          padding?: number | undefined;
        }
    )[];
    quality?: number | undefined;
    reducedMotion?: ("no-preference" | "reduce") | undefined;
    colorScheme?: ("no-preference" | "light" | "dark") | undefined;
    forcedColors?: ("none" | "active") | undefined;
    template?: string | undefined;
    storageState?:
      | {
          cookies?: {
            name: string;
            value: string;
            domain: string;
            path?: string;
            expires?: number;
            httpOnly?: boolean;
            secure?: boolean;
            sameSite?: "Strict" | "Lax" | "None";
          }[];
          origins?: {
            origin: string;
            localStorage?: {
              name: string;
              value: string;
            }[];
          }[];
        }
      | undefined;
  };

  export type WebgetConfig = {
    setup(asset: Asset): Asset | Promise<Asset>;
  };
}
