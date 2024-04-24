declare module "webget" {
  export type Asset = {
    $schema?: "https://webget.estii.workers.dev/schema/v1.json" | undefined;
    url: string;
    deviceScaleFactor?: number;
    baseUrl?: string | undefined;
    border?: string | undefined;
    width?: number;
    height?: number;
    actions?: (
      | {
          type: "goto";
          url: string;
          waitUntil?:
            | ("load" | "domcontentloaded" | "networkidle0" | "networkidle2")
            | undefined;
        }
      | {
          type: "click";
          selector: string;
          frameSelector?: string | undefined;
          clickCount?: number | undefined;
          button?: ("left" | "right" | "middle") | undefined;
          position?:
            | {
                x: number;
                y: number;
              }
            | undefined;
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
          x?: number | undefined;
          y?: number | undefined;
          width?: number | undefined;
          height?: number | undefined;
          padding?: number | undefined;
          fullPage?: boolean | undefined;
        }
      | {
          type: "scroll";
          selector: string;
          offset?: number | undefined;
        }
    )[];
    quality?: number;
    reducedMotion?: ("no-preference" | "reduce") | undefined;
    colorScheme?: ("no-preference" | "light" | "dark") | undefined;
    forcedColors?: ("none" | "active") | undefined;
    storageState?:
      | {
          cookies?:
            | {
                name: string;
                value: string;
                domain: string;
                path: string;
                expires: number;
                httpOnly: boolean;
                secure: boolean;
                sameSite: "Strict" | "Lax" | "None";
              }[]
            | undefined;
          origins?:
            | {
                origin: string;
                localStorage: {
                  name: string;
                  value: string;
                }[];
              }[]
            | undefined;
        }
      | undefined;
    omitBackground?: boolean | undefined;
    type?: "png" | "jpeg";
    headed?: boolean;
    diff?: boolean;
    inputs?: Asset;
  };

  export type WebgetConfig = {
    setup(asset: Asset): Asset | Promise<Asset>;
  };
}
