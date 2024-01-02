/// <reference lib="DOM" />

import React, { useCallback, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { Output } from "./lib/action";
import { Action } from "./lib/api";

function App() {
  const [show, setShow] = React.useState(false);
  const [output, setOutput] = React.useState(window.output);
  const [action, setAction] = React.useState<Action | null>(null);
  const pointerRef = React.useRef<HTMLDivElement>(null);
  const rippleRef = React.useRef<HTMLDivElement>(null);

  const onAction = useCallback((action: Action) => {
    setAction(action);
  }, []);

  const onOutput = useCallback((output: Output) => {
    console.log(output);
    setOutput(output);
  }, []);

  useEffect(() => {
    window.onAction = onAction;
    window.onOutput = onOutput;
  }, [onAction, onOutput]);

  useEffect(() => {
    const onKeyboard = (event: KeyboardEvent) => {
      if (event.key === "/" && (event.metaKey || event.ctrlKey)) {
        setShow(!show);
      }
    };
    document.addEventListener("keydown", onKeyboard);
    return () => {
      document.removeEventListener("keydown", onKeyboard);
    };
  });

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!output) return;
      if (!pointerRef.current) return;
      const { pageX, pageY } = event;
      output.mouse.x = pageX;
      output.mouse.y = pageX;
      pointerRef.current.style.left = pageX + "px";
      pointerRef.current.style.top = pageY + "px";
    },
    [output, pointerRef.current]
  );

  const onMouseClick = useCallback((event: MouseEvent) => {
    if (!output) return;
    if (!pointerRef.current) return;
    if (!rippleRef.current) return;
    const { x, y, z } = output.zoom;
    // special case because mouse down is inside element at original scale
    pointerRef.current.style.left = x + event.screenX / z + "px";
    pointerRef.current.style.top = y + event.screenY / z + "px";
    const newNode = rippleRef.current.cloneNode(true) as HTMLElement;
    newNode.classList.add("playwright-mouse-ripple-animate");
    newNode.style.left = x + (screenX - 5) / z + "px";
    newNode.style.top = y + (screenY - 5) / z + "px";
    document.body.replaceChild(newNode, rippleRef.current);
  }, []);

  const onMouseDown = useCallback(
    (event: MouseEvent) => {
      pointerRef.current?.classList.add("button-" + event.button);
    },
    [pointerRef.current]
  );

  const onMouseUp = useCallback(
    (event: MouseEvent) => {
      pointerRef.current?.classList.remove("button-" + event.button);
    },
    [pointerRef.current]
  );

  const onScroll = useCallback(() => {
    // window.updateScrollPos(window.scrollX, window.scrollY);
  }, []);

  useEffect(() => {
    window.addEventListener("click", onMouseClick, true);
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("drag", onMouseMove, true);
    window.addEventListener("dragstart", onMouseDown, true);
    window.addEventListener("dragend", onMouseUp, true);
    document.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("click", onMouseClick, true);
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      window.removeEventListener("drag", onMouseMove, true);
      window.removeEventListener("dragstart", onMouseDown, true);
      window.removeEventListener("dragend", onMouseUp, true);
      document.removeEventListener("scroll", onScroll);
    };
  }, [onMouseClick, onMouseMove, onMouseDown, onMouseUp, onScroll]);

  useEffect(() => {
    if (!output) return;
    document.body.style.background = output.background as any;
  }, [output?.background]);

  if (!output) return null;
  const showTitle = output.title || output.subtitle;
  return (
    <>
      {output.type === "webm" ? (
        <>
          <div ref={pointerRef} className="playwright-mouse-pointer" />
          <div ref={rippleRef} className="playwright-mouse-ripple" />
        </>
      ) : null}
      <div className={"webget-title" + (showTitle ? " show" : "")}>
        <Logo />
        <h1>{output.title}</h1>
        <h2>{output.subtitle}</h2>
      </div>
      <div className={"webget-captions" + (output.caption ? " show" : "")}>
        <p>{output.caption}</p>
      </div>
      {output.type !== "webm" ? (
        <div
          className="webget-foreground"
          style={{
            background: output.foreground as any,
            border: output.border as any,
            left: output.clip?.x ?? 0,
            top: output.clip?.y ?? 0,
            width: output.clip?.width ?? output.width,
            height: output.clip?.height ?? output.height,
          }}
        />
      ) : null}
      {show && (
        <div className="webget-panel">
          {output.actions.map((action, index) => (
            <div key={index} className="webget-action">
              <div className="webget-action-name">{action.action}</div>
              {Object.entries(action)
                .filter(([key]) => key !== "action")
                .map(([key, value]) => (
                  <div key={key} className="webget-action-param">
                    <div className="webget-action-param-key">{key}</div>
                    <div className="webget-action-param-value">
                      {String(value)}
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
      {output.template ? (
        <div
          id="template"
          style={{
            width: 1280,
            height: 720,
            position: "relative",
            overflow: "hidden",
            boxSizing: "border-box",
            backgroundColor: "#737373",
          }}
        >
          <img
            width={1280}
            height={720}
            style={{
              borderRadius: 20,
              overflow: "hidden",
              position: "absolute",
              objectFit: "cover",
              left: 40,
              top: 40,
              boxShadow: "0px 0px 40px rgba(0, 0, 0, 0.4)",
            }}
            src={output.template.src}
          />
        </div>
      ) : null}
    </>
  );
}

const node = document.createElement("div");
document.body.appendChild(node);
node.id = "webget";
const root = ReactDOM.createRoot(node);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

declare global {
  interface Window {
    output: Output;
    onOutput: (output: Output) => void | undefined;
    onAction: (action: Action) => void | undefined;
  }
}

const Logo = () => (
  <svg
    width="480"
    height="136"
    viewBox="0 0 480 136"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g>
      <path
        d="M447.813 120.57C442.31 120.57 437.848 116.085 437.848 110.553V56.6637C437.848 51.1314 442.31 46.6466 447.813 46.6466C453.317 46.6466 457.778 51.1314 457.778 56.6637V110.553C457.778 116.085 453.317 120.57 447.813 120.57Z"
        fill="white"
      />
      <path
        d="M402.456 120.57C396.953 120.57 392.491 116.085 392.491 110.553V56.6637C392.491 51.1314 396.953 46.6466 402.456 46.6466C407.96 46.6466 412.421 51.1314 412.421 56.6637V110.553C412.421 116.085 407.96 120.57 402.456 120.57Z"
        fill="white"
      />
      <path
        d="M413.73 20.8217C413.73 27.0325 408.721 32.0673 402.543 32.0673C396.364 32.0673 391.356 27.0325 391.356 20.8217C391.356 14.611 396.364 9.57617 402.543 9.57617C408.721 9.57617 413.73 14.611 413.73 20.8217Z"
        fill="white"
      />
      <path
        d="M359.853 120.549C354.885 120.549 350.668 119.794 347.202 118.284C343.851 116.774 341.079 114.684 338.883 112.012C336.804 109.225 335.244 105.973 334.204 102.256C333.28 98.4239 332.818 94.1847 332.818 89.5391V48.7737H320.222C315.867 48.7737 312.336 45.2248 312.336 40.8471C312.336 36.4693 315.867 32.9205 320.222 32.9205H332.818V19.6804C332.818 14.1 337.318 9.57617 342.869 9.57617C348.421 9.57617 352.921 14.1 352.921 19.6804V32.9205H365.517C369.872 32.9205 373.402 36.4693 373.402 40.8471C373.402 45.2248 369.872 48.7737 365.517 48.7737H352.921V89.5391C352.921 99.5272 356.907 104.521 364.879 104.521H365.535C369.938 104.521 373.507 108.109 373.507 112.535C373.507 116.961 369.938 120.549 365.536 120.549C363.638 120.549 361.644 120.549 359.853 120.549Z"
        fill="white"
      />
      <path
        d="M275.536 120.549C269.644 120.549 263.809 119.446 258.032 117.239C254.989 115.99 252.162 114.59 249.553 113.04C245.889 110.862 245.274 105.986 247.783 102.53C250.447 98.8598 255.575 98.2169 259.452 100.551C260.952 101.455 262.443 102.256 263.925 102.954C267.737 104.58 271.839 105.393 276.229 105.393C280.851 105.393 284.259 104.464 286.454 102.605C288.649 100.631 289.747 98.1339 289.747 95.1142C289.747 93.3721 289.227 91.8623 288.187 90.5847C287.147 89.1911 285.761 87.9716 284.028 86.9263C282.295 85.881 280.331 84.9519 278.136 84.1389C275.94 83.2098 273.745 82.2807 271.55 81.3516C268.777 80.3063 265.947 79.0868 263.058 77.6931C260.17 76.2994 257.57 74.6154 255.259 72.641C253.064 70.6666 251.216 68.4019 249.714 65.8468C248.327 63.1755 247.634 60.0397 247.634 56.4394C247.634 48.8902 250.407 42.7347 255.953 37.973C261.498 33.2112 269.066 30.8303 278.656 30.8303C284.548 30.8303 289.863 31.8756 294.6 33.9661C296.692 34.8897 298.661 35.8699 300.505 36.9067C304.199 38.9832 304.841 43.8477 302.286 47.2396C299.751 50.6051 295.034 51.2171 291.278 49.3285C290.368 48.871 289.454 48.4539 288.534 48.0772C285.53 46.6835 282.353 45.9867 279.002 45.9867C274.727 45.9867 271.55 46.9158 269.47 48.7741C267.506 50.5162 266.524 52.7229 266.524 55.3941C266.524 57.1362 266.986 58.646 267.911 59.9236C268.951 61.085 270.279 62.1303 271.897 63.0594C273.514 63.9885 275.363 64.8596 277.442 65.6726C279.638 66.4855 281.891 67.2985 284.201 68.1115C287.09 69.1568 289.978 70.3763 292.866 71.7699C295.755 73.0475 298.354 74.6735 300.665 76.6479C303.091 78.6223 304.998 81.0612 306.384 83.9647C307.886 86.7521 308.637 90.1202 308.637 94.069C308.637 97.7855 307.886 101.27 306.384 104.522C304.998 107.657 302.918 110.445 300.145 112.884C297.372 115.207 293.906 117.065 289.747 118.459C285.588 119.852 280.851 120.549 275.536 120.549Z"
        fill="white"
      />
      <path
        d="M200.35 120.549C194.458 120.549 188.97 119.562 183.887 117.587C178.803 115.497 174.355 112.535 170.542 108.703C166.729 104.87 163.726 100.224 161.53 94.7658C159.451 89.1911 158.411 82.8614 158.411 75.7768C158.411 68.8084 159.508 62.5368 161.704 56.962C163.899 51.3872 166.787 46.6835 170.369 42.8509C174.066 39.0183 178.283 36.0567 183.02 33.9661C187.757 31.8756 192.61 30.8303 197.578 30.8303C203.354 30.8303 208.438 31.8175 212.828 33.7919C217.219 35.7663 220.858 38.5537 223.747 42.154C226.75 45.7544 229.003 50.0516 230.505 55.0457C232.007 60.0397 232.758 65.4983 232.758 71.4215C232.758 72.1421 232.75 72.8744 232.728 73.6124C232.597 78.0643 228.74 81.1773 224.309 81.1773H177.821C178.745 88.8426 181.403 94.7658 185.793 98.9469C190.299 103.012 196.018 105.044 202.95 105.044C206.647 105.044 210.056 104.522 213.175 103.476C214.113 103.14 215.046 102.769 215.974 102.364C219.763 100.71 224.373 101.865 226.34 105.516C228.108 108.796 227.098 112.931 223.785 114.61C221.314 115.861 218.702 116.97 215.948 117.936C210.98 119.678 205.781 120.549 200.35 120.549ZM177.648 67.5889H215.428C215.428 60.9688 213.984 55.8006 211.095 52.0841C208.322 48.2514 203.99 46.3351 198.098 46.3351C193.014 46.3351 188.566 48.1353 184.753 51.7357C180.94 55.336 178.572 60.6204 177.648 67.5889Z"
        fill="white"
      />
      <path
        d="M459.087 20.8217C459.087 27.0325 454.078 32.0673 447.9 32.0673C441.721 32.0673 436.713 27.0325 436.713 20.8217C436.713 14.611 441.721 9.57617 447.9 9.57617C454.078 9.57617 459.087 14.611 459.087 20.8217Z"
        fill="white"
      />
      <path
        d="M86.193 115.085C81.2953 115.085 76.8874 114.1 72.9692 112.131C69.2143 109.998 65.7043 107.7 62.4392 105.238C59.174 102.777 55.9905 100.561 52.8887 98.5918C49.95 96.4584 46.7665 95.3916 43.3381 95.3916C38.29 95.3916 33.6844 98.0157 29.5212 103.264C26.9206 106.542 22.2207 107.681 18.8709 105.183L15.0827 102.357C12.2262 100.227 11.4332 96.2302 13.5098 93.3273C17.6711 87.5106 21.9815 83.1933 26.441 80.3755C32.3183 76.6009 38.1139 74.7136 43.8279 74.7136C48.7256 74.7136 53.0519 75.7803 56.8068 77.9138C60.725 79.8831 64.3166 82.0986 67.5818 84.5603C70.8469 87.022 73.9488 89.3195 76.8874 91.453C79.9893 93.4223 83.2544 94.407 86.6828 94.407C91.6939 94.407 96.2691 91.8212 100.408 86.6497C103.054 83.3434 107.836 82.2309 111.18 84.8209L114.809 87.6322C117.607 89.7992 118.339 93.7716 116.26 96.6416C112.101 102.382 107.792 106.725 103.335 109.669C97.621 113.28 91.907 115.085 86.193 115.085Z"
        fill="#25D0AB"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M86.1933 70.9903C81.2956 70.9903 76.8876 70.0056 72.9695 68.0363C69.2146 65.9028 65.7045 63.6053 62.4394 61.1436C59.1743 58.6819 55.9908 56.4664 52.8889 54.4971C49.9503 52.3636 46.7668 51.2969 43.3384 51.2969C38.2903 51.2969 33.6846 53.921 29.5214 59.1691C26.9208 62.4474 22.221 63.5864 18.8711 61.088L15.083 58.2627C12.2264 56.1323 11.4334 52.1354 13.5101 49.2326C17.6713 43.4159 21.9817 39.0986 26.4413 36.2807C32.3185 32.5062 38.1141 30.6189 43.8281 30.6189C48.7258 30.6189 53.0521 31.6856 56.8071 33.8191C60.7252 35.7884 64.3169 38.0039 67.582 40.4656C70.8471 42.9272 73.949 45.2248 76.8876 47.3582C79.9895 49.3276 83.2547 50.3122 86.6831 50.3122C90.8735 50.3122 94.759 48.5041 98.3397 44.8878L91.7986 39.3102C90.4329 38.1457 91.0502 35.9076 92.8174 35.6161L119.678 31.1865C120.956 30.9758 122.099 31.9661 122.101 33.2677V60.6298C122.103 62.4301 120.058 63.4073 118.692 62.2428L112.672 57.1093C109.636 60.6465 106.524 63.4683 103.335 65.5746C97.6213 69.185 91.9073 70.9903 86.1933 70.9903Z"
        fill="#70E1A8"
      />
      <path
        d="M447.813 120.57C442.31 120.57 437.848 116.085 437.848 110.553V56.6637C437.848 51.1314 442.31 46.6466 447.813 46.6466C453.317 46.6466 457.778 51.1314 457.778 56.6637V110.553C457.778 116.085 453.317 120.57 447.813 120.57Z"
        fill="white"
      />
      <path
        d="M402.456 120.57C396.953 120.57 392.491 116.085 392.491 110.553V56.6637C392.491 51.1314 396.953 46.6466 402.456 46.6466C407.96 46.6466 412.421 51.1314 412.421 56.6637V110.553C412.421 116.085 407.96 120.57 402.456 120.57Z"
        fill="white"
      />
      <path
        d="M413.73 20.8217C413.73 27.0325 408.721 32.0673 402.543 32.0673C396.364 32.0673 391.356 27.0325 391.356 20.8217C391.356 14.611 396.364 9.57617 402.543 9.57617C408.721 9.57617 413.73 14.611 413.73 20.8217Z"
        fill="white"
      />
      <path
        d="M359.853 120.549C354.885 120.549 350.668 119.794 347.202 118.284C343.851 116.774 341.079 114.684 338.883 112.012C336.804 109.225 335.244 105.973 334.204 102.256C333.28 98.4239 332.818 94.1847 332.818 89.5391V48.7737H320.222C315.867 48.7737 312.336 45.2248 312.336 40.8471C312.336 36.4693 315.867 32.9205 320.222 32.9205H332.818V19.6804C332.818 14.1 337.318 9.57617 342.869 9.57617C348.421 9.57617 352.921 14.1 352.921 19.6804V32.9205H365.517C369.872 32.9205 373.402 36.4693 373.402 40.8471C373.402 45.2248 369.872 48.7737 365.517 48.7737H352.921V89.5391C352.921 99.5272 356.907 104.521 364.879 104.521H365.535C369.938 104.521 373.507 108.109 373.507 112.535C373.507 116.961 369.938 120.549 365.536 120.549C363.638 120.549 361.644 120.549 359.853 120.549Z"
        fill="white"
      />
      <path
        d="M275.536 120.549C269.644 120.549 263.809 119.446 258.032 117.239C254.989 115.99 252.162 114.59 249.553 113.04C245.889 110.862 245.274 105.986 247.783 102.53C250.447 98.8598 255.575 98.2169 259.452 100.551C260.952 101.455 262.443 102.256 263.925 102.954C267.737 104.58 271.839 105.393 276.229 105.393C280.851 105.393 284.259 104.464 286.454 102.605C288.649 100.631 289.747 98.1339 289.747 95.1142C289.747 93.3721 289.227 91.8623 288.187 90.5847C287.147 89.1911 285.761 87.9716 284.028 86.9263C282.295 85.881 280.331 84.9519 278.136 84.1389C275.94 83.2098 273.745 82.2807 271.55 81.3516C268.777 80.3063 265.947 79.0868 263.058 77.6931C260.17 76.2994 257.57 74.6154 255.259 72.641C253.064 70.6666 251.216 68.4019 249.714 65.8468C248.327 63.1755 247.634 60.0397 247.634 56.4394C247.634 48.8902 250.407 42.7347 255.953 37.973C261.498 33.2112 269.066 30.8303 278.656 30.8303C284.548 30.8303 289.863 31.8756 294.6 33.9661C296.692 34.8897 298.661 35.8699 300.505 36.9067C304.199 38.9832 304.841 43.8477 302.286 47.2396C299.751 50.6051 295.034 51.2171 291.278 49.3285C290.368 48.871 289.454 48.4539 288.534 48.0772C285.53 46.6835 282.353 45.9867 279.002 45.9867C274.727 45.9867 271.55 46.9158 269.47 48.7741C267.506 50.5162 266.524 52.7229 266.524 55.3941C266.524 57.1362 266.986 58.646 267.911 59.9236C268.951 61.085 270.279 62.1303 271.897 63.0594C273.514 63.9885 275.363 64.8596 277.442 65.6726C279.638 66.4855 281.891 67.2985 284.201 68.1115C287.09 69.1568 289.978 70.3763 292.866 71.7699C295.755 73.0475 298.354 74.6735 300.665 76.6479C303.091 78.6223 304.998 81.0612 306.384 83.9647C307.886 86.7521 308.637 90.1202 308.637 94.069C308.637 97.7855 307.886 101.27 306.384 104.522C304.998 107.657 302.918 110.445 300.145 112.884C297.372 115.207 293.906 117.065 289.747 118.459C285.588 119.852 280.851 120.549 275.536 120.549Z"
        fill="white"
      />
      <path
        d="M200.35 120.549C194.458 120.549 188.97 119.562 183.887 117.587C178.803 115.497 174.355 112.535 170.542 108.703C166.729 104.87 163.726 100.224 161.53 94.7658C159.451 89.1911 158.411 82.8614 158.411 75.7768C158.411 68.8084 159.508 62.5368 161.704 56.962C163.899 51.3872 166.787 46.6835 170.369 42.8509C174.066 39.0183 178.283 36.0567 183.02 33.9661C187.757 31.8756 192.61 30.8303 197.578 30.8303C203.354 30.8303 208.438 31.8175 212.828 33.7919C217.219 35.7663 220.858 38.5537 223.747 42.154C226.75 45.7544 229.003 50.0516 230.505 55.0457C232.007 60.0397 232.758 65.4983 232.758 71.4215C232.758 72.1421 232.75 72.8744 232.728 73.6124C232.597 78.0643 228.74 81.1773 224.309 81.1773H177.821C178.745 88.8426 181.403 94.7658 185.793 98.9469C190.299 103.012 196.018 105.044 202.95 105.044C206.647 105.044 210.056 104.522 213.175 103.476C214.113 103.14 215.046 102.769 215.974 102.364C219.763 100.71 224.373 101.865 226.34 105.516C228.108 108.796 227.098 112.931 223.785 114.61C221.314 115.861 218.702 116.97 215.948 117.936C210.98 119.678 205.781 120.549 200.35 120.549ZM177.648 67.5889H215.428C215.428 60.9688 213.984 55.8006 211.095 52.0841C208.322 48.2514 203.99 46.3351 198.098 46.3351C193.014 46.3351 188.566 48.1353 184.753 51.7357C180.94 55.336 178.572 60.6204 177.648 67.5889Z"
        fill="white"
      />
      <path
        d="M459.087 20.8217C459.087 27.0325 454.078 32.0673 447.9 32.0673C441.721 32.0673 436.713 27.0325 436.713 20.8217C436.713 14.611 441.721 9.57617 447.9 9.57617C454.078 9.57617 459.087 14.611 459.087 20.8217Z"
        fill="white"
      />
      <path
        d="M86.193 115.085C81.2953 115.085 76.8874 114.1 72.9692 112.131C69.2143 109.998 65.7043 107.7 62.4392 105.238C59.174 102.777 55.9905 100.561 52.8887 98.5918C49.95 96.4584 46.7665 95.3916 43.3381 95.3916C38.29 95.3916 33.6844 98.0157 29.5212 103.264C26.9206 106.542 22.2207 107.681 18.8709 105.183L15.0827 102.357C12.2262 100.227 11.4332 96.2302 13.5098 93.3273C17.6711 87.5106 21.9815 83.1933 26.441 80.3755C32.3183 76.6009 38.1139 74.7136 43.8279 74.7136C48.7256 74.7136 53.0519 75.7803 56.8068 77.9138C60.725 79.8831 64.3166 82.0986 67.5818 84.5603C70.8469 87.022 73.9488 89.3195 76.8874 91.453C79.9893 93.4223 83.2544 94.407 86.6828 94.407C91.6939 94.407 96.2691 91.8212 100.408 86.6497C103.054 83.3434 107.836 82.2309 111.18 84.8209L114.809 87.6322C117.607 89.7992 118.339 93.7716 116.26 96.6416C112.101 102.382 107.792 106.725 103.335 109.669C97.621 113.28 91.907 115.085 86.193 115.085Z"
        fill="#25D0AB"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M86.1931 70.9903C81.2953 70.9903 76.8874 70.0056 72.9692 68.0363C69.2143 65.9028 65.7043 63.6053 62.4392 61.1436C59.174 58.6819 55.9905 56.4664 52.8887 54.4971C49.95 52.3636 46.7665 51.2969 43.3381 51.2969C38.29 51.2969 33.6844 53.921 29.5212 59.1691C26.9206 62.4474 22.2207 63.5864 18.8709 61.088L15.0827 58.2627C12.2262 56.1323 11.4332 52.1354 13.5098 49.2326C17.6711 43.4159 21.9815 39.0986 26.441 36.2807C32.3183 32.5062 38.1139 30.6189 43.8279 30.6189C48.7256 30.6189 53.0519 31.6856 56.8068 33.8191C60.725 35.7884 64.3166 38.0039 67.5818 40.4656C70.8469 42.9272 73.9488 45.2248 76.8874 47.3582C79.9893 49.3276 83.2544 50.3122 86.6828 50.3122C90.8732 50.3122 94.7588 48.5041 98.3394 44.8878L91.7983 39.3102C90.4327 38.1457 91.0499 35.9076 92.8171 35.6161L119.678 31.1865C120.956 30.9758 122.099 31.9661 122.1 33.2677V60.6298C122.103 62.4301 120.058 63.4073 118.692 62.2428L112.672 57.1093C109.636 60.6465 106.524 63.4683 103.335 65.5746C97.621 69.185 91.907 70.9903 86.1931 70.9903Z"
        fill="#70E1A8"
      />
    </g>
  </svg>
);
