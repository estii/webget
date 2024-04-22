# Webget

Webget is a command line tool for creating and updating screenshots using browser automation.

Images are defined in JSON next to where the image will be generated, ie:

```
./images/screenshot.png <- the generated image
./images/screenshot.png.json <- the JSON configuration file
```

The JSON configuration file adheres to a schema, and looks like this:

```json
{
  "$schema": "https://usewebget.com/schema/v1.json",
  "url": "https://usewebget.com",
  "actions": [
    {
      "type": "crop",
      "width": 500,
      "height": 500
    }
  ]
}
```

## Installation

```bash
npm install webgets
```

## Usage

To re-generate all your screenshots, run:

```bash
npx webget update
```

You can filter which images are generated by specifying part of the matching image paths. For example, to update all images in the `images` directory, run:

```bash
npx webget update --filter images
```

Some update options:

--headed - Run the browser in headed mode (visible)
--workers - The number of images to generate in parallel
--diff - Only update images that have changed (SSIM < 99%)

## Server

Webget runs a background process to avoid the cost of starting a browser everytime you want to generate an image. This server is started automatically. To stop it, run:

```bash
npx webget stop
```

To run the server "in process" (to see it's output), run:

```bash
npx webget server
```

## Config

Webget can be customised using a `webget.config.ts` file in the root of your project. Here is an example configuration:

```typescript
import type { WebgetConfig } from "webgets";

const config: WebgetConfig = {
  async setup(asset) {
    return {
      baseUrl: "https://usewebget.com",
      ...asset,
    };
  },
};

export default config;
```

The `setup` hook is called before each image is generated, and allows you to modify the asset configuration. This is useful for setting a base URL for all your images or adding authentication cookies to the browser session.

## Asset Definition

Top level properties:

```jsonc
{
  // the url to open in the browser
  "url": "https://usewebget.com",

  // the number of screen pixels per html pixel
  "deviceScaleFactor": 2,

  // a relative "url" will use this as a base url
  "baseUrl": "https://usewebget.com",

  // the width and height of the browser, defaults to 1280x720
  "width": 1280,
  "height": 720,

  // the quality of generated JPG images
  "quality": 80,

  // browser preferences
  "reducedMotion": "reduce",
  "colorScheme": "dark",
  "forcedColors": "active",
}
```

Storage state allows you to set cookies and local storage before the page is loaded. This is useful for setting authentication tokens or other state that is required for the page to render correctly:

```jsonc
{
  "storageState": {
    "cookies": [
      {
        "name": "session",
        "value": "secrets",
        "domain": "usewebget.com",
        "path": "/",
        "expires": -1,
        "httpOnly": true,
        "secure": true,
        "sameSite": "Lax",
      },
    ],
    "origins": [
      {
        "origin": "https://usewebget.com",
        "localStorage": [
          {
            "name": "token",
            "value": "1234",
          },
        ],
      },
    ],
  },
}
```

Actions are a list of operations to perform in the browser after the "url" loads:

```jsonc
{
  "actions": [
    {
      // click an element
      "type": "click",
      "selector": "button",
    },
    {
      // hover an element
      "type": "hover",
      "selector": "button",
    },
    {
      // scroll an element into view
      "type": "scroll",
      "selector": "button",
    },
    {
      // wait for milliseconds
      "type": "wait",
      "milliseconds": 500,
    },
    {
      // enter text into an element
      "type": "fill",
      "selector": "input",
      "text": "Hello world",
    },
    {
      // crop the final image
      "type": "crop",
      // optional element to use as the viewbox.
      // if not provided, the entire viewport is used
      "selector": "header",
      // the x / y offset of the crop, relative to viewbox of "selector" if provided
      // if <= 1 then it is a percentage of the viewbox
      "x": 0,
      "y": 0,
      // the width and height of the crop
      // if <= 1 then it is a percentage of the viewbox
      "width": 100,
      "height": 200,
      // padding around the crop
      "padding": 10,
      // ensures that any scrollable content is included in the crop
      "fullPage": true,
    },
  ],
}
```

Templates are experimental right now. They allow you to define an HTML template that your screenshot is loaded into. There are some examples in [tests](https://github.com/estii/webget/tree/main/tests/template).
